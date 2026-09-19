import { prisma } from '../lib/db.js';

/** Хранилище сессий бота в PostgreSQL: пошаговые сценарии переживают перезапуск. */
export class PrismaSessionStore {
  async get(key) {
    const row = await prisma.botSession.findUnique({ where: { key } });
    return row ? row.value : undefined;
  }

  async set(key, value) {
    await prisma.botSession.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  async delete(key) {
    await prisma.botSession.deleteMany({ where: { key } });
  }
}
