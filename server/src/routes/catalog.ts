import { Router } from 'express';
import * as catalogController from '../controllers/catalog.js';

const router = Router();

router.get('/company', catalogController.getCompanyInfo);
router.get('/organizations', catalogController.listOrganizationsInfo);

export default router;
