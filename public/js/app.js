'use strict';

import API from './api.js';
import { esc } from './ui.js';
import { render as renderDashboard } from './views/dashboard.js';
import { render as renderTransacciones } from './views/transacciones.js';
import { render as renderUsuarios } from './views/usuarios.js';
import { render as renderCatalogos } from './views/catalogos.js';
import { render as renderCortes } from './views/cortes.js';
import { render as renderReportes } from './views/reportes.js';
import { render as renderRenglones } from './views/renglones.js';
import { render as renderPlanCuentas } from './views/contabilidad/plan-cuentas.js';
import { render as renderAsientos } from './views/contabilidad/asientos.js';
import { render as renderLibroDiario } from './views/contabilidad/libro-diario.js';
import { render as renderLibroMayor } from './views/contabilidad/libro-mayor.js';
import { render as renderBalance } from './views/contabilidad/balance.js';
import { render as renderPeriodos } from './views/contabilidad/periodos.js';

const VIEWS = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  ingresos: { title: 'Ingresos', render: (el, ctx) => renderTransacciones(el, ctx, 'INGRESO') },
  egresos: { title: 'Egresos', render: (el, ctx) => renderTransacciones(el, ctx, 'EGRESO') },
  transacciones: { title: 'Transacciones', render: renderTransacciones },
  usuarios: { title: 'Usuarios', render: renderUsuarios, admin: true },
  catalogos: { title: 'Catálogos', render: renderCatalogos },
  renglones: { title: 'Renglones', render: renderRenglones },
  cortes: { title: 'Cortes Mensuales', render: renderCortes },
  reportes: { title: 'Reportes', render: renderReportes },
  'plan-cuentas': { title: 'Plan de Cuentas', render: renderPlanCuentas, empresa: true },
  asientos: { title: 'Asientos Contables', render: renderAsientos, empresa: true },
  'libro-diario': { title: 'Libro Diario', render: renderLibroDiario, empresa: true },
  'libro-mayor': { title: 'Libro Mayor', render: renderLibroMayor, empresa: true },
  balance: { title: 'Balance de Comprobación', render: renderBalance, empresa: true },
  periodos: { title: 'Períodos Contables', render: renderPeriodos, empresa: true },
};

const TAB_TITLES = {
  'tipos-egresos': 'Tipos de Egresos',
  'tipos-ingresos': 'Tipos de Ingresos',
  'tipos-pago': 'Tipos de Pago',
  egresos: 'Egresos',
  ingresos: 'Ingresos',
};

let session = null;

async function verSesion() {
  try {
    session = await API.get('/auth/me');
  } catch (err) {
    if (err.status === 401 || err.status === 0) window.location.href = '/login.html';
    return null;
  }
  return session;
}

function aplicarSesion() {
  document.getElementById('user-nombre').textContent = session.nombre;
  document.getElementById('user-cedula').textContent = session.cedula;
  document.getElementById('user-rol').textContent = session.rol === 'ADMIN' ? 'Admin' : 'Usuario';
  document.getElementById('user-initials').textContent =
    session.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const esAdmin = session.rol === 'ADMIN';
  document.querySelectorAll('.admin-only').forEach((el) => { el.style.display = esAdmin ? '' : 'none'; });

  const esEmpresa = session.tipoPersona === 'JURIDICA';
  document.querySelectorAll('.empresa-only').forEach((el) => { el.style.display = esEmpresa ? '' : 'none'; });

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('greeting').textContent = `${saludo}, ${session.nombre.split(' ')[0]}`;
}

function rutaActual() {
  return location.hash.replace(/^#\/?/, '') || 'dashboard';
}

async function navegar() {
  const ruta = rutaActual();
  const [nombre, sub] = ruta.split('/');
  const view = VIEWS[nombre];
  const content = document.getElementById('content');

  if (nombre === 'cerrar-sesion') {
    try { await API.post('/auth/logout'); } catch (_) { /* noop */ }
    window.location.href = '/login.html';
    return;
  }

  if (nombre === 'catalogos' && sub === 'renglones') {
    location.hash = '#/renglones';
    return;
  }

  if (nombre === 'catalogos' && !sub) {
    location.hash = '#/catalogos/tipos-egresos';
    return;
  }

  const esEmpresaValida = !view.empresa || (session && session.tipoPersona === 'JURIDICA');
  if (!view || (view.admin && session && session.rol !== 'ADMIN') || !esEmpresaValida) {
    location.hash = '#/dashboard';
    return;
  }

  const esSubCatalogo = nombre === 'catalogos' && sub;
  document.getElementById('page-title').textContent = esSubCatalogo ? (TAB_TITLES[sub] || view.title) : view.title;
  document.querySelectorAll('.nav-link').forEach((a) => {
    a.classList.toggle('active', a.dataset.view === ruta);
  });

  content.innerHTML = '<div style="padding:60px;text-align:center;color:var(--texto-muy-suave)">Cargando…</div>';
  try {
    if (esSubCatalogo) {
      await view.render(content, { session, api: API }, sub);
    } else {
      await view.render(content, { session, api: API });
    }
  } catch (err) {
    content.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
  }

  window.scrollTo(0, 0);
  document.getElementById('sidebar').classList.remove('open');
}

function init() {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('menu-toggle').onclick = () => sidebar.classList.toggle('open');

  document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = '#/cerrar-sesion';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  init();
  if (!(await verSesion())) return;
  aplicarSesion();
  window.addEventListener('hashchange', navegar);
  await navegar();
});