import type { Request, Response } from 'express';
import { z } from 'zod';
import { listResidentsOfHouse } from '../services/users.js';
import { serializeResident } from '../routes/serialize.js';
import { parseQuery } from '../routes/validation.js';

const listQuerySchema = z.object({
  houseId: z.coerce.number().int().positive(),
});

export async function list(req: Request, res: Response) {
  const { houseId } = parseQuery(listQuerySchema, req);
  const residents = await listResidentsOfHouse(houseId);
  res.json(residents.map(serializeResident));
}
