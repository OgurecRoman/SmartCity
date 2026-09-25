import { transition } from '@maxhub/max-bot-api';
import type { PhotoAttachment } from '@maxhub/max-bot-api/types';
import type { BotContext } from '../controllers/context.js';
import { payloadOf, stripButtons } from '../controllers/helpers.js';
import { downloadPhotoFromMax } from '../controllers/photos.js';
import { panelButton, withKeyboard } from '../controllers/ui.js';
import { MAX_PHOTOS_PER_ITEM } from '../lib/rules.js';

export async function cancelIntercept({ ctx }: { ctx: BotContext }) {
  if (payloadOf(ctx) !== 'cancel') return undefined;
  await stripButtons(ctx);
  await ctx.reply('Действие отменено.', withKeyboard(panelButton()));
  return transition.cancel();
}

export const SCENARIO_TIMEOUT_MS = 30 * 60 * 1000;

export type PhotoStepResult =
  | { kind: 'done' }
  | { kind: 'invalid' }
  | { kind: 'added'; photos: string[] };

// Шаг сбора фото общий для заявок, новостей и объявлений: пользователь присылает одну или
// несколько фотографий (по одной или альбомом), либо нажимает кнопку donePayload, чтобы продолжить.
export async function handlePhotoInput(ctx: BotContext, donePayload: string, existing: string[]): Promise<PhotoStepResult> {
  const payload = payloadOf(ctx);
  if (payload === donePayload) return { kind: 'done' };
  if (payload) return { kind: 'invalid' };

  const attachments = ctx.has('message_created') ? (ctx.message.body.attachments ?? []) : [];
  const photoAttachments = attachments.filter((a): a is PhotoAttachment => a.type === 'image');
  if (photoAttachments.length === 0) return { kind: 'invalid' };

  const room = Math.max(MAX_PHOTOS_PER_ITEM - existing.length, 0);
  const saved: string[] = [];
  for (const photo of photoAttachments.slice(0, room)) {
    const filename = await downloadPhotoFromMax(photo.payload.url);
    if (filename) saved.push(filename);
  }
  return { kind: 'added', photos: [...existing, ...saved] };
}
