import path from 'node:path';
import type { Request, Response } from 'express';
import { config } from '../config.js';
import { prisma } from '../lib/db.js';
import { errors } from '../lib/errors.js';
import type { CATEGORY_LABELS, STATUS_LABELS } from '../lib/labels.js';
import { savePhotoBuffer } from '../lib/photoStorage.js';
import * as announcementsService from '../services/announcements.js';
import { buildRequestDocument } from '../services/documents.js';
import { sendDelegationEmail } from '../services/mailer.js';
import * as membershipService from '../services/membership.js';
import * as newsService from '../services/news.js';
import * as requestsService from '../services/requests.js';
import * as usersService from '../services/users.js';
import {
  addTenantSchema,
  applicantQuerySchema,
  bindChatSchema,
  changeStatusSchema,
  chatMessageSchema,
  createAnnouncementSchema,
  createNewsSchema,
  createRequestSchema,
  devResetSchema,
  hasVotedQuerySchema,
  listRequestsQuerySchema,
  maxUserHouseSchema,
  maxUserSchema,
  outboxQuerySchema,
  promoteSchema,
  rejectMembershipSchema,
  reopenRequestSchema,
  reviewerQuerySchema,
  reviewerSchema,
  submitMembershipSchema,
  unbindChatSchema,
  userIdSchema,
} from '../validation/bot.js';
import { REQUEST_STATUSES } from '../validation/common.js';
import { idParam, parseBody, parseQuery } from '../validation/parse.js';

// Ручки для процесса бота. Раньше бот ходил в Prisma напрямую — теперь всё, что ему нужно, доступно по HTTP.
// Ответы отдаются в «сыром» виде (как возвращают сервисы), BigInt сериализуется строкой (см. lib/bigint.ts).

async function requireUser(id: number): Promise<usersService.DbUser> {
  const user = await usersService.getUserById(id);
  if (!user) throw errors.notFound('Пользователь не найден');
  return user;
}

// --- Пользователи ---

export async function getUser(req: Request, res: Response) {
  res.json(await usersService.getUserById(idParam(req)));
}

export async function getUserByMax(req: Request, res: Response) {
  const raw = String(req.params.maxUserId ?? '');
  if (!/^\d{1,18}$/.test(raw)) throw errors.badRequest('Некорректный maxUserId');
  res.json(await usersService.getUserByMaxId(BigInt(raw)));
}

export async function listEmployees(_req: Request, res: Response) {
  res.json(await usersService.listEmployees());
}

export async function promote(req: Request, res: Response) {
  const input = parseBody(promoteSchema, req);
  if (!config.uk.accessCode) throw errors.unavailable('Вход для сотрудников УК по коду отключён (UK_ACCESS_CODE не задан).');
  if (input.code !== config.uk.accessCode) throw errors.forbidden('Неверный код. Формат: /uk_login <код>');
  res.json(await usersService.promoteToEmployee(input.userId));
}

export async function assignHouse(req: Request, res: Response) {
  const input = parseBody(maxUserHouseSchema, req);
  res.json(await usersService.assignResidentToHouse(BigInt(input.maxUserId), input.houseId));
}

export async function detach(req: Request, res: Response) {
  const input = parseBody(maxUserSchema, req);
  res.json(await usersService.detachResident(BigInt(input.maxUserId)));
}

export async function appointChairman(req: Request, res: Response) {
  const input = parseBody(maxUserHouseSchema, req);
  res.json(await usersService.appointChairman(BigInt(input.maxUserId), input.houseId));
}

export async function dismissChairman(req: Request, res: Response) {
  const input = parseBody(maxUserSchema, req);
  res.json(await usersService.dismissChairman(BigInt(input.maxUserId)));
}

export async function addTenant(req: Request, res: Response) {
  const input = parseBody(addTenantSchema, req);
  const owner = await requireUser(input.ownerId);
  res.json(await usersService.addTenantByOwner(owner, BigInt(input.maxUserId), input.apartment));
}

// --- Дома, компания, организации ---

export async function listHouses(_req: Request, res: Response) {
  res.json(await usersService.listHouses());
}

export async function getHouse(req: Request, res: Response) {
  res.json(await usersService.getHouse(idParam(req)));
}

export async function getChairman(req: Request, res: Response) {
  res.json(await usersService.getChairmanOf(idParam(req)));
}

export async function listResidents(req: Request, res: Response) {
  res.json(await usersService.listResidentsOfHouse(idParam(req)));
}

export async function votesRequired(req: Request, res: Response) {
  res.json({ votesRequired: await requestsService.computeVotesRequired(idParam(req)) });
}

