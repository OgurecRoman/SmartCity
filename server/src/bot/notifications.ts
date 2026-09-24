import type { Api } from '@maxhub/max-bot-api';
import type { AttachmentRequest, Message } from '@maxhub/max-bot-api/types';
import { prisma } from '../lib/db.js';
import { events } from '../lib/events.js';
import { CATEGORY_LABELS, STATUS_EMOJI, STATUS_LABELS, fullName } from '../lib/labels.js';
import { log } from '../lib/logger.js';
import { getAnnouncement } from '../services/announcements.js';
import { getMembershipRequest } from '../services/membership.js';
import { getNews } from '../services/news.js';
import { getRequest, type RequestWithRelations } from '../services/requests.js';
import { getChairmanOf, getUserById, listEmployees } from '../services/users.js';
import {
  announcementCard,
  chatDetailsButtons,
  keyboard,
  membershipCard,
  membershipReviewButtons,
  newsCard,
  requestCard,
  residentMenu,
  ukRequestButtons,
  withKeyboard,
  type ButtonRows,
} from './ui.js';

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
  return votes.map((vote: any) => vote.user.maxUserId);
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

  events.on('announcement.created', async ({ announcementId }) => {
    const announcement = await getAnnouncement(announcementId);
    if (!announcement || !announcement.house.chatId) return;
    const message = await sendToChat(announcement.house.chatId, announcementCard(announcement));
    if (message) {
      await prisma.announcement.update({ where: { id: announcement.id }, data: { chatMessageId: message.body.mid } });
    }
  });

  events.on('announcement.updated', async ({ announcementId }) => {
    const announcement = await getAnnouncement(announcementId);
    if (announcement?.chatMessageId) await editMessage(announcement.chatMessageId, announcementCard(announcement), []);
  });

  events.on('announcement.deleted', async ({ chatMessageId, title }) => {
    if (chatMessageId) await editMessage(chatMessageId, `🗑 Объявление «${title}» удалено.`, []);
  });

  events.on('news.created', async ({ newsId }) => {
    const news = await getNews(newsId);
    if (!news || !news.house.chatId) return;
    const message = await sendToChat(news.house.chatId, newsCard(news));
    if (message) {
      await prisma.news.update({ where: { id: news.id }, data: { chatMessageId: message.body.mid } });
    }
  });

  events.on('news.updated', async ({ newsId }) => {
    const news = await getNews(newsId);
    if (news?.chatMessageId) await editMessage(news.chatMessageId, newsCard(news), []);
  });

  events.on('news.deleted', async ({ chatMessageId, title }) => {
    if (chatMessageId) await editMessage(chatMessageId, `🗑 Новость «${title}» удалена.`, []);
  });

  events.on('membership.requested', async ({ requestId }) => {
    const request = await getMembershipRequest(requestId);
    if (!request) return;
    const chairman = await getChairmanOf(request.houseId);
    const reviewers = chairman ? [chairman] : await listEmployees();
    if (reviewers.length === 0) {
      log.warn(`Заявку на вступление №${request.id} некому рассмотреть — нет ни председателя, ни сотрудников УК`);
      return;
    }
    await Promise.all(
      reviewers.map((reviewer) => sendDm(reviewer.maxUserId, membershipCard(request), withKeyboard(membershipReviewButtons(request.id)))),
    );
  });

  events.on('membership.approved', async ({ requestId }) => {
    const request = await getMembershipRequest(requestId);
    if (!request) return;
    let chatLine = '';
    if (api) {
      const house = await prisma.house.findUnique({ where: { id: request.houseId } });
      if (house?.chatId) {
        try {
          const chat = await api.getChat(Number(house.chatId));
          if (chat.link) chatLine = `\n\nЧат дома: ${chat.link}`;
        } catch (error) {
          log.warn(`Не удалось получить ссылку на чат дома ${house.chatId}`, error);
        }
      }
    }
    await sendDm(
      request.applicant.maxUserId,
      `✅ Заявка на вступление в дом «${request.house.address}» подтверждена. Теперь доступны все функции бота и приложения.${chatLine}`,
      withKeyboard(residentMenu(false, true)),
    );
  });

  events.on('membership.rejected', async ({ requestId }) => {
    const request = await getMembershipRequest(requestId);
    if (!request) return;
    await sendDm(
      request.applicant.maxUserId,
      `❌ Заявка на вступление в дом «${request.house.address}» отклонена.\nПричина: ${request.rejectReason}\n\n` +
        'Можете подать заявку заново — отправьте боту /start.',
    );
  });

  events.on('tenant.added', async ({ houseId, ownerId, tenantId, apartment }) => {
    const chairman = await getChairmanOf(houseId);
    if (!chairman) return;
    const [owner, tenant] = await Promise.all([getUserById(ownerId), getUserById(tenantId)]);
    if (!owner || !tenant) return;
    await sendDm(chairman.maxUserId, `ℹ️ ${fullName(owner)} добавил(а) съёмщика ${fullName(tenant)} в квартиру ${apartment}.`);
  });
}

export function initNotifications(botApi: Api): void {
  api = botApi;
  subscribe();
}
