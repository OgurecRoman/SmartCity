import { defineScenario, transition } from '@maxhub/max-bot-api';
import type { BotContext } from '../controllers/context.js';
import { ack, payloadOf, textOf } from '../controllers/helpers.js';
import { MD, btn, esc, houseButtons, keyboard, mdName, panelButton, requestCard, ukRequestButtons, withKeyboard, yesNoButtons } from '../controllers/ui.js';
import {
  appointChairman,
  assignResidentToHouse,
  changeStatus,
  createAnnouncement,
  detachResident,
  dismissChairman,
  getHouse,
  getRequest,
  getUserByMaxId,
  listHouses,
  listOrganizations,
} from '../lib/api.js';
import { isAppError } from '../lib/errors.js';
import { fullName } from '../lib/labels.js';
import { isChairman } from '../lib/rules.js';
import { SCENARIO_TIMEOUT_MS, cancelIntercept, handlePhotoInput } from './common.js';

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
          `Удалить ${mdName(targetName)} (кв. ${esc(existing.apartment ?? '—')}, ${esc(existing.house?.address ?? '—')}) из дома?`,
          { ...withKeyboard(yesNoButtons('own')), ...MD },
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
      await ctx.reply(
        `Добавить ${mdName(data.targetName ?? '')} в дом «${esc(house.address)}» как владельца?`,
        { ...withKeyboard(yesNoButtons('own')), ...MD },
      );
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
          await ctx.reply(
            `✅ ${mdName(data.targetName ?? '')} добавлен в дом «${esc(data.houseAddress ?? '')}».`,
            { ...withKeyboard(panelButton()), ...MD },
          );
        } else {
          await detachResident(BigInt(data.maxUserId));
          await ack(ctx, { message: { text: 'Пользователь был удалён!' } });
          await ctx.reply(`✅ ${mdName(data.targetName ?? '')} удалён из дома.`, { ...withKeyboard(panelButton()), ...MD });
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

export interface ManageChairmanData {
  action: 'appoint' | 'dismiss';
  maxUserId?: string;
  targetName?: string;
  houseId?: number;
  houseAddress?: string;
}

type ChairmanStep = 'start' | 'user' | 'house' | 'confirm';

export const manageChairmanScenario = defineScenario<BotContext, ManageChairmanData>()<ChairmanStep>({
  id: 'manage-chairman',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx, data }) => {
      const verb = data.action === 'appoint' ? 'назначить председателем ТСЖ' : 'снять с должности председателя ТСЖ';
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

      if (data.action === 'dismiss') {
        if (!existing || !isChairman(existing)) {
          await ctx.reply('Этот пользователь не является председателем ТСЖ.', withKeyboard(panelButton()));
          return transition.cancel();
        }
        await ctx.reply(
          `Снять ${mdName(targetName)} (${esc(existing.house?.address ?? '—')}) с должности председателя ТСЖ?`,
          { ...withKeyboard(yesNoButtons('chair')), ...MD },
        );
        return transition.goto('confirm', { maxUserId: text, targetName });
      }

      if (existing?.role === 'UK_EMPLOYEE') {
        await ctx.reply('Этот пользователь — сотрудник УК, председателем его назначить нельзя.', withKeyboard(panelButton()));
        return transition.cancel();
      }

      const houses = await listHouses();
      if (houses.length === 0) {
        await ctx.reply('Сначала добавьте дома (см. seed или БД).', withKeyboard(panelButton()));
        return transition.cancel();
      }
      await ctx.reply('В каком доме назначить председателя?', withKeyboard(houseButtons(houses, 'chair:house')));
      return transition.goto('house', { maxUserId: text, targetName });
    },

    house: async ({ ctx, data }) => {
      const match = /^chair:house:(\d+)$/.exec(payloadOf(ctx) ?? '');
      const house = match ? await getHouse(Number(match[1])) : null;
      if (!house) {
        await ctx.reply('Выберите дом кнопкой выше.');
        return transition.stay();
      }
      await ack(ctx, { message: { text: `🏠 ${house.address}` } });
      await ctx.reply(
        `Назначить ${mdName(data.targetName ?? '')} председателем ТСЖ дома «${esc(house.address)}»?`,
        { ...withKeyboard(yesNoButtons('chair')), ...MD },
      );
      return transition.goto('confirm', { houseId: house.id, houseAddress: house.address });
    },

    confirm: async ({ ctx, data }) => {
      const payload = payloadOf(ctx);
      if (payload === 'chair:no') {
        await ack(ctx, { message: { text: 'Отменено.' } });
        await ctx.reply('Хорошо, ничего не меняем.', withKeyboard(panelButton()));
        return transition.cancel();
      }
      if (payload !== 'chair:yes' || !data.maxUserId) {
        await ctx.reply('Нажмите «Да» или «Нет».');
        return transition.stay();
      }
      try {
        if (data.action === 'appoint' && data.houseId) {
          await appointChairman(BigInt(data.maxUserId), data.houseId);
          await ack(ctx, { message: { text: 'Председатель назначен!' } });
          await ctx.reply(
            `✅ ${mdName(data.targetName ?? '')} назначен председателем ТСЖ дома «${esc(data.houseAddress ?? '')}».`,
            { ...withKeyboard(panelButton()), ...MD },
          );
        } else {
          await dismissChairman(BigInt(data.maxUserId));
          await ack(ctx, { message: { text: 'Председатель снят!' } });
          await ctx.reply(`✅ ${mdName(data.targetName ?? '')} больше не председатель ТСЖ.`, { ...withKeyboard(panelButton()), ...MD });
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
  title?: string;
  description?: string;
  photos?: string[];
}

type AnnounceStep = 'start' | 'house' | 'title' | 'description' | 'photos' | 'confirm';

const ANN_PHOTOS_DONE = 'ann:photos:done';

function announcePhotoButtons(count: number) {
  return [[btn.callback(count > 0 ? `Готово (${count})` : 'Без фото', ANN_PHOTOS_DONE)], [btn.callback('Отмена', 'cancel')]];
}

export const announceScenario = defineScenario<BotContext, AnnounceData>()<AnnounceStep>({
  id: 'announce',
  initialStep: 'start',
  idleTimeoutMs: SCENARIO_TIMEOUT_MS,
  createData: () => ({}),
  intercept: cancelIntercept,
  steps: {
    start: async ({ ctx }) => {
      if (isChairman(ctx.dbUser) && ctx.dbUser.houseId && ctx.dbUser.house) {
        await ctx.reply(
          'Введите заголовок объявления (например: «Отключение горячей воды»):',
          withKeyboard([[btn.callback('Отмена', 'cancel')]]),
        );
        return transition.goto('title', { houseId: ctx.dbUser.houseId, houseAddress: ctx.dbUser.house.address });
      }
      const houses = await listHouses();
      if (houses.length === 0) {
        await ctx.reply('Сначала добавьте дома (см. seed или БД).', withKeyboard(panelButton()));
        return transition.cancel();
      }
      await ctx.reply('В какой дом отправить объявление?', withKeyboard(houseButtons(houses, 'ann:house')));
      return transition.goto('house');
    },

    house: async ({ ctx }) => {
      const match = /^ann:house:(\d+)$/.exec(payloadOf(ctx) ?? '');
      const house = match ? await getHouse(Number(match[1])) : null;
      if (!house) {
        await ctx.reply('Выберите дом кнопкой выше.');
        return transition.stay();
      }
      await ack(ctx, { message: { text: `🏠 ${house.address}` } });
      await ctx.reply(
        'Введите заголовок объявления (например: «Отключение горячей воды»):',
        withKeyboard([[btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('title', { houseId: house.id, houseAddress: house.address });
    },

    title: async ({ ctx }) => {
      const text = textOf(ctx);
      if (!text || text.trim().length < 3) {
        await ctx.reply('Заголовок должен быть от 3 символов. Попробуйте ещё раз:');
        return transition.stay();
      }
      await ctx.reply('Теперь текст объявления одним сообщением:', withKeyboard([[btn.callback('Отмена', 'cancel')]]));
      return transition.goto('description', { title: text.trim() });
    },

    description: async ({ ctx, data }) => {
      const text = textOf(ctx);
      if (!text || text.trim().length < 5) {
        await ctx.reply('Опишите объявление подробнее (минимум 5 символов).');
        return transition.stay();
      }
      await ctx.reply('Можете приложить фото (необязательно) — пришлите одну или несколько, или нажмите «Без фото».', withKeyboard(announcePhotoButtons(0)));
      return transition.goto('photos', { description: text.trim() });
    },

    photos: async ({ ctx, data }) => {
      const result = await handlePhotoInput(ctx, ANN_PHOTOS_DONE, data.photos ?? []);
      if (result.kind === 'done') {
        await ack(ctx, { message: { text: `Фото: ${(data.photos ?? []).length}` } });
        const photosLine = data.photos?.length ? `\n\n📷 Фото: ${data.photos.length}` : '';
        await ctx.reply(
          `Опубликовать в доме «${data.houseAddress}»:\n\n📢 ${data.title}\n\n${data.description}${photosLine}`,
          withKeyboard([[btn.callback('Опубликовать', 'ann:yes'), btn.callback('Отмена', 'cancel')]]),
        );
        return transition.goto('confirm');
      }
      if (result.kind === 'invalid') {
        await ctx.reply('Пришлите фото или нажмите кнопку выше.', withKeyboard(announcePhotoButtons((data.photos ?? []).length)));
        return transition.stay();
      }
      await ctx.reply(`Добавлено. Всего фото: ${result.photos.length}. Пришлите ещё или нажмите «Готово».`, withKeyboard(announcePhotoButtons(result.photos.length)));
      return transition.stay({ photos: result.photos });
    },

    confirm: async ({ ctx, data }) => {
      if (payloadOf(ctx) !== 'ann:yes' || !data.houseId || !data.title || !data.description) {
        await ctx.reply('Нажмите «Опубликовать» или «Отмена».');
        return transition.stay();
      }
      try {
        await createAnnouncement({ houseId: data.houseId, authorId: ctx.dbUser.id, title: data.title, description: data.description, photos: data.photos });
        await ack(ctx, { message: { text: 'Объявление опубликовано.' } });
        await ctx.reply(`✅ Объявление опубликовано в доме «${data.houseAddress}».`, withKeyboard(panelButton()));
      } catch (error) {
        if (!isAppError(error)) throw error;
        await ack(ctx, { notification: error.message });
        await ctx.reply(`Не получилось: ${error.message}`, withKeyboard(panelButton()));
      }
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
    await ctx.api.editMessage(cardMid, {
      text: `${requestCard(request)}\n\n${note}`,
      attachments: [keyboard(ukRequestButtons(request))],
      ...MD,
    });
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
        // Письмо в организацию отправляет сервер вместе со сменой статуса и возвращает результат.
        const { request: updated, mail } = await changeStatus(data.requestId, 'DELEGATED', { byUserId: ctx.dbUser.id, organizationId });
        const organizationName = updated.delegatedTo?.name ?? String(organizationId);
        const mailNote = !mail
          ? ''
          : mail.to
            ? mail.simulated
              ? `Письмо на ${mail.to} записано в лог сервера (SMTP не настроен — отправка имитируется).`
              : `Заявка отправлена на почту ответственного: ${mail.to}.`
            : 'У организации не указан email — письмо не отправлено.';
        await ack(ctx, { message: { text: `Организация: ${organizationName}` } });
        await ctx.reply(`➡️ Заявка №${data.requestId} передана в «${organizationName}». ${mailNote}`, withKeyboard(panelButton()));
        await refreshCard(ctx, data.requestId, data.cardMid, `➡️ Передана в организацию: ${esc(organizationName)}`);
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

export interface ResolveData {
  requestId: number;
  cardMid?: string | null;
  note?: string;
  responsibleName?: string;
  photos?: string[];
}

type ResolveStep = 'start' | 'note' | 'responsible' | 'photos' | 'confirm';

const RESOLVE_PHOTOS_DONE = 'resolve:photos:done';
const RESOLVE_SEND = 'resolve:send';

function resolvePhotoButtons(count: number) {
  return [[btn.callback(count > 0 ? `Готово (${count} фото)` : 'Без фото', RESOLVE_PHOTOS_DONE)], [btn.callback('Отмена', 'cancel')]];
}

export const resolveScenario = defineScenario<BotContext, ResolveData>()<ResolveStep>({
  id: 'resolve-request',
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
      await ctx.reply(
        `Заявка №${data.requestId}. Опишите одним сообщением, что именно было сделано:`,
        withKeyboard([[btn.callback('Отмена', 'cancel')]]),
      );
      return transition.goto('note');
    },

    note: async ({ ctx }) => {
      const text = textOf(ctx);
      if (!text || text.trim().length < 5) {
        await ctx.reply('Опишите подробнее, что было сделано (минимум 5 символов).');
        return transition.stay();
      }
      await ctx.reply('Укажите ФИО ответственного за выполнение:', withKeyboard([[btn.callback('Отмена', 'cancel')]]));
      return transition.goto('responsible', { note: text.trim() });
    },

    responsible: async ({ ctx }) => {
      const text = textOf(ctx);
      if (!text || text.trim().length < 3) {
        await ctx.reply('Укажите ФИО ответственного (минимум 3 символа).');
        return transition.stay();
      }
      await ctx.reply(
        'Можете приложить фото результата работы (необязательно) — пришлите одну или несколько, или нажмите «Без фото».',
        withKeyboard(resolvePhotoButtons(0)),
      );
      return transition.goto('photos', { responsibleName: text.trim() });
    },

    photos: async ({ ctx, data }) => {
      const result = await handlePhotoInput(ctx, RESOLVE_PHOTOS_DONE, data.photos ?? []);
      if (result.kind === 'invalid') {
        await ctx.reply('Пришлите фото результата или нажмите кнопку выше.', withKeyboard(resolvePhotoButtons((data.photos ?? []).length)));
        return transition.stay();
      }
      if (result.kind === 'added') {
        await ctx.reply(
          `Добавлено. Всего фото: ${result.photos.length}. Пришлите ещё или нажмите кнопку, чтобы продолжить.`,
          withKeyboard(resolvePhotoButtons(result.photos.length)),
        );
        return transition.stay({ photos: result.photos });
      }
      const photosLine = data.photos?.length ? `\n📷 Фото: ${data.photos.length}` : '';
      await ack(ctx, { message: { text: `Фото: ${(data.photos ?? []).length}` } });
      await ctx.reply(
        `Заявка №${data.requestId} будет закрыта как выполненная:\n\n${esc(data.note ?? '')}\n\nОтветственный: ${mdName(data.responsibleName ?? '')}${photosLine}`,
        { ...withKeyboard([[btn.callback('✅ Закрыть заявку', RESOLVE_SEND)], [btn.callback('Отмена', 'cancel')]]), ...MD },
      );
      return transition.goto('confirm');
    },

    confirm: async ({ ctx, data }) => {
      if (payloadOf(ctx) !== RESOLVE_SEND || !data.note || !data.responsibleName) {
        await ctx.reply('Нажмите «Закрыть заявку» или «Отмена».');
        return transition.stay();
      }
      try {
        const { request } = await changeStatus(data.requestId, 'RESOLVED', {
          byUserId: ctx.dbUser.id,
          resolutionNote: data.note,
          resolvedByName: data.responsibleName,
          photos: data.photos,
        });
        await ack(ctx, { message: { text: 'Заявка закрыта.' } });
        await ctx.reply(
          `${requestCard(request)}\n\n✅ Заявка закрыта как выполненная. Жители уведомлены.`,
          { ...withKeyboard([...ukRequestButtons(request), ...panelButton()]), ...MD },
        );
        await refreshCard(ctx, data.requestId, data.cardMid, '✅ Выполнена');
      } catch (error) {
        if (!isAppError(error)) throw error;
        await ack(ctx, { notification: error.message });
        await ctx.reply(`Не получилось: ${error.message}`, withKeyboard(panelButton()));
      }
      return transition.complete();
    },
  },
});
