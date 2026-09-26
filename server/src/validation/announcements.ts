import { z } from 'zod';
import { pagination, positiveInt } from './common.js';

export const listAnnouncementsQuerySchema = z.object({
  houseId: positiveInt.optional(),
  ...pagination,
});

export const createAnnouncementSchema = z.object({
  houseId: z.number().int().positive().optional(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(2000),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(5).max(2000).optional(),
});
