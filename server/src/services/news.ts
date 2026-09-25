import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { errors } from '../lib/errors.js';
import { events } from '../lib/events.js';
import { deletePhotoFile } from '../lib/photoStorage.js';
import type { DbUser } from './users.js';

export const newsInclude = {
  author: { select: { id: true, firstName: true, lastName: true, role: true } },
  house: { select: { id: true, address: true, chatId: true } },
  photos: { select: { filename: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.NewsInclude;

export type NewsWithRelations = Prisma.NewsGetPayload<{ include: typeof newsInclude }>;

function validateFields(title: string, description: string, contact: string): void {
  if (title.length < 3 || title.length > 120) throw errors.badRequest('Заголовок должен быть от 3 до 120 символов');
  if (description.length < 5 || description.length > 2000) throw errors.badRequest('Описание должно быть от 5 до 2000 символов');
  if (contact.length < 3 || contact.length > 200) throw errors.badRequest('Укажите контакт для связи (от 3 до 200 символов)');
}

function canManageNews(user: Pick<DbUser, 'id' | 'role'>, news: { authorId: number }): boolean {
  return user.id === news.authorId || user.role === 'UK_EMPLOYEE';
}

export interface CreateNewsInput {
  houseId: number;
  authorId: number;
  title: string;
  description: string;
  contact: string;
  photos?: string[];
}

export async function createNews(input: CreateNewsInput): Promise<NewsWithRelations> {
  const house = await prisma.house.findUnique({ where: { id: input.houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  const title = input.title.trim();
  const description = input.description.trim();
  const contact = input.contact.trim();
  validateFields(title, description, contact);
  const news = await prisma.news.create({
    data: {
      houseId: input.houseId,
      authorId: input.authorId,
      title,
      description,
      contact,
      photos: input.photos?.length ? { create: input.photos.map((filename) => ({ filename })) } : undefined,
    },
    include: newsInclude,
  });
  events.emit('news.created', { newsId: news.id });
  return news;
}

export async function getNews(id: number): Promise<NewsWithRelations | null> {
  return prisma.news.findUnique({ where: { id }, include: newsInclude });
}

export interface ListNewsFilter {
  houseId?: number;
  limit?: number;
  offset?: number;
}

function buildNewsWhere(filter: Pick<ListNewsFilter, 'houseId'>): Prisma.NewsWhereInput {
  const where: Prisma.NewsWhereInput = {};
  if (filter.houseId !== undefined) where.houseId = filter.houseId;
  return where;
}

export async function listNews(filter: ListNewsFilter): Promise<NewsWithRelations[]> {
  return prisma.news.findMany({
    where: buildNewsWhere(filter),
    include: newsInclude,
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(Math.max(filter.limit ?? 50, 1), 200),
    skip: Math.max(filter.offset ?? 0, 0),
  });
}

export async function countNews(filter: Pick<ListNewsFilter, 'houseId'>): Promise<number> {
  return prisma.news.count({ where: buildNewsWhere(filter) });
}

export interface UpdateNewsInput {
  title?: string;
  description?: string;
  contact?: string;
}

export async function updateNews(id: number, editor: Pick<DbUser, 'id' | 'role'>, input: UpdateNewsInput): Promise<NewsWithRelations> {
  const existing = await prisma.news.findUnique({ where: { id } });
  if (!existing) throw errors.notFound('Новость не найдена');
  if (!canManageNews(editor, existing)) throw errors.forbidden('Редактировать новость может её автор или сотрудник УК');
  const title = input.title !== undefined ? input.title.trim() : existing.title;
  const description = input.description !== undefined ? input.description.trim() : existing.description;
  const contact = input.contact !== undefined ? input.contact.trim() : existing.contact;
  validateFields(title, description, contact);
  const updated = await prisma.news.update({ where: { id }, data: { title, description, contact }, include: newsInclude });
  events.emit('news.updated', { newsId: id });
  return updated;
}

export async function deleteNews(id: number, editor: Pick<DbUser, 'id' | 'role'>): Promise<void> {
  const existing = await prisma.news.findUnique({ where: { id }, include: { photos: { select: { filename: true } } } });
  if (!existing) throw errors.notFound('Новость не найдена');
  if (!canManageNews(editor, existing)) throw errors.forbidden('Удалить новость может её автор или сотрудник УК');
  await prisma.news.delete({ where: { id } });
  await Promise.all(existing.photos.map((photo) => deletePhotoFile(photo.filename)));
  events.emit('news.deleted', { newsId: id, houseId: existing.houseId, chatMessageId: existing.chatMessageId, title: existing.title });
}
