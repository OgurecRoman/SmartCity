import type { AttachmentRequest, ChatType, Update, User as MaxUser } from '@maxhub/max-bot-api/types';
import { log } from '../lib/logger.js';
import type { BotContext } from './context.js';

export function maxUserOf(update: Update): MaxUser | undefined {
  switch (update.update_type) {
    case 'message_created':
    case 'message_edited':
    case 'comment_created':
    case 'comment_edited':
      return update.message.sender ?? undefined;
    case 'message_callback':
      return update.callback.user;
    case 'bot_started':
    case 'bot_stopped':
    case 'bot_added':
    case 'bot_removed':
    case 'user_added':
    case 'user_removed':
    case 'chat_title_changed':
    case 'dialog_cleared':
    case 'dialog_muted':
    case 'dialog_unmuted':
    case 'dialog_removed':
      return update.user;
    default:
      return undefined;
  }
}

export function chatTypeOf(update: Update): ChatType | undefined {
  switch (update.update_type) {
    case 'message_created':
    case 'message_edited':
      return update.message.recipient.chat_type;
    case 'message_callback':
      return update.message?.recipient.chat_type;
    case 'bot_started':
    case 'bot_stopped':
    case 'dialog_cleared':
    case 'dialog_muted':
    case 'dialog_unmuted':
    case 'dialog_removed':
      return 'dialog';
    case 'bot_added':
    case 'bot_removed':
    case 'user_added':
    case 'user_removed':
    case 'chat_title_changed':
      return 'chat';
    default:
      return undefined;
  }
}

export function isDialog(ctx: BotContext): boolean {
  return chatTypeOf(ctx.update) === 'dialog';
}

export function textOf(ctx: BotContext): string | null {
  if (!ctx.has('message_created')) return null;
  const text = ctx.message.body.text?.trim();
  return text ? text : null;
}

export function payloadOf(ctx: BotContext): string | null {
  if (!ctx.has('message_callback')) return null;
  return ctx.callback.payload ?? null;
}

export interface AnswerOptions {

  notification?: string;

  message?: { text: string; attachments?: AttachmentRequest[] };
}

export async function ack(ctx: BotContext, options: AnswerOptions = {}): Promise<void> {
  if (!ctx.has('message_callback')) return;
  const body: Record<string, unknown> = {};
  if (options.notification) body.notification = options.notification;
  if (options.message) body.message = { text: options.message.text, attachments: options.message.attachments ?? [] };
  try {
    await ctx.answerOnCallback(body as Parameters<typeof ctx.answerOnCallback>[0]);
  } catch (error) {
    log.warn('Не удалось ответить на callback', error);
  }
}

export async function stripButtons(ctx: BotContext, text?: string): Promise<void> {
  if (!ctx.has('message_callback')) return;
  const current = text ?? ctx.message?.body.text ?? '';
  await ack(ctx, { message: { text: current, attachments: [] } });
}

export function parseIntStrict(value: string | undefined): number | null {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  return Number.parseInt(value, 10);
}
