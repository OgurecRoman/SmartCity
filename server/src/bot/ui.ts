import { Keyboard } from '@maxhub/max-bot-api';
import type { AttachmentRequest, Button } from '@maxhub/max-bot-api/types';
import { config } from '../config.js';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PRIORITY_LABELS,
  RESIDENT_TYPE_LABELS,
  STATUS_EMOJI,
  STATUS_LABELS,
  formatDate,
  formatDateTime,
  fullName,
} from '../lib/labels.js';
import type { AnnouncementWithRelations } from '../services/announcements.js';
import type { MembershipRequestWithRelations } from '../services/membership.js';
import type { NewsWithRelations } from '../services/news.js';
import type { RequestWithRelations } from '../services/requests.js';
import { AUTHOR_DELETABLE_STATUSES } from '../services/rules.js';
import type { DbUser, ResidentRow } from '../services/users.js';

export type ButtonRows = Button[][];
export const btn = Keyboard.button;

let botUsername = config.bot.username;

export function setBotIdentity(username: string | null | undefined): void {
  if (username) botUsername = username.replace(/^@/, '');
}

export function getBotUsername(): string {
  return botUsername;
}

export function botDeepLink(payload?: string): string | null {
  if (!botUsername) return null;
  const url = `https://max.ru/${botUsername}`;
  return payload ? `${url}?start=${encodeURIComponent(payload)}` : url;
}

export function keyboard(rows: ButtonRows): AttachmentRequest {
  return Keyboard.inlineKeyboard(rows);
}

export function withKeyboard(rows: ButtonRows): { attachments: AttachmentRequest[] } {
  return { attachments: [keyboard(rows)] };
}

export function openAppButton(text: string, payload?: string): Button | null {
  if (!botUsername) return null;
  return btn.link(text, `https://max.ru/${botUsername}?startapp${payload ? `=${encodeURIComponent(payload)}` : ''}`);
}

export function residentMenu(isChairman = false, isOwner = false): ButtonRows {
  const rows: ButtonRows = [
    [btn.callback('📝 Создать заявку', 'menu:create')],
    [btn.callback('📋 Мои заявки', 'menu:my'), btn.callback('🤝 Поддержанные', 'menu:supported')],
    [btn.callback('🎉 Новость соседям', 'menu:news_new')],
  ];
  if (isOwner) rows.push([btn.callback('➕ Добавить съёмщика', 'menu:add_tenant')]);
  if (isChairman) {
    rows.push([btn.callback('📢 Объявление жителям', 'menu:announce')]);
    rows.push([btn.callback('📋 Заявки на вступление', 'menu:membership_queue')]);
  }
  rows.push([btn.callback('📞 Контакты УК', 'menu:contacts')]);
  const app = openAppButton('📱 Открыть приложение');
  if (app) rows.push([app]);
  return rows;
}

export function adminMenu(): ButtonRows {
  return [
    [btn.callback('📨 Новые заявки', 'uk:new')],
    [btn.callback('📋 Заявки на вступление', 'menu:membership_queue')],
    [btn.callback('👥 Жители дома', 'menu:residents')],
    [btn.callback('➕ Добавить владельца', 'menu:add_owner'), btn.callback('➖ Удалить владельца', 'menu:remove_owner')],
    [btn.callback('👤 Назначить председателя', 'menu:appoint_chairman'), btn.callback('🚫 Снять председателя', 'menu:dismiss_chairman')],
    [btn.callback('📢 Объявление жителям', 'menu:announce')],
    [btn.callback('📞 Контакты УК', 'menu:contacts')],
  ];
}

export function panelButton(): ButtonRows {
  return [[btn.callback('Открыть панель', 'menu:panel')]];
}

export function categoryButtons(prefix: string): ButtonRows {
  const rows: ButtonRows = [];
  for (let i = 0; i < CATEGORY_ORDER.length; i += 2) {
    rows.push(CATEGORY_ORDER.slice(i, i + 2).map((category) => btn.callback(CATEGORY_LABELS[category], `${prefix}:${category}`)));
  }
  rows.push([btn.callback('Отмена', 'cancel')]);
  return rows;
}

