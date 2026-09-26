import { z } from 'zod';

export const pointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const geoSearchQuerySchema = z.object({
  q: z.string().trim().min(3).max(200),
});

export const votePercentSchema = z.object({
  votePercent: z.coerce.number().int().min(0).max(100),
});
