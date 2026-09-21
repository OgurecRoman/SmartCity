import type { Api } from '@maxhub/max-bot-api';
import type { AttachmentRequest, Message } from '@maxhub/max-bot-api/types';
import { prisma } from '../lib/db.js';
import { events } from '../lib/events.js';
import { CATEGORY_LABELS, STATUS_EMOJI, STATUS_LABELS, fullName } from '../lib/labels.js';
import { log } from '../lib/logger.js';
import { getRequest, type RequestWithRelations } from '../services/requests.js';
import { listEmployees } from '../services/users.js';
import { chatDetailsButtons, keyboard, requestCard, ukRequestButtons, withKeyboard, type ButtonRows } from './ui.js';

let api: Api | null = null;
let subscribed = false;

type Extra = { attachments?: AttachmentRequest[] };

async function sendDm(maxUserId: bigint, text: string, extra?: Extra): Promise<void> {
  if (!api) return;
  try {
    await api.sendMessageToUser(Number(maxUserId), text, extra);
  } catch (error) {

    log.warn(`Не удалось отправить личное сообщение пользователю ${maxUserId}`, error);
  }
}

async function sendToChat(chatId: bigint, text: string, extra?: Extra): Promise<Message | null> {
  if (!api) return null;
  try {
    return await api.sendMessageToChat(Number(chatId), text, extra);
  } catch (error) {
    log.warn(`Не удалось отправить сообщение в чат ${chatId}`, error);
    return null;
  }
}

async function editMessage(messageId: string, text: string, rows: ButtonRows): Promise<void> {
  if (!api) return;
  try {
    await api.editMessage(messageId, { text, attachments: rows.length > 0 ? [keyboard(rows)] : [] });
  } catch (error) {
    log.warn(`Не удалось отредактировать сообщение ${messageId}`, error);
  }
}

function chatHeading(request: RequestWithRelations): string {
  const author = fullName(request.author);
  if (request.priority === 'EMERGENCY') {
    return `🚨 Жителем ${author} создана аварийная заявка — она сразу передана в УК`;
  }
  return `📣 Жителем ${author} создана заявка на тему: ${CATEGORY_LABELS[request.category]}`;
}

async function refreshChatMessage(request: RequestWithRelations, note?: string): Promise<void> {
  if (!request.chatMessageId) return;
  const text = [chatHeading(request), '', requestCard(request), note ? `\n${note}` : ''].join('\n').trimEnd();
  await editMessage(request.chatMessageId, text, chatDetailsButtons(request.id));
}

async function notifyEmployees(request: RequestWithRelations, heading: string): Promise<void> {
  const employees = await listEmployees();
  if (employees.length === 0) {
    log.warn(`Сотрудников УК нет — уведомление по заявке №${request.id} некому отправить`);
    return;
  }
  await Promise.all(
    employees.map((employee) =>
      sendDm(employee.maxUserId, `${heading}\n\n${requestCard(request)}`, withKeyboard(ukRequestButtons(request))),
    ),
  );
}

async function voterIds(requestId: number, excludeUserId?: number): Promise<bigint[]> {
  const votes = await prisma.vote.findMany({
    where: { requestId, ...(excludeUserId ? { userId: { not: excludeUserId } } : {}) },
    select: { user: { select: { maxUserId: true } } },
  });
  return votes.map((vote) => vote.user.maxUserId);
}

function subscribe(): void {
  if (subscribed) return;
  subscribed = true;

  events.on('request.created', async ({ requestId }) => {
    const request = await getRequest(requestId);
    if (!request) return;
    const emergency = request.priority === 'EMERGENCY';
    if (request.house.chatId) {
      const note = emergency ? '' : '\n\nНажмите «Подробнее», чтобы поддержать заявку.';
      const message = await sendToChat(
        request.house.chatId,
        `${chatHeading(request)}\n\n${requestCard(request)}${note}`,
        withKeyboard(chatDetailsButtons(request.id)),
      );
      if (message) {
        await prisma.request.update({ where: { id: request.id }, data: { chatMessageId: message.body.mid } });
      }
    }
    if (emergency) await notifyEmployees(request, '🚨 Поступила аварийная заявка');
  });

  events.on('request.voted', async ({ requestId }) => {
    const request = await getRequest(requestId);
    if (request) await refreshChatMessage(request, 'Нажмите «Подробнее», чтобы поддержать заявку.');
  });

  events.on('request.submitted', async ({ requestId }) => {
    const request = await getRequest(requestId);
    if (!request) return;
    await refreshChatMessage(request, '✅ Подписи собраны — заявка передана в УК.');
    await sendDm(
      request.author.maxUserId,
      `✅ По вашей заявке №${request.id} собрано необходимое количество подписей (${request.votesCount}). ` +
        'Заявка передана в управляющую компанию.\n\n' +
        requestCard(request),
    );
    const voters = await voterIds(request.id, request.authorId);
    await Promise.all(
      voters.map((id) => sendDm(id, `📨 Заявка №${request.id} «${request.title}», которую вы поддержали, передана в УК.`)),
    );
    await notifyEmployees(request, '📨 Новая заявка от жителей: собрано необходимое количество подписей');
  });

  events.on('request.status_changed', async ({ requestId, oldStatus, newStatus, comment }) => {
    const request = await getRequest(requestId);
    if (!request) return;
    const lines = [
      `${STATUS_EMOJI[newStatus]} Статус заявки №${request.id} изменён: ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[newStatus]}`,
    ];
    if (newStatus === 'DELEGATED' && request.delegatedTo) lines.push(`Ответственная организация: ${request.delegatedTo.name}`);
    if (comment) lines.push(`Комментарий УК: ${comment}`);
    const line = lines.join('\n');

    await sendDm(request.author.maxUserId, `${line}\n\n${requestCard(request)}`);
    const voters = await voterIds(request.id, request.authorId);
    await Promise.all(voters.map((id) => sendDm(id, `${line}\nТема: ${request.title}`)));
    if (request.house.chatId) await sendToChat(request.house.chatId, `${line}\nТема: ${request.title}`);
    await refreshChatMessage(request);
  });

  events.on('request.deleted', async ({ requestId, chatMessageId, title }) => {
    if (chatMessageId) await editMessage(chatMessageId, `🗑 Заявка №${requestId} «${title}» удалена автором.`, []);
  });

  events.on('request.expired', async ({ requestId }) => {
    const request = await getRequest(requestId);
    if (!request) return;
    await refreshChatMessage(request, '⌛ Срок сбора подписей истёк.');
    await sendDm(
      request.author.maxUserId,
      `⌛ Срок сбора подписей по заявке №${request.id} истёк: собрано ${request.votesCount} из ${request.votesRequired}. ` +
        'Вы можете создать заявку заново.',
    );
  });
}

export function initNotifications(botApi: Api): void {
  api = botApi;
  subscribe();
}
