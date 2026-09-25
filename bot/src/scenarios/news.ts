import { defineScenario, transition } from '@maxhub/max-bot-api';
import type { BotContext } from '../controllers/context.js';
import { ack, payloadOf, textOf } from '../controllers/helpers.js';
import { btn, panelButton, withKeyboard, type ButtonRows } from '../controllers/ui.js';
import { createNews } from '../lib/api.js';
import { isAppError } from '../lib/errors.js';
import { SCENARIO_TIMEOUT_MS, cancelIntercept, handlePhotoInput } from './common.js';

export interface CreateNewsData {
  title?: string;
  description?: string;
  contact?: string;
  photos?: string[];
}

type CreateNewsStep = 'start' | 'title' | 'description' | 'contact' | 'photos' | 'confirm';

const PHOTOS_DONE = 'news:photos:done';

function photoPromptButtons(count: number): ButtonRows {
  return [[btn.callback(count > 0 ? `Готово (${count})` : 'Без фото', PHOTOS_DONE)], [btn.callback('Отмена', 'cancel')]];
}

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
      await ctx.reply('Можете приложить фото (необязательно) — пришлите одну или несколько, или нажмите «Без фото».', withKeyboard(photoPromptButtons(0)));
      return transition.goto('photos', { contact });
    },

    photos: async ({ ctx, data }) => {
      const result = await handlePhotoInput(ctx, PHOTOS_DONE, data.photos ?? []);
      if (result.kind === 'done') {
        await ack(ctx, { message: { text: `Фото: ${(data.photos ?? []).length}` } });
        const photosLine = data.photos?.length ? `\n\n📷 Фото: ${data.photos.length}` : '';
        await ctx.reply(
          `Опубликовать в доме:\n\n🎉 ${data.title}\n\n${data.description}\n\nСвязаться: ${data.contact}${photosLine}`,
          withKeyboard([[btn.callback('Опубликовать', 'news:yes'), btn.callback('Отмена', 'cancel')]]),
        );
        return transition.goto('confirm');
      }
      if (result.kind === 'invalid') {
        await ctx.reply('Пришлите фото или нажмите кнопку выше.', withKeyboard(photoPromptButtons((data.photos ?? []).length)));
        return transition.stay();
      }
      await ctx.reply(`Добавлено. Всего фото: ${result.photos.length}. Пришлите ещё или нажмите «Готово».`, withKeyboard(photoPromptButtons(result.photos.length)));
      return transition.stay({ photos: result.photos });
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
          photos: data.photos,
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
