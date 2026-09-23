import '../src/lib/bigint.js';
import type { Update, User as MaxUser } from '@maxhub/max-bot-api/types';
import { createBot } from '../src/bot/index.js';
import { initNotifications } from '../src/bot/notifications.js';
import { drainOutboxOnce } from '../src/bot/outboxConsumer.js';
import { setBotIdentity } from '../src/bot/ui.js';
import { prisma } from '../src/lib/db.js';

const BOT_ID = 1;
let midCounter = 0;
const out = (line: string) => console.log(line);

type Extra = { attachments?: Array<{ type: string; payload?: { buttons?: Array<Array<Record<string, string>>> } }>; text?: string };

function buttonsOf(extra?: Extra): string {
  const kb = extra?.attachments?.find((a) => a.type === 'inline_keyboard');
  if (!kb?.payload?.buttons) return '';
  return (
    '\n      ' +
    kb.payload.buttons
      .map((row) => row.map((b) => `[${b.text}${b.payload ? ` → ${b.payload}` : b.url ? ` → ${b.url}` : ''}]`).join(' '))
      .join('\n      ')
  );
}

function fakeMessage(chatId: number, text: string) {
  midCounter += 1;
  return {
    sender: null,
    recipient: { chat_id: chatId, chat_type: 'dialog' as const, user_id: null, post_id: null },
    timestamp: Date.now(),
    body: { mid: `mid_${midCounter}`, seq: midCounter, text },
  };
}

const bot = createBot();
const api = bot.api as unknown as Record<string, unknown>;
api.sendMessageToChat = async (chatId: number, text: string, extra?: Extra) => {
  out(`   🤖 → chat ${chatId}: ${text.replace(/\n/g, '\n      ')}${buttonsOf(extra)}`);
  return fakeMessage(chatId, text);
};
api.sendMessageToUser = async (userId: number, text: string, extra?: Extra) => {
  out(`   🤖 → user ${userId}: ${text.replace(/\n/g, '\n      ')}${buttonsOf(extra)}`);
  return fakeMessage(userId, text);
};
api.editMessage = async (id: string, extra: Extra) => {
  out(`   🤖 edit ${id}: ${(extra.text ?? '').replace(/\n/g, '\n      ')}${buttonsOf(extra)}`);
  return { success: true };
};
api.answerOnCallback = async (id: string, extra: { notification?: string; message?: Extra }) => {
  const parts: string[] = [];
  if (extra?.notification) parts.push(`notification="${extra.notification}"`);
  if (extra?.message) parts.push(`edit="${(extra.message.text ?? '').replace(/\n/g, ' | ')}"${buttonsOf(extra.message)}`);
  out(`   🤖 answer(${id}): ${parts.join(' ') || 'ok'}`);
  return { success: true };
};
api.getChat = async (id: number) => ({
  chat_id: id, type: 'chat', status: 'active', title: 'Дом Волгоградская 5', icon: null, last_event_time: 0, participants_count: 3, is_public: false,
});
api.uploadFile = async ({ source }: { source: string }) => {
  out(`   🤖 upload ${source}`);
  return { toJson: () => ({ type: 'file', payload: { token: 'fake-token' } }) };
};
api.setMyCommands = async () => ({ success: true });

bot.botInfo = { user_id: BOT_ID, first_name: 'SmartCity', name: 'SmartCity', username: 'smartcity_demo_bot', is_bot: true, last_activity_time: 0 };
setBotIdentity('smartcity_demo_bot');
initNotifications(bot.api);

const handle = (bot as unknown as { handleUpdate: (update: Update) => Promise<void> }).handleUpdate;
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 150));
  // В реальном запуске события уходят в NotificationOutbox и их забирает отдельный процесс бота
  // (src/bot-worker.ts). Здесь всё в одном процессе, поэтому вычитываем очередь вручную после каждого шага.
  await drainOutboxOnce();
};

function user(id: number, firstName: string, lastName: string): MaxUser {
  return { user_id: id, first_name: firstName, last_name: lastName, name: `${firstName} ${lastName}`, username: null, is_bot: false, last_activity_time: 0 };
}
const dm = (u: MaxUser) => 7000 + (u.user_id % 1000);
const GROUP = 8001;

