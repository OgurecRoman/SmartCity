import { createApp } from './app.js';
import { assertConfig, config } from './config.js';
import { startExpireJob } from './jobs/expire.js';
import { prisma } from './lib/db.js';
import { log } from './lib/logger.js';

assertConfig();
await prisma.$connect();
log.info('База данных подключена');

const app = createApp();
log.info(`HTTP-сервер запущен на порту ${config.port}`);

startExpireJob();

export default app;

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
