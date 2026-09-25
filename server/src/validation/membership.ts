import { z } from 'zod';
import { pagination } from './common.js';

export const listMembershipQuerySchema = z.object({ ...pagination });

export const rejectMembershipSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
