import { getToken } from './session.js';

// Volá se, když server odmítne token (vypršel nebo je neplatný)
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// Jednotné místo pro komunikaci se serverem
export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    onUnauthorized();
  }
  if (!res.ok) {
    throw new Error(data.error || `Chyba serveru (${res.status})`);
  }
  return data;
}
