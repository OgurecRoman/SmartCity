import axios from 'axios';
import { messageForApiError } from '../lib/apiError';

const baseURL = `${import.meta.env.VITE_API_URL}/api`;
const devUserId = import.meta.env.VITE_DEV_USER_ID?.trim();

export const api = axios.create({
  baseURL,
  timeout: 10_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const initData = window.WebApp?.initData;

  if (initData) {
    config.headers.set('Authorization', `MaxInitData ${initData}`);
    config.headers.delete('X-Dev-User-Id');
  } else if (devUserId) {
    config.headers.set('X-Dev-User-Id', devUserId);
    config.headers.delete('Authorization');
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data as
      | { error?: { code?: string; message?: string } }
      | undefined;
    const status = error.response?.status as number | undefined;
    const code = data?.error?.code;

    const err = new Error(
      messageForApiError(
        {
          code,
          // Never fall back to axios' "Request failed with status code N"
          message: data?.error?.message,
          status,
        },
        'Что-то пошло не так',
      ),
    ) as Error & {
      status?: number;
      code?: string;
    };
    err.status = status;
    err.code = code;
    return Promise.reject(err);
  },
);
