import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../lib/errors.js';
import { saveUploadedPhotos } from '../lib/upload.js';
import { countNews, createNews, deleteNews, listNews, updateNews } from '../services/news.js';
import { isEmployee } from '../services/users.js';
import { serializeNews } from '../routes/serialize.js';
import { idParam, parseBody, parseQuery } from '../routes/validation.js';

const listQuerySchema = z.object({
  houseId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(5),
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

  const [news, total] = await Promise.all([
    listNews({ houseId, limit: query.limit, offset: query.offset }),
    countNews({ houseId }),
  ]);
  res.json({ items: news.map((item) => serializeNews(item, { viewerId: user.id })), total });
}

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(2000),
  contact: z.string().trim().min(3).max(200),
});

export async function create(req: Request, res: Response) {
  const user = req.user!;
  if (!user.houseId || !user.onboardedAt) {
    throw errors.badRequest('Сначала дождитесь подтверждения от председателя ТСЖ или УК', 'onboarding_required');
  }
  const input = parseBody(createSchema, req);
  const photos = await saveUploadedPhotos(req.files as Express.Multer.File[] | undefined);
  const news = await createNews({
    houseId: user.houseId,
    authorId: user.id,
    title: input.title,
    description: input.description,
    contact: input.contact,
    photos,
  });
  res.status(201).json(serializeNews(news, { viewerId: user.id }));
}

const updateSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(5).max(2000).optional(),
  contact: z.string().trim().min(3).max(200).optional(),
});

export async function update(req: Request, res: Response) {
  const user = req.user!;
  const input = parseBody(updateSchema, req);
  const news = await updateNews(idParam(req), user, input);
  res.json(serializeNews(news, { viewerId: user.id }));
}

export async function remove(req: Request, res: Response) {
  const user = req.user!;
  await deleteNews(idParam(req), user);
  res.status(204).end();
}
