import type { Api } from '@maxhub/max-bot-api';
import type { AttachmentRequest, Message } from '@maxhub/max-bot-api/types';
import { events } from '../lib/events.js';
import { CATEGORY_LABELS, STATUS_EMOJI, STATUS_LABELS, fullName } from '../lib/labels.js';
import { log } from '../lib/logger.js';
import { getAnnouncement } from '../services/announcements.js';
import { getMembershipRequest } from '../services/membership.js';
import { getNews } from '../services/news.js';
import { getRequest, type RequestWithRelations } from '../services/requests.js';
import { getChairmanOf, getUserById, listEmployees } from '../services/users.js';
import { uploadPhotosToMax } from './photos.js';
import {
  announcementCard,
  chatDetailsButtons,
  esc,
  keyboard,
  MD,
  mdName,
  mdStatus,
  membershipCard,
  membershipReviewButtons,
  newsCard,
  requestCard,
  residentMenu,
  ukRequestButtons,
  withKeyboard,
  type ButtonRows,
} from './ui.js';
import { request } from '../lib/network.js';

let api: Api | null = null;
let subscribed = false;

type Extra = { attachments?: AttachmentRequest[] };

async function sendDm(maxUserId: bigint, text: string, extra?: Extra): Promise<void> {
  if (!api) return;
  try {
    await api.sendMessageToUser(Number(maxUserId), text, { ...extra, ...MD });
  } catch (error) {

    log.warn(`Не удалось отправить личное сообщение пользователю ${maxUserId}`, error);
  }
}

async function sendToChat(chatId: bigint, text: string, extra?: Extra): Promise<Message | null> {
  if (!api) return null;
  try {
    return await api.sendMessageToChat(Number(chatId), text, { ...extra, ...MD });
  } catch (error) {
    log.warn(`Не удалось отправить сообщение в чат ${chatId}`, error);
    return null;
  }
}

async function editMessage(messageId: string, text: string, rows: ButtonRows): Promise<void> {
  if (!api) return;
  try {
    await api.editMessage(messageId, { text, attachments: rows.length > 0 ? [keyboard(rows)] : [], ...MD });
  } catch (error) {
    log.warn(`Не удалось отредактировать сообщение ${messageId}`, error);
  }
}

function chatHeading(request: RequestWithRelations): string {
  const author = mdName(fullName(request.author));
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
    employees.map((employee: any) =>
      sendDm(employee.maxUserId, `${heading}\n\n${requestCard(request)}`, withKeyboard(ukRequestButtons(request))),
    ),
  );
}

async function photoAttachments(filenames: string[]): Promise<AttachmentRequest[]> {
  if (!api || filenames.length === 0) return [];
  return uploadPhotosToMax(api, filenames);
}

