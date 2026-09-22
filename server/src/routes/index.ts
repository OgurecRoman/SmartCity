import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireEmployee } from '../auth/middleware.js';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PRIORITY_LABELS,
  RESIDENT_TYPE_LABELS,
  STATUS_LABELS,
  parseRuDate,
} from '../lib/labels.js';
import { RequestCategory } from '@prisma/client';
import { errors } from '../lib/errors.js';
import { buildRequestDocument } from '../services/documents.js';
import { sendDelegationEmail } from '../services/mailer.js';
import {
  changeStatus,
  createRequest,
  deleteRequest,
  getRequestDetailed,
  hasVoted,
  listRequests,
  unvote,
  vote,
  votedRequestIds,
} from '../services/requests.js';
import { STATUS_TRANSITIONS, UK_ACTIVE_STATUSES, UK_SETTABLE_STATUSES } from '../services/rules.js';
import { completeOnboarding, findOrCreateHouseAt, getCompany, isEmployee, listHouses, listOrganizations, lookupHouseAt } from '../services/users.js';
import { prisma } from '../lib/db.js';
import { searchAddress } from '../services/geo.js';
import { serializeHouse, serializeRequest, serializeRequestDetailed, serializeUser } from './serialize.js';
import { idParam, parseBody, parseQuery } from './validation.js';

export const apiRouter = Router();

const REQUEST_STATUSES = Object.keys(STATUS_LABELS) as [string, ...string[]];
const REQUEST_CATEGORIES = Object.keys(CATEGORY_LABELS) as [string, ...string[]];

