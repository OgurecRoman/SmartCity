import { Router } from 'express';
import * as meController from '../controllers/me.js';

const router = Router();

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: Получить пользователя по id
 *     tags: [Пользователь]
 *   patch:
 *     summary: Редактировать пользователя
 *     tags: [Пользователь]
 */
router.get('/me', meController.get);
router.patch('/me', meController.update);

export default router;
