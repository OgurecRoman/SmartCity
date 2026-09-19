import { isAppError } from '../../lib/errors.js';
import { log } from '../../lib/logger.js';
import { deleteRequest, getRequest, hasVoted, listRequests, vote } from '../../services/requests.js';
import { getCompany, isEmployee, isOnboarded } from '../../services/users.js';

import { ack, isDialog, stripButtons } from '../helpers.js';
import { createRequestScenario } from '../scenarios/createRequest.js';
import { onboardingScenario } from '../scenarios/onboarding.js';
import { TEXTS, btn, contactsCard, keyboard, panelButton, requestCard, residentRequestButtons, withKeyboard } from '../ui.js';
import { sendRequestList } from '../views.js';

async function ensureOnboarded(ctx, next) {
  if (isOnboarded(ctx.dbUser)) return true;
  await ack(ctx);
  await ctx.reply(TEXTS.onboardingRequired);
  await ctx.scenario.start(onboardingScenario, { next });
  return false;
}

async function startCreate(ctx) {
  if (!isDialog(ctx)) return;
  if (isEmployee(ctx.dbUser)) {
    await ack(ctx);
    await ctx.reply('Сотрудники УК не создают заявки — они их обрабатывают. Откройте /panel.');
    return;
  }
  if (!(await ensureOnboarded(ctx, 'create'))) return;
  await ack(ctx);
  await ctx.scenario.start(createRequestScenario, {});
}

async function showMy(ctx) {
  if (!isDialog(ctx)) return;
  if (!(await ensureOnboarded(ctx, null))) return;
  await ack(ctx);
  const requests = await listRequests({ authorId: ctx.dbUser.id });
  await sendRequestList(ctx, requests, 'Мои заявки', (request) => residentRequestButtons(request, ctx.dbUser, false));
}

async function showSupported(ctx) {
  if (!isDialog(ctx)) return;
  if (!(await ensureOnboarded(ctx, null))) return;
  await ack(ctx);
  const requests = await listRequests({ supportedByUserId: ctx.dbUser.id });
  await sendRequestList(ctx, requests, 'Поддержанные заявки', () => []);
}

async function showContacts(ctx) {
  if (!isDialog(ctx)) return;
  await ack(ctx);
  await ctx.reply(contactsCard(await getCompany()), withKeyboard(panelButton()));
}

export function registerResidentHandlers(bot) {
  bot.command(['create', 'new'], startCreate);
  bot.action('menu:create', startCreate);

  bot.command('my', showMy);
  bot.action('menu:my', showMy);

  bot.command('supported', showSupported);
  bot.action('menu:supported', showSupported);

  bot.command('contacts', showContacts);
  bot.action('menu:contacts', showContacts);

  // Поддержать заявку (кнопка под карточкой в личном диалоге)
  bot.action(/^req:vote:(\d+)$/, async (ctx) => {
    const requestId = Number(ctx.match?.[1]);
    try {
      const { request, submitted } = await vote(requestId, ctx.dbUser.id);
      const note = submitted
        ? '\n\n✅ Заявка была подписана! Собрано нужное число подписей — заявка передана в УК.'
        : '\n\n✅ Заявка была подписана!';
      await ack(ctx, { message: { text: requestCard(request) + note, attachments: [keyboard(panelButton())] } });
    } catch (error) {
      if (!isAppError(error)) throw error;
      await ack(ctx, { notification: error.message });
      if (error.code === 'onboarding_required') {
        await ctx.reply(TEXTS.onboardingRequired);
        await ctx.scenario.start(onboardingScenario, { next: `req_${requestId}` });
      } else {
        await ctx.reply(error.message, withKeyboard(panelButton()));
      }
    }
  });

  // «Отклонить» у жителя — просто убрать кнопки, заявка не меняется
  bot.action(/^req:dismiss:(\d+)$/, async (ctx) => {
    const current = ctx.message?.body.text ?? '';
    await ack(ctx, { message: { text: current, attachments: [keyboard(panelButton())] } });
  });

  // «Подробнее» из чата дома, если ссылка на бота недоступна: шлём карточку в личку
  bot.action(/^req:view:(\d+)$/, async (ctx) => {
    const requestId = Number(ctx.match?.[1]);
    const request = await getRequest(requestId);
    if (!request) {
      await ack(ctx, { notification: 'Заявка не найдена' });
      return;
    }
    const voted = await hasVoted(request.id, ctx.dbUser.id);
    try {
      await ctx.api.sendMessageToUser(
        Number(ctx.dbUser.maxUserId),
        requestCard(request) + (voted ? '\n\n✅ Вы поддержали эту заявку' : ''),
        withKeyboard([...residentRequestButtons(request, ctx.dbUser, voted), ...panelButton()]),
      );
      await ack(ctx, { notification: 'Отправил заявку вам в личные сообщения' });
    } catch (error) {
      log.warn('Не удалось отправить карточку в личку', error);
      await ack(ctx, { notification: 'Сначала откройте диалог с ботом и нажмите «Начать»' });
    }
  });

  bot.action(/^req:delete:(\d+)$/, async (ctx) => {
    const requestId = Number(ctx.match?.[1]);
    await ack(ctx, {
      message: {
        text: `Вы уверены в удалении заявки №${requestId}?`,
        attachments: [keyboard([[btn.callback('Да', `req:delete_yes:${requestId}`), btn.callback('Нет', `req:delete_no:${requestId}`)]])],
      },
    });
  });

  bot.action(/^req:delete_yes:(\d+)$/, async (ctx) => {
    const requestId = Number(ctx.match?.[1]);
    try {
      await deleteRequest(requestId, ctx.dbUser.id);
      await ack(ctx, { message: { text: `Заявка №${requestId} была удалена.`, attachments: [keyboard(panelButton())] } });
    } catch (error) {
      if (!isAppError(error)) throw error;
      await ack(ctx, { message: { text: error.message, attachments: [keyboard(panelButton())] } });
    }
  });

  bot.action(/^req:delete_no:(\d+)$/, async (ctx) => {
    const requestId = Number(ctx.match?.[1]);
    const request = await getRequest(requestId);
    if (!request) {
      await stripButtons(ctx, 'Заявка не найдена.');
      return;
    }
    await ack(ctx, {
      message: {
        text: requestCard(request),
        attachments: [keyboard([...residentRequestButtons(request, ctx.dbUser, false), ...panelButton()])],
      },
    });
  });
}
