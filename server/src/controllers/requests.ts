import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../lib/errors.js';
import { CATEGORY_LABELS, STATUS_LABELS, parseRuDate } from '../lib/labels.js';
import { prisma } from '../lib/db.js';
import { saveUploadedPhotos } from '../lib/upload.js';
import { buildRequestDocument } from '../services/documents.js';
import { sendDelegationEmail } from '../services/mailer.js';
import * as requestsService from '../services/requests.js';
import { UK_ACTIVE_STATUSES, UK_SETTABLE_STATUSES } from '../services/rules.js';
import { isEmployee } from '../services/users.js';
import { serializeRequest, serializeRequestDetailed } from '../routes/serialize.js';
import { idParam, parseBody, parseQuery } from '../routes/validation.js';

const REQUEST_STATUSES = Object.keys(STATUS_LABELS) as [string, ...string[]];
const REQUEST_CATEGORIES = Object.keys(CATEGORY_LABELS) as [string, ...string[]];

const listQuerySchema = z.object({
  filter: z.enum(['all', 'mine', 'supported']).default('all'),
  status: z.string().optional(),
  category: z.string().optional(),
  houseId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(5),
  offset: z.coerce.number().int().min(0).default(0),
});

function parseListParam<T extends string>(raw: string | undefined, valid: readonly T[], label: string): T[] | undefined {
  if (!raw) return undefined;
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
  for (const value of values) {
    if (!valid.includes(value as T)) throw errors.badRequest(`Неизвестн${label === 'статус' ? 'ый статус' : 'ая категория'}: ${value}`);
  }
  return values as T[];
}

export async function list(req: Request, res: Response) {
  const user = req.user!;
  const query = parseQuery(listQuerySchema, req);
  const statuses = parseListParam(query.status, REQUEST_STATUSES, 'статус');
  const categories = parseListParam(query.category, REQUEST_CATEGORIES, 'категория');
  const employee = isEmployee(user);

  let houseId: number | undefined;
  if (employee) houseId = query.houseId;
  else {
    if (!user.houseId || !user.onboardedAt) {
      throw errors.badRequest('Сначала дождитесь подтверждения от председателя ТСЖ или УК', 'onboarding_required');
    }
    houseId = user.houseId;
  }

  const filter = {
    houseId,
    authorId: query.filter === 'mine' ? user.id : undefined,
    supportedByUserId: query.filter === 'supported' ? user.id : undefined,
    statuses: statuses as (keyof typeof STATUS_LABELS)[] | undefined,
    categories: categories as (keyof typeof CATEGORY_LABELS)[] | undefined,
  };
  const [requests, total] = await Promise.all([
    requestsService.listRequests({ ...filter, limit: query.limit, offset: query.offset }),
    requestsService.countRequests(filter),
  ]);
  const voted = await requestsService.votedRequestIds(user.id, requests.map((request) => request.id));
  res.json({
    items: requests.map((request) => serializeRequest(request, { hasVoted: voted.has(request.id), viewerId: user.id })),
    total,
  });
}

const createSchema = z.object({
  category: z.enum(REQUEST_CATEGORIES),
  description: z.string().trim().min(5).max(2000),
  title: z.string().trim().max(120).optional(),
  priority: z.enum(['NORMAL', 'EMERGENCY']).default('NORMAL'),

  deadline: z.string().trim().optional(),
});

export async function create(req: Request, res: Response) {
  const user = req.user!;
  if (isEmployee(user)) throw errors.forbidden('Сотрудники УК не создают заявки');
  const input = parseBody(createSchema, req);
  let deadline: Date | null = null;
  if (input.deadline) {
    deadline = parseRuDate(input.deadline) ?? new Date(input.deadline);
    if (Number.isNaN(deadline.getTime())) throw errors.badRequest('Некорректная дата в поле deadline');
  }
  const photos = await saveUploadedPhotos(req.files as Express.Multer.File[] | undefined);
  const request = await requestsService.createRequest({
    authorId: user.id,
    category: input.category as keyof typeof CATEGORY_LABELS,
    description: input.description,
    title: input.title ?? null,
    priority: input.priority,
    deadline,
    photos,
  });
  res.status(201).json(serializeRequest(request, { hasVoted: false, viewerId: user.id }));
}

