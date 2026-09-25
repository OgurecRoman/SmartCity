import { z } from 'zod';
import { UK_SETTABLE_STATUSES } from '../services/rules.js';
import { REQUEST_CATEGORIES, chatId, maxId, photoFilenames, positiveInt } from './common.js';

// Схемы ручек /api/bot/* (см. controllers/bot.ts). Бот передаёт пользователя явно (userId/maxUserId),
// т.к. авторизации через MaxInitData у него нет.

// --- Пользователи ---

export const upsertUserSchema = z.object({
  maxUserId: maxId,
  firstName: z.string().min(1),
  lastName: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
});

export const promoteSchema = z.object({ userId: positiveInt, code: z.string() });
export const maxUserSchema = z.object({ maxUserId: maxId });
export const maxUserHouseSchema = z.object({ maxUserId: maxId, houseId: positiveInt });
export const addTenantSchema = z.object({ ownerId: positiveInt, maxUserId: maxId, apartment: z.string().trim().min(1).max(20) });

// --- Дома ---

export const bindChatSchema = z.object({ chatId, chatTitle: z.string().nullable().optional() });
export const unbindChatSchema = z.object({ chatId });

// --- Заявки ---

export const getVotesQuerySchema = z.object({
  requestId: positiveInt,
  excludeUserId: positiveInt.optional(),
});

export const listRequestsQuerySchema = z.object({
  authorId: positiveInt.optional(),
  supportedByUserId: positiveInt.optional(),
  statuses: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const userIdSchema = z.object({ userId: positiveInt });
export const hasVotedQuerySchema = userIdSchema;

export const createRequestSchema = z.object({
  authorId: positiveInt,
  category: z.enum(REQUEST_CATEGORIES),
  description: z.string().trim().min(5).max(2000),
  priority: z.enum(['NORMAL', 'EMERGENCY']).default('NORMAL'),
  deadline: z.string().datetime().nullable().optional(),
  photos: photoFilenames.optional(),
});

export const changeStatusSchema = z.object({
  byUserId: positiveInt,
  status: z.enum(UK_SETTABLE_STATUSES as unknown as [string, ...string[]]),
  comment: z.string().trim().max(1000).nullable().optional(),
  organizationId: positiveInt.optional(),
  resolutionNote: z.string().trim().max(2000).optional(),
  resolvedByName: z.string().trim().max(150).optional(),
  photos: photoFilenames.optional(),
});

export const reopenRequestSchema = z.object({
  userId: positiveInt,
  reason: z.string().trim().min(5).max(1000),
  photos: photoFilenames.min(1),
});

export const chatMessageSchema = z.object({ messageId: z.string().min(1) });

// --- Заявки на вступление ---

export const applicantQuerySchema = z.object({ applicantId: positiveInt });
export const reviewerQuerySchema = z.object({ reviewerId: positiveInt });
export const reviewerSchema = reviewerQuerySchema;
export const rejectMembershipSchema = z.object({ reviewerId: positiveInt, reason: z.string().trim().min(3).max(500) });

export const submitMembershipSchema = z.object({
  applicantId: positiveInt,
  houseId: positiveInt,
  apartment: z.string().trim().min(1).max(20),
  fullName: z.string().trim().min(3).max(150),
});

// --- Объявления и новости ---

export const createAnnouncementSchema = z.object({
  houseId: positiveInt,
  authorId: positiveInt,
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(2000),
  photos: photoFilenames.optional(),
});

export const createNewsSchema = createAnnouncementSchema.extend({ contact: z.string().trim().min(3).max(200) });

// --- Очередь уведомлений и dev ---

export const outboxQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

export const devResetSchema = z.object({
  maxUserIds: z.array(maxId).min(1).max(20),
  unbindChatOfHouseIds: z.array(positiveInt).optional(),
});
