import { Router } from 'express';
import * as newsController from '../controllers/news.js';

const router = Router();

router.get('/news', newsController.list);
router.post('/news', newsController.create);
router.patch('/news/:id', newsController.update);
router.delete('/news/:id', newsController.remove);

export default router;
