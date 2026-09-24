import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { errors } from '../lib/errors.js';
import { events } from '../lib/events.js';
import { canManageAnnouncements, type DbUser } from './users.js';

export const announcementInclude = {
  author: { select: { id: true, firstName: true, lastName: true, role: true } },
  house: { select: { id: true, address: true, chatId: true } },
} satisfies Prisma.AnnouncementInclude;

export type AnnouncementWithRelations = Prisma.AnnouncementGetPayload<{ include: typeof announcementInclude }>;

function validateFields(title: string, description: string): void {
  if (title.length < 3 || title.length > 120) throw errors.badRequest('Заголовок должен быть от 3 до 120 символов');
  if (description.length < 5 || description.length > 2000) throw errors.badRequest('Описание должно быть от 5 до 2000 символов');
}

export interface CreateAnnouncementInput {
  houseId: number;
  authorId: number;
  title: string;
  description: string;
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<AnnouncementWithRelations> {
  const house = await prisma.house.findUnique({ where: { id: input.houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  const title = input.title.trim();
  const description = input.description.trim();
  validateFields(title, description);
  const announcement = await prisma.announcement.create({
    data: { houseId: input.houseId, authorId: input.authorId, title, description },
    include: announcementInclude,
  });
  events.emit('announcement.created', { announcementId: announcement.id });
  return announcement;
}

export async function getAnnouncement(id: number): Promise<AnnouncementWithRelations | null> {
  return prisma.announcement.findUnique({ where: { id }, include: announcementInclude });
}

export interface ListAnnouncementsFilter {
  houseId?: number;
  limit?: number;
  offset?: number;
}

export async function listAnnouncements(filter: ListAnnouncementsFilter): Promise<AnnouncementWithRelations[]> {
  const where: Prisma.AnnouncementWhereInput = {};
  if (filter.houseId !== undefined) where.houseId = filter.houseId;
  return prisma.announcement.findMany({
    where,
    include: announcementInclude,
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(Math.max(filter.limit ?? 50, 1), 200),
    skip: Math.max(filter.offset ?? 0, 0),
  });
}

export interface UpdateAnnouncementInput {
  title?: string;
  description?: string;
}

export async function updateAnnouncement(
  id: number,
  editor: Pick<DbUser, 'role' | 'houseId'>,
  input: UpdateAnnouncementInput,
): Promise<AnnouncementWithRelations> {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw errors.notFound('Объявление не найдено');
  if (!canManageAnnouncements(editor, existing.houseId)) {
    throw errors.forbidden('Редактировать объявление может УК или председатель ТСЖ этого дома');
  }
  const title = input.title !== undefined ? input.title.trim() : existing.title;
  const description = input.description !== undefined ? input.description.trim() : existing.description;
  validateFields(title, description);
  const updated = await prisma.announcement.update({ where: { id }, data: { title, description }, include: announcementInclude });
  events.emit('announcement.updated', { announcementId: id });
  return updated;
}

export async function deleteAnnouncement(id: number, editor: Pick<DbUser, 'role' | 'houseId'>): Promise<void> {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw errors.notFound('Объявление не найдено');
  if (!canManageAnnouncements(editor, existing.houseId)) {
    throw errors.forbidden('Удалить объявление может УК или председатель ТСЖ этого дома');
  }
  await prisma.announcement.delete({ where: { id } });
  events.emit('announcement.deleted', {
    announcementId: id,
    houseId: existing.houseId,
    chatMessageId: existing.chatMessageId,
    title: existing.title,
  });
}
