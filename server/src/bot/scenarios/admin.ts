import { defineScenario, transition } from '@maxhub/max-bot-api';
import { prisma } from '../../lib/db.js';
import { isAppError } from '../../lib/errors.js';
import { fullName } from '../../lib/labels.js';
import { buildRequestDocument } from '../../services/documents.js';
import { sendDelegationEmail } from '../../services/mailer.js';
import { changeStatus, getRequest, getRequestDetailed } from '../../services/requests.js';
import { assignResidentToHouse, detachResident, getHouse, getUserByMaxId, listHouses, listOrganizations } from '../../services/users.js';
import type { BotContext } from '../context.js';
import { ack, payloadOf, textOf } from '../helpers.js';
import { btn, houseButtons, keyboard, panelButton, requestCard, ukRequestButtons, withKeyboard, yesNoButtons } from '../ui.js';
import { SCENARIO_TIMEOUT_MS, cancelIntercept } from './common.js';

export interface ManageOwnerData {
  action: 'add' | 'remove';
  maxUserId?: string;
  targetName?: string;
  houseId?: number;
  houseAddress?: string;
}

type OwnerStep = 'start' | 'user' | 'house' | 'confirm';

export const manageOwnerScenario = defineScenario<BotContext, ManageOwnerData>()<OwnerStep>({
  id: 'manage-owner',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx, data }) => {
      const verb = data.action === 'add' ? 'добавить' : 'удалить';
      await ctx.reply(
        `Введите MAX ID жителя, которого нужно ${verb} (число). Житель может узнать свой ID командой /id в этом боте.`,
        withKeyboard([[btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('user');
    },

    user: async ({ ctx, data }) => {
      const text = textOf(ctx);
      if (!text || !/^\d{1,18}$/.test(text)) {
        await ctx.reply('ID должен быть числом. Попробуйте ещё раз:');
        return transition.stay();
      }
      const existing = await getUserByMaxId(BigInt(text));
      const targetName = existing ? fullName(existing) : `пользователь ${text}`;

      if (data.action === 'remove') {
        if (!existing || existing.houseId === null) {
          await ctx.reply('Житель с таким ID не привязан ни к одному дому.', withKeyboard(panelButton()));
          return transition.cancel();
        }
        await ctx.reply(
          `Удалить ${targetName} (кв. ${existing.apartment ?? '—'}, ${existing.house?.address ?? '—'}) из дома?`,
          withKeyboard(yesNoButtons('own')),
        );
        return transition.goto('confirm', { maxUserId: text, targetName });
      }

      const houses = await listHouses();
      if (houses.length === 0) {
        await ctx.reply('Сначала добавьте дома (см. seed или БД).', withKeyboard(panelButton()));
        return transition.cancel();
      }
      await ctx.reply('Выберите дом:', withKeyboard(houseButtons(houses, 'own:house')));
      return transition.goto('house', { maxUserId: text, targetName });
    },

    house: async ({ ctx, data }) => {
      const match = /^own:house:(\d+)$/.exec(payloadOf(ctx) ?? '');
      const house = match ? await getHouse(Number(match[1])) : null;
      if (!house) {
        await ctx.reply('Выберите дом кнопкой выше.');
        return transition.stay();
      }
      await ack(ctx, { message: { text: `🏠 ${house.address}` } });
      await ctx.reply(`Добавить ${data.targetName} в дом «${house.address}» как владельца?`, withKeyboard(yesNoButtons('own')));
      return transition.goto('confirm', { houseId: house.id, houseAddress: house.address });
    },

    confirm: async ({ ctx, data }) => {
      const payload = payloadOf(ctx);
      if (payload === 'own:no') {
        await ack(ctx, { message: { text: 'Отменено.' } });
        await ctx.reply('Хорошо, ничего не меняем.', withKeyboard(panelButton()));
        return transition.cancel();
      }
      if (payload !== 'own:yes' || !data.maxUserId) {
        await ctx.reply('Нажмите «Да» или «Нет».');
        return transition.stay();
      }
      try {
        if (data.action === 'add' && data.houseId) {
          await assignResidentToHouse(BigInt(data.maxUserId), data.houseId);
          await ack(ctx, { message: { text: 'Пользователь был добавлен!' } });
          await ctx.reply(`✅ ${data.targetName} добавлен в дом «${data.houseAddress}».`, withKeyboard(panelButton()));
        } else {
          await detachResident(BigInt(data.maxUserId));
          await ack(ctx, { message: { text: 'Пользователь был удалён!' } });
          await ctx.reply(`✅ ${data.targetName} удалён из дома.`, withKeyboard(panelButton()));
        }
      } catch (error) {
        if (!isAppError(error)) throw error;
        await ack(ctx, { notification: error.message });
        await ctx.reply(`Не получилось: ${error.message}`, withKeyboard(panelButton()));
      }
      return transition.complete();
    },
  },
});

export interface AnnounceData {
  houseId?: number;
  houseAddress?: string;
  chatId?: string;
  text?: string;
}

type AnnounceStep = 'start' | 'house' | 'text' | 'confirm';

export const announceScenario = defineScenario<BotContext, AnnounceData>()<AnnounceStep>({
  id: 'announce',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  createData: () => ({}),
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx }) => {
      const houses = (await listHouses()).filter((house: any) => house.chatId !== null);
      if (houses.length === 0) {
        await ctx.reply('Ни один чат дома ещё не привязан. Добавьте бота в чат дома и отправьте там /bind.', withKeyboard(panelButton()));
        return transition.cancel();
      }
      await ctx.reply('В какой дом отправить объявление?', withKeyboard(houseButtons(houses, 'ann:house')));
      return transition.goto('house');
    },

    house: async ({ ctx }) => {
      const match = /^ann:house:(\d+)$/.exec(payloadOf(ctx) ?? '');
      const house = match ? await getHouse(Number(match[1])) : null;
      if (!house || house.chatId === null) {
        await ctx.reply('Выберите дом кнопкой выше.');
        return transition.stay();
      }
      await ack(ctx, { message: { text: `🏠 ${house.address}` } });
      await ctx.reply('Введите текст объявления одним сообщением:', withKeyboard([[btn.callback('Отмена', 'cancel')]]));
      return transition.goto('text', { houseId: house.id, houseAddress: house.address, chatId: house.chatId.toString() });
    },

    text: async ({ ctx }) => {
      const text = textOf(ctx);
      if (!text) {
        await ctx.reply('Отправьте текст объявления.');
        return transition.stay();
      }
      await ctx.reply(`Отправить в чат дома:\n\n📢 ${text}`, withKeyboard([[btn.callback('Отправить', 'ann:yes'), btn.callback('Отмена', 'cancel')]]));
      return transition.goto('confirm', { text });
    },

    confirm: async ({ ctx, data }) => {
      if (payloadOf(ctx) !== 'ann:yes' || !data.chatId || !data.text) {
        await ctx.reply('Нажмите «Отправить» или «Отмена».');
        return transition.stay();
      }
      await ctx.api.sendMessageToChat(Number(data.chatId), `📢 Объявление от управляющей компании\n\n${data.text}`);
      await ack(ctx, { message: { text: 'Объявление отправлено.' } });
      await ctx.reply(`✅ Объявление отправлено в чат дома «${data.houseAddress}».`, withKeyboard(panelButton()));
      return transition.complete();
    },
  },
});

