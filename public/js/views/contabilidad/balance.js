'use strict';

import API from '../../api.js';
import { esc, ic, toast, fmt } from '../../ui.js';
import { spinner, errorBox, vacio } from './comun.js';
import { aExcel, cabeceraXLSX, encabezadoXLSX, filaXLSX, totalRowXLSX, MONEDA_FORMAT, sello, metaGenerado } from '../../xlsx.js';

let ultimoResultado = null;

export async function render(el, ctx) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Balance de Comprobación</h3>
          <p>Saldos por cuenta dentro del rango seleccionado</p>
        </div>
      </div>
      <form id="filtros-balance" class="filtro-bar" autocomplete="off">
        <span class="filtro-field filtro-field--fecha">
          <svg class="filtro-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>
          <input class="filtro-control" type="date" name="desde" autocomplete="off" />
        </span>
        <span class="filtro-field filtro-field--fecha">
          <svg class="filtro-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>
          <input class="filtro-control" type="date" name="hasta" autocomplete="off" />
        </span>
        <button class="btn btn-primary" type="submit">${ic.refresh} Consultar</button>
        <button class="btn btn-outline" type="button" id="btn-excel-balance">${ic.download} Exportar Excel</button>
      </form>
      <div id="balance-body">${spinner()}</div>
    </div>
  `;

  const divBody = el.querySelector('#balance-body');

  document.getElementById('filtros-balance').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await consultar(fd.get('desde'), fd.get('hasta'));
  };

  document.getElementById('btn-excel-balance').onclick = () => {
    if (!ultimoResultado) return toast('Consulta primero el balance.', 'warn');
    aExcel(`balance-comprobacion-${sello()}.xlsx`, (wb) => {
      const ws = wb.addWorksheet('Balance de Comprobación');
      ws.columns = [{ width: 10 }, { width: 34 }, { width: 14 }, { width: 14 }, { width: 14 }];
      const desde = document.querySelector('#filtros-balance [name="desde"]').value;
      const hasta = document.querySelector('#filtros-balance [name="hasta"]').value;
      cabeceraXLSX(ws, 'Balance de Comprobación', metaGenerado(desde, hasta, [ultimoResultado.cuadra ? 'El balance cuadra' : 'El balance NO cuadra']));
      encabezadoXLSX(ws, ['Código', 'Cuenta', 'Débitos', 'Créditos', 'Saldo']);
      const algs = ['center', 'left', 'right', 'right', 'right'];
      ultimoResultado.filas.forEach((f) => {
        const r = filaXLSX(ws, [f.codigo, f.nombre, Number(f.debe) || 0, Number(f.haber) || 0, Number(f.saldo) || 0], algs);
        [3, 4, 5].forEach((col) => (r.getCell(col).numFmt = MONEDA_FORMAT));
      });
      ws.addRow([]);
      totalRowXLSX(ws, 'Total débitos', ultimoResultado.totalDebe);
      totalRowXLSX(ws, 'Total créditos', ultimoResultado.totalHaber);
    });
  };

  await consultar(null, null);
}

async function consultar(desde, hasta) {
  const div = document.getElementById('balance-body');
  div.innerHTML = spinner();
  try {
    const datos = await API.query('/contabilidad/balance-comprobacion', { desde, hasta });
    ultimoResultado = datos;
    div.innerHTML = avisoCuadre(datos) + tabla(datos);
  } catch (err) {
    div.innerHTML = errorBox(err.message);
  }
}

function avisoCuadre(datos) {
  return datos.cuadra
    ? `<div style="padding:14px 18px;margin-bottom:16px;border-radius:10px;background:var(--ingreso-bg);color:var(--ingreso-fg);font-weight:600">✓ El balance cuadra: total débitos = total créditos.</div>`
    : `<div style="padding:14px 18px;margin-bottom:16px;border-radius:10px;background:var(--egreso-bg);color:var(--danger);font-weight:600">✗ El balance NO cuadra. Revisa los asientos registrados.</div>`;
}

function tabla(datos) {
  return `
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>Código</th><th>Cuenta</th><th style="text-align:right">Débitos</th><th style="text-align:right">Créditos</th><th style="text-align:right">Saldo</th></tr></thead>
        <tbody>
          ${datos.filas.map((f) => `
            <tr>
              <td class="mono">${esc(f.codigo)}</td>
              <td><strong>${esc(f.nombre)}</strong></td>
              <td style="text-align:right" class="mono">${f.debe ? fmt.money(f.debe) : ''}</td>
              <td style="text-align:right" class="mono">${f.haber ? fmt.money(f.haber) : ''}</td>
              <td style="text-align:right" class="mono"><strong>${fmt.money(f.saldo)}</strong></td>
            </tr>`).join('') || vacio('Sin movimientos en el rango seleccionado.', 5)}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align:right"><strong>Totales</strong></td>
            <td style="text-align:right"><strong class="mono">${fmt.money(datos.totalDebe)}</strong></td>
            <td style="text-align:right"><strong class="mono">${fmt.money(datos.totalHaber)}</strong></td>
            <td><span class="badge ${datos.cuadra ? 'ok' : 'no'}">${datos.cuadra ? 'Cuadra' : 'No cuadra'}</span></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}