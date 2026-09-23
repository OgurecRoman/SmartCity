import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../lib/errors.js';
import {
  approveMembershipRequest,
  countPendingMembershipRequests,
  listPendingMembershipRequests,
  rejectMembershipRequest,
} from '../services/membership.js';
import { isChairman, isEmployee } from '../services/users.js';
import { serializeMembershipRequest } from '../routes/serialize.js';
import { idParam, parseBody, parseQuery } from '../routes/validation.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(5),
  offset: z.coerce.number().int().min(0).default(0),
});

function requireReviewer(user: Request['user']): void {
  if (!user || (!isEmployee(user) && !isChairman(user))) {
    throw errors.forbidden('Доступно сотрудникам УК и председателям ТСЖ');
  }
}

export async function list(req: Request, res: Response) {
  const user = req.user!;
  requireReviewer(user);
  const query = parseQuery(listQuerySchema, req);
  const [items, total] = await Promise.all([
    listPendingMembershipRequests(user, { limit: query.limit, offset: query.offset }),
    countPendingMembershipRequests(user),
  ]);
  res.json({ items: items.map(serializeMembershipRequest), total });
}

export async function approve(req: Request, res: Response) {
  const user = req.user!;
  requireReviewer(user);
  const request = await approveMembershipRequest(idParam(req), user);
  res.json(serializeMembershipRequest(request));
}

const rejectSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export async function reject(req: Request, res: Response) {
  const user = req.user!;
  requireReviewer(user);
  const input = parseBody(rejectSchema, req);
  const request = await rejectMembershipRequest(idParam(req), user, input.reason);
  res.json(serializeMembershipRequest(request));
}
