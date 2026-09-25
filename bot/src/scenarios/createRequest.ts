import { defineScenario, transition } from '@maxhub/max-bot-api';
import { config } from '../config.js';
import { CATEGORY_LABELS, PRIORITY_LABELS, addDays, formatDate, parseRuDate } from '../../lib/labels.js';
import type { RequestCategory, RequestPriority } from '@prisma/client';
import { computeVotesRequired, createRequest } from '../../services/requests.js';
import type { BotContext } from '../context.js';
import { ack, payloadOf, textOf } from '../helpers.js';
import { MD, btn, categoryButtons, panelButton, requestCard, withKeyboard, type ButtonRows } from '../ui.js';
import { SCENARIO_TIMEOUT_MS, cancelIntercept, handlePhotoInput } from './common.js';

export interface CreateRequestData {
  category?: RequestCategory;
  description?: string;
  priority?: RequestPriority;

  deadline?: string | null;
  photos?: string[];
}

type Step = 'start' | 'category' | 'description' | 'priority' | 'deadline' | 'photos' | 'preview';

const PHOTOS_DONE = 'cr:photos:done';

function photoPromptButtons(count: number): ButtonRows {
  return [[btn.callback(count > 0 ? `Готово (${count})` : 'Без фото', PHOTOS_DONE)], [btn.callback('Отмена', 'cancel')]];
}

const CATEGORY_PROMPT = 'Выберите категорию заявки:';

async function sendPreview(ctx: BotContext, data: CreateRequestData): Promise<void> {
  const user = ctx.dbUser;
  const emergency = data.priority === 'EMERGENCY';
  const deadline = data.deadline ? new Date(data.deadline) : addDays(new Date(), config.votes.defaultDeadlineDays);
  const votesRequired = user.houseId && !emergency ? await computeVotesRequired(user.houseId) : 0;
  const lines = [
    'Ваша заявка:',
    `Категория: ${CATEGORY_LABELS[data.category ?? 'OTHER']}`,
    `Приоритет: ${PRIORITY_LABELS[data.priority ?? 'NORMAL']}`,
    `Дом: ${user.house?.address ?? '—'}${user.apartment ? `, кв. ${user.apartment}` : ''}`,
  ];
  if (!emergency) {
    lines.push(`Срок сбора подписей: ${formatDate(deadline)}`);
    lines.push(`Необходимое количество подписей: ${votesRequired}`);
  } else {
    lines.push('Аварийная заявка будет передана в УК сразу, без сбора подписей.');
  }
  lines.push('', data.description ?? '');
  if (data.photos?.length) lines.push('', `📷 Фото: ${data.photos.length}`);
  await ctx.reply(
    lines.join('\n'),
    withKeyboard([[btn.callback('✅ Отправить', 'cr:send'), btn.callback('✏️ Изменить', 'cr:edit')], [btn.callback('Отмена', 'cancel')]]),
  );
}

