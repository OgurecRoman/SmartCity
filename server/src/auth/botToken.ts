import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { errors } from '../lib/errors.js';

/** Ручки /api/bot/* вызывает только процесс бота; при заданном BOT_API_TOKEN требуем его в заголовке X-Bot-Token. */
export function requireBotToken(req: Request, _res: Response, next: NextFunction): void {
  if (!config.bot.apiToken) {
    next();
    return;
  }
  if (req.get('x-bot-token') !== config.bot.apiToken) {
    next(errors.unauthorized('Неверный X-Bot-Token', 'bot_token_invalid'));
    return;
  }
  next();
}
