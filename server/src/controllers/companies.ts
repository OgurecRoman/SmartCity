import type { Request, Response } from 'express';
import { errors } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import * as companiesService from '../services/companies.js';
import { updateCompanyContactsSchema } from '../validation/companies.js';
import { idParam } from '../validation/parse.js';

export async function getAllCompaniesController(req: Request, res: Response): Promise<void> {
  try {
    const companies = await companiesService.getCompanies();
    res.json({ companies });
  } catch (error) {
    log.error('Error in getAllCompaniesController', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCompanyController(req: Request, res: Response): Promise<void> {
  try {
    const company = await companiesService.getCompanyById(idParam(req));
    res.json({ company });
  } catch (error) {
    log.error('Error in getCompanyController', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateCompanyContactsController(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const id = idParam(req);

  if (user.companyId == null) {
    throw errors.forbidden('Сотрудник УК не привязан к компании');
  }
  if (user.companyId !== id) {
    throw errors.forbidden('Можно редактировать только контакты своей УК');
  }

  const parseResult = updateCompanyContactsSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message ?? 'Проверьте заполненные поля';
    throw errors.badRequest(message, 'validation_error');
  }

  const existing = await companiesService.getCompanyById(id);
  if (!existing) throw errors.notFound('УК не найдена');

  const company = await companiesService.updateCompanyContacts(id, parseResult.data);
  res.json({ company });
}
