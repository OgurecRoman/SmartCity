import { Keyboard } from '@maxhub/max-bot-api';

import { config } from '../config.js';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PRIORITY_LABELS,
  STATUS_EMOJI,
  STATUS_LABELS,
  formatDate,
  formatDateTime,
  fullName,
} from '../lib/labels.js';

import { AUTHOR_DELETABLE_STATUSES } from '../services/rules.js';

export const btn = Keyboard.button;

let botUsername = config.bot.username;

export function setBotIdentity(username) {
  if (username) botUsername = username.replace(/^@/, '');
}

export function getBotUsername() {
  return botUsername;
}

/** Ссылка вида https://max.ru/<бот>?start=<payload>; null, если имя бота неизвестно. */
export function botDeepLink(payload) {
  if (!botUsername) return null;
  const url = `https://max.ru/${botUsername}`;
  return payload ? `${url}?start=${encodeURIComponent(payload)}` : url;
}

export function keyboard(rows) {
  return Keyboard.inlineKeyboard(rows);
}

export function withKeyboard(rows) {
  return { attachments: [keyboard(rows)] };
}

/**
 * Кнопка открытия мини-приложения: обычная ссылка https://max.ru/<бот>?startapp — MAX открывает
 * мини-приложение, подключённое к боту в кабинете dev.max.ru. Пока оно не подключено, ссылка ведёт в чат с ботом.
 */
export function openAppButton(text, payload) {
  if (!botUsername) return null;
  return btn.link(text, `https://max.ru/${botUsername}?startapp${payload ? `=${encodeURIComponent(payload)}` : ''}`);
}

export function residentMenu() {
  const rows = [
    [btn.callback('📝 Создать заявку', 'menu:create')],
    [btn.callback('📋 Мои заявки', 'menu:my'), btn.callback('🤝 Поддержанные', 'menu:supported')],
    [btn.callback('📞 Контакты УК', 'menu:contacts')],
  ];
  const app = openAppButton('📱 Открыть приложение');
  if (app) rows.push([app]);
  return rows;
}

export function adminMenu() {
  return [
    [btn.callback('📨 Новые заявки', 'uk:new')],
    [btn.callback('➕ Добавить владельца', 'menu:add_owner'), btn.callback('➖ Удалить владельца', 'menu:remove_owner')],
    [btn.callback('📢 Объявление в чат дома', 'menu:announce')],
    [btn.callback('📞 Контакты УК', 'menu:contacts')],
  ];
}

export function panelButton() {
  return [[btn.callback('Открыть панель', 'menu:panel')]];
}

export function categoryButtons(prefix) {
  const rows = [];
  for (let i = 0; i < CATEGORY_ORDER.length; i += 2) {
    rows.push(CATEGORY_ORDER.slice(i, i + 2).map((category) => btn.callback(CATEGORY_LABELS[category], `${prefix}:${category}`)));
  }
  rows.push([btn.callback('Отмена', 'cancel')]);
  return rows;
}

export function houseButtons(houses, prefix, withCancel = true) {
  const rows = houses.map((house) => [btn.callback(house.address, `${prefix}:${house.id}`)]);
  if (withCancel) rows.push([btn.callback('Отмена', 'cancel')]);
  return rows;
}

export function yesNoButtons(prefix) {
  return [[btn.callback('Да', `${prefix}:yes`), btn.callback('Нет', `${prefix}:no`)]];
}

/** Кнопки под карточкой заявки для жителя. */
export function residentRequestButtons(request, viewer, viewerHasVoted) {
  const rows = [];
  const isAuthor = request.authorId === viewer.id;
  if (request.status === 'VOTING' && !isAuthor && !viewerHasVoted) {
    rows.push([btn.callback('👍 Поддержать', `req:vote:${request.id}`), btn.callback('Отклонить', `req:dismiss:${request.id}`)]);
  }
  if (isAuthor && AUTHOR_DELETABLE_STATUSES.includes(request.status)) {
    rows.push([btn.callback('🗑 Удалить', `req:delete:${request.id}`)]);
  }
  const app = openAppButton('📱 Открыть в приложении', `request_${request.id}`);
  if (app) rows.push([app]);
  return rows;
}

/** Кнопки под карточкой заявки для сотрудника УК. */
export function ukRequestButtons(request) {
  const id = request.id;
  const rows = [];
  switch (request.status) {
    case 'SUBMITTED':
      rows.push([btn.callback('🛠 В работу', `uk:take:${id}`), btn.callback('➡️ Передать в организацию', `uk:delegate:${id}`)]);
      rows.push([btn.callback('✅ Сделано', `uk:resolve:${id}`), btn.callback('❌ Отклонить', `uk:reject:${id}`)]);
      break;
    case 'IN_PROGRESS':
      rows.push([btn.callback('➡️ Передать в организацию', `uk:delegate:${id}`)]);
      rows.push([btn.callback('✅ Сделано', `uk:resolve:${id}`), btn.callback('❌ Отклонить', `uk:reject:${id}`)]);
      break;
    case 'DELEGATED':
      rows.push([btn.callback('🛠 Вернуть в работу', `uk:take:${id}`)]);
      rows.push([btn.callback('✅ Сделано', `uk:resolve:${id}`), btn.callback('❌ Отклонить', `uk:reject:${id}`)]);
      break;
    case 'VOTING':
      rows.push([btn.callback('❌ Отклонить', `uk:reject:${id}`)]);
      break;
    default:
      break;
  }
  rows.push([btn.callback('📄 Сформировать документ', `uk:doc:${id}`)]);
  return rows;
}

