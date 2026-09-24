import type { Request, Response } from 'express';
import { z } from 'zod';
import { searchAddress } from '../services/geo.js';
import { findOrCreateHouseAt, listHouses, lookupHouseAt, setVotePercent } from '../services/users.js';
import { serializeHouse } from '../routes/serialize.js';
import { idParam, parseBody, parseQuery } from '../routes/validation.js';

export async function list(_req: Request, res: Response) {
  const houses = await listHouses();
  res.json(houses.map((house) => serializeHouse(house, { residentsCount: house._count.residents })));
}

const pointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

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
  const { q } = parseQuery(z.object({ q: z.string().trim().min(3).max(200) }), req);
  res.json(await searchAddress(q));
}

const votePercentSchema = z.object({
  votePercent: z.coerce.number().int().min(0).max(100),
});

export async function updateVotePercent(req: Request, res: Response) {
  const { votePercent } = parseBody(votePercentSchema, req);
  const house = await setVotePercent(idParam(req), votePercent);
  res.json(serializeHouse(house));
}
