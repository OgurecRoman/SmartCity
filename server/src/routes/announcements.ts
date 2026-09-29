import { Router } from 'express';
import { photoUpload } from '../lib/upload.js';
import * as announcementsController from '../controllers/announcements.js';

const router = Router();

/**
 * @swagger
 * /api/announcements:
 *   get:
 *     summary: Получить список всех объявлений
 *     tags: [Объявления]
 *   post:
 *     summary: Создать новое объявление
 *     description: Доступно только сотрудникам УК или председателю ТСЖ этого дома. Фото — multipart field photos.
 *     tags: [Объявления]
 */
router.get('/announcements', announcementsController.list);
router.post('/announcements', photoUpload.array('photos'), announcementsController.create);

/**
 * @swagger
 * /api/announcements/{id}:
 *   patch:
 *     summary: Обновить объявление
 *     description: Доступно только сотрудникам УК или председателю ТСЖ этого дома
 *     tags: [Объявления]
 *   delete:
 *     summary: Удалить объявление
 *     description: Доступно только сотрудникам УК или председателю ТСЖ этого дома
 *     tags: [Объявления]
 */
router.patch('/announcements/:id', announcementsController.update);
router.delete('/announcements/:id', announcementsController.remove);

export default router;
