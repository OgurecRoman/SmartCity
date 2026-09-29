import type { Request, Response } from 'express';
import * as companiesService from '../services/companies.js';
import { log } from '../lib/logger.js';
import { updateCompanySchema } from '../validation/companies.js';

export async function getAllCompaniesController(req: Request, res: Response): Promise<void> {
  try {
    const companies = await companiesService.getCompanies();
    res.json({companies});

  } catch (error) {
    log.error('Error in getAllCompaniesController', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCompanyController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.body.id)
        return;
    const company = await companiesService.getCompanyById(Number(req.body.id));
    res.json({company});
  } catch (error) {
    log.error('Error in upsertUserController', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createCompanyController(req: Request, res: Response): Promise<void> {
  try {
    const company = await companiesService.updateCompany(req.body.company);

    res.json({company});
  } catch (error) {
    log.error('Error in upsertUserController', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function upsertUserController(req: Request, res: Response): Promise<void> {
  try {
    const parseResult = updateCompanySchema.safeParse(req.body.company);
    if (!parseResult.success) {
      res.status(400).json({ 
        error: 'Invalid request body', 
        details: parseResult.error.issues 
      });
      return;
    }

    const company = await companiesService.updateCompany(req.body.company);

    res.json({company});
  } catch (error) {
    log.error('Error in upsertUserController', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteCompanyController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.body.id)
        return;
    const company = await companiesService.deleteCompany(req.body.id);

    res.json({company});
  } catch (error) {
    log.error('Error in deleteCompanyController', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}