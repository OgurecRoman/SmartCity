import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { errors } from '../lib/errors.js';
import { getUserByMaxId, isEmployee, upsertFromMax } from '../services/users.js';
import { validateInitData } from './initData.js';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (config.auth.devBypass) {
    const devId = req.get('x-dev-user-id');
    if (devId && /^\d{1,18}$/.test(devId)) {

      req.user =
        (await getUserByMaxId(BigInt(devId))) ??
        (await upsertFromMax({ maxUserId: BigInt(devId), firstName: headerName(req) || 'Житель', lastName: null, username: null }));
      next();
      return;
    }
  }

  const header = req.get('authorization') ?? '';
  const match = /^MaxInitData\s+(.+)$/i.exec(header.trim());
  if (match) {
    const payload = validateInitData(match[1], config.bot.token, config.auth.initDataMaxAgeSec);
    req.user = await upsertFromMax({
      maxUserId: BigInt(payload.user.id),
      firstName: payload.user.first_name || 'Житель',
      lastName: payload.user.last_name ?? null,
      username: payload.user.username ?? null,
    });
    next();
    return;
  }

  throw errors.unauthorized('Передайте заголовок Authorization: MaxInitData <initData>');
}

function headerName(req: Request): string {
  const raw = req.get('x-dev-user-name') ?? '';
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function requireEmployee(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || !isEmployee(req.user)) {
    throw errors.forbidden('Действие доступно только сотрудникам УК');
  }
  next();
}
