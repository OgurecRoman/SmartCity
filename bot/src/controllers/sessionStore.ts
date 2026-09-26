import type { AsyncSessionStore } from '@maxhub/max-bot-api';
import { deleteSession, getSession, setSession } from '../lib/api.js';

/** Состояние сценариев хранится на бэкенде (таблица BotSession) — бот к БД напрямую не ходит. */
export class ApiSessionStore<T extends object> implements AsyncSessionStore<T> {
  async get(key: string): Promise<T | undefined> {
    return (await getSession<T>(key)) ?? undefined;
  }

  async set(key: string, value: T): Promise<void> {
    await setSession(key, value);
  }

  async delete(key: string): Promise<void> {
    await deleteSession(key);
  }
}
