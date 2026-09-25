import { Router } from 'express';
import { requireEmployee } from '../auth/middleware.js';
import { photoUpload } from '../lib/upload.js';
import * as requestsController from '../controllers/requests.js';

const router = Router();

/**
 * @swagger
 * /api/requests:
 *   get:
 *     summary: Получить все заявки
 *     tags: [Заявки]
 *   post:
 *     summary: Создать новую заявку
 *     tags: [Заявки]
 */
router.get('/requests', requestsController.list);
router.post('/requests', photoUpload.array('photos'), requestsController.create);

/**
 * @swagger
 * /api/requests/{id}:
 *   get:
 *     summary: Получить заявку по id
 *     tags: [Заявки]
 *   delete:
 *     summary: Удалить заявку
 *     tags: [Заявки]
 */
router.get('/requests/:id', requestsController.get);
router.delete('/requests/:id', requestsController.remove);

/**
 * @swagger
 * /api/requests/{id}/vote:
 *   post:
 *     summary: Проголосовать за заявку
 *     tags: [Заявки]
 *   delete:
 *     summary: Удалить голос с заявки
 *     tags: [Заявки]
 */
router.post('/requests/:id/vote', requestsController.voteFor);
router.delete('/requests/:id/vote', requestsController.unvoteFor);

/**
 * @swagger
 * /api/requests/{id}/reopen:
 *   post:
 *     summary: Открыть заявку снова
 *     tags: [Заявки]
 */
router.post('/requests/:id/reopen', photoUpload.array('photos'), requestsController.reopen);

/**
 * @swagger
 * /api/requests/{id}/rate:
 *   post:
 *     summary: Проголосовать за заявку
 *     tags: [Заявки]
 */
router.post('/requests/:id/rate', requestsController.rate);

/**
 * @swagger
 * /api/requests/{id}/document:
 *   get:
 *     summary: Получить составленный документ на заявку
 *     tags: [Заявки]
 */
router.get('/requests/:id/document', requestsController.document);

/**
 * @swagger
 * /api/requests/{id}/status:
 *   patch:
 *     summary: Изменить статус заявки
 *     tags: [Заявки]
 */
router.patch('/requests/:id/status', requireEmployee, photoUpload.array('photos'), requestsController.updateStatus);

/**
 * @swagger
 * /api/uk/requests:
 *   get:
 *     summary: Получить все заявки переданные в УК
 *     tags: [Заявки]
 */
router.get('/uk/requests', requireEmployee, requestsController.listForUk);

export default router;
