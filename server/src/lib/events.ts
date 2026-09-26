import type { RequestStatus } from '@prisma/client';
import { prisma } from './db.js';
import { log } from './logger.js';

export interface AppEvents {
  'request.created': { requestId: number };
  'request.voted': { requestId: number; userId: number };
  'request.submitted': { requestId: number };
  'request.status_changed': {
    requestId: number;
    oldStatus: RequestStatus;
    newStatus: RequestStatus;
    changedById: number | null;
    comment: string | null;
  };
  'request.deleted': { requestId: number; houseId: number; chatMessageId: string | null; title: string };
  'request.expired': { requestId: number };
  'request.reopened': { requestId: number; reason: string; photos: string[] };
  'announcement.created': { announcementId: number };
  'announcement.updated': { announcementId: number };
  'announcement.deleted': { announcementId: number; houseId: number; chatMessageId: string | null; title: string };
  'news.created': { newsId: number };
  'news.updated': { newsId: number };
  'news.deleted': { newsId: number; houseId: number; chatMessageId: string | null; title: string };
  'membership.requested': { requestId: number };
  'membership.approved': { requestId: number };
  'membership.rejected': { requestId: number };
  'tenant.added': { houseId: number; ownerId: number; tenantId: number; apartment: string };
}

type Handler<K extends keyof AppEvents> = (payload: AppEvents[K]) => Promise<void> | void;
const handlers = new Map<keyof AppEvents, Handler<keyof AppEvents>[]>();

async function enqueue<K extends keyof AppEvents>(name: K, payload: AppEvents[K]): Promise<void> {
  try {
    await prisma.notificationOutbox.create({ 
      data: { event: name, payload: payload as object } 
    });
  } catch (error) {
    log.error(`Не удалось поставить событие ${name} в очередь уведомлений`, error);
  }
}

export const events = {
  on<K extends keyof AppEvents>(name: K, handler: Handler<K>): void {
    const list = (handlers.get(name) ?? []) as Handler<K>[];
    list.push(handler);
    handlers.set(name, list as Handler<keyof AppEvents>[]);
  },
  
  emit<K extends keyof AppEvents>(name: K, payload: AppEvents[K]): void {
    void enqueue(name, payload);
  },

  async dispatch<K extends keyof AppEvents>(name: K, payload: AppEvents[K]): Promise<void> {
    const list = (handlers.get(name) ?? []) as Handler<K>[];
    for (const handler of list) {
      try {
        await handler(payload);
      } catch (error) {
        log.error(`Обработчик события ${name} завершился с ошибкой`, error);
      }
    }
  },
};