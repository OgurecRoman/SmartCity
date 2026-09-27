import type { Bot } from '@maxhub/max-bot-api';
import type { BotContext } from '../controllers/context.js';
import { ack, isDialog } from '../controllers/helpers.js';
import { chatGuideText, esc, MD, TEXTS, botDeepLink, btn, getBotUsername, houseButtons, mdName, withKeyboard } from '../controllers/ui.js';
import { bindHouseChat, getCompany, getHouse, getHouseByChat, listHouses, unbindHouseChat } from '../lib/api.js';
import { fullName } from '../lib/labels.js';
import { log } from '../lib/logger.js';
import { isChairman, isEmployee } from '../lib/rules.js';

async function sendBindPrompt(ctx: BotContext): Promise<void> {
  const houses = await listHouses();
  if (houses.length === 0) {
    await ctx.reply('В системе пока нет домов. Добавьте дома в БД и повторите /bind.');
    return;
  }
  await ctx.reply('К какому дому привязать этот чат?', withKeyboard(houseButtons(houses, 'bind', false)));
}

/** Отправляет в групповой чат памятку (хештеги, команды, контакты УК) и закрепляет её. Закрепить может только бот-администратор. */
async function sendChatGuide(ctx: BotContext, chatId: number, house: { address: string } | null): Promise<void> {
  const company = await getCompany();
  const message = await ctx.api.sendMessageToChat(chatId, chatGuideText(company, house, botDeepLink('join')), MD);
  try {
    await ctx.api.pinMessage(chatId, message.body.mid, { notify: false });
  } catch (error) {
    log.warn(`Не удалось закрепить памятку в чате ${chatId}`, error);
    await ctx.api.sendMessageToChat(
      chatId,
      `Не получилось закрепить памятку: назначьте бота администратором чата и отправьте «@${getBotUsername()} /pin» — закреплю.`,
    );
  }
}

export function registerChatHandlers(bot: Bot<BotContext>): void {
  bot.on('bot_added', async (ctx) => {
    if (ctx.update.is_channel) return;
    // Памятку закрепляем сразу при добавлении; после /bind она отправится заново уже с адресом дома.
    await sendChatGuide(ctx, ctx.update.chat_id, null);
    if (isEmployee(ctx.dbUser)) {
      await ctx.reply('Привяжите этот чат к дому, чтобы жители получали уведомления о заявках.');
      await sendBindPrompt(ctx);
      return;
    }
    await ctx.reply(TEXTS.bindHint());
  });

  bot.command('bind', async (ctx) => {
    if (isDialog(ctx)) {
      await ctx.reply('Команда /bind работает в групповом чате дома: добавьте туда бота и отправьте там «@' + getBotUsername() + ' /bind».');
      return;
    }
    if (!isEmployee(ctx.dbUser)) {
      await ctx.reply('Привязать чат к дому может только сотрудник УК.');
      return;
    }
    await sendBindPrompt(ctx);
  });

  bot.action(/^bind:(\d+)$/, async (ctx) => {
    if (!isEmployee(ctx.dbUser)) {
      await ack(ctx, { notification: 'Привязать чат может только сотрудник УК' });
      return;
    }
    const chatId = ctx.chatId;
    if (!chatId) return;
    const house = await getHouse(Number(ctx.match?.[1]));
    if (!house) {
      await ack(ctx, { notification: 'Дом не найден' });
      return;
    }
    let title: string | null = null;
    try {
      title = (await ctx.api.getChat(chatId)).title;
    } catch (error) {
      log.warn('Не удалось получить название чата', error);
    }
    await bindHouseChat(house.id, BigInt(chatId), title);
    await ack(ctx, { message: { text: `✅ Группа успешно привязана к дому «${house.address}».` } });
    await sendChatGuide(ctx, chatId, house);
  });

  // Повторно отправить и закрепить памятку (например, после того как бота сделали администратором чата).
  bot.command('pin', async (ctx) => {
    if (isDialog(ctx)) {
      await ctx.reply('Команда /pin работает в групповом чате дома: отправьте там «@' + getBotUsername() + ' /pin».');
      return;
    }
    if (!isEmployee(ctx.dbUser) && !isChairman(ctx.dbUser)) {
      await ctx.reply('Закрепить памятку может сотрудник УК или председатель ТСЖ.');
      return;
    }
    const chatId = ctx.chatId;
    if (!chatId) return;
    await sendChatGuide(ctx, chatId, await getHouseByChat(BigInt(chatId)));
  });

  bot.on('user_added', async (ctx) => {
    if (ctx.update.is_channel) return;
    if (ctx.update.user.user_id === ctx.myId) return;
    const house = await getHouseByChat(BigInt(ctx.chatId));
    if (!house) return;
    const link = botDeepLink('join');
    const name = fullName({ firstName: ctx.update.user.first_name || ctx.update.user.name, lastName: ctx.update.user.last_name });
    await ctx.reply(
      `Добро пожаловать, ${mdName(name)}! Это чат дома «${esc(house.address)}». ` +
        'Чтобы создавать заявки и поддерживать заявки соседей, откройте диалог с ботом и пройдите короткую регистрацию.',
      { ...(link ? withKeyboard([[btn.link('Открыть бота', link)]]) : {}), ...MD },
    );
  });

  bot.on('bot_removed', async (ctx) => {
    await unbindHouseChat(BigInt(ctx.update.chat_id));
  });
}