async function started(u: MaxUser, payload?: string) {
  out(`👤 ${u.first_name} → /start${payload ? ` (payload=${payload})` : ''}`);
  await handle({ update_type: 'bot_started', timestamp: Date.now(), chat_id: dm(u), user: u, payload: payload ?? null });
  await settle();
}
async function msg(u: MaxUser, text: string, chatId = dm(u), chatType: 'dialog' | 'chat' = 'dialog') {
  out(`👤 ${u.first_name}${chatType === 'chat' ? ' (в группе)' : ''}: ${text}`);
  midCounter += 1;
  await handle({
    update_type: 'message_created', timestamp: Date.now(),
    message: { sender: u, recipient: { chat_id: chatId, chat_type: chatType, user_id: null, post_id: null }, timestamp: Date.now(), body: { mid: `in_${midCounter}`, seq: midCounter, text } },
  });
  await settle();
}
async function cb(u: MaxUser, payload: string, chatId = dm(u), chatType: 'dialog' | 'chat' = 'dialog') {
  out(`👤 ${u.first_name}${chatType === 'chat' ? ' (в группе)' : ''} нажал [${payload}]`);
  midCounter += 1;
  await handle({
    update_type: 'message_callback', timestamp: Date.now(),
    callback: { timestamp: Date.now(), callback_id: `cb_${midCounter}`, payload, user: u },
    message: { sender: { ...u, user_id: BOT_ID, is_bot: true }, recipient: { chat_id: chatId, chat_type: chatType, user_id: null, post_id: null }, timestamp: Date.now(), body: { mid: `card_${midCounter}`, seq: midCounter, text: '(карточка)' } },
  });
  await settle();
}
async function botAdded(u: MaxUser, chatId: number) {
  out(`👤 ${u.first_name} добавил бота в группу ${chatId}`);
  await handle({ update_type: 'bot_added', timestamp: Date.now(), chat_id: chatId, user: u, is_channel: false });
  await settle();
}
async function userAdded(u: MaxUser, chatId: number) {
  out(`👤 ${u.first_name} вступил в группу ${chatId}`);
  await handle({ update_type: 'user_added', timestamp: Date.now(), chat_id: chatId, user: u, inviter_id: null, is_channel: false });
  await settle();
}
async function onboard(u: MaxUser, apartment: string, reviewer: MaxUser) {
  await cb(u, 'onb:house:1');
  await msg(u, apartment);
  await cb(u, 'onb:name:profile');
  await cb(u, 'onb:send');
  const request = await prisma.membershipRequest.findFirst({
    where: { applicant: { maxUserId: BigInt(u.user_id) }, status: 'PENDING' },
    orderBy: { id: 'desc' },
  });
  if (!request) throw new Error('Заявка на вступление не создана');
  await cb(reviewer, `mem:approve:${request.id}`);
}
async function latestRequestId(maxUserId: number): Promise<number> {
  const request = await prisma.request.findFirst({ where: { author: { maxUserId: BigInt(maxUserId) } }, orderBy: { id: 'desc' } });
  if (!request) throw new Error('Заявка не создана');
  return request.id;
}

const section = (title: string) => out(`\n━━━ ${title} ━━━`);

