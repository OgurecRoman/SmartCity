import { config } from '../config.js';
import { errors } from '../lib/errors.js';
import { getUserByMaxId, isEmployee, upsertFromMax } from '../services/users.js';
import { validateInitData } from './initData.js';

/**
 * Авторизация запросов мини-приложения.
 *   Простой режим (DEV_AUTH_BYPASS=true): пользователь берётся из заголовка X-Dev-User-Id (+ X-Dev-User-Name),
 *   который мини-приложение заполняет из WebApp.initDataUnsafe.user — без проверки подписи.
 *   Строгий режим: Authorization: MaxInitData <window.WebApp.initData>, подпись проверяется по токену бота.
 */
export async function authenticate(req, _res, next) {
  if (config.auth.devBypass) {
    const devId = req.get('x-dev-user-id');
    if (devId && /^\d{1,18}$/.test(devId)) {
      // Существующего пользователя не трогаем (не затираем имя из seed), нового создаём
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

/** Имя из заголовка приходит URL-кодированным (в HTTP-заголовках нельзя передавать кириллицу напрямую) */
function headerName(req) {
  const raw = req.get('x-dev-user-name') ?? '';
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function requireEmployee(req, _res, next) {
  if (!req.user || !isEmployee(req.user)) {
    throw errors.forbidden('Действие доступно только сотрудникам УК');
  }
  next();
}