/** Кнопка «Подробнее» для уведомления в чате дома: ведёт в диалог с ботом. */
export function chatDetailsButtons(requestId) {
  const link = botDeepLink(`req_${requestId}`);
  const details = link ? btn.link('Подробнее', link) : btn.callback('Подробнее', `req:view:${requestId}`);
  return [[details]];
}

export function requestCard(request) {
  const lines = [];
  const emoji = request.priority === 'EMERGENCY' ? '🚨' : '📋';
  lines.push(`${emoji} Заявка №${request.id} · ${CATEGORY_LABELS[request.category]}`);
  if (request.priority === 'EMERGENCY') lines.push(`Приоритет: ${PRIORITY_LABELS.EMERGENCY}`);
  lines.push(`Автор: ${fullName(request.author)}${request.author.apartment ? `, кв. ${request.author.apartment}` : ''}`);
  lines.push(`Дом: ${request.house.address}`);
  lines.push('');
  lines.push(request.description);
  lines.push('');
  if (request.priority !== 'EMERGENCY') {
    if (request.status === 'VOTING') {
      lines.push(`Срок сбора подписей: ${request.deadline ? formatDate(request.deadline) : '—'}`);
    }
    lines.push(`Необходимое количество подписей: ${request.votesRequired}`);
    lines.push(`Поддержали: ${request.votesCount}`);
  }
  if (request.delegatedTo) lines.push(`Передана в: ${request.delegatedTo.name}`);
  lines.push(`Статус: ${STATUS_EMOJI[request.status]} ${STATUS_LABELS[request.status]}`);
  lines.push(`Создана: ${formatDateTime(request.createdAt)}`);
  return lines.join('\n');
}

export function requestShortLine(request) {
  return `${STATUS_EMOJI[request.status]} №${request.id} · ${CATEGORY_LABELS[request.category]} · ${STATUS_LABELS[request.status]}`;
}

export function contactsCard(company) {
  if (!company) return 'Контакты управляющей компании пока не заполнены.';
  const lines = [`🏢 ${company.name}`, `📞 Телефон: ${company.phone}`];
  if (company.email) lines.push(`✉️ Email: ${company.email}`);
  if (company.address) lines.push(`📍 Адрес: ${company.address}`);
  if (company.workingHours) lines.push(`🕘 Часы работы: ${company.workingHours}`);
  return lines.join('\n');
}

export const TEXTS = {
  welcomeResident:
    'Привет! Я бот «Умный дом» — помогаю жителям решать проблемы дома вместе с управляющей компанией.\n\n' +
    'Здесь можно создать заявку (шумные соседи, сломанный лифт, ремонт подъезда, авария), поддержать заявки соседей ' +
    'и следить за статусом: от сбора подписей до выполнения.\n\n' +
    'Для начала расскажите, где вы живёте.',
  welcomeBack: (name) => `С возвращением, ${name}! Что делаем?`,
  welcomeAdmin:
    'Вы сотрудник управляющей компании. Что умеет бот:\n' +
    '• присылает вам заявки, собравшие нужное число подписей, и аварийные заявки;\n' +
    '• позволяет взять заявку в работу, передать в ответственную организацию, отклонить или закрыть;\n' +
    '• уведомляет жителей о каждой смене статуса.\n\n' +
    'Чтобы подключить чат дома: создайте групповой чат в MAX, добавьте в него жителей и этого бота, ' +
    'затем отправьте в чат команду /bind и выберите дом.',
  helpResident:
    'Команды:\n' +
    '/panel — главное меню\n' +
    '/create — создать заявку\n' +
    '/my — мои заявки\n' +
    '/supported — заявки, которые я поддержал\n' +
    '/contacts — контакты УК\n' +
    '/id — мой ID в MAX (нужен УК для добавления владельца)\n' +
    '/cancel — отменить текущее действие',
  helpAdmin:
    'Команды сотрудника УК:\n' +
    '/panel — панель управления\n' +
    '/requests — заявки в работе\n' +
    '/add_owner — добавить владельца в дом\n' +
    '/remove_owner — удалить владельца из дома\n' +
    '/announce — объявление в чат дома\n' +
    '/bind — (в групповом чате) привязать чат к дому\n' +
    '/cancel — отменить текущее действие',
  groupInstructions: (link) =>
    'Я буду присылать сюда уведомления о новых заявках и смене их статусов.\n' +
    'Чтобы создавать и поддерживать заявки, откройте диалог с ботом' +
    (link ? `: ${link}` : ' и нажмите «Начать».'),
  onboardingRequired: 'Сначала укажите дом и квартиру — это займёт минуту.',
};
