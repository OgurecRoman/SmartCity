import type { Request, Response } from 'express';
import { CATEGORY_LABELS } from '../lib/labels.js';
import { getCompany, listOrganizations } from '../services/users.js';
import { RequestCategory } from "@prisma/client";

export async function getCompanyInfo(_req: Request, res: Response) {
  const company = await getCompany();
  res.json(company);
}

export async function listOrganizationsInfo(_req: Request, res: Response) {
  const organizations = await listOrganizations();
  res.json(organizations.map((org: any) => ({ ...org, categoryLabels: org.categories.map((c: RequestCategory) => CATEGORY_LABELS[c]) })));
}
