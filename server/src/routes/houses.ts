import { Router } from 'express';
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
 * /api/houses/lookup:
 *   get:
 *     summary: Получить дом по координатам
 *     tags: [Дома]
 */
router.get('/houses/lookup', housesController.lookup);
router.get('/geo/search', housesController.searchGeo);

export default router;
