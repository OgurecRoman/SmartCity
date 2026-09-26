
import { prisma } from '../lib/db.js';

export async function getVotes(requestId: number, excludeUserId: number | undefined) {
    const votes = await prisma.vote.findMany({
        where: { requestId, ...(excludeUserId ? { userId: { not: excludeUserId } } : {}) },
        select: { user: { select: { maxUserId: true } } },
    });

  return votes;
}