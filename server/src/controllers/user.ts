import type { Request, Response } from 'express';
import { z } from 'zod';
import { upsertFromMax } from '../services/users.js';
import { log } from '../lib/logger.js';

export const upsertUserSchema = z.object({
  maxUserId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
});

export async function upsertUserController(req: Request, res: Response): Promise<void> {
  try {
    const parseResult = upsertUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ 
        error: 'Invalid request body', 
        details: parseResult.error.issues 
      });
      return;
    }

    const dto = parseResult.data;

    const user = await upsertFromMax({
      maxUserId: BigInt(dto.maxUserId),
      firstName: dto.firstName,
      lastName: dto.lastName,
      username: dto.username,
    });

    res.json({user});
  } catch (error) {
    log.error('Error in upsertUserController', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}