export async function getHouseByChat(req: Request, res: Response) {
  const raw = String(req.params.chatId ?? '');
  if (!/^-?\d{1,18}$/.test(raw)) throw errors.badRequest('Некорректный chatId');
  res.json(await usersService.getHouseByChat(BigInt(raw)));
}

export async function bindChat(req: Request, res: Response) {
  const input = parseBody(bindChatSchema, req);
  res.json(await usersService.bindHouseChat(idParam(req), BigInt(input.chatId), input.chatTitle ?? null));
}

export async function unbindChat(req: Request, res: Response) {
  const input = parseBody(unbindChatSchema, req);
  await usersService.unbindHouseChat(BigInt(input.chatId));
  res.status(204).end();
}

export async function getCompany(_req: Request, res: Response) {
  res.json(await usersService.getCompany());
}

export async function listOrganizations(_req: Request, res: Response) {
  res.json(await usersService.listOrganizations());
}

// --- Заявки ---

export async function listRequests(req: Request, res: Response) {
  const query = parseQuery(listRequestsQuerySchema, req);
  const statuses = query.statuses?.split(',').filter(Boolean) as (keyof typeof STATUS_LABELS)[] | undefined;
  for (const status of statuses ?? []) {
    if (!REQUEST_STATUSES.includes(status)) throw errors.badRequest(`Неизвестный статус: ${status}`);
  }
  res.json(await requestsService.listRequests({ ...query, statuses }));
}

export async function getRequest(req: Request, res: Response) {
  res.json(await requestsService.getRequest(idParam(req)));
}

export async function requestDocument(req: Request, res: Response) {
  const request = await requestsService.getRequestDetailed(idParam(req));
  if (!request) throw errors.notFound('Заявка не найдена');
  res.json(buildRequestDocument(request));
}

export async function hasVoted(req: Request, res: Response) {
  const query = parseQuery(hasVotedQuerySchema, req);
  res.json({ voted: await requestsService.hasVoted(idParam(req), query.userId) });
}

export async function createRequest(req: Request, res: Response) {
  const input = parseBody(createRequestSchema, req);
  const request = await requestsService.createRequest({
    authorId: input.authorId,
    category: input.category as keyof typeof CATEGORY_LABELS,
    description: input.description,
    priority: input.priority,
    deadline: input.deadline ? new Date(input.deadline) : null,
    photos: input.photos,
  });
  res.status(201).json(request);
}

export async function vote(req: Request, res: Response) {
  const input = parseBody(userIdSchema, req);
  res.json(await requestsService.vote(idParam(req), input.userId));
}

export async function deleteRequest(req: Request, res: Response) {
  const input = parseBody(userIdSchema, req);
  await requestsService.deleteRequest(idParam(req), input.userId);
  res.status(204).end();
}

export async function changeStatus(req: Request, res: Response) {
  const input = parseBody(changeStatusSchema, req);
  const requestId = idParam(req);
  const request = await requestsService.changeStatus(requestId, input.status as keyof typeof STATUS_LABELS, {
    byUserId: input.byUserId,
    comment: input.comment ?? null,
    organizationId: input.organizationId ?? null,
    resolutionNote: input.resolutionNote,
    resolvedByName: input.resolvedByName,
    photos: input.photos,
  });

  let mail: { simulated: boolean; to: string | null } | null = null;
  if (input.status === 'DELEGATED' && request.delegatedTo) {
    const detailed = await requestsService.getRequestDetailed(requestId);
    if (detailed) mail = await sendDelegationEmail(request, request.delegatedTo, buildRequestDocument(detailed));
  }
  res.json({ request, mail });
}

export async function reopenRequest(req: Request, res: Response) {
  const input = parseBody(reopenRequestSchema, req);
  res.json(await requestsService.reopenRequest(idParam(req), input));
}

export async function setRequestChatMessage(req: Request, res: Response) {
  const input = parseBody(chatMessageSchema, req);
  await requestsService.updateMessage(idParam(req), input.messageId);
  res.status(204).end();
}

// --- Заявки на вступление ---

export async function getMembership(req: Request, res: Response) {
  res.json(await membershipService.getMembershipRequest(idParam(req)));
}

export async function latestMembership(req: Request, res: Response) {
  const query = parseQuery(applicantQuerySchema, req);
  res.json(await membershipService.getLatestMembershipRequestFor(query.applicantId));
}

export async function pendingMembership(req: Request, res: Response) {
  const query = parseQuery(reviewerQuerySchema, req);
  const reviewer = await requireUser(query.reviewerId);
  res.json(await membershipService.listPendingMembershipRequests(reviewer));
}

export async function submitMembership(req: Request, res: Response) {
  res.status(201).json(await membershipService.submitMembershipRequest(parseBody(submitMembershipSchema, req)));
}

