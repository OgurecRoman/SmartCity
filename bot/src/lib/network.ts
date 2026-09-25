import { config } from '../config.js';
import { AppError, BackendUnavailableError } from './errors.js';
import { log } from './logger.js';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type Query = Record<string, string | number | boolean | undefined | null>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return { ...(config.backend.token ? { 'X-Bot-Token': config.backend.token } : {}), ...extra };
}

async function send<T>(method: Method, pathWithQuery: string, init: RequestInit): Promise<T> {
  const url = `${config.backend.apiUrl}/api/${pathWithQuery}`;
  let response: Response;
  try {
    response = await fetch(url, { method, ...init });
  } catch (error) {
    log.warn(`Бэкенд недоступен (${method} ${url})`, error);
    throw new BackendUnavailableError();
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new AppError(response.status, err?.code ?? 'backend_error', err?.message ?? `Ошибка бэкенда (${response.status})`);
  }
  return body as T;
}

/** JSON-запрос к бэкенду. Ошибки API приходят как AppError, недоступность сервера — как BackendUnavailableError. */
export async function request<T = unknown>(method: Method, path: string, body?: unknown, query?: Query): Promise<T> {
  return send<T>(method, withQuery(path, query), {
    headers: headers(body !== undefined ? { 'Content-Type': 'application/json' } : undefined),
    body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
  });
}

/** Загрузка одного файла (multipart/form-data, поле `photo`). */
export async function upload<T = unknown>(path: string, buffer: Buffer, filename: string): Promise<T> {
  const form = new FormData();
  form.append('photo', new Blob([new Uint8Array(buffer)]), filename);
  return send<T>('POST', path, { headers: headers(), body: form });
}

/** Скачивание файла, который сервер раздаёт статикой (например, /uploads/photos/<имя>). */
export async function download(publicPath: string): Promise<Buffer> {
  const url = `${config.backend.apiUrl}${publicPath}`;
  let response: Response;
  try {
    response = await fetch(url, { headers: headers() });
  } catch (error) {
    log.warn(`Бэкенд недоступен (GET ${url})`, error);
    throw new BackendUnavailableError();
  }
  if (!response.ok) throw new AppError(response.status, 'download_failed', `Не удалось скачать ${publicPath} (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

/** Проверка, что бэкенд отвечает (GET /health). */
export async function ping(): Promise<boolean> {
  try {
    const response = await fetch(`${config.backend.apiUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
