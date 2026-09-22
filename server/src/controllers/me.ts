import type { Request, Response } from 'express';
import { z } from 'zod';
import { getLatestMembershipRequestFor, submitMembershipRequest } from '../services/membership.js';
import { serializeMembershipRequest, serializeUser } from '../routes/serialize.js';
import { parseBody } from '../routes/validation.js';

export async function get(req: Request, res: Response) {
  const user = req.user!;
  let membership = null;
  if (!user.onboardedAt) {
    const latest = await getLatestMembershipRequestFor(user.id);
    if (latest && latest.status !== 'APPROVED') membership = serializeMembershipRequest(latest);
  }
  res.json({ ...serializeUser(user), membership });
}

const submitSchema = z.object({
  houseId: z.number().int().positive(),
  apartment: z.string().trim().min(1).max(10),
  fullName: z.string().trim().min(3).max(150),
});

export async function update(req: Request, res: Response) {
  const input = parseBody(submitSchema, req);
  const request = await submitMembershipRequest({ applicantId: req.user!.id, ...input });
  res.status(202).json({ membership: serializeMembershipRequest(request) });
}
