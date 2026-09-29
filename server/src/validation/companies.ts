import { z } from "zod";

const emptyToNull = (value: string | null | undefined) => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const createCompanySchema = z.object({
  name: z.string().min(1, "Название обязательно").max(255),
  phone: z.string().min(1, "Телефон обязателен").max(50),
  email: z.string().email("Некорректный email").nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  workingHours: z.string().max(255).nullable().optional(),
});

export const updateCompanySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(50).optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  workingHours: z.string().max(255).nullable().optional(),
});

/** Контакты своей УК — только для сотрудника. */
export const updateCompanyContactsSchema = z.object({
  phone: z.string().trim().min(1, "Укажите телефон").max(50),
  email: z
    .string()
    .trim()
    .max(255)
    .transform(emptyToNull)
    .pipe(z.string().email("Некорректный email").nullable()),
  address: z.string().max(500).transform(emptyToNull),
  workingHours: z.string().max(255).transform(emptyToNull),
});

export type createCompanySchemaDto = z.infer<typeof createCompanySchema>;
export type updateCompanySchemaDto = z.infer<typeof updateCompanySchema>;
export type UpdateCompanyContactsDto = z.infer<typeof updateCompanyContactsSchema>;
