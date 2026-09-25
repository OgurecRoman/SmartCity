import { Router } from 'express';
import { upsertUserController } from '../controllers/user.js';

const router = Router();

router.post('/user/upsert', upsertUserController);

export default router;