import { config } from '../config.js';
import { ackOutbox, listOutbox } from '../lib/api.js';
import { events } from '../lib/events.js';
import { log } from '../lib/logger.js';
let running = false;
export async function drainOutboxOnce() {
    if (running)
        return;
    running = true;
    try {
        const rows = await listOutbox(50);
        for (const row of rows) {
            try {
                await events.dispatch(row.event, row.payload);
            }
            catch (error) {
                log.error(`Ошибка диспетчеризации события ${row.event}`, error);
            }
            await ackOutbox(row.id).catch(() => { });
        }
    }
    catch (error) {
        log.error('Ошибка обработки очереди уведомлений', error);
    }
    finally {
        running = false;
    }
}
let timer = null;
export function startOutboxConsumer() {
    if (timer)
        return;
    void drainOutboxOnce();
    timer = setInterval(() => void drainOutboxOnce(), config.jobs.outboxPollIntervalSec * 1000);
    timer.unref();
}
export function stopOutboxConsumer() {
    if (timer)
        clearInterval(timer);
    timer = null;
}
//# sourceMappingURL=outboxConsumer.js.map