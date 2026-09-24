import { Router } from 'express';
import { requireEmployee } from '../auth/middleware.js';
import * as residentsController from '../controllers/residents.js';

const router = Router();

/**
 * @swagger
 * /api/residents:
 *   get:
 *     summary: Получить всех жителей
 *     tags: [Жители]
 */
router.get('/residents', requireEmployee, residentsController.list);

export default router;