export async function get(req: Request, res: Response) {
  const user = req.user!;
  const request = await requestsService.getRequestDetailed(idParam(req));
  if (!request) throw errors.notFound('Заявка не найдена');
  if (!isEmployee(user) && request.houseId !== user.houseId) throw errors.forbidden('Заявка другого дома');
  const voted = await requestsService.hasVoted(request.id, user.id);
  res.json(serializeRequestDetailed(request, { hasVoted: voted, viewerId: user.id }));
}

export async function remove(req: Request, res: Response) {
  await requestsService.deleteRequest(idParam(req), req.user!.id);
  res.status(204).end();
}

export async function voteFor(req: Request, res: Response) {
  const user = req.user!;
  const { request, submitted } = await requestsService.vote(idParam(req), user.id);
  res.json({ ...serializeRequest(request, { hasVoted: true, viewerId: user.id }), submitted });
}

export async function unvoteFor(req: Request, res: Response) {
  const user = req.user!;
  const request = await requestsService.unvote(idParam(req), user.id);
  res.json(serializeRequest(request, { hasVoted: false, viewerId: user.id }));
}

const reopenSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export async function reopen(req: Request, res: Response) {
  const user = req.user!;
  const input = parseBody(reopenSchema, req);
  const photos = await saveUploadedPhotos(req.files as Express.Multer.File[] | undefined);
  const request = await requestsService.reopenRequest(idParam(req), { userId: user.id, reason: input.reason, photos });
  res.json(serializeRequest(request, { viewerId: user.id }));
}

const rateSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
});

export async function rate(req: Request, res: Response) {
  const user = req.user!;
  const input = parseBody(rateSchema, req);
  const request = await requestsService.rateRequest(idParam(req), { userId: user.id, rating: input.rating });
  res.json(serializeRequest(request, { viewerId: user.id }));
}

export async function document(req: Request, res: Response) {
  const user = req.user!;
  const request = await requestsService.getRequestDetailed(idParam(req));
  if (!request) throw errors.notFound('Заявка не найдена');
  if (!isEmployee(user) && request.authorId !== user.id) throw errors.forbidden('Документ доступен автору и сотрудникам УК');
  const doc = buildRequestDocument(request);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
  res.send(doc.content);
}

const statusSchema = z.object({
  status: z.enum(UK_SETTABLE_STATUSES as unknown as [string, ...string[]]),
  comment: z.string().trim().max(1000).optional(),
  organizationId: z.coerce.number().int().positive().optional(),
  resolutionNote: z.string().trim().max(2000).optional(),
  resolvedByName: z.string().trim().max(150).optional(),
});

export async function updateStatus(req: Request, res: Response) {
  const user = req.user!;
  const input = parseBody(statusSchema, req);
  const requestId = idParam(req);
  const photos = await saveUploadedPhotos(req.files as Express.Multer.File[] | undefined);
  const request = await requestsService.changeStatus(requestId, input.status as keyof typeof STATUS_LABELS, {
    byUserId: user.id,
    comment: input.comment ?? null,
    organizationId: input.organizationId ?? null,
    resolutionNote: input.resolutionNote,
    resolvedByName: input.resolvedByName,
    photos,
  });

  let mail: { simulated: boolean; to: string | null } | undefined;
  if (input.status === 'DELEGATED' && request.delegatedTo) {
    const detailed = await requestsService.getRequestDetailed(requestId);
    const organization = await prisma.responsibleOrganization.findUnique({ where: { id: request.delegatedTo.id } });
    if (detailed && organization) mail = await sendDelegationEmail(request, organization, buildRequestDocument(detailed));
  }
  res.json({ ...serializeRequest(request, { viewerId: user.id }), mail });
}

export async function updateMessage(req: Request, res: Response) {
  await requestsService.updateMessage();
  res.json({ ...serializeRequest(request, { viewerId: user.id }), mail });
}

export async function listForUk(req: Request, res: Response) {
  const user = req.user!;
  const query = parseQuery(listQuerySchema, req);
  const statuses = (parseListParam(query.status, REQUEST_STATUSES, 'статус') as (keyof typeof STATUS_LABELS)[] | undefined) ?? [
    ...UK_ACTIVE_STATUSES,
  ];
  const categories = parseListParam(query.category, REQUEST_CATEGORIES, 'категория') as (keyof typeof CATEGORY_LABELS)[] | undefined;
  const filter = { houseId: query.houseId, statuses, categories };
  const [requests, total] = await Promise.all([
    requestsService.listRequests({ ...filter, limit: query.limit, offset: query.offset }),
    requestsService.countRequests(filter),
  ]);
  res.json({ items: requests.map((request) => serializeRequest(request, { viewerId: user.id })), total });
}
