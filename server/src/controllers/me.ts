import type { Request, Response } from 'express';
import { prisma } from '../lib/db.js';
import { getLatestMembershipRequestFor, submitMembershipRequest } from '../services/membership.js';
import * as usersService from '../services/users.js';
import { serializeMembershipRequest, serializeUser, serializeUserHouse } from '../routes/serialize.js';
import { activeHouseSchema, submitMembershipSchema } from '../validation/me.js';
import { idParam, parseBody } from '../validation/parse.js';

async function housesOf(user: usersService.DbUser) {
  const [approved, pending] = await Promise.all([
    usersService.listUserHouses(user.id),
    prisma.membershipRequest.findMany({
      where: { applicantId: user.id, status: 'PENDING' },
      include: { house: { select: { id: true, address: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return [
    ...approved.map((row) => serializeUserHouse(row, { status: 'APPROVED', active: row.houseId === user.houseId })),
    ...pending.map((request) =>
      serializeUserHouse(
        { houseId: request.houseId, apartment: request.apartment, residentType: null, house: request.house },
        { status: 'PENDING', active: false, membershipRequestId: request.id },
      ),
    ),
  ];
}

export async function get(req: Request, res: Response) {
  const user = req.user!;
  let membership = null;
  if (!user.onboardedAt) {
    const latest = await getLatestMembershipRequestFor(user.id);
    if (latest && latest.status !== 'APPROVED') membership = serializeMembershipRequest(latest);
  }
  res.json({ ...serializeUser(user), membership, houses: await housesOf(user) });
}

export async function update(req: Request, res: Response) {
  const input = parseBody(submitMembershipSchema, req);
  const request = await submitMembershipRequest({ applicantId: req.user!.id, ...input });
  res.status(202).json({ membership: serializeMembershipRequest(request) });
}

export async function listHouses(req: Request, res: Response) {
  res.json({ items: await housesOf(req.user!) });
}

export async function setActiveHouse(req: Request, res: Response) {
  const input = parseBody(activeHouseSchema, req);
  const user = await usersService.setActiveHouse(req.user!.id, input.houseId);
  res.json({ ...serializeUser(user), houses: await housesOf(user) });
}

export async function leaveHouse(req: Request, res: Response) {
  const user = await usersService.leaveHouse(req.user!.id, idParam(req, 'houseId'));
  res.json({ ...serializeUser(user), houses: await housesOf(user) });
}