apiRouter.get('/dictionaries', (_req, res) => {
  res.json({
    categories: CATEGORY_ORDER.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
    statuses: (Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((value) => ({ value, label: STATUS_LABELS[value] })),
    priorities: (Object.keys(PRIORITY_LABELS) as (keyof typeof PRIORITY_LABELS)[]).map((value) => ({ value, label: PRIORITY_LABELS[value] })),
    residentTypes: (Object.keys(RESIDENT_TYPE_LABELS) as (keyof typeof RESIDENT_TYPE_LABELS)[]).map((value) => ({
      value,
      label: RESIDENT_TYPE_LABELS[value],
    })),
    transitions: STATUS_TRANSITIONS,
  });
});

apiRouter.use(authenticate);

apiRouter.get('/me', (req, res) => {
  res.json(serializeUser(req.user!));
});

const onboardingSchema = z.object({
  houseId: z.number().int().positive(),
  apartment: z.string().trim().min(1).max(10),
  residentType: z.enum(['OWNER', 'TENANT']),
});

apiRouter.patch('/me', async (req, res) => {
  const input = parseBody(onboardingSchema, req);
  const user = await completeOnboarding(req.user!.id, input);
  res.json(serializeUser(user));
});

apiRouter.get('/houses', async (_req, res) => {
  const houses = await listHouses();
  res.json(houses.map((house: any) => serializeHouse(house, { residentsCount: house._count.residents })));
});

const pointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

apiRouter.get('/houses/lookup', async (req, res) => {
  const { lat, lng } = parseQuery(pointSchema, req);
  const { building, house } = await lookupHouseAt(lat, lng);
  res.json({ building, house: house ? serializeHouse(house) : null });
});

apiRouter.post('/houses', async (req, res) => {
  const { lat, lng } = parseBody(pointSchema, req);
  const { house, created } = await findOrCreateHouseAt(lat, lng);
  res.status(created ? 201 : 200).json(serializeHouse(house));
});

apiRouter.get('/geo/search', async (req, res) => {
  const { q } = parseQuery(z.object({ q: z.string().trim().min(3).max(200) }), req);
  res.json(await searchAddress(q));
});

apiRouter.get('/company', async (_req, res) => {
  const company = await getCompany();
  res.json(company);
});

apiRouter.get('/organizations', async (_req, res) => {
  const organizations = await listOrganizations();
  res.json(organizations.map((org: any) => 
    ({ ...org, categoryLabels: org.categories.map((c: RequestCategory) => CATEGORY_LABELS[c]) })));
});

const listQuerySchema = z.object({
  filter: z.enum(['all', 'mine', 'supported']).default('all'),
  status: z.string().optional(),
  houseId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function parseStatuses(raw: string | undefined) {
  if (!raw) return undefined;
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
  for (const value of values) {
    if (!REQUEST_STATUSES.includes(value)) throw errors.badRequest(`Неизвестный статус: ${value}`);
  }
  return values as (keyof typeof STATUS_LABELS)[];
}

apiRouter.get('/requests', async (req, res) => {
  const user = req.user!;
  const query = parseQuery(listQuerySchema, req);
  const statuses = parseStatuses(query.status);
  const employee = isEmployee(user);

  let houseId: number | undefined;
  if (employee) houseId = query.houseId;
  else {
    if (!user.houseId) throw errors.badRequest('Сначала укажите дом и квартиру', 'onboarding_required');
    houseId = user.houseId;
  }

  const requests = await listRequests({
    houseId,
    authorId: query.filter === 'mine' ? user.id : undefined,
    supportedByUserId: query.filter === 'supported' ? user.id : undefined,
    statuses,
    limit: query.limit,
    offset: query.offset,
  });
  const voted = await votedRequestIds(user.id, requests.map((request) => request.id));
  res.json(requests.map((request) => serializeRequest(request, { hasVoted: voted.has(request.id), viewerId: user.id })));
});

const createSchema = z.object({
  category: z.enum(REQUEST_CATEGORIES),
  description: z.string().trim().min(5).max(2000),
  title: z.string().trim().max(120).optional(),
  priority: z.enum(['NORMAL', 'EMERGENCY']).default('NORMAL'),

  deadline: z.string().trim().optional(),
});

apiRouter.post('/requests', async (req, res) => {
  const user = req.user!;
  if (isEmployee(user)) throw errors.forbidden('Сотрудники УК не создают заявки');
  const input = parseBody(createSchema, req);
  let deadline: Date | null = null;
  if (input.deadline) {
    deadline = parseRuDate(input.deadline) ?? new Date(input.deadline);
    if (Number.isNaN(deadline.getTime())) throw errors.badRequest('Некорректная дата в поле deadline');
  }
  const request = await createRequest({
    authorId: user.id,
    category: input.category as keyof typeof CATEGORY_LABELS,
    description: input.description,
    title: input.title ?? null,
    priority: input.priority,
    deadline,
  });
  res.status(201).json(serializeRequest(request, { hasVoted: false, viewerId: user.id }));
});

apiRouter.get('/requests/:id', async (req, res) => {
  const user = req.user!;
  const request = await getRequestDetailed(idParam(req));
  if (!request) throw errors.notFound('Заявка не найдена');
  if (!isEmployee(user) && request.houseId !== user.houseId) throw errors.forbidden('Заявка другого дома');
  const voted = await hasVoted(request.id, user.id);
  res.json(serializeRequestDetailed(request, { hasVoted: voted, viewerId: user.id }));
});

apiRouter.delete('/requests/:id', async (req, res) => {
  await deleteRequest(idParam(req), req.user!.id);
  res.status(204).end();
});

apiRouter.post('/requests/:id/vote', async (req, res) => {
  const user = req.user!;
  const { request, submitted } = await vote(idParam(req), user.id);
  res.json({ ...serializeRequest(request, { hasVoted: true, viewerId: user.id }), submitted });
});

apiRouter.delete('/requests/:id/vote', async (req, res) => {
  const user = req.user!;
  const request = await unvote(idParam(req), user.id);
  res.json(serializeRequest(request, { hasVoted: false, viewerId: user.id }));
});

apiRouter.get('/requests/:id/document', async (req, res) => {
  const user = req.user!;
  const request = await getRequestDetailed(idParam(req));
  if (!request) throw errors.notFound('Заявка не найдена');
  if (!isEmployee(user) && request.authorId !== user.id) throw errors.forbidden('Документ доступен автору и сотрудникам УК');
  const document = buildRequestDocument(request);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
  res.send(document.content);
});

const statusSchema = z.object({
  status: z.enum(UK_SETTABLE_STATUSES as unknown as [string, ...string[]]),
  comment: z.string().trim().max(1000).optional(),
  organizationId: z.number().int().positive().optional(),
});

apiRouter.patch('/requests/:id/status', requireEmployee, async (req, res) => {
  const user = req.user!;
  const input = parseBody(statusSchema, req);
  const requestId = idParam(req);
  const request = await changeStatus(requestId, input.status as keyof typeof STATUS_LABELS, {
    byUserId: user.id,
    comment: input.comment ?? null,
    organizationId: input.organizationId ?? null,
  });

  let mail: { simulated: boolean; to: string | null } | undefined;
  if (input.status === 'DELEGATED' && request.delegatedTo) {
    const detailed = await getRequestDetailed(requestId);
    const organization = await prisma.responsibleOrganization.findUnique({ where: { id: request.delegatedTo.id } });
    if (detailed && organization) mail = await sendDelegationEmail(request, organization, buildRequestDocument(detailed));
  }
  res.json({ ...serializeRequest(request, { viewerId: user.id }), mail });
});

apiRouter.get('/uk/requests', requireEmployee, async (req, res) => {
  const user = req.user!;
  const query = parseQuery(listQuerySchema, req);
  const statuses = parseStatuses(query.status) ?? [...UK_ACTIVE_STATUSES];
  const requests = await listRequests({ houseId: query.houseId, statuses, limit: query.limit, offset: query.offset });
  res.json(requests.map((request) => serializeRequest(request, { viewerId: user.id })));
});
