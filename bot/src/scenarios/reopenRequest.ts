import { defineScenario, transition } from '@maxhub/max-bot-api';
import type { BotContext } from '../controllers/context.js';
import { ack, payloadOf, textOf } from '../controllers/helpers.js';
import { MD, btn, panelButton, requestCard, withKeyboard, type ButtonRows } from '../controllers/ui.js';
import { reopenRequest } from '../lib/api.js';
import { isAppError } from '../lib/errors.js';
import { SCENARIO_TIMEOUT_MS, cancelIntercept, handlePhotoInput } from './common.js';

export interface ReopenRequestData {
  requestId: number;
  reason?: string;
  photos?: string[];
}

type ReopenStep = 'start' | 'reason' | 'photos' | 'confirm';

const REOPEN_PHOTOS_DONE = 'reopen:photos:done';
const REOPEN_SEND = 'reopen:send';

function reopenPhotoButtons(count: number): ButtonRows {
  const rows: ButtonRows = [];
  if (count > 0) rows.push([btn.callback(`Готово (${count} фото)`, REOPEN_PHOTOS_DONE)]);
  rows.push([btn.callback('Отмена', 'cancel')]);
  return rows;
}

export const reopenRequestScenario = defineScenario<BotContext, ReopenRequestData>()<ReopenStep>({
  id: 'reopen-request',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx, data }) => {
      await ctx.reply(
        `Заявка №${data.requestId}. Опишите одним сообщением, почему считаете, что проблема не устранена:`,
        withKeyboard([[btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('reason');
    },

    reason: async ({ ctx }) => {
      const text = textOf(ctx);
      if (!text || text.trim().length < 5) {
        await ctx.reply('Опишите подробнее (минимум 5 символов).');
        return transition.stay();
      }
      await ctx.reply(
        'Приложите хотя бы одно фото, подтверждающее, что проблема не устранена:',
        withKeyboard(reopenPhotoButtons(0)),
      );
      return transition.goto('photos', { reason: text.trim() });
    },

    photos: async ({ ctx, data }) => {
      const result = await handlePhotoInput(ctx, REOPEN_PHOTOS_DONE, data.photos ?? []);
      if (result.kind === 'invalid') {
        await ctx.reply('Пришлите фото или нажмите кнопку выше.', withKeyboard(reopenPhotoButtons((data.photos ?? []).length)));
        return transition.stay();
      }
      if (result.kind === 'added') {
        await ctx.reply(
          `Добавлено. Всего фото: ${result.photos.length}. Пришлите ещё или нажмите «Готово».`,
          withKeyboard(reopenPhotoButtons(result.photos.length)),
        );
        return transition.stay({ photos: result.photos });
      }
      if (!data.photos?.length) {
        await ctx.reply('Нужно хотя бы одно фото. Пришлите фото или нажмите «Отмена».', withKeyboard(reopenPhotoButtons(0)));
        return transition.stay();
      }
      await ack(ctx, { message: { text: `Фото: ${data.photos.length}` } });
      await ctx.reply(
        `Заявка №${data.requestId} будет возвращена в УК:\n\n${data.reason}\n\n📷 Фото: ${data.photos.length}`,
        withKeyboard([[btn.callback('🔄 Вернуть заявку', REOPEN_SEND)], [btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('confirm');
    },

    confirm: async ({ ctx, data }) => {
      if (payloadOf(ctx) !== REOPEN_SEND || !data.reason || !data.photos?.length) {
        await ctx.reply('Нажмите «Вернуть заявку» или «Отмена».');
        return transition.stay();
      }
      try {
        const request = await reopenRequest(data.requestId, { userId: ctx.dbUser.id, reason: data.reason, photos: data.photos });
        await ack(ctx, { message: { text: 'Заявка возвращена.' } });
        await ctx.reply(`🔄 Заявка №${data.requestId} возвращена в УК.\n\n${requestCard(request)}`, { ...withKeyboard(panelButton()), ...MD });
      } catch (error) {
        if (!isAppError(error)) throw error;
        await ack(ctx, { notification: error.message });
        await ctx.reply(`Не получилось: ${error.message}`, withKeyboard(panelButton()));
      }
      return transition.complete();
    },
  },
});
