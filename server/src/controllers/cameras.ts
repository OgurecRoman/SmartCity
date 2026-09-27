import type { Request, Response } from 'express';
import { listCamerasOfHouse } from '../services/cameras.js';
import { resolveHouseFor } from '../services/users.js';
import { serializeCamera } from '../routes/serialize.js';
import { listCamerasQuerySchema } from '../validation/cameras.js';
import { parseQuery } from '../validation/parse.js';

export async function list(req: Request, res: Response) {
  const user = req.user!;
  const query = parseQuery(listCamerasQuerySchema, req);

  const houseId = await resolveHouseFor(user, query.houseId);

  const cameras = await listCamerasOfHouse(houseId);
  res.json(cameras.map(serializeCamera));
}
