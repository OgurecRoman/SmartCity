import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../lib/errors.js';
import { createAnnouncement, deleteAnnouncement, listAnnouncements, updateAnnouncement } from '../services/announcements.js';
import { isChairman, isEmployee } from '../services/users.js';
import { serializeAnnouncement } from '../routes/serialize.js';
import { idParam, parseBody, parseQuery } from '../routes/validation.js';

const listQuerySchema = z.object({
  houseId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function list(req: Request, res: Response) {
  const user = req.user!;
  const query = parseQuery(listQuerySchema, req);

  let houseId: number | undefined;
  if (isEmployee(user)) houseId = query.houseId;
  else {
    if (!user.houseId) throw errors.badRequest('Сначала укажите дом и квартиру', 'onboarding_required');
    houseId = user.houseId;
  }

  const announcements = await listAnnouncements({ houseId, limit: query.limit, offset: query.offset });
  res.json(announcements.map(serializeAnnouncement));
}

const createSchema = z.object({
  houseId: z.number().int().positive().optional(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(2000),
});

export async function create(req: Request, res: Response) {
  const user = req.user!;
  const input = parseBody(createSchema, req);

  let houseId: number;
  if (isEmployee(user)) {
    if (!input.houseId) throw errors.badRequest('Укажите дом (houseId)');
    houseId = input.houseId;
  } else if (isChairman(user)) {
    if (!user.houseId) throw errors.badRequest('У председателя не указан дом');
    if (input.houseId && input.houseId !== user.houseId) {
      throw errors.forbidden('Председатель может публиковать объявления только в своём доме');
    }
    houseId = user.houseId;
  } else {
    throw errors.forbidden('Создавать объявления могут УК или председатель ТСЖ');
  }

  const announcement = await createAnnouncement({ houseId, authorId: user.id, title: input.title, description: input.description });
  res.status(201).json(serializeAnnouncement(announcement));
}

const updateSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(5).max(2000).optional(),
});

export async function update(req: Request, res: Response) {
  const user = req.user!;
  const input = parseBody(updateSchema, req);
  const announcement = await updateAnnouncement(idParam(req), user, input);
  res.json(serializeAnnouncement(announcement));
}

export async function remove(req: Request, res: Response) {
  const user = req.user!;
  await deleteAnnouncement(idParam(req), user);
  res.status(204).end();
}
