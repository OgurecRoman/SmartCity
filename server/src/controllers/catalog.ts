import type { Request, Response } from 'express';
import { CATEGORY_LABELS } from '../lib/labels.js';
import { getCompanyMetrics, getCompanyRating } from '../services/requests.js';
import { getCompany, listOrganizations } from '../services/users.js';

export async function getCompanyInfo(_req: Request, res: Response) {
  const company = await getCompany();
  if (!company) {
    res.json(null);
    return;
  }
  const [rating, metrics] = await Promise.all([getCompanyRating(company.id), getCompanyMetrics(company.id)]);
  res.json({ ...company, rating, metrics });
}

export async function listOrganizationsInfo(_req: Request, res: Response) {
  const organizations = await listOrganizations();
  res.json(organizations.map((org) => ({ ...org, categoryLabels: org.categories.map((c) => CATEGORY_LABELS[c]) })));
}
