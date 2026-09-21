import { createHmac, timingSafeEqual } from 'node:crypto';
import { errors } from '../lib/errors.js';

export interface InitDataUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface InitDataPayload {
  user: InitDataUser;
  authDate: Date;
  queryId?: string;
  startParam?: string;
  chat?: { id: number; type: string };
  raw: Record<string, string>;
}

function secretKey(botToken: string): Buffer {
  return createHmac('sha256', 'WebAppData').update(botToken).digest();
}

export function computeInitDataHash(params: Record<string, string>, botToken: string): string {
  const checkString = Object.keys(params)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('\n');
  return createHmac('sha256', secretKey(botToken)).update(checkString).digest('hex');
}

export function validateInitData(initData: string, botToken: string, maxAgeSec?: number): InitDataPayload {
  if (!botToken) throw errors.unauthorized('Проверка initData невозможна: не задан токен бота', 'init_data_unavailable');
  if (!initData || initData.length > 8192) throw errors.unauthorized('Некорректный initData', 'init_data_invalid');

  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(initData)) params[key] = value;

  const receivedHash = params.hash;
  if (!receivedHash || !/^[0-9a-f]{64}$/i.test(receivedHash)) {
    throw errors.unauthorized('В initData нет подписи', 'init_data_invalid');
  }

  const expected = Buffer.from(computeInitDataHash(params, botToken), 'hex');
  const received = Buffer.from(receivedHash, 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw errors.unauthorized('Подпись initData не совпадает', 'init_data_invalid');
  }

  const authDateSec = Number(params.auth_date);
  if (!Number.isFinite(authDateSec)) throw errors.unauthorized('Некорректный auth_date', 'init_data_invalid');
  if (maxAgeSec && maxAgeSec > 0 && Date.now() / 1000 - authDateSec > maxAgeSec) {
    throw errors.unauthorized('initData устарел, откройте приложение заново', 'init_data_expired');
  }

  let user: InitDataUser;
  try {
    user = JSON.parse(params.user ?? '') as InitDataUser;
  } catch {
    throw errors.unauthorized('В initData нет данных пользователя', 'init_data_invalid');
  }
  if (!user || typeof user.id !== 'number') throw errors.unauthorized('В initData нет id пользователя', 'init_data_invalid');

  let chat: InitDataPayload['chat'];
  if (params.chat) {
    try {
      chat = JSON.parse(params.chat) as { id: number; type: string };
    } catch {
      chat = undefined;
    }
  }

  return {
    user,
    authDate: new Date(authDateSec * 1000),
    queryId: params.query_id,
    startParam: params.start_param,
    chat,
    raw: params,
  };
}

export function buildInitData(
  botToken: string,
  fields: { user: InitDataUser; authDate?: Date; queryId?: string; startParam?: string },
): string {
  const params: Record<string, string> = {
    auth_date: String(Math.floor((fields.authDate ?? new Date()).getTime() / 1000)),
    query_id: fields.queryId ?? 'local-query',
    user: JSON.stringify(fields.user),
  };
  if (fields.startParam) params.start_param = fields.startParam;
  params.hash = computeInitDataHash(params, botToken);
  return new URLSearchParams(params).toString();
}
