const DEFAULT_API_BASE_URL = 'http://localhost:5001/api';

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || DEFAULT_API_BASE_URL;
}

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  count?: number;
  message?: string;
};

export function getToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('examus_token') || '';
}

export async function apiFetch<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(getApiUrl(path), { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || 'API isteği başarısız oldu.');
  }

  return payload as ApiEnvelope<T>;
}

export function formatDate(date?: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}
