import type { AsyncSessionStore } from '@maxhub/max-bot-api';
import { prisma } from '../lib/db.js';
import type { Prisma } from '@prisma/client';

export class PrismaSessionStore<T extends object> implements AsyncSessionStore<T> {
  async get(key: string): Promise<T | undefined> {
    const row = await prisma.botSession.findUnique({ where: { key } });
    return row ? (row.value as T) : undefined;
  }

  async set(key: string, value: T): Promise<void> {
    const json = value as unknown as Prisma.InputJsonValue;
    await prisma.botSession.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
  }

  async delete(key: string): Promise<void> {
    await prisma.botSession.deleteMany({ where: { key } });
  }
}
