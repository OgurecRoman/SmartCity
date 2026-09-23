import { config } from '../config.js';
import { prisma } from '../lib/db.js';
import { errors } from '../lib/errors.js';
import { events } from '../lib/events.js';
import { CATEGORY_LABELS, STATUS_LABELS, addDays } from '../lib/labels.js';
import { Prisma } from '@prisma/client';
import type { RequestCategory, RequestPriority, RequestStatus } from '@prisma/client';
import { AUTHOR_DELETABLE_STATUSES, canTransition, votesRequiredFor } from './rules.js';
import { countResidents } from './users.js';

export const requestInclude = {
  author: { select: { id: true, firstName: true, lastName: true, apartment: true, maxUserId: true } },
  house: { select: { id: true, address: true, chatId: true, votePercent: true } },
  delegatedTo: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.RequestInclude;

export const requestDetailedInclude = {
  ...requestInclude,
  votes: {
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, user: { select: { id: true, firstName: true, lastName: true, apartment: true } } },
  },
  statusHistory: {
    orderBy: { changedAt: 'asc' },
    select: {
      id: true,
      oldStatus: true,
      newStatus: true,
      comment: true,
      changedAt: true,
      changedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  },
} satisfies Prisma.RequestInclude;

export type RequestWithRelations = Prisma.RequestGetPayload<{ include: typeof requestInclude }>;
export type RequestDetailed = Prisma.RequestGetPayload<{ include: typeof requestDetailedInclude }>;

export async function computeVotesRequired(houseId: number): Promise<number> {
  const house = await prisma.house.findUnique({ where: { id: houseId }, select: { votePercent: true } });
  const residents = await countResidents(houseId);
  return votesRequiredFor(residents, house?.votePercent ?? config.votes.defaultPercent);
}

function makeTitle(category: RequestCategory, description: string): string {
  const short = description.replace(/\s+/g, ' ').trim();
  const cut = short.length > 60 ? `${short.slice(0, 57).trimEnd()}…` : short;
  return `${CATEGORY_LABELS[category]}: ${cut}`;
}

export interface CreateRequestInput {
  authorId: number;
  category: RequestCategory;
  description: string;
  title?: string | null;
  priority?: RequestPriority;
  deadline?: Date | null;
}

export async function createRequest(input: CreateRequestInput): Promise<RequestWithRelations> {
  const author = await prisma.user.findUnique({ where: { id: input.authorId } });
  if (!author) throw errors.notFound('Пользователь не найден');
  if (!author.houseId || !author.onboardedAt) throw errors.badRequest('Сначала дождитесь подтверждения от председателя ТСЖ или УК', 'onboarding_required');

  const description = input.description.trim();
  if (description.length < 5) throw errors.badRequest('Опишите проблему подробнее (минимум 5 символов)');
  if (description.length > 2000) throw errors.badRequest('Описание слишком длинное (максимум 2000 символов)');

  const priority: RequestPriority = input.priority ?? 'NORMAL';
  const emergency = priority === 'EMERGENCY';
  const votesRequired = emergency ? 0 : await computeVotesRequired(author.houseId);
  const deadline = emergency ? null : (input.deadline ?? addDays(new Date(), config.votes.defaultDeadlineDays));
  if (deadline && deadline.getTime() < Date.now()) throw errors.badRequest('Срок сбора подписей уже прошёл');
  const status: RequestStatus = emergency ? 'SUBMITTED' : 'VOTING';
  const title = input.title?.trim() || makeTitle(input.category, description);

  const request = await prisma.request.create({
    data: {
      houseId: author.houseId,
      authorId: author.id,
      title,
      description,
      category: input.category,
      priority,
      status,
      votesRequired,
      deadline,
      submittedAt: emergency ? new Date() : null,
      statusHistory: {
        create: {
          oldStatus: null,
          newStatus: status,
          changedById: author.id,
          comment: emergency ? 'Аварийная заявка передана в УК без сбора подписей' : null,
        },
      },
    },
    include: requestInclude,
  });

  events.emit('request.created', { requestId: request.id });
  return request;
}

export async function getRequest(id: number): Promise<RequestWithRelations | null> {
  return prisma.request.findUnique({ where: { id }, include: requestInclude });
}

export async function getRequestDetailed(id: number): Promise<RequestDetailed | null> {
  return prisma.request.findUnique({ where: { id }, include: requestDetailedInclude });
}

export async function requireRequest(id: number): Promise<RequestWithRelations> {
  const request = await getRequest(id);
  if (!request) throw errors.notFound('Заявка не найдена');
  return request;
}

export async function hasVoted(requestId: number, userId: number): Promise<boolean> {
  const vote = await prisma.vote.findUnique({ where: { requestId_userId: { requestId, userId } }, select: { id: true } });
  return vote !== null;
}

export async function votedRequestIds(userId: number, requestIds: number[]): Promise<Set<number>> {
  if (requestIds.length === 0) return new Set();
  const votes = await prisma.vote.findMany({ where: { userId, requestId: { in: requestIds } }, select: { requestId: true } });
  return new Set(votes.map((vote) => vote.requestId));
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function vote(requestId: number, userId: number): Promise<{ request: RequestWithRelations; submitted: boolean }> {
  const [user, request] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.request.findUnique({ where: { id: requestId } }),
  ]);
  if (!request) throw errors.notFound('Заявка не найдена');
  if (!user) throw errors.notFound('Пользователь не найден');
  if (!user.houseId || !user.onboardedAt) throw errors.badRequest('Сначала укажите дом и квартиру', 'onboarding_required');
  if (request.status !== 'VOTING') throw errors.conflict(`Сбор подписей завершён: ${STATUS_LABELS[request.status]}`);
  if (user.houseId !== request.houseId) throw errors.forbidden('Поддержать заявку могут только жители этого дома');
  if (request.authorId === userId) throw errors.conflict('Автор не может подписать свою заявку');

  const votesRequired = await computeVotesRequired(request.houseId);

  let updated: RequestWithRelations;
  try {
    updated = await prisma.$transaction(async (tx) => {
      await tx.vote.create({ data: { requestId, userId } });
      const afterVote = await tx.request.update({
        where: { id: requestId },
        data: { votesCount: { increment: 1 }, votesRequired },
        include: requestInclude,
      });
      if (afterVote.status === 'VOTING' && afterVote.votesCount >= afterVote.votesRequired) {
        return tx.request.update({
          where: { id: requestId },
          data: {
            status: 'SUBMITTED',
            submittedAt: new Date(),
            statusHistory: {
              create: {
                oldStatus: 'VOTING',
                newStatus: 'SUBMITTED',
                comment: `Собрано ${afterVote.votesCount} из ${afterVote.votesRequired} подписей`,
              },
            },
          },
          include: requestInclude,
        });
      }
      return afterVote;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw errors.conflict('Вы уже поддержали эту заявку');
    throw error;
  }

  const submitted = updated.status === 'SUBMITTED';
  if (submitted) events.emit('request.submitted', { requestId });
  else events.emit('request.voted', { requestId, userId });
  return { request: updated, submitted };
}

export async function unvote(requestId: number, userId: number): Promise<RequestWithRelations> {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw errors.notFound('Заявка не найдена');
  if (request.status !== 'VOTING') throw errors.conflict('Сбор подписей уже завершён, отозвать подпись нельзя');
  const deleted = await prisma.vote.deleteMany({ where: { requestId, userId } });
  if (deleted.count === 0) throw errors.conflict('Вы не подписывали эту заявку');
  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { votesCount: { decrement: 1 } },
    include: requestInclude,
  });
  events.emit('request.voted', { requestId, userId });
  return updated;
}