export async function approveMembership(req: Request, res: Response) {
  const input = parseBody(reviewerSchema, req);
  const reviewer = await requireUser(input.reviewerId);
  res.json(await membershipService.approveMembershipRequest(idParam(req), reviewer));
}

export async function rejectMembership(req: Request, res: Response) {
  const input = parseBody(rejectMembershipSchema, req);
  const reviewer = await requireUser(input.reviewerId);
  res.json(await membershipService.rejectMembershipRequest(idParam(req), reviewer, input.reason));
}

// --- Объявления и новости ---

export async function createAnnouncement(req: Request, res: Response) {
  res.status(201).json(await announcementsService.createAnnouncement(parseBody(createAnnouncementSchema, req)));
}

export async function getAnnouncement(req: Request, res: Response) {
  res.json(await announcementsService.getAnnouncement(idParam(req)));
}

export async function setAnnouncementChatMessage(req: Request, res: Response) {
  const input = parseBody(chatMessageSchema, req);
  await prisma.announcement.update({ where: { id: idParam(req) }, data: { chatMessageId: input.messageId } });
  res.status(204).end();
}

export async function createNews(req: Request, res: Response) {
  res.status(201).json(await newsService.createNews(parseBody(createNewsSchema, req)));
}

export async function getNews(req: Request, res: Response) {
  res.json(await newsService.getNews(idParam(req)));
}

export async function setNewsChatMessage(req: Request, res: Response) {
  const input = parseBody(chatMessageSchema, req);
  await prisma.news.update({ where: { id: idParam(req) }, data: { chatMessageId: input.messageId } });
  res.status(204).end();
}

// --- Фото: бот скачивает файл из MAX и отдаёт его сюда, а сервер хранит на своём диске ---

export async function uploadPhoto(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw errors.badRequest('Файл photo не передан');
  const filename = await savePhotoBuffer(file.buffer, path.extname(file.originalname) || '.jpg');
  res.status(201).json({ filename });
}

// --- Сессии сценариев бота (таблица BotSession) ---

function sessionKey(req: Request): string {
  const key = String(req.params.key ?? '');
  if (!key || key.length > 200) throw errors.badRequest('Некорректный ключ сессии');
  return key;
}

export async function getSession(req: Request, res: Response) {
  const row = await prisma.botSession.findUnique({ where: { key: sessionKey(req) } });
  res.json(row ? row.value : null);
}

export async function setSession(req: Request, res: Response) {
  const key = sessionKey(req);
  const value = (req.body ?? {}) as object;
  await prisma.botSession.upsert({ where: { key }, create: { key, value }, update: { value } });
  res.status(204).end();
}

export async function deleteSession(req: Request, res: Response) {
  await prisma.botSession.deleteMany({ where: { key: sessionKey(req) } });
  res.status(204).end();
}

// --- Очередь уведомлений (таблица NotificationOutbox): бот забирает события и подтверждает обработку ---

export async function listOutbox(req: Request, res: Response) {
  const query = parseQuery(outboxQuerySchema, req);
  console.log('/bot/outbox', query);
  const notifications = await prisma.notificationOutbox.findMany({ orderBy: { id: 'asc' }, take: query.limit })
  console.log('/bot/outbox', notifications);
  res.json(notifications);
}

export async function ackOutbox(req: Request, res: Response) {
  await prisma.notificationOutbox.deleteMany({ where: { id: idParam(req) } });
  res.status(204).end();
}

// --- Только для разработки: очистка данных тестовых пользователей (используется bot/src/scripts/simulate-bot.ts) ---

export async function devReset(req: Request, res: Response) {
  if (config.isProduction) throw errors.forbidden('Недоступно в production');
  const input = parseBody(devResetSchema, req);
  const ids = input.maxUserIds.map((id) => BigInt(id));
  await prisma.botSession.deleteMany({});
  await prisma.notificationOutbox.deleteMany({});
  await prisma.request.deleteMany({ where: { author: { maxUserId: { in: ids } } } });
  await prisma.announcement.deleteMany({ where: { author: { maxUserId: { in: ids } } } });
  await prisma.news.deleteMany({ where: { author: { maxUserId: { in: ids } } } });
  await prisma.membershipRequest.deleteMany({ where: { applicant: { maxUserId: { in: ids } } } });
  await prisma.user.deleteMany({ where: { maxUserId: { in: ids } } });
  if (input.unbindChatOfHouseIds?.length) {
    await prisma.house.updateMany({ where: { id: { in: input.unbindChatOfHouseIds } }, data: { chatId: null, chatTitle: null } });
  }
  res.status(204).end();
}