export interface DelegateData {
  requestId: number;

  cardMid?: string | null;
}

type DelegateStep = 'start' | 'org';

async function refreshCard(ctx: BotContext, requestId: number, cardMid: string | null | undefined, note: string): Promise<void> {
  if (!cardMid) return;
  const request = await getRequest(requestId);
  if (!request) return;
  try {
    await ctx.api.editMessage(cardMid, { text: `${requestCard(request)}\n\n${note}`, attachments: [keyboard(ukRequestButtons(request))] });
  } catch {

  }
}

export const delegateScenario = defineScenario<BotContext, DelegateData>()<DelegateStep>({
  id: 'delegate-request',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx, data }) => {
      const request = await getRequest(data.requestId);
      if (!request) {
        await ctx.reply('Заявка не найдена.', withKeyboard(panelButton()));
        return transition.cancel();
      }
      const organizations = await listOrganizations();
      if (organizations.length === 0) {
        await ctx.reply('Справочник организаций пуст. Добавьте организации в БД (таблица ResponsibleOrganization).', withKeyboard(panelButton()));
        return transition.cancel();
      }
      const sorted = [...organizations].sort((a, b) => {
        const aMatch = a.categories.includes(request.category) ? 0 : 1;
        const bMatch = b.categories.includes(request.category) ? 0 : 1;
        return aMatch - bMatch || a.id - b.id;
      });
      const rows = sorted.map((org) => [btn.callback(org.categories.includes(request.category) ? `⭐ ${org.name}` : org.name, `dlg:org:${org.id}`)]);
      rows.push([btn.callback('Отмена', 'cancel')]);
      await ctx.reply(`Заявка №${request.id}. Выберите организацию, ответственную за данный вопрос:`, withKeyboard(rows));
      return transition.goto('org');
    },

    org: async ({ ctx, data }) => {
      const match = /^dlg:org:(\d+)$/.exec(payloadOf(ctx) ?? '');
      if (!match) {
        await ctx.reply('Выберите организацию кнопкой выше.');
        return transition.stay();
      }
      const organizationId = Number(match[1]);
      try {
        const updated = await changeStatus(data.requestId, 'DELEGATED', { byUserId: ctx.dbUser.id, organizationId });
        const detailed = await getRequestDetailed(data.requestId);
        const organization = await prisma.responsibleOrganization.findUnique({ where: { id: organizationId } });
        let mailNote = '';
        if (detailed && organization) {
          const result = await sendDelegationEmail(updated, organization, buildRequestDocument(detailed));
          mailNote = result.to
            ? result.simulated
              ? `Письмо на ${result.to} записано в лог сервера (SMTP не настроен — отправка имитируется).`
              : `Заявка отправлена на почту ответственного: ${result.to}.`
            : 'У организации не указан email — письмо не отправлено.';
        }
        await ack(ctx, { message: { text: `Организация: ${organization?.name ?? organizationId}` } });
        await ctx.reply(`➡️ Заявка №${data.requestId} передана в «${organization?.name}». ${mailNote}`, withKeyboard(panelButton()));
        await refreshCard(ctx, data.requestId, data.cardMid, `➡️ Передана в организацию: ${organization?.name}`);
      } catch (error) {
        if (!isAppError(error)) throw error;
        await ack(ctx, { notification: error.message });
        await ctx.reply(`Не получилось: ${error.message}`, withKeyboard(panelButton()));
      }
      return transition.complete();
    },
  },
});

