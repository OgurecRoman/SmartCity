import type { Bot } from '@maxhub/max-bot-api';
import { config } from '../../config.js';
import { isEmployee, isOnboarded, promoteToEmployee } from '../../services/users.js';
import type { BotContext } from '../context.js';
import { ack, isDialog, parseIntStrict } from '../helpers.js';
import { onboardingScenario } from '../scenarios/onboarding.js';
import { TEXTS, adminMenu, residentMenu, withKeyboard } from '../ui.js';
import { showRequestToEmployee, showRequestToResident } from '../views.js';

export async function showPanel(ctx: BotContext): Promise<void> {
  const user = ctx.dbUser;
  if (isEmployee(user)) {
    await ctx.reply('Панель сотрудника УК:', withKeyboard(adminMenu()));
    return;
  }
  if (isOnboarded(user)) {
    await ctx.reply(`Дом: ${user.house?.address ?? '—'}, кв. ${user.apartment ?? '—'}. Что делаем?`, withKeyboard(residentMenu()));
    return;
  }
  await ctx.reply(TEXTS.onboardingRequired);
  await ctx.scenario.start(onboardingScenario, {});
}

export async function handleStart(ctx: BotContext, payload: string | null): Promise<void> {
  if (!isDialog(ctx)) return;
  ctx.scenario.cancel();
  const user = ctx.dbUser;

  const requestMatch = /^req_(\d+)$/.exec(payload ?? '');
  if (requestMatch) {
    const requestId = parseIntStrict(requestMatch[1]);
    if (requestId) {
      if (isEmployee(user)) return showRequestToEmployee(ctx, requestId);
      if (isOnboarded(user)) return showRequestToResident(ctx, requestId);
      await ctx.reply(`${TEXTS.welcomeResident}\n\nПосле регистрации покажу заявку №${requestId}.`);
      await ctx.scenario.start(onboardingScenario, { next: `req_${requestId}` });
      return;
    }
  }

  if (isEmployee(user)) {
    await ctx.reply(TEXTS.welcomeAdmin, withKeyboard(adminMenu()));
    return;
  }
  if (isOnboarded(user)) {
    await ctx.reply(TEXTS.welcomeBack(user.firstName), withKeyboard(residentMenu()));
    return;
  }
  await ctx.reply(TEXTS.welcomeResident);
  await ctx.scenario.start(onboardingScenario, { next: payload === 'create' ? 'create' : null });
}

export function registerCommonHandlers(bot: Bot<BotContext>): void {
  bot.on('bot_started', (ctx) => handleStart(ctx, ctx.startPayload ?? null));

  bot.command(/^start(?:\s+(\S+))?$/, (ctx) => handleStart(ctx, ctx.match?.[1] ?? null));

  bot.command('cancel', async (ctx) => {
    if (!isDialog(ctx)) return;
    const cancelled = ctx.scenario.cancel();
    await ctx.reply(cancelled ? 'Действие отменено.' : 'Сейчас нет активного действия.');
    await showPanel(ctx);
  });

  bot.command(['panel', 'menu'], async (ctx) => {
    if (!isDialog(ctx)) return;
    ctx.scenario.cancel();
    await showPanel(ctx);
  });

  bot.action('menu:panel', async (ctx) => {
    ctx.scenario.cancel();
    await ack(ctx);
    await showPanel(ctx);
  });

  bot.command('help', async (ctx) => {
    if (!isDialog(ctx)) return;
    await ctx.reply(isEmployee(ctx.dbUser) ? TEXTS.helpAdmin : TEXTS.helpResident);
  });

  bot.command('id', async (ctx) => {
    if (!isDialog(ctx)) return;
    await ctx.reply(`Ваш MAX ID: ${ctx.dbUser.maxUserId.toString()}\nСообщите его сотруднику УК, если он добавляет вас в дом вручную.`);
  });

  bot.command(/^uk_login(?:\s+(\S+))?$/, async (ctx) => {
    if (!isDialog(ctx)) return;
    const code = ctx.match?.[1];
    if (!config.uk.accessCode) {
      await ctx.reply('Вход для сотрудников УК по коду отключён (UK_ACCESS_CODE не задан).');
      return;
    }
    if (!code || code !== config.uk.accessCode) {
      await ctx.reply('Неверный код. Формат: /uk_login <код>');
      return;
    }
    ctx.scenario.cancel();
    ctx.dbUser = await promoteToEmployee(ctx.dbUser.id);
    await ctx.reply(`Права сотрудника УК выданы.\n\n${TEXTS.welcomeAdmin}`, withKeyboard(adminMenu()));
  });
}
