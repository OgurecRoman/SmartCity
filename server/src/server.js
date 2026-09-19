import { createApp } from './app.js';
import { createBot, prepareBot } from './bot/index.js';

import { assertConfig, config } from './config.js';
import { startExpireJob, stopExpireJob } from './jobs/expire.js';
import { prisma } from './lib/db.js';
import { log } from './lib/logger.js';

async function main() {
  assertConfig();
  await prisma.$connect();
  log.info('База данных подключена');

  let bot = null;
  let webhookHandler;

  if (config.bot.enabled) {
    bot = createBot();
    await prepareBot(bot);
    if (config.bot.mode === 'webhook') {
      webhookHandler = await bot.createWebhook({
        domain: config.bot.webhookDomain,
        path: config.bot.webhookPath,
        secret: config.bot.webhookSecret,
      });
      log.info(`Вебхук зарегистрирован: ${config.bot.webhookDomain}${config.bot.webhookPath}`);
    }
  } else {
    log.warn('Бот выключен: MAX_BOT_TOKEN не задан или BOT_ENABLED=false. Запускается только API.');
  }

  const app = createApp({ webhookHandler });
  const server = await new Promise((resolve) => {
    const instance = app.listen(config.port, () => resolve(instance));
  });
  log.info(`HTTP-сервер запущен на порту ${config.port}`);

  if (bot && config.bot.mode === 'polling') {
    bot.start({ mode: 'polling' }).catch((error) => {
      log.error('Long polling остановлен с ошибкой', error);
      process.exitCode = 1;
    });
    log.info('Бот получает обновления через long polling');
  }

  startExpireJob();

  const shutdown = async (signal) => {
    log.info(`Получен ${signal}, останавливаемся…`);
    stopExpireJob();
    try {
      if (bot) {
        if (config.bot.mode === 'polling') bot.stopPolling();
        else await bot.stopWebhook();
      }
      await new Promise((resolve) => server.close(() => resolve()));
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
