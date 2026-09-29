import { Router } from 'express';
import * as residentsController from '../controllers/residents.js';

const router = Router();

/**
 * @swagger
 * /api/residents:
 *   get:
 *     summary: Получить жителей дома (УК или председатель ТСЖ)
 *     tags: [Жители]
 */
router.get('/residents', residentsController.list);

export default router;
