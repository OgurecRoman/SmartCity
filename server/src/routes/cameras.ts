import { Router } from 'express';
import * as camerasController from '../controllers/cameras.js';

const router = Router();

/**
 * @swagger
 * /api/cameras:
 *   get:
 *     summary: Получить список всех камер
 *     tags: [Камеры]
 */
router.get('/cameras', camerasController.list);

export default router;
