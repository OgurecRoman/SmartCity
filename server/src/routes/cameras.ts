import { Router } from 'express';
import * as camerasController from '../controllers/cameras.js';

const router = Router();

router.get('/cameras', camerasController.list);

export default router;
