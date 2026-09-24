import type { Request, Response } from 'express';
import { z } from 'zod';
import { errors } from '../lib/errors.js';
import { listCamerasOfHouse } from '../services/cameras.js';
import { isEmployee } from '../services/users.js';
import { serializeCamera } from '../routes/serialize.js';
import { parseQuery } from '../routes/validation.js';

const listQuerySchema = z.object({
  houseId: z.coerce.number().int().positive().optional(),
});

export async function list(req: Request, res: Response) {
  const user = req.user!;
  const query = parseQuery(listQuerySchema, req);

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
