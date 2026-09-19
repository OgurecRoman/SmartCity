import { config } from '../config.js';
import { log } from '../lib/logger.js';
import { expireOverdue } from '../services/requests.js';

let timer = null;

async function tick() {
  try {
    const expired = await expireOverdue();
    if (expired.length > 0) log.info(`Истёк срок сбора подписей у заявок: ${expired.join(', ')}`);
  } catch (error) {
    log.error('Ошибка проверки просроченных заявок', error);
  }
}

/** Периодически закрывает заявки, у которых истёк срок сбора подписей. */
export function startExpireJob() {
  if (timer) return;
  void tick();
  timer = setInterval(() => void tick(), config.jobs.expireIntervalSec * 1000);
  timer.unref();
}

export function stopExpireJob() {
  if (timer) clearInterval(timer);
  timer = null;
}
