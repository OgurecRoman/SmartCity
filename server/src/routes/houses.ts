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
router.get('/houses/lookup', housesController.lookup);
router.post('/houses', housesController.create);
router.get('/houses/lookup', housesController.lookup);

/**
 * @swagger
 * /api/houses/{id}:
 *   patch:
 *     summary: Изменить дом по id
 *     tags: [Дома]
 *   delete:
 *     summary: Удалить дом по id
 *     tags: [Дома]
 */
router.patch('/houses/:id', requireEmployee, housesController.updateVotePercent);
router.delete('/houses/:id', requireEmployee, housesController.remove);
router.get('/geo/search', housesController.searchGeo);

/**
 * @swagger
 * /api/houses/{id}/chairman:
 *   put:
 *     summary: УК назначает председателя ТСЖ дома (body { userId })
 *     tags: [Дома]
 *   delete:
 *     summary: УК снимает председателя ТСЖ дома
 *     tags: [Дома]
 * /api/houses/{id}/residents/{userId}:
 *   delete:
 *     summary: УК убирает жителя из дома
 *     tags: [Дома]
 */
router.put('/houses/:id/chairman', requireEmployee, housesController.setChairman);
router.delete('/houses/:id/chairman', requireEmployee, housesController.unsetChairman);
router.delete('/houses/:id/residents/:userId', requireEmployee, housesController.removeResident);

export default router;
