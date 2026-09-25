import type { Bot } from '@maxhub/max-bot-api';
import type { BotContext } from '../controllers/context.js';
import { ack, isDialog } from '../controllers/helpers.js';
import { esc, houseButtons, keyboard, MD, panelButton, requestCard, residentsCards, ukRequestButtons, withKeyboard } from '../controllers/ui.js';
import { sendRequestDocument, sendRequestList } from '../controllers/views.js';
import { changeStatus, getHouse, listHouses, listRequests, listResidentsOfHouse } from '../lib/api.js';
import { isAppError } from '../lib/errors.js';
import { isChairman, isEmployee, UK_ACTIVE_STATUSES } from '../lib/rules.js';
import { announceScenario, delegateScenario, manageChairmanScenario, manageOwnerScenario, rejectScenario, resolveScenario } from '../scenarios/admin.js';

async function guard(ctx: BotContext): Promise<boolean> {
  if (!isDialog(ctx)) return false;
  if (isEmployee(ctx.dbUser)) return true;
  if (ctx.has('message_callback')) await ack(ctx, { notification: 'Доступно только сотрудникам УК' });
  else await ctx.reply('Команда доступна только сотрудникам УК. Если вы сотрудник — отправьте /uk_login <код>.');
  return false;
}

async function guardAnnounce(ctx: BotContext): Promise<boolean> {
  if (!isDialog(ctx)) return false;
  if (isEmployee(ctx.dbUser) || isChairman(ctx.dbUser)) return true;
  if (ctx.has('message_callback')) await ack(ctx, { notification: 'Доступно сотрудникам УК и председателям ТСЖ' });
  else await ctx.reply('Команда доступна сотрудникам УК и председателям ТСЖ.');
  return false;
}

async function showQueue(ctx: BotContext): Promise<void> {
  if (!(await guard(ctx))) return;
  await ack(ctx);
  const requests = await listRequests({ statuses: [...UK_ACTIVE_STATUSES], limit: 50 });
  await sendRequestList(ctx, requests, 'Заявки в работе', (request) => ukRequestButtons(request));
}

async function setStatus(ctx: BotContext, requestId: number, status: 'IN_PROGRESS', note: string): Promise<void> {
  if (!(await guard(ctx))) return;
  try {
    const { request } = await changeStatus(requestId, status, { byUserId: ctx.dbUser.id });
    await ack(ctx, {
      message: { text: `${requestCard(request)}\n\n${note}`, attachments: [keyboard([...ukRequestButtons(request), ...panelButton()])], ...MD },
    });
  } catch (error) {
    if (!isAppError(error)) throw error;
    await ack(ctx, { notification: error.message });
  }
}

export function registerAdminHandlers(bot: Bot<BotContext>): void {
  bot.command('requests', showQueue);
  bot.action('uk:new', showQueue);

  bot.action(/^uk:take:(\d+)$/, (ctx) => setStatus(ctx, Number(ctx.match?.[1]), 'IN_PROGRESS', '🛠 Заявка взята в работу. Жители уведомлены.'));

  bot.action(/^uk:resolve:(\d+)$/, async (ctx) => {
    if (!(await guard(ctx))) return;
    await ack(ctx);
    await ctx.scenario.start(resolveScenario, { requestId: Number(ctx.match?.[1]), cardMid: ctx.messageId ?? null });
  });

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

  const startChairman = (action: 'appoint' | 'dismiss') => async (ctx: BotContext) => {
    if (!(await guard(ctx))) return;
    await ack(ctx);
    await ctx.scenario.start(manageChairmanScenario, { action });
  };
  bot.command('appoint_chairman', startChairman('appoint'));
  bot.action('menu:appoint_chairman', startChairman('appoint'));
  bot.command('dismiss_chairman', startChairman('dismiss'));
  bot.action('menu:dismiss_chairman', startChairman('dismiss'));

  const startAnnounce = async (ctx: BotContext) => {
    if (!(await guardAnnounce(ctx))) return;
    await ack(ctx);
    await ctx.scenario.start(announceScenario, {});
  };
  bot.command('announce', startAnnounce);
  bot.action('menu:announce', startAnnounce);

  const startResidents = async (ctx: BotContext) => {
    if (!(await guard(ctx))) return;
    await ack(ctx);
    const houses = await listHouses();
    if (houses.length === 0) {
      await ctx.reply('Пока нет домов.', withKeyboard(panelButton()));
      return;
    }
    await ctx.reply('Жители какого дома нужны?', withKeyboard(houseButtons(houses, 'res:house')));
  };
  bot.command('residents', startResidents);
  bot.action('menu:residents', startResidents);

  bot.action(/^res:house:(\d+)$/, async (ctx) => {
    if (!(await guard(ctx))) return;
    const houseId = Number(ctx.match?.[1]);
    const house = await getHouse(houseId);
    if (!house) {
      await ack(ctx, { notification: 'Дом не найден' });
      return;
    }
    await ack(ctx, { message: { text: `🏠 ${esc(house.address)}`, format: 'markdown' } });
    const residents = await listResidentsOfHouse(houseId);
    if (residents.length === 0) {
      await ctx.reply(`В доме «${house.address}» пока нет подтверждённых жителей.`, withKeyboard(panelButton()));
      return;
    }
    const cards = residentsCards(house, residents);
    for (let i = 0; i < cards.length; i += 1) {
      const isLast = i === cards.length - 1;
      await ctx.reply(cards[i], isLast ? { ...withKeyboard(panelButton()), ...MD } : MD);
    }
  });
}
