import { Router } from 'express';
import { authenticate } from '../auth/middleware.js';
import announcementsRouter from './announcements.js';
import catalogRouter from './catalog.js';
import dictionariesRouter from './dictionaries.js';
import housesRouter from './houses.js';
import meRouter from './me.js';
import requestsRouter from './requests.js';

export const apiRouter = Router();

apiRouter.use(dictionariesRouter);

apiRouter.use(authenticate);

apiRouter.use(meRouter);
apiRouter.use(housesRouter);
apiRouter.use(catalogRouter);
apiRouter.use(requestsRouter);
apiRouter.use(announcementsRouter);
