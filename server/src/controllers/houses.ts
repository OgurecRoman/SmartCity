import type { Request, Response } from 'express';
import { searchAddress } from '../services/geo.js';
import { findOrCreateHouseAt, listHouses, lookupHouseAt, setVotePercent } from '../services/users.js';
import { serializeHouse } from '../routes/serialize.js';
import { geoSearchQuerySchema, pointSchema, votePercentSchema } from '../validation/houses.js';
import { idParam, parseBody, parseQuery } from '../validation/parse.js';

export async function list(_req: Request, res: Response) {
  const houses = await listHouses();
  res.json(houses.map((house: any) => serializeHouse(house, { residentsCount: house._count.residents })));
}

export async function lookup(req: Request, res: Response) {
  const { lat, lng } = parseQuery(pointSchema, req);
  const { building, house } = await lookupHouseAt(lat, lng);
  res.json({ building, house: house ? serializeHouse(house) : null });
}

export async function create(req: Request, res: Response) {
  const { lat, lng } = parseBody(pointSchema, req);
  const { house, created } = await findOrCreateHouseAt(lat, lng);
  res.status(created ? 201 : 200).json(serializeHouse(house));
}

export async function searchGeo(req: Request, res: Response) {
  const { q } = parseQuery(geoSearchQuerySchema, req);
  res.json(await searchAddress(q));
}

export async function updateVotePercent(req: Request, res: Response) {
  const { votePercent } = parseBody(votePercentSchema, req);
  const house = await setVotePercent(idParam(req), votePercent);
  res.json(serializeHouse(house));
}
