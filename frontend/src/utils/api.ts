/**
 * Centralized API utility.
 * All API calls MUST go through these helpers so that the Azure VM
 * backend URL is automatically prepended in production.
 */

export const API_BASE = 'https://20.40.42.232.nip.io';

/**
 * Drop-in replacement for fetch() that automatically prepends the API base URL.
 * Usage: apiFetch('/api/user/settings') → fetches https://vm.../api/user/settings
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, { credentials: 'include', ...init });
}

/**
 * Build a full API URL (useful for axios calls).
 */
export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

/**
 * Build a websocket URL against the same backend host as the REST API.
 */
export function wsUrl(path: string): string {
  if (path.startsWith('ws')) return path;
  const base = new URL(API_BASE);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = path.startsWith('/') ? path : `/${path}`;
  base.search = '';
  base.hash = '';
  return base.toString();
}
