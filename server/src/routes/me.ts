import { Router } from 'express';
import * as meController from '../controllers/me.js';

const router = Router();

router.get('/me', meController.get);
router.patch('/me', meController.update);

export default router;
