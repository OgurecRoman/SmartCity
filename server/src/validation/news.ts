import { z } from 'zod';
import { pagination, positiveInt } from './common.js';

export const listNewsQuerySchema = z.object({
  houseId: positiveInt.optional(),
  ...pagination,
});

export const createNewsSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(2000),
  contact: z.string().trim().min(3).max(200),
});

export const updateNewsSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(5).max(2000).optional(),
  contact: z.string().trim().min(3).max(200).optional(),
});
