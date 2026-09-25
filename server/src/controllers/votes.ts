import type { Request, Response } from 'express';
import { getVotes } from '../services/votes.js'
import { log } from '../lib/logger.js';
import { z } from 'zod';

export const getVotesSchema = z.object({
  requestId: z.coerce.number().int().positive(),
  excludeUserId: z.coerce.number().int().positive().optional(),
});

export async function getVotesController(req: Request, res: Response): Promise<void> {
  try {
    const parseResult = getVotesSchema.safeParse(req.query);
    
    if (!parseResult.success) {
      res.status(400).json({ 
        error: 'Invalid query parameters', 
        details: parseResult.error.flatten().fieldErrors 
      });
      return;
    }

    const { requestId, excludeUserId } = parseResult.data;

    
    const votes = await getVotes(requestId, excludeUserId);;

    res.json({ votes });
  } catch (error) {
    log.error('Error in getVotesController', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}