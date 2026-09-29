import { ManagementCompany } from '@prisma/client';
import { prisma } from '../lib/db.js';
import type { UpdateCompanyContactsDto } from '../validation/companies.js';

export interface CreateCompanyInput {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  workingHours?: string | null;
}

export interface UpdateCompanyInput {
  id: number;
  name?: string;
  phone?: string;
  email?: string | null;
  address?: string | null;
  workingHours?: string | null;
}

export async function getCompanies(): Promise<ManagementCompany[]> {
  return prisma.managementCompany.findMany();
}

export async function getCompanyById(id: number): Promise<ManagementCompany | null> {
  return prisma.managementCompany.findUnique({ where: { id } });
}

export async function createCompany(company: CreateCompanyInput): Promise<ManagementCompany> {
  return prisma.managementCompany.create({
    data: {
      name: company.name,
      phone: company.phone,
      email: company.email,
      address: company.address,
      workingHours: company.workingHours,
    },
  });
}

export async function updateCompany(company: UpdateCompanyInput): Promise<ManagementCompany> {
  return prisma.managementCompany.update({
    where: { id: company.id },
    data: {
      name: company.name,
      phone: company.phone,
      email: company.email,
      address: company.address,
      workingHours: company.workingHours,
    },
  });
}

export async function updateCompanyContacts(
  id: number,
  contacts: UpdateCompanyContactsDto,
): Promise<ManagementCompany> {
  return prisma.managementCompany.update({
    where: { id },
    data: {
      name: contacts.name,
      phone: contacts.phone,
      email: contacts.email,
      address: contacts.address,
      workingHours: contacts.workingHours,
    },
  });
}
