import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(import.meta.dirname, '..', '.env'), quiet: true });

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bigintList(value: string | undefined): bigint[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^\d+$/.test(item))
    .map((item) => BigInt(item));
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';
const botToken = process.env.MAX_BOT_TOKEN?.trim() ?? '';

export const config = {
  nodeEnv,
  isProduction,
  port: int(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  corsOrigin: process.env.CORS_ORIGIN?.trim() || '*',
  bot: {
    token: botToken,
    enabled: bool(process.env.BOT_ENABLED, true) && botToken.length > 0,
    mode: (process.env.BOT_MODE?.trim() === 'webhook' ? 'webhook' : 'polling') as 'polling' | 'webhook',
    webhookDomain: process.env.WEBHOOK_DOMAIN?.trim() ?? '',
    webhookPath: process.env.WEBHOOK_PATH?.trim() || '/bot/webhook',
    webhookSecret: process.env.WEBHOOK_SECRET?.trim() || undefined,
    username: process.env.BOT_USERNAME?.trim().replace(/^@/, '') ?? '',
  },
  uk: {
    accessCode: process.env.UK_ACCESS_CODE?.trim() ?? '',
    adminIds: bigintList(process.env.UK_ADMIN_IDS),
  },
  auth: {

    devBypass: bool(process.env.DEV_AUTH_BYPASS, false),
    initDataMaxAgeSec: int(process.env.INIT_DATA_MAX_AGE_SEC, 86_400),
  },
  votes: {
    defaultPercent: int(process.env.VOTE_PERCENT_DEFAULT, 20),
    defaultDeadlineDays: int(process.env.DEFAULT_DEADLINE_DAYS, 14),
  },
  jobs: {
    expireIntervalSec: int(process.env.EXPIRE_CHECK_INTERVAL_SEC, 300),
  },
  geo: {

    overpassUrls: (process.env.OVERPASS_URL?.trim() || 'https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),

    nominatimUrl: (process.env.NOMINATIM_URL?.trim() || 'https://nominatim.openstreetmap.org').replace(/\/(search|reverse)?\/?$/, ''),
  },
  smtp: {
    host: process.env.SMTP_HOST?.trim() ?? '',
    port: int(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER || 'smartcity@example.com',
  },
} as const;

export function assertConfig(): void {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL не задан. Скопируйте .env.example в .env и заполните.');
  }
  if (config.bot.enabled && config.bot.mode === 'webhook' && !config.bot.webhookDomain) {
    throw new Error('BOT_MODE=webhook требует WEBHOOK_DOMAIN (публичный HTTPS-адрес сервера).');
  }
}
