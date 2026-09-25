'use strict';

import { esc } from '../../ui.js';

export function spinner() {
  return '<div style="text-align:center;padding:50px;color:var(--texto-muy-suave)">Cargando…</div>';
}

export const TIPOS_CUENTA = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO'];

export function badgeEstado(estado) {
  if (estado === 'ACTIVO' || estado === 'ABIERTO') return '<span class="badge ok">Activo</span>';
  if (estado === 'CERRADO') return '<span class="badge no">Cerrado</span>';
  if (estado === 'ANULADO') return '<span class="badge no">Anulado</span>';
  return '<span class="badge no">Inactivo</span>';
}

export function badgeTipoCuenta(tipo) {
  const mapa = { ACTIVO: 'ok', PASIVO: 'no', PATRIMONIO: 'gold', INGRESO: 'ok', GASTO: 'no' };
  return `<span class="badge ${mapa[tipo] || 'muted'}">${esc(tipo)}</span>`;
}

export function selectCuentas(cuentas, selected = null) {
  return cuentas
    .filter((c) => c.estado === 'ACTIVO')
    .map((c) => `<option value="${c.id}" ${Number(c.id) === Number(selected) ? 'selected' : ''}>${esc(c.codigo)} — ${esc(c.nombre)}</option>`)
    .join('');
}

export function errorBox(mensaje) {
  return `<p style="padding:24px;color:var(--danger)">${esc(mensaje)}</p>`;
}

export function vacio(mensaje, colspan) {
  return `<tr><td class="empty" colspan="${colspan}">${esc(mensaje)}</td></tr>`;
}