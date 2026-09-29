import { z } from 'zod';
import { CATEGORY_LABELS, STATUS_LABELS } from '../lib/labels.js';
import { MAX_PHOTOS_PER_ITEM } from '../lib/photoStorage.js';

export const REQUEST_STATUSES = Object.keys(STATUS_LABELS) as [string, ...string[]];
export const REQUEST_CATEGORIES = Object.keys(CATEGORY_LABELS) as [string, ...string[]];

export const positiveInt = z.coerce.number().int().positive();

export const maxId = z.string().regex(/^\d{1,18}$/, 'MAX ID должен быть числом');
export const chatId = z.string().regex(/^-?\d{1,18}$/, 'chat_id должен быть числом');

export const photoFilenames = z.array(z.string().regex(/^[\w.-]+$/)).max(MAX_PHOTOS_PER_ITEM);

export const pagination = {
  limit: z.coerce.number().int().min(1).max(200).default(5),
  offset: z.coerce.number().int().min(0).default(0),
};
