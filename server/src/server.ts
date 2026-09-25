import type { Server } from 'node:http';
import { createApp } from './app.js';
import { assertConfig, config } from './config.js';
import { startExpireJob, stopExpireJob } from './jobs/expire.js';
import { prisma } from './lib/db.js';
import { log } from './lib/logger.js';

async function main(): Promise<void> {
  assertConfig();
  await prisma.$connect();
  log.info('База данных подключена');

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const instance = app.listen(config.port, () => resolve(instance));
  });
  log.info(`HTTP-сервер запущен на порту ${config.port}`);

  startExpireJob();

  const shutdown = async (signal: string) => {
    log.info(`Получен ${signal}, останавливаемся…`);
    stopExpireJob();
    try {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await prisma.$disconnect();
    } catch (error) {
      log.error('Ошибка при остановке', error);
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  log.error('Не удалось запустить сервер', error);
  process.exit(1);
});
