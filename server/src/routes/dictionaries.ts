import { Router } from 'express';
import * as dictionariesController from '../controllers/dictionaries.js';

const router = Router();

router.get('/dictionaries', dictionariesController.get);

export default router;
