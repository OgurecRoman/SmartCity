import type { Request, Response } from 'express';
import { getLatestMembershipRequestFor, submitMembershipRequest } from '../services/membership.js';
import { serializeMembershipRequest, serializeUser } from '../routes/serialize.js';
import { submitMembershipSchema } from '../validation/me.js';
import { parseBody } from '../validation/parse.js';

export async function get(req: Request, res: Response) {
  const user = req.user!;
  let membership = null;
  if (!user.onboardedAt) {
    const latest = await getLatestMembershipRequestFor(user.id);
    if (latest && latest.status !== 'APPROVED') membership = serializeMembershipRequest(latest);
  }
  res.json({ ...serializeUser(user), membership });
}

export async function update(req: Request, res: Response) {
  const input = parseBody(submitMembershipSchema, req);
  const request = await submitMembershipRequest({ applicantId: req.user!.id, ...input });
  res.status(202).json({ membership: serializeMembershipRequest(request) });
}
