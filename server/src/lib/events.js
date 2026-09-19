import { EventEmitter } from 'node:events';

import { log } from './logger.js';

const emitter = new EventEmitter();

export const events = {
  on(name, handler) {
    emitter.on(name, (payload) => {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((error) => log.error(`Обработчик события ${name} завершился с ошибкой`, error));
    });
  },
  emit(name, payload) {
    emitter.emit(name, payload);
  },
};
