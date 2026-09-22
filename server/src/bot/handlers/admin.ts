import type { Bot } from '@maxhub/max-bot-api';
import { isAppError } from '../../lib/errors.js';
import { changeStatus, listRequests } from '../../services/requests.js';
import { UK_ACTIVE_STATUSES } from '../../services/rules.js';
import { isEmployee } from '../../services/users.js';
import type { BotContext } from '../context.js';
import { ack, isDialog } from '../helpers.js';
import { announceScenario, delegateScenario, manageOwnerScenario, rejectScenario } from '../scenarios/admin.js';
import { keyboard, panelButton, requestCard, ukRequestButtons, withKeyboard } from '../ui.js';
import { sendRequestDocument, sendRequestList } from '../views.js';

async function guard(ctx: BotContext): Promise<boolean> {
  if (!isDialog(ctx)) return false;
  if (isEmployee(ctx.dbUser)) return true;
  if (ctx.has('message_callback')) await ack(ctx, { notification: 'Доступно только сотрудникам УК' });
  else await ctx.reply('Команда доступна только сотрудникам УК. Если вы сотрудник — отправьте /uk_login <код>.');
  return false;
}

async function showQueue(ctx: BotContext): Promise<void> {
  if (!(await guard(ctx))) return;
  await ack(ctx);
  const requests = await listRequests({ statuses: [...UK_ACTIVE_STATUSES], limit: 50 });
  await sendRequestList(ctx, requests, 'Заявки в работе', (request) => ukRequestButtons(request));
}

async function setStatus(ctx: BotContext, requestId: number, status: 'IN_PROGRESS' | 'RESOLVED', note: string): Promise<void> {
  if (!(await guard(ctx))) return;
  try {
    const request = await changeStatus(requestId, status, { byUserId: ctx.dbUser.id });
    await ack(ctx, { message: { text: `${requestCard(request)}\n\n${note}`, attachments: [keyboard([...ukRequestButtons(request), ...panelButton()])] } });
  } catch (error) {
    if (!isAppError(error)) throw error;
    await ack(ctx, { notification: error.message });
  }
}

export function registerAdminHandlers(bot: Bot<BotContext>): void {
  bot.command('requests', showQueue);
  bot.action('uk:new', showQueue);

  bot.action(/^uk:take:(\d+)$/, (ctx) => setStatus(ctx, Number(ctx.match?.[1]), 'IN_PROGRESS', '🛠 Заявка взята в работу. Жители уведомлены.'));
  bot.action(/^uk:resolve:(\d+)$/, (ctx) => setStatus(ctx, Number(ctx.match?.[1]), 'RESOLVED', '✅ Заявка закрыта как выполненная. Жители уведомлены.'));

  bot.action(/^uk:delegate:(\d+)$/, async (ctx) => {
    if (!(await guard(ctx))) return;
    await ack(ctx);
    await ctx.scenario.start(delegateScenario, { requestId: Number(ctx.match?.[1]), cardMid: ctx.messageId ?? null });
  });

  bot.action(/^uk:reject:(\d+)$/, async (ctx) => {
    if (!(await guard(ctx))) return;
    await ack(ctx);
    await ctx.scenario.start(rejectScenario, { requestId: Number(ctx.match?.[1]), cardMid: ctx.messageId ?? null });
  });

  bot.action(/^uk:doc:(\d+)$/, async (ctx) => {
    if (!(await guard(ctx))) return;
    await ack(ctx, { notification: 'Формирую документ…' });
    await sendRequestDocument(ctx, Number(ctx.match?.[1]));
  });

  const startOwner = (action: 'add' | 'remove') => async (ctx: BotContext) => {
    if (!(await guard(ctx))) return;
    await ack(ctx);
    await ctx.scenario.start(manageOwnerScenario, { action });
  };
  bot.command('add_owner', startOwner('add'));
  bot.action('menu:add_owner', startOwner('add'));
  bot.command('remove_owner', startOwner('remove'));
  bot.action('menu:remove_owner', startOwner('remove'));

  const startAnnounce = async (ctx: BotContext) => {
    if (!(await guard(ctx))) return;
    await ack(ctx);
    await ctx.scenario.start(announceScenario, {});
  };
  bot.command('announce', startAnnounce);
  bot.action('menu:announce', startAnnounce);
}
