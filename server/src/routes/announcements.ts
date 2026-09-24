import { Router } from 'express';
import * as announcementsController from '../controllers/announcements.js';

const router = Router();

router.get('/announcements', announcementsController.list);
router.post('/announcements', announcementsController.create);
router.patch('/announcements/:id', announcementsController.update);
router.delete('/announcements/:id', announcementsController.remove);

export default router;
