import { Router } from 'express';
import { getVotesController } from '../controllers/votes.js';

const router = Router();

router.get('/votes', getVotesController);

export default router;