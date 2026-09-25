import type { Request, Response } from 'express';
import { errors } from '../lib/errors.js';
import { listCamerasOfHouse } from '../services/cameras.js';
import { isEmployee } from '../services/users.js';
import { serializeCamera } from '../routes/serialize.js';
import { listCamerasQuerySchema } from '../validation/cameras.js';
import { parseQuery } from '../validation/parse.js';

export async function list(req: Request, res: Response) {
  const user = req.user!;
  const query = parseQuery(listCamerasQuerySchema, req);

  let houseId: number;
  if (isEmployee(user)) {
    if (!query.houseId) throw errors.badRequest('Укажите дом (houseId)');
    houseId = query.houseId;
  } else {
    if (!user.houseId || !user.onboardedAt) {
      throw errors.badRequest('Сначала дождитесь подтверждения от председателя ТСЖ или УК', 'onboarding_required');
    }
    houseId = user.houseId;
  }

  const cameras = await listCamerasOfHouse(houseId);
  res.json(cameras.map(serializeCamera));
}