export interface ChangeStatusInput {
  byUserId: number | null;
  comment?: string | null;
  organizationId?: number | null;
}

export async function changeStatus(
  requestId: number,
  newStatus: RequestStatus,
  input: ChangeStatusInput,
): Promise<RequestWithRelations> {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw errors.notFound('Заявка не найдена');
  if (!canTransition(request.status, newStatus)) {
    throw errors.conflict(
      `Нельзя перевести заявку из «${STATUS_LABELS[request.status]}» в «${STATUS_LABELS[newStatus]}»`,
      'invalid_transition',
    );
  }

  const data: Prisma.RequestUpdateInput = {
    status: newStatus,
    statusHistory: {
      create: {
        oldStatus: request.status,
        newStatus,
        comment: input.comment?.trim() || null,
        changedById: input.byUserId,
      },
    },
  };

  if (newStatus === 'DELEGATED') {
    if (!input.organizationId) throw errors.badRequest('Укажите организацию, в которую передаётся заявка');
    const organization = await prisma.responsibleOrganization.findUnique({ where: { id: input.organizationId } });
    if (!organization) throw errors.notFound('Организация не найдена');
    data.delegatedTo = { connect: { id: organization.id } };
    data.delegatedAt = new Date();
  }
  if (newStatus === 'SUBMITTED') data.submittedAt = new Date();
  if (newStatus === 'RESOLVED' || newStatus === 'REJECTED') data.resolvedAt = new Date();

  const updated = await prisma.request.update({ where: { id: requestId }, data, include: requestInclude });
  events.emit('request.status_changed', {
    requestId,
    oldStatus: request.status,
    newStatus,
    changedById: input.byUserId,
    comment: input.comment?.trim() || null,
  });
  return updated;
}

