import { Router } from 'express';
import * as companiesController from '../controllers/companies.js';

const router = Router();

/**
 * @swagger
 * /companies:
 *   get:
 *     summary: Получить список всех компаний
 *     tags: [Компании]
 * /company:
 *   get:
 *     summary: Получить компанию
 *     tags: [Компании]
 *     data: { id: number }
 *   post:
 *     summary: Создать компанию
 *     tags: [Компании]
 *   patch:
 *     summary: Изменить компанию
 *     tags: [Компании]
 *   delete:
 *     summary: Удалить компанию
 *     tags: [Компании]
 *     data: { id: number }
 */
router.get('/companies', companiesController.getAllCompaniesController);
router.get('/company', companiesController.getCompanyController);
router.post('/company', companiesController.createCompanyController);
router.patch('/company', companiesController.upsertUserController);
router.delete('/company', companiesController.deleteCompanyController);

export default router;
