import { transition } from '@maxhub/max-bot-api';
import type { BotContext } from '../context.js';
import { payloadOf, stripButtons } from '../helpers.js';
import { panelButton, withKeyboard } from '../ui.js';

export async function cancelIntercept({ ctx }: { ctx: BotContext }) {
  if (payloadOf(ctx) !== 'cancel') return undefined;
  await stripButtons(ctx);
  await ctx.reply('Действие отменено.', withKeyboard(panelButton()));
  return transition.cancel();
}

export const SCENARIO_TIMEOUT_MS = 30 * 60 * 1000;
