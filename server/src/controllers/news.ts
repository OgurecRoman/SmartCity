import type { Request, Response } from 'express';
import { errors } from '../lib/errors.js';
import { saveUploadedPhotos } from '../lib/upload.js';
import { countNews, createNews, deleteNews, listNews, updateNews } from '../services/news.js';
import { isEmployee, resolveHouseFor } from '../services/users.js';
import { serializeNews } from '../routes/serialize.js';
import { createNewsSchema, listNewsQuerySchema, updateNewsSchema } from '../validation/news.js';
import { idParam, parseBody, parseQuery } from '../validation/parse.js';

export async function list(req: Request, res: Response) {
  const user = req.user!;
  const query = parseQuery(listNewsQuerySchema, req);

  const houseId = isEmployee(user) ? query.houseId : await resolveHouseFor(user, query.houseId, { allowPending: true });

  const [news, total] = await Promise.all([
    listNews({ houseId, limit: query.limit, offset: query.offset }),
    countNews({ houseId }),
  ]);
  res.json({ items: news.map((item) => serializeNews(item, { viewerId: user.id })), total });
}

export async function create(req: Request, res: Response) {
  const user = req.user!;
  if (isEmployee(user)) throw errors.forbidden('Новости публикуют жители; у УК есть объявления');
  const input = parseBody(createNewsSchema, req);
  const houseId = await resolveHouseFor(user, input.houseId);
  const photos = await saveUploadedPhotos(req.files as Express.Multer.File[] | undefined);
  const news = await createNews({
    houseId,
    authorId: user.id,
    title: input.title,
    description: input.description,
    contact: input.contact,
    photos,
  });
  res.status(201).json(serializeNews(news, { viewerId: user.id }));
}

export async function update(req: Request, res: Response) {
  const user = req.user!;
  const input = parseBody(updateNewsSchema, req);
  const news = await updateNews(idParam(req), user, input);
  res.json(serializeNews(news, { viewerId: user.id }));
}

export async function remove(req: Request, res: Response) {
  const user = req.user!;
  await deleteNews(idParam(req), user);
  res.status(204).end();
}
