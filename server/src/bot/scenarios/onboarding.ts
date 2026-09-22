import { defineScenario, transition } from '@maxhub/max-bot-api';
import { checkApartment } from '../../services/rules.js';
import { submitMembershipRequest } from '../../services/membership.js';
import { apartmentDataOf, getHouse, listHouses } from '../../services/users.js';
import { isAppError } from '../../lib/errors.js';
import type { BotContext } from '../context.js';
import { ack, payloadOf, textOf } from '../helpers.js';
import { btn, houseButtons, panelButton, withKeyboard } from '../ui.js';
import { SCENARIO_TIMEOUT_MS, cancelIntercept } from './common.js';

export interface OnboardingData {
  houseId?: number;
  houseAddress?: string;
  apartment?: string;
  fullName?: string;

  next?: string | null;
}

type Step = 'start' | 'house' | 'apartment' | 'fullName' | 'confirm';

const APARTMENT_RE = /^\d{1,4}\s?[а-яa-z]?$/i;

export const onboardingScenario = defineScenario<BotContext, OnboardingData>()<Step>({
  id: 'onboarding',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  createData: () => ({}),
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx }) => {
      const houses = await listHouses();
      if (houses.length === 0) {
        await ctx.reply('Пока ни один дом не подключён к боту. Обратитесь в управляющую компанию.');
        return transition.cancel();
      }
      await ctx.reply('Выберите ваш дом:', withKeyboard(houseButtons(houses, 'onb:house', false)));
      return transition.goto('house');
    },

    house: async ({ ctx }) => {
      const match = /^onb:house:(\d+)$/.exec(payloadOf(ctx) ?? '');
      const house = match ? await getHouse(Number(match[1])) : null;
      if (!house) {
        await ctx.reply('Пожалуйста, выберите дом кнопкой в сообщении выше.');
        return transition.stay();
      }
      await ack(ctx, { message: { text: `🏠 Дом: ${house.address}` } });
      await ctx.reply('Введите номер квартиры (например, 15 или 15а):');
      return transition.goto('apartment', { houseId: house.id, houseAddress: house.address });
    },

    apartment: async ({ ctx, data }) => {
      const text = textOf(ctx);
      if (!text || !APARTMENT_RE.test(text)) {
        await ctx.reply('Номер квартиры — это число, например 15 или 15а. Попробуйте ещё раз:');
        return transition.stay();
      }

      const house = data.houseId ? await getHouse(data.houseId) : null;
      const check = house ? checkApartment(text, apartmentDataOf(house)) : null;
      if (check && !check.ok) {
        await ctx.reply(`${check.message}. Проверьте номер и введите ещё раз:`);
        return transition.stay();
      }

      const profileName = [ctx.dbUser.firstName, ctx.dbUser.lastName].filter(Boolean).join(' ').trim();
      const rows = profileName
        ? [[btn.callback(`Использовать «${profileName}»`, 'onb:name:profile')], [btn.callback('Отмена', 'cancel')]]
        : [[btn.callback('Отмена', 'cancel')]];
      await ctx.reply(
        'Как вас зовут? Укажите ФИО полностью — его увидит председатель ТСЖ или УК при проверке.',
        withKeyboard(rows),
      );
      return transition.goto('fullName', { apartment: text.replace(/\s+/g, '') });
    },

    fullName: async ({ ctx, data }) => {
      let fullNameValue: string | null = null;
      if (payloadOf(ctx) === 'onb:name:profile') {
        fullNameValue = [ctx.dbUser.firstName, ctx.dbUser.lastName].filter(Boolean).join(' ').trim() || null;
        await ack(ctx, { message: { text: `👤 ${fullNameValue}` } });
      } else {
        const text = textOf(ctx);
        if (text && text.trim().length >= 3) fullNameValue = text.trim();
      }
      if (!fullNameValue || fullNameValue.length < 3) {
        await ctx.reply('Введите ФИО текстом (от 3 символов) или нажмите кнопку выше.');
        return transition.stay();
      }
      await ctx.reply(
        `Дом: ${data.houseAddress}\nКвартира: ${data.apartment}\nФИО: ${fullNameValue}\n\n` +
          'Отправить на подтверждение председателю ТСЖ или в УК?',
        withKeyboard([[btn.callback('Отправить', 'onb:send'), btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('confirm', { fullName: fullNameValue });
    },

    confirm: async ({ ctx, data }) => {
      if (payloadOf(ctx) !== 'onb:send' || !data.houseId || !data.apartment || !data.fullName) {
        await ctx.reply('Нажмите «Отправить» или «Отмена».');
        return transition.stay();
      }
      try {
        await submitMembershipRequest({
          applicantId: ctx.dbUser.id,
          houseId: data.houseId,
          apartment: data.apartment,
          fullName: data.fullName,
        });
        await ack(ctx, { message: { text: 'Заявка отправлена.' } });
        const requestMatch = /^req_(\d+)$/.exec(data.next ?? '');
        const extra = requestMatch ? ` После подтверждения сможете посмотреть заявку №${requestMatch[1]}.` : '';
        await ctx.reply(
          'Заявка отправлена на проверку председателю ТСЖ или в УК. Как только её подтвердят, пришлю сообщение ' +
            `и ссылку на чат дома.${extra}`,
        );
      } catch (error) {
        if (!isAppError(error)) throw error;
        await ack(ctx, { notification: error.message });
        await ctx.reply(`Не получилось: ${error.message}`, withKeyboard(panelButton()));
      }
      return transition.complete();
    },
  },
});
