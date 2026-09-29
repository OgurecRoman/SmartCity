import type { Request, Response } from 'express';
import { errors } from '../lib/errors.js';
import {
  assertEmployeeHouseAccess,
  isChairman,
  isEmployee,
  listResidentsOfHouse,
} from '../services/users.js';
import { serializeResident } from '../routes/serialize.js';
import { parseQuery } from '../validation/parse.js';
import { listResidentsQuerySchema } from '../validation/residents.js';

export async function list(req: Request, res: Response) {
  const user = req.user!;
  const { houseId } = parseQuery(listResidentsQuerySchema, req);

  if (isEmployee(user)) {
    await assertEmployeeHouseAccess(user, houseId);
  } else if (isChairman(user)) {
    if (user.chairmanHouseId !== houseId) {
      throw errors.forbidden('Председатель ТСЖ видит жителей только своего дома');
    }
  } else {
    throw errors.forbidden('Список жителей доступен УК и председателю ТСЖ');
  }

  const residents = await listResidentsOfHouse(houseId);
  res.json(residents.map(serializeResident));
}
