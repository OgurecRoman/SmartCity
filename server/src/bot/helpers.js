import { log } from '../lib/logger.js';

/** Пользователь MAX, инициировавший событие (если есть). */
export function maxUserOf(update) {
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

/** Тип чата, в котором произошло событие. */
export function chatTypeOf(update) {
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

export function isDialog(ctx) {
  return chatTypeOf(ctx.update) === 'dialog';
}

/** Текст входящего сообщения (для шагов сценариев). */
export function textOf(ctx) {
  if (!ctx.has('message_created')) return null;
  const text = ctx.message.body.text?.trim();
  return text ? text : null;
}

/** payload нажатой inline-кнопки (для шагов сценариев). */
export function payloadOf(ctx) {
  if (!ctx.has('message_callback')) return null;
  return ctx.callback.payload ?? null;
}

/**
 * Ответ на нажатие кнопки: снимает «часики», может показать уведомление и/или отредактировать сообщение.
 * Ошибки не пробрасываем — ответ на callback вторичен по отношению к основной логике.
 */
export async function ack(ctx, options = {}) {
  if (!ctx.has('message_callback')) return;
  const body = {};
  if (options.notification) body.notification = options.notification;
  if (options.message) body.message = { text: options.message.text, attachments: options.message.attachments ?? [] };
  try {
    await ctx.answerOnCallback(body);
  } catch (error) {
    log.warn('Не удалось ответить на callback', error);
  }
}

/** Убирает кнопки у сообщения, на котором нажали (оставляя текст). */
export async function stripButtons(ctx, text) {
  if (!ctx.has('message_callback')) return;
  const current = text ?? ctx.message?.body.text ?? '';
  await ack(ctx, { message: { text: current, attachments: [] } });
}

export function parseIntStrict(value) {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  return Number.parseInt(value, 10);
}
