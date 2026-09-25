import { Router } from 'express';
import { requireEmployee } from '../auth/middleware.js';
import * as housesController from '../controllers/houses.js';

const router = Router();

/**
 * @swagger
 * /api/houses:
 *   get:
 *     summary: Получить список всех домов
 *     tags: [Дома]
 *   post:
 *     summary: Создать новый дом
 *     tags: [Дома]
 */
router.get('/houses', housesController.list);
router.post('/houses', housesController.create);

/**
 * @swagger
 * /api/houses/{id}:
 *   get:
 *     summary: Получить дом по id
 *     tags: [Дома]
 */
router.patch('/houses/:id', requireEmployee, housesController.updateVotePercent);
router.get('/geo/search', housesController.searchGeo);

export default router;
