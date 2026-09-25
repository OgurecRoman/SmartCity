import path from 'node:path';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { MulterError } from 'multer';
import { config } from './config.js';
import { isAppError } from './lib/errors.js';
import { log } from './lib/logger.js';
import { apiRouter } from './routes/index.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './lib/swagger.js';
import './lib/bigint.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((item) => item.trim()) }));
  app.use(express.json({ limit: '1mb' }));
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'backend', time: new Date().toISOString() });
  });

  app.use('/api', apiRouter);
  app.use('/uploads', express.static(path.resolve(import.meta.dirname, '..', 'uploads')));

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
    if (error instanceof MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'Фото слишком большое (максимум 8 МБ)' : 'Слишком много фото (максимум 5)';
      res.status(400).json({ error: { code: 'invalid_upload', message } });
      return;
    }
    log.error('Необработанная ошибка API', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Внутренняя ошибка сервера' } });
  });

  return app;
}
