import { Router } from 'express';
import { requireEmployee } from '../auth/middleware.js';
import { photoUpload } from '../lib/upload.js';
import * as requestsController from '../controllers/requests.js';

const router = Router();

router.get('/requests', requestsController.list);
router.post('/requests', photoUpload.array('photos'), requestsController.create);
router.get('/requests/:id', requestsController.get);
router.delete('/requests/:id', requestsController.remove);
router.post('/requests/:id/vote', requestsController.voteFor);
router.delete('/requests/:id/vote', requestsController.unvoteFor);
router.post('/requests/:id/reopen', photoUpload.array('photos'), requestsController.reopen);
router.post('/requests/:id/rate', requestsController.rate);
router.get('/requests/:id/document', requestsController.document);
router.patch('/requests/:id/status', requireEmployee, photoUpload.array('photos'), requestsController.updateStatus);
router.get('/uk/requests', requireEmployee, requestsController.listForUk);

export default router;
