import { getApiToken } from '@/api/token';
import { getErrorMessage } from '@/lib/errors';

const API_BASE_URL = 'http://localhost:8000/api';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT';

const withAuthHeaders = (): HeadersInit => {
  const token = getApiToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleUnauthorized = () => {
  localStorage.removeItem('auth-storage');
  window.location.assign('/login');
};

export async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...withAuthHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const fallback = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      throw new Error(getErrorMessage(payload, fallback));
    } catch (error) {
      throw new Error(getErrorMessage(error, fallback));
    }
  }

  return response.json() as Promise<T>;
}