export async function deleteRequest(requestId: number, userId: number): Promise<void> {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw errors.notFound('Заявка не найдена');
  if (request.authorId !== userId) throw errors.forbidden('Удалить заявку может только её автор');
  if (!AUTHOR_DELETABLE_STATUSES.includes(request.status)) {
    throw errors.conflict('Заявка уже передана в УК, удалить её нельзя');
  }
  await prisma.request.delete({ where: { id: requestId } });
  events.emit('request.deleted', {
    requestId,
    houseId: request.houseId,
    chatMessageId: request.chatMessageId,
    title: request.title,
  });
}

export interface ListFilter {
  houseId?: number;
  authorId?: number;
  supportedByUserId?: number;
  statuses?: RequestStatus[];
  categories?: RequestCategory[];
  limit?: number;
  offset?: number;
}

type RequestFilterFields = Pick<ListFilter, 'houseId' | 'authorId' | 'supportedByUserId' | 'statuses' | 'categories'>;

function buildRequestWhere(filter: RequestFilterFields): Prisma.RequestWhereInput {
  const where: Prisma.RequestWhereInput = {};
  if (filter.houseId !== undefined) where.houseId = filter.houseId;
  if (filter.authorId !== undefined) where.authorId = filter.authorId;
  if (filter.supportedByUserId !== undefined) where.votes = { some: { userId: filter.supportedByUserId } };
  if (filter.statuses && filter.statuses.length > 0) where.status = { in: filter.statuses };
  if (filter.categories && filter.categories.length > 0) where.category = { in: filter.categories };
  return where;
}

export async function listRequests(filter: ListFilter): Promise<RequestWithRelations[]> {
  return prisma.request.findMany({
    where: buildRequestWhere(filter),
    include: requestInclude,
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(Math.max(filter.limit ?? 50, 1), 200),
    skip: Math.max(filter.offset ?? 0, 0),
  });
}

export async function countRequests(filter: RequestFilterFields): Promise<number> {
  return prisma.request.count({ where: buildRequestWhere(filter) });
}

export async function expireOverdue(now = new Date()): Promise<number[]> {
  const overdue = await prisma.request.findMany({
    where: { status: 'VOTING', deadline: { lt: now } },
    select: { id: true },
  });
  const expired: number[] = [];
  for (const { id } of overdue) {
    const result = await prisma.request.updateMany({
      where: { id, status: 'VOTING' },
      data: { status: 'EXPIRED' },
    });
    if (result.count === 0) continue;
    await prisma.statusHistory.create({
      data: { requestId: id, oldStatus: 'VOTING', newStatus: 'EXPIRED', comment: 'Срок сбора подписей истёк' },
    });
    expired.push(id);
    events.emit('request.expired', { requestId: id });
  }
  return expired;
}
