import type { Request, Response } from 'express';
import { z } from 'zod';
import { completeOnboarding } from '../services/users.js';
import { serializeUser } from '../routes/serialize.js';
import { parseBody } from '../routes/validation.js';

export function get(req: Request, res: Response) {
  res.json(serializeUser(req.user!));
}

const onboardingSchema = z.object({
  houseId: z.number().int().positive(),
  apartment: z.string().trim().min(1).max(10),
  residentType: z.enum(['OWNER', 'TENANT']),
});

export async function update(req: Request, res: Response) {
  const input = parseBody(onboardingSchema, req);
  const user = await completeOnboarding(req.user!.id, input);
  res.json(serializeUser(user));
}
