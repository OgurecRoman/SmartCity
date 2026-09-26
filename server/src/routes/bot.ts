import { Router } from 'express';
import { requireBotToken } from '../auth/botToken.js';
import * as bot from '../controllers/bot.js';
import { upsertUserController } from '../controllers/user.js';
import { getVotesController } from '../controllers/votes.js';
import { photoUpload } from '../lib/upload.js';

// API для процесса бота (bot/): все запросы к данным, которые раньше делались через Prisma напрямую.
// Не использует MaxInitData — вместо этого общий секрет BOT_API_TOKEN в заголовке X-Bot-Token.
const router = Router();
router.use(requireBotToken);

router.post('/user/upsert', upsertUserController);
router.get('/users/employees', bot.listEmployees);
router.get('/users/by-max/:maxUserId', bot.getUserByMax);
router.get('/users/:id', bot.getUser);
router.post('/users/promote', bot.promote);
router.post('/users/assign-house', bot.assignHouse);
router.post('/users/detach', bot.detach);
router.post('/users/appoint-chairman', bot.appointChairman);
router.post('/users/dismiss-chairman', bot.dismissChairman);
router.post('/users/add-tenant', bot.addTenant);

router.get('/houses', bot.listHouses);
router.get('/houses/by-chat/:chatId', bot.getHouseByChat);
router.post('/houses/unbind-chat', bot.unbindChat);
router.get('/houses/:id', bot.getHouse);
router.get('/houses/:id/chairman', bot.getChairman);
router.get('/houses/:id/residents', bot.listResidents);
router.get('/houses/:id/votes-required', bot.votesRequired);
router.post('/houses/:id/chat', bot.bindChat);
router.get('/company', bot.getCompany);
router.get('/organizations', bot.listOrganizations);

router.get('/votes', getVotesController);
router.get('/requests', bot.listRequests);
router.post('/requests', bot.createRequest);
router.get('/requests/:id', bot.getRequest);
router.get('/requests/:id/document', bot.requestDocument);
router.get('/requests/:id/voted', bot.hasVoted);
router.post('/requests/:id/vote', bot.vote);
router.post('/requests/:id/delete', bot.deleteRequest);
router.post('/requests/:id/status', bot.changeStatus);
router.post('/requests/:id/reopen', bot.reopenRequest);
router.post('/requests/:id/chat-message', bot.setRequestChatMessage);

router.get('/membership/latest', bot.latestMembership);
router.get('/membership/pending', bot.pendingMembership);
router.post('/membership', bot.submitMembership);
router.get('/membership/:id', bot.getMembership);
router.post('/membership/:id/approve', bot.approveMembership);
router.post('/membership/:id/reject', bot.rejectMembership);

router.post('/announcements', bot.createAnnouncement);
router.get('/announcements/:id', bot.getAnnouncement);
router.post('/announcements/:id/chat-message', bot.setAnnouncementChatMessage);
router.post('/news', bot.createNews);
router.get('/news/:id', bot.getNews);
router.post('/news/:id/chat-message', bot.setNewsChatMessage);

router.post('/photos', photoUpload.single('photo'), bot.uploadPhoto);

router.get('/session/:key', bot.getSession);
router.put('/session/:key', bot.setSession);
router.delete('/session/:key', bot.deleteSession);

router.get('/outbox', bot.listOutbox);
router.delete('/outbox/:id', bot.ackOutbox);

router.post('/dev/reset', bot.devReset);

export default router;
