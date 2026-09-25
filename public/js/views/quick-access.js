'use strict';

// Acceso rápido del Dashboard: en lugar de redirigir a otra página, un menú
// desplegable permite elegir Transacciones / Reportes / Procesar cortes y abrirlos
// en un MODAL CENTRADO en pantalla, SIN salir del dashboard. No se reimplementa
// nada: cada opción reutiliza el render(el, ctx) de su vista existente.

import { esc } from '../ui.js';
import { render as renderTransacciones } from './transacciones.js';
import { render as renderReportes } from './reportes.js';
import { render as renderCortes } from './cortes.js';

// Íconos con el mismo trazo (stroke="currentColor") que el resto del sistema.
const ICONOS = {
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"></path></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>',
  go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"></path></svg>',
  transacciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"></path><path d="M3 11V8a2 2 0 0 1 2-2h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v3a2 2 0 0 1-2 2H5"></path></svg>',
  cortes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M9 3v4H5m6 3l-2 2 2 2m4-4l2 2-2 2M3 13h18"></path></svg>',
  reportes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="M7 13l3-4 4 3 5-7"></path></svg>',
};

const OPCIONES = [
  { id: 'transacciones', titulo: 'Transacciones', desc: 'Registrar y gestionar movimientos', icon: ICONOS.transacciones, render: renderTransacciones },
  { id: 'reportes', titulo: 'Reportes', desc: 'Consultar y exportar reportes', icon: ICONOS.reportes, render: renderReportes },
  { id: 'cortes', titulo: 'Procesar cortes', desc: 'Cierres mensuales de períodos', icon: ICONOS.cortes, render: renderCortes },
];

// ===== Menú desplegable =====

export function accesoRapidoHTML() {
  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Acceso rápido</h3>
          <p>Las opciones se abren dentro del dashboard, sin salir de esta vista</p>
        </div>
      </div>
      <div class="qa-wrap">
        <button class="btn btn-primary qa-trigger" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="qa-menu">
          ${ICONOS.zap} Acceso rápido
          <svg class="qa-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
        </button>
        <div class="qa-menu" id="qa-menu" role="menu">
          ${OPCIONES.map((o) => `
            <button class="qa-item" role="menuitem" type="button" data-qa="${o.id}">
              <span class="qa-item-ic">${o.icon}</span>
              <span class="qa-item-txt"><strong>${esc(o.titulo)}</strong><small>${esc(o.desc)}</small></span>
              <span class="qa-item-go">${ICONOS.go}</span>
            </button>`).join('')}
        </div>
      </div>
    </div>`;
}

export function bindAccesoRapido(el, ctx) {
  const wrap = el.querySelector('.qa-wrap');
  if (!wrap) return;
  const trigger = wrap.querySelector('.qa-trigger');
  const menu = wrap.querySelector('.qa-menu');

  const abrirMenu = () => {
    menu.classList.add('open');
    wrap.classList.add('abierto');
    trigger.setAttribute('aria-expanded', 'true');
  };
  const cerrarMenu = () => {
    menu.classList.remove('open');
    wrap.classList.remove('abierto');
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('open')) cerrarMenu();
    else abrirMenu();
  });

  menu.querySelectorAll('.qa-item').forEach((item) => {
    item.addEventListener('click', () => {
      const opcion = OPCIONES.find((o) => o.id === item.dataset.qa);
      cerrarMenu();
      if (opcion) abrirDrawer(opcion, ctx);
    });
  });
}

// Cierre global: un clic fuera de cualquier menú abierto lo cierra. Se registra una
// sola vez (no por render) para no acumular listeners entre renders del dashboard.
document.addEventListener('click', (e) => {
  const menu = document.querySelector('.qa-menu.open');
  if (!menu) return;
  const wrap = menu.closest('.qa-wrap');
  if (wrap && wrap.contains(e.target)) return;
  cerrarMenuAbierto(menu);
});

function cerrarMenuAbierto(menu) {
  menu.classList.remove('open');
  const wrap = menu.closest('.qa-wrap');
  if (wrap) wrap.classList.remove('abierto');
  const trig = wrap && wrap.querySelector('.qa-trigger');
  if (trig) trig.setAttribute('aria-expanded', 'false');
}

// ===== Modal centrado =====

let drawer = null;
let drawerBody = null;
let ultimoFoco = null;

function crearDrawer() {
  const back = document.createElement('div');
  back.className = 'drawer-backdrop';
  back.innerHTML = `
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Acceso rápido">
      <header class="drawer-header">
        <div class="drawer-title">
          <h3></h3>
          <p></p>
        </div>
        <button class="modal-close qa-close" type="button" aria-label="Cerrar">&times;</button>
      </header>
      <div class="drawer-body"></div>
    </aside>`;
  document.body.appendChild(back);

  const onBackdrop = (e) => { if (e.target === back) cerrarDrawer(); };
  back.addEventListener('mousedown', onBackdrop);
  back.querySelector('.qa-close').addEventListener('click', cerrarDrawer);
  return back;
}

async function abrirDrawer(opcion, ctx) {
  const back = drawer || crearDrawer();
  drawer = back;
  drawerBody = back.querySelector('.drawer-body');
  back.querySelector('.drawer-title h3').textContent = opcion.titulo;
  back.querySelector('.drawer-title p').textContent = opcion.desc;

  drawerBody.innerHTML = '<div style="padding:60px;text-align:center;color:var(--texto-muy-suave)">Cargando…</div>';
  document.body.style.overflow = 'hidden';
  back.classList.add('open');
  ultimoFoco = document.activeElement;
  back.querySelector('.qa-close').focus();

  try {
    await opcion.render(drawerBody, ctx);
  } catch (err) {
    drawerBody.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
  }
  if (drawer === back) drawerBody.scrollTop = 0;
}

function cerrarDrawer() {
  if (!drawer) return;
  const back = drawer;
  back.classList.remove('open');
  document.body.style.overflow = '';
  if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  // Se libera el contenido tras la animación de salida. Si el drawer se reabre en
  // ese lapso (.open vuelve a estar presente), no se borra el montaje en curso.
  setTimeout(() => {
    if (!back.classList.contains('open')) {
      const cuerpo = back.querySelector('.drawer-body');
      if (cuerpo) cuerpo.innerHTML = '';
    }
  }, 280);
  drawer = null;
  drawerBody = null;
  ultimoFoco = null;
}

// Escape cierra el drawer (o el menú si estuviera abierto) y cualquier navegación
// (sidebar, logo, etc.) cierra el drawer. Registrados una sola vez por sesión.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // Si hay un modal (confirmar/editar) abierto encima, Escape lo cierra a él primero.
  if (document.querySelector('.modal-backdrop')) return;
  if (drawer) { cerrarDrawer(); return; }
  const menu = document.querySelector('.qa-menu.open');
  if (menu) cerrarMenuAbierto(menu);
});

window.addEventListener('hashchange', () => {
  if (drawer) cerrarDrawer();
});