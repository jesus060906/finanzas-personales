'use strict';

import API from '../../api.js';
import { esc, ic, toast, fmt } from '../../ui.js';
import { spinner, selectCuentas, errorBox, vacio } from './comun.js';
import { aExcel, cabeceraXLSX, encabezadoXLSX, filaXLSX, totalRowXLSX, MONEDA_FORMAT, fmtD, sello, metaGenerado } from '../../xlsx.js';

let ultimoResultado = null;

export async function render(el, ctx) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Libro Diario</h3>
          <p>Registro cronológico de todos los asientos activos</p>
        </div>
      </div>
      <form id="filtros-diario" class="filtro-bar" autocomplete="off">
        <span class="filtro-field filtro-field--fecha">
          <svg class="filtro-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>
          <input class="filtro-control" type="date" name="desde" autocomplete="off" />
        </span>
        <span class="filtro-field filtro-field--fecha">
          <svg class="filtro-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>
          <input class="filtro-control" type="date" name="hasta" autocomplete="off" />
        </span>
        <span class="filtro-field filtro-field--select">
          <select class="filtro-control" name="cuentaId" id="diario-cuenta" style="min-width:260px"><option value="">Todas las cuentas</option></select>
        </span>
        <button class="btn btn-primary" type="submit">${ic.refresh} Consultar</button>
        <button class="btn btn-outline" type="button" id="btn-excel-diario">${ic.download} Exportar Excel</button>
      </form>
      <div id="diario-body">${spinner()}</div>
    </div>
  `;

  const cuentas = await API.get('/contabilidad/cuentas').catch(() => []);
  document.getElementById('diario-cuenta').insertAdjacentHTML('beforeend', selectCuentas(cuentas));

  document.getElementById('filtros-diario').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await consultar(fd.get('desde'), fd.get('hasta'), fd.get('cuentaId'));
  };

  document.getElementById('btn-excel-diario').onclick = () => {
    if (!ultimoResultado) return toast('Consulta primero el libro diario.', 'warn');
    aExcel(`libro-diario-${sello()}.xlsx`, (wb) => {
      const ws = wb.addWorksheet('Libro Diario');
      ws.columns = [{ width: 12 }, { width: 9 }, { width: 30 }, { width: 40 }, { width: 30 }, { width: 14 }, { width: 14 }];
      const desde = document.querySelector('#filtros-diario [name="desde"]').value;
      const hasta = document.querySelector('#filtros-diario [name="hasta"]').value;
      cabeceraXLSX(ws, 'Libro Diario', metaGenerado(desde, hasta, [`${ultimoResultado.filas.length} movimientos`]));
      encabezadoXLSX(ws, ['Fecha', 'N.º', 'Cuenta', 'Concepto', 'Detalle', 'Débito', 'Crédito']);
      const algs = ['center', 'center', 'left', 'left', 'left', 'right', 'right'];
      ultimoResultado.filas.forEach((f) => {
        const r = filaXLSX(ws, [
          fmtD(f.fecha),
          f.numero,
          `${f.cuentaCodigo} — ${f.cuentaNombre}`,
          f.concepto,
          f.descripcion || '',
          Number(f.debe) || 0,
          Number(f.haber) || 0,
        ], algs);
        r.getCell(6).numFmt = MONEDA_FORMAT;
        r.getCell(7).numFmt = MONEDA_FORMAT;
      });
      ws.addRow([]);
      totalRowXLSX(ws, 'Total débitos', ultimoResultado.totalDebe);
      totalRowXLSX(ws, 'Total créditos', ultimoResultado.totalHaber);
    });
  };

  await consultar(null, null, '');
}

async function consultar(desde, hasta, cuentaId) {
  const div = document.getElementById('diario-body');
  div.innerHTML = spinner();
  try {
    const datos = await API.query('/contabilidad/libro-diario', { desde, hasta, cuentaId });
    ultimoResultado = datos;
    div.innerHTML = tabla(datos);
  } catch (err) {
    div.innerHTML = errorBox(err.message);
  }
}

function tabla(datos) {
  return `
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>Fecha</th><th>Nº</th><th>Cuenta</th><th>Concepto</th><th style="text-align:right">Débito</th><th style="text-align:right">Crédito</th></tr></thead>
        <tbody>
          ${datos.filas.map((f) => `
            <tr>
              <td class="mono">${esc(f.fecha)}</td>
              <td class="mono">${esc(f.numero)}</td>
              <td class="mono">${esc(`${f.cuentaCodigo} — ${f.cuentaNombre}`)}</td>
              <td>${esc(f.concepto)}${f.descripcion ? `<small style="color:var(--texto-muy-suave)"> · ${esc(f.descripcion)}</small>` : ''}</td>
              <td style="text-align:right" class="mono">${f.debe ? fmt.money(f.debe) : ''}</td>
              <td style="text-align:right" class="mono">${f.haber ? fmt.money(f.haber) : ''}</td>
            </tr>`).join('') || vacio('No hay movimientos para los filtros seleccionados.', 6)}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right"><strong>Totales</strong></td>
            <td style="text-align:right"><strong class="mono">${fmt.money(datos.totalDebe)}</strong></td>
            <td style="text-align:right"><strong class="mono">${fmt.money(datos.totalHaber)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}