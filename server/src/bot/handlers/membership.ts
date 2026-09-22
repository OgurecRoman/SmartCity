import type { Bot } from '@maxhub/max-bot-api';
import { isAppError } from '../../lib/errors.js';
import { approveMembershipRequest, listPendingMembershipRequests } from '../../services/membership.js';
import { isChairman, isEmployee } from '../../services/users.js';
import type { BotContext } from '../context.js';
import { ack, isDialog } from '../helpers.js';
import { rejectMembershipScenario } from '../scenarios/membership.js';
import { membershipCard, membershipReviewButtons, panelButton, withKeyboard } from '../ui.js';

async function guardReview(ctx: BotContext): Promise<boolean> {
  if (!isDialog(ctx)) return false;
  if (isEmployee(ctx.dbUser) || isChairman(ctx.dbUser)) return true;
  if (ctx.has('message_callback')) await ack(ctx, { notification: 'Доступно сотрудникам УК и председателям ТСЖ' });
  else await ctx.reply('Команда доступна сотрудникам УК и председателям ТСЖ.');
  return false;
}

async function showQueue(ctx: BotContext): Promise<void> {
  if (!(await guardReview(ctx))) return;
  await ack(ctx);
  const list = await listPendingMembershipRequests(ctx.dbUser);
  if (list.length === 0) {
    await ctx.reply('Заявок на вступление нет.', withKeyboard(panelButton()));
    return;
  }
  for (const request of list) {
    await ctx.reply(membershipCard(request), withKeyboard(membershipReviewButtons(request.id)));
  }
}

export function registerMembershipHandlers(bot: Bot<BotContext>): void {
  bot.command('membership_queue', showQueue);
  bot.action('menu:membership_queue', showQueue);

  bot.action(/^mem:approve:(\d+)$/, async (ctx) => {
    if (!(await guardReview(ctx))) return;
    const requestId = Number(ctx.match?.[1]);
    try {
      await approveMembershipRequest(requestId, ctx.dbUser);
      await ack(ctx, { message: { text: `✅ Заявка №${requestId} подтверждена. Заявителю отправлена ссылка на чат дома.`, attachments: [] } });
    } catch (error) {
      if (!isAppError(error)) throw error;
      await ack(ctx, { notification: error.message });
    }
  });

  bot.action(/^mem:reject:(\d+)$/, async (ctx) => {
    if (!(await guardReview(ctx))) return;
    await ack(ctx);
    await ctx.scenario.start(rejectMembershipScenario, { requestId: Number(ctx.match?.[1]) });
  });
}
