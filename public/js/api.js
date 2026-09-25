'use strict';

const API = {};

async function request(path, options = {}) {
  const opts = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
  };
  if (options.body !== undefined) opts.body = JSON.stringify(options.body);

  let res;
  try {
    res = await fetch('/api' + path, opts);
  } catch (err) {
    throw Object.assign(new Error('No se pudo conectar con el servidor.'), { status: 0 });
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    window.location.href = '/login.html';
    throw Object.assign(new Error(data.error || 'Sesión expirada.'), { status: 401 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Error del servidor.'), { status: res.status });
  }
  return data;
}

API.get = (path) => request(path);
API.post = (path, body) => request(path, { method: 'POST', body });
API.put = (path, body) => request(path, { method: 'PUT', body });
API.patch = (path, body) => request(path, { method: 'PATCH', body });
API.del = (path, body) => request(path, { method: 'DELETE', body });

const qs = (params) => {
  const clean = Object.entries(params || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (!clean.length) return '';
  return '?' + new URLSearchParams(clean).toString();
};

API.query = (path, params) => request(path + qs(params));

export default API;