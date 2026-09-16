const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost/medrep-api/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// NOTE on headers: deliberately NOT setting 'Content-Type: application/json'
// here. That header makes the browser treat the request as "non-simple",
// which forces a CORS preflight (OPTIONS) before the real request — and
// InfinityFree's free-tier Apache doesn't have mod_headers enabled, so
// there's no way to get an Access-Control-Allow-Origin header onto that
// preflight response, which permanently fails the whole request.
//
// Avoiding a body Content-Type entirely (GET) or using 'text/plain' (POST)
// are both on the CORS "simple request" safelist, so the browser skips the
// preflight and goes straight to the real request — whose response DOES
// carry the right CORS headers, because those come from api_helpers.php
// (PHP-level), not from .htaccess. The backend's json_input() reads the
// raw request body directly regardless of what Content-Type says, so this
// requires no backend changes.
async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (options.body !== undefined && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'text/plain;charset=UTF-8';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers,
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