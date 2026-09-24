import { Router } from 'express';
import * as newsController from '../controllers/news.js';

const router = Router();

/**
 * @swagger
 * /api/news:
 *   get:
 *     summary: Получить все новости
 *     tags: [Новости]
 *   post:
 *     summary: Создать новую новость
 *     tags: [Новости]
 */
router.get('/news', newsController.list);
router.post('/news', newsController.create);

/**
 * @swagger
 * /api/news/{id}:
 *   patch:
 *     summary: Редактировать новость
 *     tags: [Новости]
 *   delete:
 *     summary: Удалить новость
 *     tags: [Новости]
 */
router.patch('/news/:id', newsController.update);
router.delete('/news/:id', newsController.remove);

export default router;
