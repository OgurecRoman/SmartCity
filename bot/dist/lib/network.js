import { config } from '../config.js';
import { AppError, BackendUnavailableError } from './errors.js';
import { log } from './logger.js';
function withQuery(path, query) {
    if (!query)
        return path;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null)
            params.append(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
}
function headers(extra) {
    return { ...(config.backend.token ? { 'X-Bot-Token': config.backend.token } : {}), ...extra };
}
async function send(method, pathWithQuery, init) {
    const url = `${config.backend.apiUrl}/api/${pathWithQuery}`;
    let response;
    try {
        response = await fetch(url, { method, ...init });
    }
    catch (error) {
        log.warn(`Бэкенд недоступен (${method} ${url})`, error);
        throw new BackendUnavailableError();
    }
    if (response.status === 204)
        return undefined;
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const err = body?.error;
        throw new AppError(response.status, err?.code ?? 'backend_error', err?.message ?? `Ошибка бэкенда (${response.status})`);
    }
    return body;
}
export async function request(method, path, body, query) {
    return send(method, withQuery(path, query), {
        headers: headers(body !== undefined ? { 'Content-Type': 'application/json' } : undefined),
        body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
    });
}
export async function upload(path, buffer, filename) {
    const form = new FormData();
    form.append('photo', new Blob([new Uint8Array(buffer)]), filename);
    return send('POST', path, { headers: headers(), body: form });
}
export async function download(publicPath) {
    const url = `${config.backend.apiUrl}${publicPath}`;
    let response;
    try {
        response = await fetch(url, { headers: headers() });
    }
    catch (error) {
        log.warn(`Бэкенд недоступен (GET ${url})`, error);
        throw new BackendUnavailableError();
    }
    if (!response.ok)
        throw new AppError(response.status, 'download_failed', `Не удалось скачать ${publicPath} (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
}
export async function ping() {
    try {
        const response = await fetch(`${config.backend.apiUrl}/health`);
        return response.ok;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=network.js.map