export function houseButtons(houses: { id: number; address: string }[], prefix: string, withCancel = true): ButtonRows {
  const rows: ButtonRows = houses.map((house) => [btn.callback(house.address, `${prefix}:${house.id}`)]);
  if (withCancel) rows.push([btn.callback('Отмена', 'cancel')]);
  return rows;
}

export function yesNoButtons(prefix: string): ButtonRows {
  return [[btn.callback('Да', `${prefix}:yes`), btn.callback('Нет', `${prefix}:no`)]];
}

export function residentRequestButtons(request: RequestWithRelations, viewer: DbUser, viewerHasVoted: boolean): ButtonRows {
  const rows: ButtonRows = [];
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

export function ukRequestButtons(request: RequestWithRelations): ButtonRows {
  const id = request.id;
  const rows: ButtonRows = [];
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

export function chatDetailsButtons(requestId: number): ButtonRows {
  const link = botDeepLink(`req_${requestId}`);
  const details = link ? btn.link('Подробнее', link) : btn.callback('Подробнее', `req:view:${requestId}`);
  return [[details]];
}

export function requestCard(request: RequestWithRelations): string {
  const lines: string[] = [];
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
  if (request.status === 'RESOLVED' && request.resolutionNote) {
    lines.push(`Выполнено: ${request.resolutionNote}`);
    if (request.resolvedByName) lines.push(`Ответственный: ${request.resolvedByName}`);
  }
  lines.push(`Статус: ${STATUS_EMOJI[request.status]} ${STATUS_LABELS[request.status]}`);
  lines.push(`Создана: ${formatDateTime(request.createdAt)}`);
  return lines.join('\n');
}

export function requestShortLine(request: RequestWithRelations): string {
  return `${STATUS_EMOJI[request.status]} №${request.id} · ${CATEGORY_LABELS[request.category]} · ${STATUS_LABELS[request.status]}`;
}

export function announcementCard(announcement: AnnouncementWithRelations): string {
  const lines = [
    `📢 ${announcement.title}`,
    '',
    announcement.description,
    '',
    `Дом: ${announcement.house.address}`,
    `От: ${fullName(announcement.author)}`,
    `Опубликовано: ${formatDateTime(announcement.createdAt)}`,
  ];
  return lines.join('\n');
}

export function newsCard(news: NewsWithRelations): string {
  const lines = [
    `🎉 ${news.title}`,
    '',
    news.description,
    '',
    `Дом: ${news.house.address}`,
    `От: ${fullName(news.author)}`,
    `Связаться: ${news.contact}`,
  ];
  return lines.join('\n');
}

export function membershipCard(request: MembershipRequestWithRelations): string {
  const lines = [
    `🆕 Заявка на вступление №${request.id}`,
    `ФИО: ${request.fullName}`,
    `Дом: ${request.house.address}`,
    `Квартира: ${request.apartment}`,
    `MAX ID заявителя: ${request.applicant.maxUserId}`,
    `Подана: ${formatDateTime(request.createdAt)}`,
  ];
  return lines.join('\n');
}

export function membershipReviewButtons(requestId: number): ButtonRows {
  return [[btn.callback('✅ Подтвердить', `mem:approve:${requestId}`), btn.callback('❌ Отклонить', `mem:reject:${requestId}`)]];
}

export function residentsCards(house: { address: string }, residents: ResidentRow[]): string[] {
  const lines = residents.map((r) => {
    const name = r.verifiedFullName ?? fullName(r);
    const verified = r.verifiedFullName ? '' : ' (ФИО не подтверждено)';
    const type = r.residentType ? ` · ${RESIDENT_TYPE_LABELS[r.residentType]}` : '';
    const nick = r.username ? `@${r.username}` : 'без ника';
    return `Кв. ${r.apartment ?? '—'} — ${name}${verified}${type}\n${nick} · MAX ID ${r.maxUserId}`;
  });

  const perMessage = 15;
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += perMessage) {
    chunks.push(lines.slice(i, i + perMessage).join('\n\n'));
  }
  if (chunks.length === 0) return chunks;
  chunks[0] = `👥 Жители дома «${house.address}» (${residents.length})\n\n${chunks[0]}`;
  return chunks;
}

export function contactsCard(company: {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  workingHours: string | null;
} | null): string {
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
    'Для начала расскажите, где вы живёте — заявку проверит председатель ТСЖ или УК.',
  welcomeBack: (name: string) => `С возвращением, ${name}! Что делаем?`,
  welcomeAdmin:
    'Вы сотрудник управляющей компании. Что умеет бот:\n' +
    '• присылает вам заявки, собравшие нужное число подписей, и аварийные заявки;\n' +
    '• позволяет взять заявку в работу, передать в ответственную организацию, отклонить или закрыть;\n' +
    '• уведомляет жителей о каждой смене статуса.\n\n' +
    'Чтобы подключить чат дома: создайте групповой чат в MAX, добавьте в него жителей и этого бота — ' +
    'он сразу предложит выбрать дом. Если бота добавил не сотрудник, отправьте в чат /bind с упоминанием бота.',
  bindHint: () =>
    `Привязать чат к дому может сотрудник управляющей компании: отправьте сюда «@${botUsername} /bind». ` +
    'Без упоминания бот увидит команду, только если назначить его администратором чата.',
  helpResident:
    'Команды:\n' +
    '/panel — главное меню\n' +
    '/create — создать заявку\n' +
    '/my — мои заявки\n' +
    '/supported — заявки, которые я поддержал\n' +
    '/news_new — новость соседям (например, позвать в гости)\n' +
    '/add_tenant — добавить своего съёмщика (только для собственника)\n' +
    '/contacts — контакты УК\n' +
    '/id — мой ID в MAX (нужен УК для добавления владельца)\n' +
    '/cancel — отменить текущее действие',
  helpChairman:
    'Команды:\n' +
    '/panel — главное меню\n' +
    '/create — создать заявку\n' +
    '/my — мои заявки\n' +
    '/supported — заявки, которые я поддержал\n' +
    '/news_new — новость соседям (например, позвать в гости)\n' +
    '/add_tenant — добавить своего съёмщика (только для собственника)\n' +
    '/announce — объявление жителям дома (вы председатель ТСЖ)\n' +
    '/membership_queue — заявки жителей на вступление в дом\n' +
    '/contacts — контакты УК\n' +
    '/id — мой ID в MAX\n' +
    '/cancel — отменить текущее действие',
  helpAdmin:
    'Команды сотрудника УК:\n' +
    '/panel — панель управления\n' +
    '/requests — заявки в работе\n' +
    '/membership_queue — заявки жителей на вступление в дом\n' +
    '/residents — список жителей выбранного дома (квартира, ФИО, ник в MAX, MAX ID)\n' +
    '/add_owner — добавить владельца в дом\n' +
    '/remove_owner — удалить владельца из дома\n' +
    '/appoint_chairman — назначить председателя ТСЖ дома\n' +
    '/dismiss_chairman — снять председателя ТСЖ\n' +
    '/announce — объявление жителям дома\n' +
    '/bind — (в групповом чате, с упоминанием бота) привязать чат к дому\n' +
    '/cancel — отменить текущее действие',
  groupInstructions: (link: string | null) =>
    'Я буду присылать сюда уведомления о новых заявках и смене их статусов.\n' +
    'Чтобы создавать и поддерживать заявки, откройте диалог с ботом' +
    (link ? `: ${link}` : ' и нажмите «Начать».'),
  onboardingRequired: 'Сначала укажите дом и квартиру — это займёт минуту.',
};
