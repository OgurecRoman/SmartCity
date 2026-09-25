import { config } from '../config.js';

export async function request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', 
    path: string, 
    body?: Record<string, any>,
    queryParams?: Record<string, string | number | boolean>
) {
    let url = `${config.backend.apiUrl}/api/${path}`
    const options: RequestInit = {
        method,
        headers: {
        'Content-Type': 'application/json',
        },
    };

    if (queryParams) {
    const searchParams = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
        }
        });
        url += `?${searchParams.toString()}`;
    }

    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Backend error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const userData = await response.json();
        return userData;
    
    } catch (error) {
        console.error(`[API Request] Ошибка при запросе ${method} /api/${path}:`, error);
        return;
    }
}