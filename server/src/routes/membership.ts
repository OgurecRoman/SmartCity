import { Router } from 'express';
import * as membershipController from '../controllers/membership.js';

const router = Router();

router.get('/membership/requests', membershipController.list);
router.post('/membership/requests/:id/approve', membershipController.approve);
router.post('/membership/requests/:id/reject', membershipController.reject);

export default router;