export interface RejectData {
  requestId: number;
  cardMid?: string | null;
}

type RejectStep = 'start' | 'comment';

export const rejectScenario = defineScenario<BotContext, RejectData>()<RejectStep>({
  id: 'reject-request',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx, data }) => {
      await ctx.reply(
        `Заявка №${data.requestId}. Укажите причину отклонения одним сообщением — житель увидит её в уведомлении.`,
        withKeyboard([[btn.callback('Без комментария', 'rej:skip')], [btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('comment');
    },

    comment: async ({ ctx, data }) => {
      const skip = payloadOf(ctx) === 'rej:skip';
      const comment = skip ? null : textOf(ctx);
      if (!skip && !comment) {
        await ctx.reply('Напишите причину или нажмите «Без комментария».');
        return transition.stay();
      }
      try {
        await changeStatus(data.requestId, 'REJECTED', { byUserId: ctx.dbUser.id, comment });
        if (skip) await ack(ctx, { message: { text: 'Без комментария.' } });
        await ctx.reply(`❌ Заявка №${data.requestId} была отклонена.`, withKeyboard(panelButton()));
        await refreshCard(ctx, data.requestId, data.cardMid, '❌ Отклонена');
      } catch (error) {
        if (!isAppError(error)) throw error;
        await ack(ctx, { notification: error.message });
        await ctx.reply(`Не получилось: ${error.message}`, withKeyboard(panelButton()));
      }
      return transition.complete();
    },
  },
});