async function main() {
  const admin = user(900000099, 'Сергей', 'Управляев');
  const anna = user(5000001, 'Пётр', 'Жильцов');
  const olga = user(5000002, 'Ольга', 'Соседова');
  const kirill = user(5000003, 'Кирилл', 'Подписов');

  await prisma.botSession.deleteMany({});
  await prisma.notificationOutbox.deleteMany({});
  await prisma.request.deleteMany({ where: { author: { maxUserId: { in: [5000001n, 5000002n, 5000003n] } } } });
  await prisma.announcement.deleteMany({ where: { author: { maxUserId: { in: [5000001n, 5000002n, 5000003n] } } } });
  await prisma.news.deleteMany({ where: { author: { maxUserId: { in: [5000001n, 5000002n, 5000003n] } } } });
  await prisma.membershipRequest.deleteMany({ where: { applicant: { maxUserId: { in: [5000001n, 5000002n, 5000003n] } } } });
  await prisma.user.deleteMany({ where: { maxUserId: { in: [5000001n, 5000002n, 5000003n] } } });
  await prisma.house.updateMany({ where: { id: 1 }, data: { chatId: null } });

  section('УК привязывает чат дома');
  await botAdded(admin, GROUP);
  await cb(admin, 'bind:1', GROUP, 'chat');
  await userAdded(anna, GROUP);

  section('Житель регистрируется — заявку на вступление подтверждает УК');
  await started(anna);
  await onboard(anna, '15', admin);

  section('Житель создаёт заявку');
  await cb(anna, 'menu:create');
  await cb(anna, 'cr:cat:PLUMBING');
  await msg(anna, 'Прорвало трубу в подвале первого подъезда, вода течёт третий день.');
  await cb(anna, 'cr:prio:NORMAL');
  await cb(anna, 'cr:skip');
  await cb(anna, 'cr:send');
  const requestId = await latestRequestId(anna.user_id);
  out(`   (создана заявка №${requestId})`);

  section('Собственник добавляет своего съёмщика — тот сразу пользуется ботом');
  await msg(anna, '/add_tenant');
  await msg(anna, String(olga.user_id));
  await msg(anna, '16');

  section('Съёмщик переходит по «Подробнее» к заявке и поддерживает');
  await started(olga, `req_${requestId}`);
  await cb(olga, `req:vote:${requestId}`);
  await cb(olga, `req:vote:${requestId}`);

  section('Второй сосед поддерживает — порог достигнут, заявка уходит в УК');
  await started(kirill);
  await onboard(kirill, '17', admin);
  await started(kirill, `req_${requestId}`);
  await cb(kirill, `req:vote:${requestId}`);

  section('Сотрудник УК обрабатывает заявку');
  await started(admin);
  await cb(admin, 'uk:new');
  await cb(admin, `uk:take:${requestId}`);
  await cb(admin, `uk:delegate:${requestId}`);
  await cb(admin, 'dlg:org:2');
  await cb(admin, `uk:doc:${requestId}`);
  await cb(admin, `uk:resolve:${requestId}`);

  section('Аварийная заявка');
  await msg(anna, '/create');
  await cb(anna, 'cr:cat:ELEVATOR');
  await msg(anna, 'Застрял лифт во втором подъезде между 5 и 6 этажами.');
  await cb(anna, 'cr:prio:EMERGENCY');
  await cb(anna, 'cr:send');
  const emergencyId = await latestRequestId(anna.user_id);

  section('УК отклоняет с комментарием');
  await cb(admin, `uk:reject:${emergencyId}`);
  await msg(admin, 'Дубликат заявки №' + requestId);

  section('Житель смотрит списки, удаляет свою заявку, прочее');
  await msg(olga, '/create');
  await cb(olga, 'cr:cat:NOISE');
  await msg(olga, 'Соседи сверху сверлят по ночам.');
  await cb(olga, 'cr:prio:NORMAL');
  await msg(olga, '01.01.2020');
  await msg(olga, '31.12.2026');
  await cb(olga, 'cr:edit');
  await cb(olga, 'cancel');
  await msg(olga, '/my');
  await msg(anna, '/my');
  await msg(anna, '/supported');
  await msg(olga, '/supported');
  await msg(anna, 'просто текст');
  await msg(anna, '/id');
  await msg(anna, '/contacts');
  await cb(anna, 'uk:new');

  section('УК: объявление в дом и добавление владельца');
  await cb(admin, 'menu:announce');
  await cb(admin, 'ann:house:1');
  await msg(admin, 'Отключение горячей воды');
  await msg(admin, 'Плановое отключение воды 25.09 с 10:00 до 14:00.');
  await cb(admin, 'ann:yes');
  await cb(admin, 'menu:add_owner');
  await msg(admin, '5000009');
  await cb(admin, 'own:house:2');
  await cb(admin, 'own:yes');
  await cb(admin, 'menu:remove_owner');
  await msg(admin, '5000009');
  await cb(admin, 'own:yes');

  section('УК назначает жителя председателем ТСЖ');
  await cb(admin, 'menu:appoint_chairman');
  await msg(admin, String(anna.user_id));
  await cb(admin, 'chair:house:1');
  await cb(admin, 'chair:yes');

  section('Председатель ТСЖ публикует объявление жителям своего дома');
  await started(anna);
  await cb(anna, 'menu:announce');
  await msg(anna, 'Собрание жильцов');
  await msg(anna, 'Собрание состоится 30.09 в 19:00 у подъезда №1.');
  await cb(anna, 'ann:yes');

  section('УК снимает председателя ТСЖ');
  await cb(admin, 'menu:dismiss_chairman');
  await msg(admin, String(anna.user_id));
  await cb(admin, 'chair:yes');

  out('\n✅ Прогон завершён без необработанных ошибок');
}

main()
  .catch((error) => {
    console.error('❌ Прогон упал:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
