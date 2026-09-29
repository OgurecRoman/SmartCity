import { Router } from 'express';
import { requireEmployee } from '../auth/middleware.js';
import * as companiesController from '../controllers/companies.js';

const router = Router();

/**
 * @swagger
 * /companies:
 *   get:
 *     summary: Получить список всех компаний
 *     tags: [Компании]
 * /company/{id}:
 *   get:
 *     summary: Получить компанию
 *     tags: [Компании]
 *   patch:
 *     summary: Изменить контакты своей УК (только сотрудник этой УК)
 *     tags: [Компании]
 *   delete:
 *     summary: Удалить компанию
 *     tags: [Компании]
 */
router.get('/companies', companiesController.getAllCompaniesController);
router.get('/company/:id', companiesController.getCompanyController);
router.post('/company', companiesController.createCompanyController);
router.patch('/company/:id', requireEmployee, companiesController.updateCompanyContactsController);
router.delete('/company/:id', companiesController.deleteCompanyController);

export default router;
