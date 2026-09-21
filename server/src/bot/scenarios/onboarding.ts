import { defineScenario, transition } from '@maxhub/max-bot-api';
import { RESIDENT_TYPE_LABELS } from '../../lib/labels.js';
import { checkApartment } from '../../services/rules.js';
import { apartmentDataOf, completeOnboarding, getHouse, listHouses } from '../../services/users.js';
import type { BotContext } from '../context.js';
import { ack, payloadOf, textOf } from '../helpers.js';
import { btn, houseButtons, residentMenu, withKeyboard } from '../ui.js';
import { showRequestToResident } from '../views.js';
import { SCENARIO_TIMEOUT_MS, cancelIntercept } from './common.js';

export interface OnboardingData {
  houseId?: number;
  houseAddress?: string;
  apartment?: string;

  next?: string | null;
}

type Step = 'start' | 'house' | 'apartment' | 'type';

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
      await ctx.reply(
        'Вы владелец квартиры или арендатор?',
        withKeyboard([[btn.callback('Владелец', 'onb:type:OWNER'), btn.callback('Арендатор', 'onb:type:TENANT')]]),
      );
      return transition.goto('type', { apartment: text.replace(/\s+/g, '') });
    },

    type: async ({ ctx, data }) => {
      const match = /^onb:type:(OWNER|TENANT)$/.exec(payloadOf(ctx) ?? '');
      if (!match || !data.houseId || !data.apartment) {
        await ctx.reply('Выберите вариант кнопкой выше: владелец или арендатор.');
        return transition.stay();
      }
      const residentType = match[1] as 'OWNER' | 'TENANT';
      ctx.dbUser = await completeOnboarding(ctx.dbUser.id, { houseId: data.houseId, apartment: data.apartment, residentType });
      await ack(ctx, { message: { text: `👤 ${RESIDENT_TYPE_LABELS[residentType]}` } });

      const summary = `Готово! Вы зарегистрированы: ${data.houseAddress}, кв. ${data.apartment} (${RESIDENT_TYPE_LABELS[residentType].toLowerCase()}).`;
      const requestMatch = /^req_(\d+)$/.exec(data.next ?? '');
      if (requestMatch) {
        await ctx.reply(summary);
        await showRequestToResident(ctx, Number(requestMatch[1]));
      } else if (data.next === 'create') {
        await ctx.reply(`${summary}\n\nТеперь можно создать заявку.`, withKeyboard([[btn.callback('📝 Создать заявку', 'menu:create')]]));
      } else {
        await ctx.reply(`${summary}\n\nЧто делаем?`, withKeyboard(residentMenu()));
      }
      return transition.complete();
    },
  },
});
