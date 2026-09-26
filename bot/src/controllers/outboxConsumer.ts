import { config } from '../config.js';
import { ackOutbox, listOutbox } from '../lib/api.js';
import { events, type AppEvents } from '../lib/events.js';
import { log } from '../lib/logger.js';

let running = false;

/** Забирает накопившиеся события из NotificationOutbox (через бэкенд), рассылает уведомления и подтверждает обработку. */
export async function drainOutboxOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const rows = await listOutbox(50);
    for (const row of rows) {
      try {
        await events.dispatch(row.event as keyof AppEvents, row.payload as AppEvents[keyof AppEvents]);
      } catch (error) {
        log.error(`Ошибка диспетчеризации события ${row.event}`, error);
      }
      await ackOutbox(row.id).catch(() => {});
    }
  } catch (error) {
    log.error('Ошибка обработки очереди уведомлений', error);
  } finally {
    running = false;
  }
}

let timer: NodeJS.Timeout | null = null;

export function startOutboxConsumer(): void {
  if (timer) return;
  void drainOutboxOnce();
  timer = setInterval(() => void drainOutboxOnce(), config.jobs.outboxPollIntervalSec * 1000);
  timer.unref();
}

export function stopOutboxConsumer(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
