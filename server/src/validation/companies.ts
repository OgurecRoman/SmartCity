import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1, "Название обязательно").max(255),
  phone: z.string().min(1, "Телефон обязателен").max(50),
  email: z.string().email("Некорректный email").nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  workingHours: z.string().max(255).nullable().optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(50).optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  workingHours: z.string().max(255).nullable().optional(),
});

export type createCompanySchemaDto = z.infer<typeof createCompanySchema>;
export type updateCompanySchemaDto = z.infer<typeof updateCompanySchema>;