import { Bot, ScenarioEngine, session } from '@maxhub/max-bot-api';
import { config } from '../config.js';
import { isAppError } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import type { BotContext, BotSession } from './context.js';
import { registerAdminHandlers } from '../handlers/admin.js';
import { registerChatHandlers } from '../handlers/chat.js';
import { registerCommonHandlers } from '../handlers/common.js';
import { registerMembershipHandlers } from '../handlers/membership.js';
import { registerResidentHandlers } from '../handlers/resident.js';
import { ack, isDialog, maxUserOf } from './helpers.js';
import { initNotifications } from './notifications.js';
import { announceScenario, delegateScenario, manageChairmanScenario, manageOwnerScenario, rejectScenario, resolveScenario } from '../scenarios/admin.js';
import { createRequestScenario } from '../scenarios/createRequest.js';
import { addTenantScenario, rejectMembershipScenario } from '../scenarios/membership.js';
import { createNewsScenario } from '../scenarios/news.js';
import { onboardingScenario } from '../scenarios/onboarding.js';
import { reopenRequestScenario } from '../scenarios/reopenRequest.js';
import { PrismaSessionStore } from './sessionStore.js';
import { panelButton, setBotIdentity, withKeyboard } from './ui.js';
import { DbUser } from '../types/index.js';
import { request } from '../lib/network.js';

export const BOT_COMMANDS = [
  { name: 'panel', description: 'Главное меню' },
  { name: 'create', description: 'Создать заявку' },
  { name: 'my', description: 'Мои заявки' },
  { name: 'supported', description: 'Поддержанные заявки' },
  { name: 'contacts', description: 'Контакты УК' },
  { name: 'requests', description: 'УК: заявки в работе' },
  { name: 'bind', description: 'УК: привязать чат дома' },
  { name: 'id', description: 'Мой MAX ID' },
  { name: 'cancel', description: 'Отменить действие' },
  { name: 'help', description: 'Справка' },
];

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.bot.token);

  bot.catch(async (error, ctx) => {
    log.error(`Ошибка при обработке события ${ctx.updateType}`, error);
    try {
      if (ctx.has('message_callback')) {
        await ack(ctx, { notification: isAppError(error) ? error.message : 'Что-то пошло не так, попробуйте ещё раз' });
      }
      if (isDialog(ctx) && ctx.chatId) {
        const text = isAppError(error) ? error.message : 'Что-то пошло не так. Попробуйте ещё раз или отправьте /cancel.';
        await ctx.reply(text, withKeyboard(panelButton()));
      }
    } catch (replyError) {
      log.error('Не удалось сообщить пользователю об ошибке', replyError);
    }
  });

  bot.use(session<BotSession, BotContext>({ store: new PrismaSessionStore<BotSession>(), defaultSession: () => ({}) }));

  bot.use(async (ctx, next) => {
    const maxUser = maxUserOf(ctx.update);
    if (maxUser && !maxUser.is_bot) {
      const options = {
        maxUserId: maxUser.user_id.toString(),
        firstName: maxUser.first_name || maxUser.name || 'Житель',
        lastName: maxUser.last_name ?? null,
        username: maxUser.username ?? null,
      };
      const userData = await request('POST', 'user/upsert', options);
      try {
        ctx.dbUser = userData as DbUser;
      } catch (error) {
        console.error('Неправильный формат данных:', error);
        await ctx.reply('Произошла ошибка при сохранении данных. Попробуйте позже.');
        return;
      }
    }
    return next();
  });

  const scenarios = new ScenarioEngine<BotContext>();
  scenarios
    .register(onboardingScenario)
    .register(createRequestScenario)
    .register(createNewsScenario)
    .register(manageOwnerScenario)
    .register(manageChairmanScenario)
    .register(announceScenario)
    .register(delegateScenario)
    .register(rejectScenario)
    .register(resolveScenario)
    .register(rejectMembershipScenario)
    .register(addTenantScenario)
    .register(reopenRequestScenario);

  bot.use(scenarios.controllerMiddleware());
  registerCommonHandlers(bot);
  bot.use(scenarios.interceptMiddleware());
  registerResidentHandlers(bot);
  registerAdminHandlers(bot);
  registerMembershipHandlers(bot);
  registerChatHandlers(bot);

  bot.on('message_created', async (ctx) => {
    if (!isDialog(ctx)) return;
    await ctx.reply('Не понял сообщение. Откройте меню командой /panel или посмотрите /help.', withKeyboard(panelButton()));
  });

  return bot;
}

export async function prepareBot(bot: Bot<BotContext>): Promise<void> {
  bot.botInfo = await bot.api.getMyInfo();
  setBotIdentity(bot.botInfo.username);
  initNotifications(bot.api);
  try {
    await bot.api.setMyCommands(BOT_COMMANDS);
  } catch (error) {
    log.warn('Не удалось зарегистрировать команды бота', error);
  }
  log.info(`Бот @${bot.botInfo.username ?? bot.botInfo.user_id} готов`);
}
