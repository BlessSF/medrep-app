const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost/medrep-api/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response (e.g. file download) — caller should use rawUrl() instead
  }

  if (!res.ok || (body && body.success === false)) {
    throw new ApiError(body?.error || body?.message || `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T = any>(path: string, data?: any) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  // Builds a plain URL for endpoints that return a file (CSV/XLSX) or need a native <a href>.
  rawUrl: (path: string) => `${API_BASE}${path}`,
};

export default api;
