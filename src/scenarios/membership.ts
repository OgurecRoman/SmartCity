import { defineScenario, transition } from '@maxhub/max-bot-api';
import type { BotContext } from '../controllers/context.js';
import { textOf } from '../controllers/helpers.js';
import { btn, panelButton, withKeyboard } from '../controllers/ui.js';
import { addTenantByOwner, rejectMembershipRequest } from '../lib/api.js';
import { isAppError } from '../lib/errors.js';
import { SCENARIO_TIMEOUT_MS, cancelIntercept } from './common.js';

export interface RejectMembershipData {
  requestId: number;
}

type RejectMembershipStep = 'start' | 'reason';

export const rejectMembershipScenario = defineScenario<BotContext, RejectMembershipData>()<RejectMembershipStep>({
  id: 'reject-membership',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx, data }) => {
      await ctx.reply(
        `Заявка №${data.requestId}. Укажите причину отказа одним сообщением — заявитель её увидит:`,
        withKeyboard([[btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('reason');
    },

    reason: async ({ ctx, data }) => {
      const text = textOf(ctx);
      if (!text || text.trim().length < 3) {
        await ctx.reply('Причина должна быть от 3 символов. Попробуйте ещё раз:');
        return transition.stay();
      }
      try {
        await rejectMembershipRequest(data.requestId, ctx.dbUser.id, text.trim());
        await ctx.reply(`❌ Заявка №${data.requestId} отклонена, заявителю отправлена причина.`, withKeyboard(panelButton()));
      } catch (error) {
        if (!isAppError(error)) throw error;
        await ctx.reply(`Не получилось: ${error.message}`, withKeyboard(panelButton()));
      }
      return transition.complete();
    },
  },
});

export interface AddTenantData {
  maxUserId?: string;
}

type AddTenantStep = 'start' | 'userId' | 'apartment';

export const addTenantScenario = defineScenario<BotContext, AddTenantData>()<AddTenantStep>({
  id: 'add-tenant',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  createData: () => ({}),
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx }) => {
      await ctx.reply(
        'Введите MAX ID съёмщика (число). Он может узнать свой ID командой /id в этом боте.',
        withKeyboard([[btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('userId');
    },

    userId: async ({ ctx }) => {
      const text = textOf(ctx);
      if (!text || !/^\d{1,18}$/.test(text)) {
        await ctx.reply('ID должен быть числом. Попробуйте ещё раз:');
        return transition.stay();
      }
      await ctx.reply('В какой квартире он живёт?', withKeyboard([[btn.callback('Отмена', 'cancel')]]));
      return transition.goto('apartment', { maxUserId: text });
    },

    apartment: async ({ ctx, data }) => {
      const text = textOf(ctx);
      if (!text || !data.maxUserId) {
        await ctx.reply('Укажите номер квартиры текстом.');
        return transition.stay();
      }
      try {
        const tenant = await addTenantByOwner(ctx.dbUser.id, data.maxUserId, text);
        await ctx.reply(`✅ Съёмщик добавлен в квартиру ${tenant.apartment}. Теперь он может пользоваться ботом и приложением.`, withKeyboard(panelButton()));
      } catch (error) {
        if (!isAppError(error)) throw error;
        await ctx.reply(`Не получилось: ${error.message}`, withKeyboard(panelButton()));
      }
      return transition.complete();
    },
  },
});
