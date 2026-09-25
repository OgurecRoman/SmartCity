import type { Request, Response } from 'express';
import { errors } from '../lib/errors.js';
import {
  approveMembershipRequest,
  countPendingMembershipRequests,
  listPendingMembershipRequests,
  rejectMembershipRequest,
} from '../services/membership.js';
import { isChairman, isEmployee } from '../services/users.js';
import { serializeMembershipRequest } from '../routes/serialize.js';
import { listMembershipQuerySchema, rejectMembershipSchema } from '../validation/membership.js';
import { idParam, parseBody, parseQuery } from '../validation/parse.js';

function requireReviewer(user: Request['user']): void {
  if (!user || (!isEmployee(user) && !isChairman(user))) {
    throw errors.forbidden('Доступно сотрудникам УК и председателям ТСЖ');
  }
}

export async function list(req: Request, res: Response) {
  const user = req.user!;
  requireReviewer(user);
  const query = parseQuery(listMembershipQuerySchema, req);
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

export async function reject(req: Request, res: Response) {
  const user = req.user!;
  requireReviewer(user);
  const input = parseBody(rejectMembershipSchema, req);
  const request = await rejectMembershipRequest(idParam(req), user, input.reason);
  res.json(serializeMembershipRequest(request));
}
