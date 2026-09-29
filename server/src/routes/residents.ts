import { Router } from 'express';
import { requireEmployeeOrChairman } from '../auth/middleware.js'; // ИЗМЕНЕНО
import * as residentsController from '../controllers/residents.js';

const router = Router();

/**
 * @swagger
 * /api/residents:
 *   get:
 *     summary: Получить всех жителей
 *     tags: [Жители]
 */
router.get('/residents', requireEmployeeOrChairman, residentsController.list); // ИЗМЕНЕНО

export default router;
