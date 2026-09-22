import type { Request } from 'express';
import { z } from 'zod';
import { errors } from '../lib/errors.js';

export function parseBody<T extends z.ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; ');
    throw errors.badRequest(message, 'validation_error');
  }
  return result.data;
}

export function parseQuery<T extends z.ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`).join('; ');
    throw errors.badRequest(message, 'validation_error');
  }
  return result.data;
}

export function idParam(req: Request, name = 'id'): number {
  const raw = req.params[name];
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  if (!/^\d{1,9}$/.test(value)) throw errors.badRequest(`Некорректный параметр ${name}`);
  return Number.parseInt(value, 10);
}
