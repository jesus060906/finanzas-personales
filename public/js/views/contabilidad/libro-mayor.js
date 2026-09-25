'use strict';

import API from '../../api.js';
import { esc, ic, fmt } from '../../ui.js';
import { spinner, selectCuentas, errorBox, vacio } from './comun.js';

let ultimoResultado = null;

export async function render(el, ctx) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Libro Mayor</h3>
          <p>Movimientos y saldo acumulado de una cuenta</p>
        </div>
      </div>
      <form id="filtros-mayor" class="filtro-bar" autocomplete="off">
        <span class="filtro-field filtro-field--select">
          <select class="filtro-control" name="cuentaId" id="mayor-cuenta" required style="min-width:280px"></select>
        </span>
        <span class="filtro-field filtro-field--fecha">
          <svg class="filtro-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>
          <input class="filtro-control" type="date" name="desde" autocomplete="off" />
        </span>
        <span class="filtro-field filtro-field--fecha">
          <svg class="filtro-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>
          <input class="filtro-control" type="date" name="hasta" autocomplete="off" />
        </span>
        <button class="btn btn-primary" type="submit">${ic.refresh} Consultar</button>
      </form>
      <div id="mayor-body">
        <p style="padding:24px;color:var(--texto-suave)">Selecciona una cuenta y consulta para ver sus movimientos.</p>
      </div>
    </div>
  `;

  const divBody = el.querySelector('#mayor-body');

  const cuentas = await API.get('/contabilidad/cuentas').catch(() => []);
  document.getElementById('mayor-cuenta').innerHTML = selectCuentas(cuentas);

  document.getElementById('filtros-mayor').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cuentaId = fd.get('cuentaId');
    if (!cuentaId) return;
    divBody.innerHTML = spinner();
    try {
      const datos = await API.query('/contabilidad/libro-mayor', { cuentaId, desde: fd.get('desde'), hasta: fd.get('hasta') });
      ultimoResultado = datos;
      divBody.innerHTML = resumen(datos) + tabla(datos);
    } catch (err) {
      divBody.innerHTML = errorBox(err.message);
    }
  };
}

function resumen(datos) {
  const saldo = datos.saldo;
  const clase = saldo >= 0 ? 'mayor-saldo-pos' : 'mayor-saldo-neg';
  return `
    <div class="mayor-resumen">
      <div class="card mayor-stat">
        <small class="mayor-stat-label">Cuenta</small>
        <div class="mayor-stat-val" style="font-size:1rem;font-weight:700">${esc(datos.cuenta.codigo)} — ${esc(datos.cuenta.nombre)}</div>
      </div>
      <div class="card mayor-stat">
        <small class="mayor-stat-label">Saldo</small>
        <div class="mayor-stat-val mayor-saldo ${clase} mono">${fmt.money(saldo)}</div>
      </div>
      <div class="card mayor-stat">
        <small class="mayor-stat-label">Total débitos</small>
        <div class="mayor-stat-val mayor-monto mono">${fmt.money(datos.totalDebe)}</div>
      </div>
      <div class="card mayor-stat">
        <small class="mayor-stat-label">Total créditos</small>
        <div class="mayor-stat-val mayor-monto mono">${fmt.money(datos.totalHaber)}</div>
      </div>
    </div>`;
}

function tabla(datos) {
  return `
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>Fecha</th><th>Nº</th><th>Concepto</th><th>Detalle</th><th style="text-align:right">Débito</th><th style="text-align:right">Crédito</th><th style="text-align:right">Saldo acumulado</th></tr></thead>
        <tbody>
          ${datos.movimientos.map((m) => `
            <tr>
              <td class="mono">${esc(m.fecha)}</td>
              <td class="mono">${esc(m.numero)}</td>
              <td>${esc(m.concepto)}</td>
              <td>${esc(m.descripcion || '—')}</td>
              <td style="text-align:right" class="mono">${m.debe ? fmt.money(m.debe) : ''}</td>
              <td style="text-align:right" class="mono">${m.haber ? fmt.money(m.haber) : ''}</td>
              <td style="text-align:right" class="mono"><strong>${fmt.money(m.saldoAcumulado)}</strong></td>
            </tr>`).join('') || vacio('No hay movimientos para esta cuenta en el rango seleccionado.', 7)}
        </tbody>
      </table>
    </div>`;
}