import http from 'node:http';
import { createBot, prepareBot } from './bot/index.js';
import { startOutboxConsumer, stopOutboxConsumer } from './bot/outboxConsumer.js';
import { assertConfig, config } from './config.js';
import { prisma } from './lib/db.js';
import { log } from './lib/logger.js';
import './lib/bigint.js';

async function main(): Promise<void> {
  assertConfig();
  if (!config.bot.enabled) {
    log.warn('Бот выключен: MAX_BOT_TOKEN не задан или BOT_ENABLED=false. Процесс бота завершается.');
    return;
  }

  await prisma.$connect();
  log.info('База данных подключена (бот)');

  const bot = createBot();
  await prepareBot(bot);

  let webhookServer: http.Server | null = null;
  if (config.bot.mode === 'webhook') {
    const webhookHandler = await bot.createWebhook({
      domain: config.bot.webhookDomain,
      path: config.bot.webhookPath,
      secret: config.bot.webhookSecret,
    });
    webhookServer = http.createServer(webhookHandler);
    await new Promise<void>((resolve) => webhookServer!.listen(config.bot.webhookPort, () => resolve()));
    log.info(`Вебхук бота слушает порт ${config.bot.webhookPort} (внешний адрес: ${config.bot.webhookDomain}${config.bot.webhookPath})`);
  } else {
    bot.start({ mode: 'polling' }).catch((error) => {
      log.error('Long polling остановлен с ошибкой', error);
      process.exitCode = 1;
    });
    log.info('Бот получает обновления через long polling');
  }

  startOutboxConsumer();
  log.info('Обработка очереди уведомлений запущена');

  const shutdown = async (signal: string) => {
    log.info(`Получен ${signal}, останавливаемся (бот)…`);
    stopOutboxConsumer();
    try {
      if (config.bot.mode === 'polling') bot.stopPolling();
      else await bot.stopWebhook();
      if (webhookServer) await new Promise<void>((resolve) => webhookServer!.close(() => resolve()));
      await prisma.$disconnect();
    } catch (error) {
      log.error('Ошибка при остановке бота', error);
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  log.error('Не удалось запустить бота', error);
  process.exit(1);
});
