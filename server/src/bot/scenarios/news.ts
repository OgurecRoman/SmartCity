import { defineScenario, transition } from '@maxhub/max-bot-api';
import { isAppError } from '../../lib/errors.js';
import { createNews } from '../../services/news.js';
import type { BotContext } from '../context.js';
import { ack, payloadOf, textOf } from '../helpers.js';
import { btn, panelButton, withKeyboard } from '../ui.js';
import { SCENARIO_TIMEOUT_MS, cancelIntercept } from './common.js';

export interface CreateNewsData {
  title?: string;
  description?: string;
  contact?: string;
}

type CreateNewsStep = 'start' | 'title' | 'description' | 'contact' | 'confirm';

export const createNewsScenario = defineScenario<BotContext, CreateNewsData>()<CreateNewsStep>({
  id: 'create-news',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  createData: () => ({}),
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx }) => {
      await ctx.reply(
        'Заголовок новости (например: «Зову на Новый год»):',
        withKeyboard([[btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('title');
    },

    title: async ({ ctx }) => {
      const text = textOf(ctx);
      if (!text || text.trim().length < 3) {
        await ctx.reply('Заголовок должен быть от 3 символов. Попробуйте ещё раз:');
        return transition.stay();
      }
      await ctx.reply('Теперь текст новости одним сообщением:', withKeyboard([[btn.callback('Отмена', 'cancel')]]));
      return transition.goto('description', { title: text.trim() });
    },

    description: async ({ ctx }) => {
      const text = textOf(ctx);
      if (!text || text.trim().length < 5) {
        await ctx.reply('Опишите новость подробнее (минимум 5 символов).');
        return transition.stay();
      }
      await ctx.reply(
        'Как с вами связаться? Укажите телефон, ссылку на профиль или что-то ещё:',
        withKeyboard([[btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('contact', { description: text.trim() });
    },

    contact: async ({ ctx, data }) => {
      const text = textOf(ctx);
      if (!text || text.trim().length < 3) {
        await ctx.reply('Укажите контакт для связи (минимум 3 символа).');
        return transition.stay();
      }
      const contact = text.trim();
      await ctx.reply(
        `Опубликовать в доме:\n\n🎉 ${data.title}\n\n${data.description}\n\nСвязаться: ${contact}`,
        withKeyboard([[btn.callback('Опубликовать', 'news:yes'), btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('confirm', { contact });
    },

    confirm: async ({ ctx, data }) => {
      if (payloadOf(ctx) !== 'news:yes' || !data.title || !data.description || !data.contact) {
        await ctx.reply('Нажмите «Опубликовать» или «Отмена».');
        return transition.stay();
      }
      try {
        await createNews({
          houseId: ctx.dbUser.houseId!,
          authorId: ctx.dbUser.id,
          title: data.title,
          description: data.description,
          contact: data.contact,
        });
        await ack(ctx, { notification: 'Новость опубликована.' });
        await ctx.reply('✅ Новость опубликована в доме.', withKeyboard(panelButton()));
      } catch (error) {
        if (!isAppError(error)) throw error;
        await ack(ctx, { notification: error.message });
        await ctx.reply(`Не получилось: ${error.message}`, withKeyboard(panelButton()));
      }
      return transition.complete();
    },
  },
});
