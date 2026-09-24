import { Router } from 'express';
import * as housesController from '../controllers/houses.js';

const router = Router();

router.get('/houses', housesController.list);
router.get('/houses/lookup', housesController.lookup);
router.post('/houses', housesController.create);
router.get('/geo/search', housesController.searchGeo);

export default router;