export const createRequestScenario = defineScenario<BotContext, CreateRequestData>()<Step>({
  id: 'create-request',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  createData: () => ({}),
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx }) => {
      await ctx.reply(CATEGORY_PROMPT, withKeyboard(categoryButtons('cr:cat')));
      return transition.goto('category');
    },

    category: async ({ ctx }) => {
      const match = /^cr:cat:([A-Z_]+)$/.exec(payloadOf(ctx) ?? '');
      const category = match && match[1] in CATEGORY_LABELS ? (match[1] as RequestCategory) : null;
      if (!category) {
        await ctx.reply('Выберите категорию кнопкой в сообщении выше.');
        return transition.stay();
      }
      await ack(ctx, { message: { text: `Категория: ${CATEGORY_LABELS[category]}` } });
      await ctx.reply('Опишите проблему одним сообщением: что случилось, где и когда.');
      return transition.goto('description', { category });
    },

    description: async ({ ctx }) => {
      const text = textOf(ctx);
      if (!text || text.length < 5) {
        await ctx.reply('Опишите проблему текстом — хотя бы несколько слов.');
        return transition.stay();
      }
      if (text.length > 2000) {
        await ctx.reply('Слишком длинное описание (максимум 2000 символов). Сократите, пожалуйста.');
        return transition.stay();
      }
      await ctx.reply(
        'Это аварийная ситуация (прорыв трубы, застрявший лифт, нет света)? Аварийные заявки уходят в УК сразу, без сбора подписей.',
        withKeyboard([[btn.callback('Обычная заявка', 'cr:prio:NORMAL')], [btn.callback('🚨 Аварийная', 'cr:prio:EMERGENCY')], [btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('priority', { description: text });
    },

    priority: async ({ ctx, data }) => {
      const match = /^cr:prio:(NORMAL|EMERGENCY)$/.exec(payloadOf(ctx) ?? '');
      if (!match) {
        await ctx.reply('Выберите вариант кнопкой выше.');
        return transition.stay();
      }
      const priority = match[1] as RequestPriority;
      await ack(ctx, { message: { text: `Приоритет: ${PRIORITY_LABELS[priority]}` } });
      if (priority === 'EMERGENCY') {
        await ctx.reply('Можете приложить фото проблемы (необязательно) — пришлите одну или несколько, или нажмите «Без фото».', withKeyboard(photoPromptButtons(0)));
        return transition.goto('photos', { priority, deadline: null });
      }
      const defaultDeadline = addDays(new Date(), config.votes.defaultDeadlineDays);
      await ctx.reply(
        `Установите срок сбора подписей в формате ДД.ММ.ГГГГ или нажмите «Пропустить» — тогда срок будет ${config.votes.defaultDeadlineDays} дней (до ${formatDate(defaultDeadline)}).`,
        withKeyboard([[btn.callback('Пропустить', 'cr:skip')], [btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('deadline', { priority });
    },

    deadline: async ({ ctx, data }) => {
      let deadline: string | null;
      if (payloadOf(ctx) === 'cr:skip') {
        await ack(ctx, { message: { text: `Срок сбора подписей: ${formatDate(addDays(new Date(), config.votes.defaultDeadlineDays))}` } });
        deadline = null;
      } else {
        const text = textOf(ctx);
        const parsed = text ? parseRuDate(text) : null;
        if (!parsed) {
          await ctx.reply('Не понял дату. Введите в формате ДД.ММ.ГГГГ, например 30.09.2026, или нажмите «Пропустить».');
          return transition.stay();
        }
        if (parsed.getTime() < Date.now()) {
          await ctx.reply('Эта дата уже прошла. Укажите дату в будущем.');
          return transition.stay();
        }
        deadline = parsed.toISOString();
      }
      await ctx.reply('Можете приложить фото проблемы (необязательно) — пришлите одну или несколько, или нажмите «Без фото».', withKeyboard(photoPromptButtons(0)));
      return transition.goto('photos', { deadline });
    },

    photos: async ({ ctx, data }) => {
      const result = await handlePhotoInput(ctx, PHOTOS_DONE, data.photos ?? []);
      if (result.kind === 'done') {
        await ack(ctx, { message: { text: `Фото: ${(data.photos ?? []).length}` } });
        await sendPreview(ctx, data);
        return transition.goto('preview');
      }
      if (result.kind === 'invalid') {
        await ctx.reply('Пришлите фото или нажмите кнопку выше.', withKeyboard(photoPromptButtons((data.photos ?? []).length)));
        return transition.stay();
      }
      await ctx.reply(`Добавлено. Всего фото: ${result.photos.length}. Пришлите ещё или нажмите «Готово».`, withKeyboard(photoPromptButtons(result.photos.length)));
      return transition.stay({ photos: result.photos });
    },

    preview: async ({ ctx, data }) => {
      const payload = payloadOf(ctx);
      if (payload === 'cr:edit') {
        await ack(ctx, { message: { text: 'Изменяем заявку.' } });
        await ctx.reply(CATEGORY_PROMPT, withKeyboard(categoryButtons('cr:cat')));
        return transition.goto('category');
      }
      if (payload !== 'cr:send' || !data.category || !data.description) {
        await ctx.reply('Нажмите «Отправить», «Изменить» или «Отмена».');
        return transition.stay();
      }
      const request = await createRequest({
        authorId: ctx.dbUser.id,
        category: data.category,
        description: data.description,
        priority: data.priority ?? 'NORMAL',
        deadline: data.deadline ? new Date(data.deadline) : null,
        photos: data.photos,
      });
      await ack(ctx, { message: { text: 'Заявка отправлена.' } });
      const hint =
        request.priority === 'EMERGENCY'
          ? 'Аварийная заявка передана в УК. Сотрудники получили уведомление.'
          : `Соседи получат уведомление в чате дома. Как только соберётся ${request.votesRequired} ${request.votesRequired === 1 ? 'подпись' : 'подписей'}, заявка уйдёт в УК, а вы получите уведомление.`;
      await ctx.reply(`Готово! Заявка №${request.id} создана.\n${hint}\n\n${requestCard(request)}`, { ...withKeyboard(panelButton()), ...MD });
      return transition.complete();
    },
  },
});
