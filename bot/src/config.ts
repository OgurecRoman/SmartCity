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

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';
const botToken = process.env.MAX_BOT_TOKEN?.trim() ?? '';

export const config = {
  nodeEnv,
  isProduction,
  bot: {
    token: botToken,
    enabled: bool(process.env.BOT_ENABLED, true) && botToken.length > 0,
    mode: (process.env.BOT_MODE?.trim() === 'webhook' ? 'webhook' : 'polling') as 'polling' | 'webhook',
    webhookDomain: process.env.WEBHOOK_DOMAIN?.trim() ?? '',
    webhookPath: process.env.WEBHOOK_PATH?.trim() || '/bot/webhook',
    webhookSecret: process.env.WEBHOOK_SECRET?.trim() || undefined,
    webhookPort: int(process.env.BOT_WEBHOOK_PORT, 3001),
    username: process.env.BOT_USERNAME?.trim().replace(/^@/, '') ?? '',
  },
  backend: {
    apiUrl: process.env.BACKEND_API_URL?.trim() || 'http://localhost:3000',
  }
} as const;

export function assertConfig(): void {
  if (config.bot.enabled && !config.bot.token) {
    throw new Error('BOT_TOKEN не задан, но бот включен (BOT_ENABLED=true).');
  }
  if (config.bot.enabled && config.bot.mode === 'webhook' && !config.bot.webhookDomain) {
    throw new Error('BOT_MODE=webhook требует WEBHOOK_DOMAIN (публичный HTTPS-адрес).');
  }
}