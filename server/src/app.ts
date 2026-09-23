import path from 'node:path';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import { isAppError } from './lib/errors.js';
import { log } from './lib/logger.js';
import { apiRouter } from './routes/index.js';
import './lib/bigint.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((item) => item.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', bot: config.bot.enabled ? config.bot.mode : 'disabled', time: new Date().toISOString() });
  });

  app.use('/api', apiRouter);

  app.use('/app', express.static(path.resolve(import.meta.dirname, '..', 'public')));
  app.get('/', (_req, res) => res.redirect('/app/'));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Маршрут не найден' } });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (isAppError(error)) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error && typeof error === 'object' && 'type' in error && (error as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'invalid_json', message: 'Некорректный JSON в теле запроса' } });
      return;
    }
    log.error('Необработанная ошибка API', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Внутренняя ошибка сервера' } });
  });

  return app;
}