async function voterIds(requestId: number, excludeUserId?: number): Promise<bigint[] | null> {
  const queryParams: Record<string, string | number> = { requestId };
  if (excludeUserId) {
    queryParams.excludeUserId = excludeUserId;
  }
  const votes = await request('GET', 'votes', undefined, queryParams);
  try {
    const answer = (votes as any[]).map((vote: any) => vote.user.maxUserId);
    return answer;
  } catch (error) {
    console.error('Неправильный формат данных:', error);
    return null;
  }
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
      const images = await photoAttachments(request.photos.map((p: any) => p.filename));
      const message = await sendToChat(
        request.house.chatId,
        `${chatHeading(request)}\n\n${requestCard(request)}${note}`,
        { attachments: [...images, keyboard(chatDetailsButtons(request.id))] },
      );
      if (message) {
        await prisma.request.update({ where: { id: request.id }, data: { chatMessageId: message.body.mid } }); // там уже что-то создано с названием updateMessage
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
      voters.map((id) => sendDm(id, `📨 Заявка №${request.id} «${esc(request.title)}», которую вы поддержали, передана в УК.`)),
    );
    await notifyEmployees(request, '📨 Новая заявка от жителей: собрано необходимое количество подписей');
  });

  events.on('request.status_changed', async ({ requestId, oldStatus, newStatus, comment }) => {
    const request = await getRequest(requestId);
    if (!request) return;
    const lines = [
      `${STATUS_EMOJI[newStatus]} Статус заявки №${request.id} изменён: ${mdStatus(STATUS_LABELS[oldStatus])} → ${mdStatus(STATUS_LABELS[newStatus])}`,
    ];
    if (newStatus === 'DELEGATED' && request.delegatedTo) lines.push(`Ответственная организация: ${esc(request.delegatedTo.name)}`);
    if (comment) lines.push(`Комментарий УК: ${esc(comment)}`);
    const line = lines.join('\n');

    const resultPhotos = newStatus === 'RESOLVED' ? request.photos.filter((p) => p.isResult).map((p) => p.filename) : [];
    const images = await photoAttachments(resultPhotos);
    const extra = images.length ? { attachments: images } : undefined;

    await sendDm(request.author.maxUserId, `${line}\n\n${requestCard(request)}`, extra);
    const voters = await voterIds(request.id, request.authorId);
    await Promise.all(voters.map((id) => sendDm(id, `${line}\nТема: ${esc(request.title)}`, extra)));
    if (request.house.chatId) await sendToChat(request.house.chatId, `${line}\nТема: ${esc(request.title)}`, extra);
    await refreshChatMessage(request);
  });

  events.on('request.deleted', async ({ requestId, chatMessageId, title }) => {
    if (chatMessageId) await editMessage(chatMessageId, `🗑 Заявка №${requestId} «${esc(title)}» удалена автором.`, []);
  });

  events.on('request.reopened', async ({ requestId, reason, photos }) => {
    const request = await getRequest(requestId);
    if (!request) return;
    const images = await photoAttachments(photos);
    const heading = `🔄 Заявка №${request.id} возвращена автором — по его словам, проблема не устранена.\nПричина: ${esc(reason)}`;
    const employees = await listEmployees();
    await Promise.all(
      employees.map((employee) =>
        sendDm(employee.maxUserId, `${heading}\n\n${requestCard(request)}`, { attachments: [...images, keyboard(ukRequestButtons(request))] }),
      ),
    );
    if (request.house.chatId) {
      await sendToChat(request.house.chatId, `${heading}\nТема: ${esc(request.title)}`, { attachments: images });
    }
    await refreshChatMessage(request, '🔄 Возвращена автором — проблема не устранена.');
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
    const images = await photoAttachments(announcement.photos.map((p) => p.filename));
    const message = await sendToChat(announcement.house.chatId, announcementCard(announcement), { attachments: images });
    if (message) {
      await prisma.announcement.update({ where: { id: announcement.id }, data: { chatMessageId: message.body.mid } });
    }
  });

  events.on('announcement.updated', async ({ announcementId }) => {
    const announcement = await getAnnouncement(announcementId);
    if (announcement?.chatMessageId) await editMessage(announcement.chatMessageId, announcementCard(announcement), []);
  });

  events.on('announcement.deleted', async ({ chatMessageId, title }) => {
    if (chatMessageId) await editMessage(chatMessageId, `🗑 Объявление «${esc(title)}» удалено.`, []);
  });

  events.on('news.created', async ({ newsId }) => {
    const news = await getNews(newsId);
    if (!news || !news.house.chatId) return;
    const images = await photoAttachments(news.photos.map((p) => p.filename));
    const message = await sendToChat(news.house.chatId, newsCard(news), { attachments: images });
    if (message) {
      await prisma.news.update({ where: { id: news.id }, data: { chatMessageId: message.body.mid } });
    }
  });

  events.on('news.updated', async ({ newsId }) => {
    const news = await getNews(newsId);
    if (news?.chatMessageId) await editMessage(news.chatMessageId, newsCard(news), []);
  });

  events.on('news.deleted', async ({ chatMessageId, title }) => {
    if (chatMessageId) await editMessage(chatMessageId, `🗑 Новость «${esc(title)}» удалена.`, []);
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
      `✅ Заявка на вступление в дом «${esc(request.house.address)}» подтверждена. Теперь доступны все функции бота и приложения.${chatLine}`,
      withKeyboard(residentMenu(false, true)),
    );
  });

  events.on('membership.rejected', async ({ requestId }) => {
    const request = await getMembershipRequest(requestId);
    if (!request) return;
    await sendDm(
      request.applicant.maxUserId,
      `❌ Заявка на вступление в дом «${esc(request.house.address)}» отклонена.\nПричина: ${esc(request.rejectReason ?? '—')}\n\n` +
        'Можете подать заявку заново — отправьте боту /start.',
    );
  });

  events.on('tenant.added', async ({ houseId, ownerId, tenantId, apartment }) => {
    const chairman = await getChairmanOf(houseId);
    if (!chairman) return;
    const [owner, tenant] = await Promise.all([getUserById(ownerId), getUserById(tenantId)]);
    if (!owner || !tenant) return;
    await sendDm(chairman.maxUserId, `ℹ️ ${mdName(fullName(owner))} добавил(а) съёмщика ${mdName(fullName(tenant))} в квартиру ${apartment}.`);
  });
}

export function initNotifications(botApi: Api): void {
  api = botApi;
  subscribe();
}
