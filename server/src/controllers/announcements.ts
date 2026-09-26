import type { Request, Response } from 'express';
import { errors } from '../lib/errors.js';
import { countAnnouncements, createAnnouncement, deleteAnnouncement, listAnnouncements, updateAnnouncement } from '../services/announcements.js';
import { isChairman, isEmployee } from '../services/users.js';
import { serializeAnnouncement } from '../routes/serialize.js';
import { createAnnouncementSchema, listAnnouncementsQuerySchema, updateAnnouncementSchema } from '../validation/announcements.js';
import { idParam, parseBody, parseQuery } from '../validation/parse.js';

export async function list(req: Request, res: Response) {
  const user = req.user!;
  const query = parseQuery(listAnnouncementsQuerySchema, req);

  let houseId: number | undefined;
  if (isEmployee(user)) houseId = query.houseId;
  else {
    if (!user.houseId) throw errors.badRequest('Сначала укажите дом и квартиру', 'onboarding_required');
    houseId = user.houseId;
  }

  const [announcements, total] = await Promise.all([
    listAnnouncements({ houseId, limit: query.limit, offset: query.offset }),
    countAnnouncements({ houseId }),
  ]);
  res.json({ items: announcements.map(serializeAnnouncement), total });
}

export async function create(req: Request, res: Response) {
  const user = req.user!;
  const input = parseBody(createAnnouncementSchema, req);

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

export async function update(req: Request, res: Response) {
  const user = req.user!;
  const input = parseBody(updateAnnouncementSchema, req);
  const announcement = await updateAnnouncement(idParam(req), user, input);
  res.json(serializeAnnouncement(announcement));
}

export async function remove(req: Request, res: Response) {
  const user = req.user!;
  await deleteAnnouncement(idParam(req), user);
  res.status(204).end();
}
