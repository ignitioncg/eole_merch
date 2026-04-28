import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();

let cachedToken = null;
async function getToken() {
  if (cachedToken) return cachedToken;
  try {
    const res = await monday.get('sessionToken');
    cachedToken = res?.data || null;
  } catch (_) {}
  return cachedToken;
}

async function api(path, { method = 'GET', body, query } = {}) {
  const token = await getToken();
  const url = new URL(path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString().replace(window.location.origin, ''), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-monday-token': token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${method} ${path} → ${res.status}: ${txt}`);
  }
  return res.json();
}

export const monsdk = monday;

export const Products = {
  list: () => api('/api/products'),
  adjust: (id, body) => api(`/api/products/${id}/adjust`, { method: 'POST', body })
};

export const Orders = {
  submit: (order, actor, dryRun = false) =>
    api('/api/orders', { method: 'POST', body: { order, actor, dryRun } })
};

export const Movements = {
  list: ({ productId, reason } = {}) => api('/api/movements', { query: { productId, reason } }),
  revert: (id, actor) => api(`/api/movements/${id}/revert`, { method: 'POST', body: { actor } })
};

export const Contacts = {
  search: (q) => api('/api/contacts/search', { query: { q } })
};

export const Config = {
  get: () => api('/api/config'),
  put: (patch) => api('/api/config', { method: 'PUT', body: patch })
};

export const Install = {
  run: (dryRun = false) => api('/api/install', { method: 'POST', body: { dryRun } })
};

export async function getCurrentUser() {
  try {
    const res = await monday.get('context');
    const user = res?.data?.user;
    if (user && user.id) {
      const name = user.name || user.email || `User ${user.id}`;
      return { id: String(user.id), name, email: user.email || null };
    }
  } catch (_) {}
  return { id: 'local', name: 'Local user', email: null };
}

export function isDryRunMode() {
  try {
    const search = new URLSearchParams(window.location.search);
    if (['1', 'true', 'yes'].includes((search.get('dryRun') || '').toLowerCase())) return true;
    const hash = window.location.hash || '';
    const hashQ = hash.includes('?') ? new URLSearchParams(hash.split('?')[1]) : null;
    if (hashQ && ['1', 'true', 'yes'].includes((hashQ.get('dryRun') || '').toLowerCase())) return true;
  } catch (_) {}
  return false;
}

export function isPrintOnDemand(name) {
  return /\s-\s*print as required\s*$/i.test(name || '');
}
