import { z } from 'zod';

export const submitMembershipSchema = z.object({
  houseId: z.number().int().positive(),
  apartment: z.string().trim().min(1).max(10),
  fullName: z.string().trim().min(3).max(150),
});
