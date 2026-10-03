export type User = {
    id: string;
    name: string;
    email: string;
};

type ApiErrorBody = {
    message?: string | string[];
};

export const API_URL = import.meta.env.VITE_API_URL;

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    path = path.replace(/^\/+/, '');

    const headers = new Headers(init.headers);
    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

    if (init.body && !isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    let response: Response;
    try {
        response = await fetch(`${API_URL}/${path}`, {
            ...init,
            headers,
            credentials: 'include',
        });
    } catch {
        throw new Error('Cannot reach the API. Make sure the NestJS server is running.');
    }

    const body = await response.json().catch(() => null) as ApiErrorBody | null;
    if (!response.ok) {
        const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
        throw new Error(message || `Request failed with status ${response.status}.`);
    }

    return body as T;
}