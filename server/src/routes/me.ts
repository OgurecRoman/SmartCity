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

/**
 * @swagger
 * /api/me/houses:
 *   get:
 *     summary: Дома жителя (подтверждённые и ожидающие подтверждения)
 *     tags: [Пользователь]
 * /api/me/active-house:
 *   put:
 *     summary: Переключить активный дом (body { houseId })
 *     tags: [Пользователь]
 * /api/me/houses/{houseId}:
 *   delete:
 *     summary: Покинуть дом
 *     tags: [Пользователь]
 */
router.get('/me/houses', meController.listHouses);
router.put('/me/active-house', meController.setActiveHouse);
router.delete('/me/houses/:houseId', meController.leaveHouse);

export default router;
