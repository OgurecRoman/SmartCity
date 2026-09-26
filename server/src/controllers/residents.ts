import type { Request, Response } from 'express';
import { listResidentsOfHouse } from '../services/users.js';
import { serializeResident } from '../routes/serialize.js';
import { parseQuery } from '../validation/parse.js';
import { listResidentsQuerySchema } from '../validation/residents.js';

export async function list(req: Request, res: Response) {
  const { houseId } = parseQuery(listResidentsQuerySchema, req);
  const residents = await listResidentsOfHouse(houseId);
  res.json(residents.map(serializeResident));
}
