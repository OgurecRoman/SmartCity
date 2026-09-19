import { fullName } from '../../lib/labels.js';
import { log } from '../../lib/logger.js';
import { bindHouseChat, getHouse, getHouseByChat, isEmployee, listHouses, unbindHouseChat } from '../../services/users.js';

import { ack, isDialog } from '../helpers.js';
import { TEXTS, botDeepLink, btn, houseButtons, withKeyboard } from '../ui.js';

async function sendBindPrompt(ctx) {
  const houses = await listHouses();
  if (houses.length === 0) {
    await ctx.reply('В системе пока нет домов. Добавьте дома в БД и повторите /bind.');
    return;
  }
  await ctx.reply('К какому дому привязать этот чат?', withKeyboard(houseButtons(houses, 'bind', false)));
}

/** Групповой чат дома: привязка к дому, приветствие новых участников. */
export function registerChatHandlers(bot) {
  bot.on('bot_added', async (ctx) => {
    if (ctx.update.is_channel) return;
    if (isEmployee(ctx.dbUser)) {
      await ctx.reply('Привет! Я бот «Умный дом». Привяжите этот чат к дому, чтобы жители получали уведомления о заявках.');
      await sendBindPrompt(ctx);
      return;
    }
    await ctx.reply(
      'Привет! Я бот «Умный дом»: присылаю в чат дома уведомления о заявках жителей.\n' +
        'Привязать чат к дому может сотрудник управляющей компании командой /bind.',
    );
  });

  bot.command('bind', async (ctx) => {
    if (isDialog(ctx)) {
      await ctx.reply('Команда /bind работает в групповом чате дома: добавьте туда бота и отправьте команду там.');
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
    let title = null;
    try {
      title = (await ctx.api.getChat(chatId)).title;
    } catch (error) {
      log.warn('Не удалось получить название чата', error);
    }
    await bindHouseChat(house.id, BigInt(chatId), title);
    await ack(ctx, { message: { text: `✅ Группа успешно привязана к дому «${house.address}».` } });
    const link = botDeepLink('join');
    await ctx.reply(TEXTS.groupInstructions(link), link ? withKeyboard([[btn.link('Открыть бота', link)]]) : undefined);
  });

  bot.on('user_added', async (ctx) => {
    if (ctx.update.is_channel) return;
    if (ctx.update.user.user_id === ctx.myId) return;
    const house = await getHouseByChat(BigInt(ctx.chatId));
    if (!house) return;
    const link = botDeepLink('join');
    const name = fullName({ firstName: ctx.update.user.first_name || ctx.update.user.name, lastName: ctx.update.user.last_name });
    await ctx.reply(
      `Добро пожаловать, ${name}! Это чат дома «${house.address}». ` +
        'Чтобы создавать заявки и поддерживать заявки соседей, откройте диалог с ботом и пройдите короткую регистрацию.',
      link ? withKeyboard([[btn.link('Открыть бота', link)]]) : undefined,
    );
  });

  bot.on('bot_removed', async (ctx) => {
    await unbindHouseChat(BigInt(ctx.update.chat_id));
  });
}
