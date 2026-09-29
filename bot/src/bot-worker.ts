import http from 'node:http';
import { assertConfig, config } from './config.js';
import { createBot, prepareBot } from './controllers/index.js';
import { startOutboxConsumer, stopOutboxConsumer } from './controllers/outboxConsumer.js';
import { log } from './lib/logger.js';

async function main(): Promise<void> {
  assertConfig();

  if (!config.bot.enabled) {
    log.warn('Бот выключен: MAX_BOT_TOKEN не задан или BOT_ENABLED=false.');
    return;
  }

  const bot = createBot();
  await prepareBot(bot);

  if (config.bot.mode === 'webhook') {
    const webhookHandler = await bot.createWebhook({
      domain: config.bot.webhookDomain,
      path: config.bot.webhookPath,
      secret: config.bot.webhookSecret,
    });

    const webhookServer = http.createServer(webhookHandler);
    await new Promise<void>((resolve) =>
      webhookServer.listen(config.bot.webhookPort, () => resolve()),
    );
    log.info(`Вебхук слушает порт ${config.bot.webhookPort} (${config.bot.webhookPath})`);
  } else {
    bot.start({ mode: 'polling' }).catch((error: unknown) => {
      log.error('Long polling остановлен с ошибкой', error);
      process.exitCode = 1;
    });
    log.info('Бот получает обновления через long polling');
  }

  startOutboxConsumer();
  log.info('Обработка очереди уведомлений запущена');

  const shutdown = async (signal: string) => {
    log.info(`Получен ${signal}, останавливаемся...`);
    stopOutboxConsumer();
    try {
      if (config.bot.mode === 'polling') bot.stopPolling();
      else await bot.stopWebhook();
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
