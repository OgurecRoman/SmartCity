
import { ManagementCompany } from '@prisma/client';
import { prisma } from '../lib/db.js';

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
    const companies = await prisma.managementCompany.findMany();
    return companies
}

export async function getCompanyById(id: number): Promise<ManagementCompany | null> {
    const company = await prisma.managementCompany.findUnique({ where: { id } });
    return company
}

export async function createCompany(company: CreateCompanyInput): Promise<ManagementCompany | null> {
    const cmp = await prisma.managementCompany.create({ 
        data: { 
            name: company.name, phone: company.phone, 
            email: company.email, address: company.address, 
            workingHours: company.workingHours 
        } 
    });
    return cmp;
}

export async function updateCompany(company: UpdateCompanyInput): Promise<ManagementCompany | null> {

    const cmp = await prisma.managementCompany.update({ 
        where: 
            {id: company.id},
        data: { 
            name: company.name, phone: company.phone, email: company.email, address: company.address, workingHours: company.workingHours 
        } 
    });
    return cmp;
}

export async function deleteCompany(id: number): Promise<ManagementCompany | null> {
    const company = await prisma.managementCompany.findUnique({ where: { id } });
    return company
}