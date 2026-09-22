import { Router } from 'express';
import { requireEmployee } from '../auth/middleware.js';
import * as residentsController from '../controllers/residents.js';

const router = Router();

router.get('/residents', requireEmployee, residentsController.list);

export default router;
