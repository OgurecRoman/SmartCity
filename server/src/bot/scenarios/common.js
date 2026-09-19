import { transition } from '@maxhub/max-bot-api';

import { payloadOf, stripButtons } from '../helpers.js';
import { panelButton, withKeyboard } from '../ui.js';

/** Общий перехватчик: кнопка «Отмена» (payload = cancel) завершает любой сценарий. */
export async function cancelIntercept({ ctx }) {
  if (payloadOf(ctx) !== 'cancel') return undefined;
  await stripButtons(ctx);
  await ctx.reply('Действие отменено.', withKeyboard(panelButton()));
  return transition.cancel();
}

export const SCENARIO_TIMEOUT_MS = 30 * 60 * 1000;
