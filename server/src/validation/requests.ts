import { z } from 'zod';
import { UK_SETTABLE_STATUSES } from '../services/rules.js';
import { REQUEST_CATEGORIES, pagination, positiveInt } from './common.js';

export const listRequestsQuerySchema = z.object({
  filter: z.enum(['all', 'mine', 'supported']).default('all'),
  status: z.string().optional(),
  category: z.string().optional(),
  houseId: positiveInt.optional(),
  ...pagination,
});

export const createRequestSchema = z.object({
  category: z.enum(REQUEST_CATEGORIES),
  description: z.string().trim().min(5).max(2000),
  title: z.string().trim().max(120).optional(),
  priority: z.enum(['NORMAL', 'EMERGENCY']).default('NORMAL'),
  deadline: z.string().trim().optional(),
});

export const reopenRequestSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export const rateRequestSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
});

export const updateStatusSchema = z.object({
  status: z.enum(UK_SETTABLE_STATUSES as unknown as [string, ...string[]]),
  comment: z.string().trim().max(1000).optional(),
  organizationId: positiveInt.optional(),
  resolutionNote: z.string().trim().max(2000).optional(),
  resolvedByName: z.string().trim().max(150).optional(),
});
