import { EventEmitter } from 'node:events';
import type { RequestStatus } from '@prisma/client';
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
}

type Handler<K extends keyof AppEvents> = (payload: AppEvents[K]) => Promise<void> | void;

const emitter = new EventEmitter();

export const events = {
  on<K extends keyof AppEvents>(name: K, handler: Handler<K>): void {
    emitter.on(name, (payload: AppEvents[K]) => {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((error) => log.error(`Обработчик события ${name} завершился с ошибкой`, error));
    });
  },
  emit<K extends keyof AppEvents>(name: K, payload: AppEvents[K]): void {
    emitter.emit(name, payload);
  },
};
