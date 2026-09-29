import type { Request, Response } from 'express';
import { searchAddress } from '../services/geo.js';
import { errors } from '../lib/errors.js';
import {
  appointChairman,
  assertEmployeeHouseAccess,
  deleteHouse,
  detachResident,
  dismissChairman,
  findOrCreateHouseAt,
  getChairmanOf,
  getUserById,
  isEmployee,
  listHouses,
  lookupHouseAt,
  setVotePercent,
} from '../services/users.js';
import { serializeHouse, serializeUser } from '../routes/serialize.js';
import { chairmanSchema, geoSearchQuerySchema, pointSchema, votePercentSchema } from '../validation/houses.js';
import { idParam, parseBody, parseQuery } from '../validation/parse.js';

export async function list(req: Request, res: Response) {
  const companyId = isEmployee(req.user!) ? req.user!.companyId : undefined;
  const houses = await listHouses(companyId === null ? -1 : companyId);
  res.json(houses.map((house: any) => serializeHouse(house, { residentsCount: house._count.residents })));
}

export async function lookup(req: Request, res: Response) {
  const { lat, lng } = parseQuery(pointSchema, req);
  const { building, house } = await lookupHouseAt(lat, lng);
  res.json({ building, house: house ? serializeHouse(house) : null });
}

export async function create(req: Request, res: Response) {
  const { lat, lng } = parseBody(pointSchema, req);
  let forCompanyId: number | undefined;
  if (isEmployee(req.user!)) {
    if (req.user!.companyId == null) throw errors.forbidden('Сотрудник УК не привязан к компании');
    forCompanyId = req.user!.companyId;
  }
  const { house, created } = await findOrCreateHouseAt(lat, lng, forCompanyId);
  res.status(created ? 201 : 200).json(serializeHouse(house));
}

export async function searchGeo(req: Request, res: Response) {
  const { q } = parseQuery(geoSearchQuerySchema, req);
  res.json(await searchAddress(q));
}

export async function remove(req: Request, res: Response) {
  const houseId = idParam(req);
  await assertEmployeeHouseAccess(req.user!, houseId);
  await deleteHouse(houseId);
  res.status(204).end();
}

export async function setChairman(req: Request, res: Response) {
  const houseId = idParam(req);
  await assertEmployeeHouseAccess(req.user!, houseId);
  const { userId } = parseBody(chairmanSchema, req);
  const target = await getUserById(userId);
  if (!target) throw errors.notFound('Пользователь не найден');
  res.json(serializeUser(await appointChairman(target.maxUserId, houseId)));
}

export async function unsetChairman(req: Request, res: Response) {
  const houseId = idParam(req);
  await assertEmployeeHouseAccess(req.user!, houseId);
  const chairman = await getChairmanOf(houseId);
  if (!chairman) throw errors.notFound('У этого дома нет председателя ТСЖ');
  res.json(serializeUser(await dismissChairman(chairman.maxUserId)));
}

export async function removeResident(req: Request, res: Response) {
  const houseId = idParam(req);
  await assertEmployeeHouseAccess(req.user!, houseId);
  const target = await getUserById(idParam(req, 'userId'));
  if (!target) throw errors.notFound('Пользователь не найден');
  res.json(serializeUser(await detachResident(target.maxUserId, houseId)));
}

export async function updateVotePercent(req: Request, res: Response) {
  const houseId = idParam(req);
  await assertEmployeeHouseAccess(req.user!, houseId);
  const { votePercent } = parseBody(votePercentSchema, req);
  const house = await setVotePercent(houseId, votePercent);
  res.json(serializeHouse(house));
}
