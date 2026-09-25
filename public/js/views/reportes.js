'use strict';

import API from '../api.js';
import { fmt, MESES, esc, ic, toast, badgeEstado } from '../ui.js';
import { aExcel, cabeceraXLSX, encabezadoXLSX, filaXLSX, totalRowXLSX, MONEDA_FORMAT, fmtD, sello } from '../xlsx.js';

export async function render(el, ctx) {
  el.innerHTML = `
    <div class="print-report" hidden>
      <div class="print-report__brand">Finanzas <span>Personales</span></div>
      <p class="print-report__sub">Reporte de transacciones y cortes mensuales</p>
      <p class="print-report__meta" id="pr-meta"></p>
    </div>
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Reporte de transacciones</h3>
          <p>Consulte transacciones por criterios: usuario, fechas, tipo o categoría</p>
        </div>
      </div>
      <div class="grid-form" id="filtros-tx">
        ${ctx.session.rol === 'ADMIN' ? `
        <div class="field">
          <label>Usuario</label>
          <select id="r-usuario"><option value="">Todos</option></select>
        </div>` : ''}
        <div class="field">
          <label>Tipo</label>
          <select id="r-tipo">
            <option value="">Todos</option>
            <option value="INGRESO">Ingresos</option>
            <option value="EGRESO">Egresos</option>
          </select>
        </div>
        <div class="field">
          <label>Tipo de pago</label>
          <select id="r-pago"><option value="">Todos</option></select>
        </div>
        <div class="field">
          <label>Fecha desde</label>
          <input id="r-desde" type="date" autocomplete="off" />
        </div>
        <div class="field">
          <label>Fecha hasta</label>
          <input id="r-hasta" type="date" autocomplete="off" />
        </div>
        <div class="field" style="justify-content:end">
          <button class="btn btn-primary" id="btn-consultar">${ic.refresh} Consultar</button>
        </div>
      </div>
      <div id="r-resumen" class="kpi-grid" hidden></div>
      <div class="table-wrap" id="r-tabla"><p style="padding:26px;color:var(--texto-muy-suave)">Use los filtros y presione "Consultar".</p></div>
      <div class="toolbar" style="margin:14px 0 0;justify-content:flex-end">
        <button class="btn btn-outline" id="btn-excel-tx" hidden>${ic.download} Exportar Excel</button>
        <button class="btn btn-outline" id="btn-pdf-tx" hidden>${ic.download} Exportar PDF</button>
        <button class="btn btn-outline" id="btn-print-tx" hidden>${ic.print} Imprimir</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Reporte de cortes</h3>
          <p>Estado de los cortes entre fechas y por usuario</p>
        </div>
      </div>
      <div class="grid-form">
        ${ctx.session.rol === 'ADMIN' ? `
        <div class="field">
          <label>Usuario</label>
          <select id="rc-usuario"><option value="">Todos</option></select>
        </div>` : ''}
        <div class="field">
          <label>Fecha desde</label>
          <input id="rc-desde" type="date" autocomplete="off" />
        </div>
        <div class="field">
          <label>Fecha hasta</label>
          <input id="rc-hasta" type="date" autocomplete="off" />
        </div>
        <div class="field" style="justify-content:end">
          <button class="btn btn-primary" id="btn-consultar-corte">${ic.refresh} Consultar</button>
        </div>
      </div>
      <div id="rc-resumen" class="kpi-grid" hidden></div>
      <div class="table-wrap" id="rc-tabla"><p style="padding:26px;color:var(--texto-muy-suave)">Consulte los cortes para ver resultados.</p></div>
      <div class="toolbar" style="margin:14px 0 0;justify-content:flex-end">
        <button class="btn btn-outline" id="btn-excel-corte" hidden>${ic.download} Exportar Excel</button>
        <button class="btn btn-outline" id="btn-pdf-corte" hidden>${ic.download} Exportar PDF</button>
        <button class="btn btn-outline" id="btn-print-corte" hidden>${ic.print} Imprimir</button>
      </div>
    </div>
  `;

  // Catálogos para filtros
  const pagos = await API.get('/catalogos/tipos-pago').catch(() => []);
  el.querySelector('#r-pago').innerHTML = '<option value="">Todos</option>' + pagos.map((p) => `<option value="${p.id}">${esc(p.descripcion)}</option>`).join('');

  if (ctx.session.rol === 'ADMIN') {
    const usuarios = await API.get('/usuarios').catch(() => []);
    const opts = usuarios.map((u) => `<option value="${u.id}">${esc(u.nombre)}</option>`).join('');
    el.querySelector('#r-usuario').innerHTML = '<option value="">Todos</option>' + opts;
    el.querySelector('#rc-usuario').innerHTML = '<option value="">Todos</option>' + opts;
  }

  let ultimo = null;

  el.querySelector('#btn-consultar').onclick = async () => {
    const params = {
      usuarioId: ctx.session.rol === 'ADMIN' ? el.querySelector('#r-usuario').value : undefined,
      tipo: el.querySelector('#r-tipo').value,
      tipoPagoId: el.querySelector('#r-pago').value,
      desde: el.querySelector('#r-desde').value,
      hasta: el.querySelector('#r-hasta').value,
    };
    try {
      const res = await API.query('/reportes/transacciones', params);
      ultimo = { tipo: 'tx', res, params };
      mostrarTx(el, res);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  el.querySelector('#btn-consultar-corte').onclick = async () => {
    const params = {
      usuarioId: ctx.session.rol === 'ADMIN' ? el.querySelector('#rc-usuario').value : undefined,
      desde: el.querySelector('#rc-desde').value,
      hasta: el.querySelector('#rc-hasta').value,
    };
    try {
      const res = await API.query('/reportes/corte', params);
      ultimo = { tipo: 'corte', res, params };
      mostrarCorte(el, res);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  el.querySelector('#btn-excel-tx').onclick = () => { if (ultimo && ultimo.tipo === 'tx') exportarTxXLSX(ultimo); };
  el.querySelector('#btn-pdf-tx').onclick = () => { if (ultimo && ultimo.tipo === 'tx') exportarTxPDF(ultimo); };
  el.querySelector('#btn-print-tx').onclick = () => {
    const m = document.getElementById('pr-meta');
    if (ultimo && ultimo.tipo === 'tx' && m) m.textContent = metaReporte(ultimo);
    window.print();
  };

  el.querySelector('#btn-excel-corte').onclick = () => { if (ultimo && ultimo.tipo === 'corte') exportarCorteXLSX(ultimo); };
  el.querySelector('#btn-pdf-corte').onclick = () => { if (ultimo && ultimo.tipo === 'corte') exportarCortePDF(ultimo); };
  el.querySelector('#btn-print-corte').onclick = () => {
    const m = document.getElementById('pr-meta');
    if (ultimo && ultimo.tipo === 'corte' && m) m.textContent = metaReporte(ultimo, true);
    window.print();
  };
}

function txConcepto(t) {
  if (t.tipo === 'INGRESO') return t.ingreso ? t.ingreso.descripcion : 'Ingreso';
  return t.egreso ? t.egreso.descripcion : 'Egreso';
}

function mostrarTx(el, res) {
  el.querySelector('#r-resumen').hidden = false;
  el.querySelector('#r-resumen').innerHTML = `
    <div class="card kpi ingreso"><div class="kpi-label">Total ingresos</div><div class="kpi-value">${fmt.money(res.totalIngresos)}</div><div class="kpi-sub">${res.count} registros</div></div>
    <div class="card kpi egreso"><div class="kpi-label">Total egresos</div><div class="kpi-value">${fmt.money(res.totalEgresos)}</div><div class="kpi-sub">${res.count} registros</div></div>
    <div class="card kpi balance"><div class="kpi-label">Balance</div><div class="kpi-value">${fmt.money(res.balance)}</div><div class="kpi-sub">Resultado neto</div></div>
  `;

  const tabla = document.getElementById('r-tabla');
  if (!res.rows.length) {
    tabla.innerHTML = '<p style="padding:26px;color:var(--texto-muy-suave)">Sin resultados para los criterios indicados.</p>';
  } else {
    tabla.innerHTML = `
      <div class="print-header" style="display:none"></div>
      <table class="tbl">
        <thead>
          <tr><th>No.</th><th>Tipo</th><th>Usuario</th><th>Concepto</th><th>Pago</th><th>Fecha</th><th class="num">Monto</th><th>Estado</th></tr>
        </thead>
        <tbody>
          ${res.rows.map((t) => `
            <tr>
              <td class="mono" style="font-size:.78rem">${esc(t.numero)}</td>
              <td>${t.tipo === 'INGRESO' ? '<span class="badge ok">Ingreso</span>' : '<span class="badge no">Egreso</span>'}</td>
              <td>${esc(t.usuario ? t.usuario.nombre : '—')}</td>
              <td>
                <strong>${esc(txConcepto(t))}</strong>
                ${(t.egreso && t.egreso.renglon) || (t.ingreso && t.ingreso.tipoIngreso) ? `<br><small style="color:var(--texto-muy-suave)">${esc(t.tipo === 'EGRESO' && t.egreso.renglon ? t.egreso.renglon.descripcion : t.ingreso.tipoIngreso.descripcion)}</small>` : ''}
              </td>
              <td>${esc(t.tipoPago ? t.tipoPago.descripcion : '—')}</td>
              <td>${fmt.date(t.fechaTransaccion)}</td>
              <td class="num ${t.tipo === 'INGRESO' ? 'pos' : 'neg'}">${t.tipo === 'INGRESO' ? '+' : '−'}${fmt.money(t.monto)}</td>
              <td>${badgeEstado(t.estado)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  el.querySelector('#btn-excel-tx').hidden = false;
  el.querySelector('#btn-print-tx').hidden = false;
}

function mostrarCorte(el, res) {
  el.querySelector('#rc-resumen').hidden = false;
  el.querySelector('#rc-resumen').innerHTML = `
    <div class="card kpi ingreso"><div class="kpi-label">Total ingresos</div><div class="kpi-value">${fmt.money(res.totalIngresos)}</div><div class="kpi-sub">${res.count} cortes</div></div>
    <div class="card kpi egreso"><div class="kpi-label">Total egresos</div><div class="kpi-value">${fmt.money(res.totalEgresos)}</div><div class="kpi-sub">${res.count} cortes</div></div>
  `;
  const tabla = document.getElementById('rc-tabla');
  if (!res.rows.length) {
    tabla.innerHTML = '<p style="padding:26px;color:var(--texto-muy-suave)">Sin cortes para los criterios indicados.</p>';
  } else {
    tabla.innerHTML = `
      <table class="tbl">
        <thead>
          <tr><th>Usuario</th><th>Período</th><th>Fecha corte</th><th class="num">Balance inicial</th>
          <th class="num">Ingresos</th><th class="num">Egresos</th><th class="num">Balance</th></tr>
        </thead>
        <tbody>
          ${res.rows.map((c) => `
            <tr>
              <td><strong>${esc(c.usuario ? c.usuario.nombre : '—')}</strong></td>
              <td>${esc(c.anio)} · ${esc(MESES[c.mes - 1])}</td>
              <td>${fmt.date(c.fechaCorte)}</td>
              <td class="num">${fmt.money(c.balanceInicial)}</td>
              <td class="num pos">${fmt.money(c.totalIngresos)}</td>
              <td class="num neg">${fmt.money(c.totalEgresos)}</td>
              <td class="num ${Number(c.balanceCorte) >= 0 ? 'pos' : 'neg'}"><strong>${fmt.money(c.balanceCorte)}</strong></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }
  el.querySelector('#btn-excel-corte').hidden = false;
  el.querySelector('#btn-print-corte').hidden = false;
}

// Guardar contexto en window para helpers de impresión del reporte activo
const _ctx = window;
_ctx.__printTitulo = null;

/* ==========================================================================
   EXPORTACIONES PROFESIONALES (Excel XLSX / PDF con jsPDF)
   ========================================================================== */

function textoSel(id) {
  const el = document.getElementById(id);
  return el && el.selectedIndex >= 0 ? el.options[el.selectedIndex].textContent.trim() : 'Todos';
}

function ahoraLegible() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${fmtD(d.toISOString().slice(0, 10))} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function metaReporte(ultimo, esCorte = false) {
  const p = ultimo.params || {};
  const usuario = p.usuarioId ? textoSel(esCorte ? 'rc-usuario' : 'r-usuario') : 'Todos';
  return [
    'Generado: ' + ahoraLegible(),
    `Usuario: ${usuario}`,
    esCorte ? '' : `Tipo: ${textoSel('r-tipo')}`,
    esCorte ? '' : `Forma de pago: ${textoSel('r-pago')}`,
    `Desde: ${fmtD(p.desde)} · Hasta: ${fmtD(p.hasta)}`,
  ].filter((x) => x).join(' · ');
}

function exportarTxXLSX(ultimo) {
  aExcel(`reporte-transacciones-${sello()}.xlsx`, (wb) => {
    const ws = wb.addWorksheet('Transacciones');
    ws.columns = [{ width: 6 }, { width: 10 }, { width: 26 }, { width: 42 }, { width: 20 }, { width: 13 }, { width: 15 }, { width: 10 }];
    cabeceraXLSX(ws, 'Reporte de transacciones', metaReporte(ultimo));
    encabezadoXLSX(ws, ['N.º', 'Tipo', 'Usuario', 'Concepto', 'Forma de pago', 'Fecha', 'Monto', 'Estado']);
    const algs = ['center', 'center', 'left', 'left', 'left', 'center', 'right', 'center'];
    ultimo.res.rows.forEach((t, i) => {
      const r = filaXLSX(ws, [
        i + 1,
        t.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso',
        t.usuario ? t.usuario.nombre : '—',
        txConcepto(t),
        t.tipoPago ? t.tipoPago.descripcion : '—',
        fmtD(t.fechaTransaccion),
        Number(t.monto),
        t.estado === 'ACTIVO' ? 'Activo' : 'Anulado',
      ], algs);
      r.getCell(7).numFmt = MONEDA_FORMAT;
    });

    ws.addRow([]);
    totalRowXLSX(ws, 'Total de registros', ultimo.res.count, false);
    totalRowXLSX(ws, 'Total ingresos', ultimo.res.totalIngresos);
    totalRowXLSX(ws, 'Total egresos', ultimo.res.totalEgresos);
    totalRowXLSX(ws, 'Balance', ultimo.res.balance);
  });
}

function exportarCorteXLSX(ultimo) {
  aExcel(`reporte-cortes-${sello()}.xlsx`, (wb) => {
    const ws = wb.addWorksheet('Cortes');
    ws.columns = [{ width: 6 }, { width: 28 }, { width: 16 }, { width: 14 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];
    cabeceraXLSX(ws, 'Reporte de cortes mensuales', metaReporte(ultimo, true));
    encabezadoXLSX(ws, ['N.º', 'Usuario', 'Período', 'Fecha de corte', 'Balance inicial', 'Total ingresos', 'Total egresos', 'Balance']);
    const algs = ['center', 'left', 'left', 'center', 'right', 'right', 'right', 'right'];
    ultimo.res.rows.forEach((c, i) => {
      const r = filaXLSX(ws, [
        i + 1,
        c.usuario ? c.usuario.nombre : '—',
        `${c.anio} · ${MESES[c.mes - 1] || c.mes}`,
        fmtD(c.fechaCorte),
        Number(c.balanceInicial),
        Number(c.totalIngresos),
        Number(c.totalEgresos),
        Number(c.balanceCorte),
      ], algs);
      [5, 6, 7, 8].forEach((col) => (r.getCell(col).numFmt = MONEDA_FORMAT));
    });

    ws.addRow([]);
    totalRowXLSX(ws, 'Total de cortes', ultimo.res.count, false);
    totalRowXLSX(ws, 'Total ingresos', ultimo.res.totalIngresos);
    totalRowXLSX(ws, 'Total egresos', ultimo.res.totalEgresos);
    totalRowXLSX(ws, 'Balance acumulado', ultimo.res.balance);
  });
}

/* ---------- PDF ---------- */
const PDF_VERDE = [16, 78, 61];
function pdfSafe(s) {
  return String(s ?? '').replace(/[^\u0000-\u00ff]/g, '').trim();
}

function monedaPDF(v, conSigno = false) {
  const num = Number(v) || 0;
  const base = pdfSafe(fmt.money(Math.abs(num)));
  if (!conSigno || num === 0) return base;
  return (num > 0 ? '+' : '-') + base;
}

function cabeceraPDF(doc, titulo, meta) {
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  doc.setFillColor(...PDF_VERDE);
  doc.rect(0, 0, W, 96, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('Finanzas Personales', M, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(219, 235, 227);
  doc.text(titulo, M, 62);
  doc.setFontSize(8.5);
  doc.setTextColor(205, 222, 213);
  doc.splitTextToSize(pdfSafe(meta), W - M * 2).forEach((l, i) => doc.text(l, M, 74 + i * 10));
}

function piePDF(d) {
  const doc = d.doc;
  const pageH = doc.internal.pageSize.getHeight();
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text('Finanzas Personales · Reporte generado automáticamente', M, pageH - 16);
  doc.text(`Página ${d.pageNumber} de ${doc.internal.getNumberOfPages()}`, W - M, pageH - 16, { align: 'right' });
}

function totalesPDF(doc, y0, items) {
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_VERDE);
  doc.text('Totales', M, y0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  let y = y0 + 16;
  items.forEach(([k, v]) => {
    doc.text(pdfSafe(k), M, y);
    doc.text(pdfSafe(String(v)), W - M, y, { align: 'right' });
    y += 13;
  });
  return y;
}

function exportarTxPDF(ultimo) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const M = 40;
  cabeceraPDF(doc, 'Reporte de transacciones', metaReporte(ultimo));

  const head = [['N.º', 'Tipo', 'Usuario', 'Concepto', 'Forma de pago', 'Fecha', 'Monto', 'Estado']];
  const body = ultimo.res.rows.map((t, i) => [
    String(i + 1),
    t.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso',
    t.usuario ? pdfSafe(t.usuario.nombre) : '—',
    pdfSafe(txConcepto(t)),
    t.tipoPago ? pdfSafe(t.tipoPago.descripcion) : '—',
    fmtD(t.fechaTransaccion),
    (t.tipo === 'INGRESO' ? '+' : '-') + monedaPDF(t.monto),
    t.estado === 'ACTIVO' ? 'Activo' : 'Anulado',
  ]);

  window.autoTable(doc, {
    startY: 116,
    margin: { left: M, right: M },
    head,
    body,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3.5, lineColor: [208, 220, 213], lineWidth: 0.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: PDF_VERDE, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [246, 249, 247] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 26 },
      1: { halign: 'center', cellWidth: 48 },
      2: { cellWidth: 82 },
      3: { cellWidth: 128 },
      4: { cellWidth: 60 },
      5: { halign: 'center', cellWidth: 58 },
      6: { halign: 'right', cellWidth: 62 },
      7: { halign: 'center', cellWidth: 42 },
    },
    didDrawPage: piePDF,
  });

  totalesPDF(doc, doc.lastAutoTable.finalY + 20, [
    ['Total de registros', ultimo.res.count],
    ['Total ingresos', '+' + monedaPDF(ultimo.res.totalIngresos)],
    ['Total egresos', '-' + monedaPDF(ultimo.res.totalEgresos)],
    ['Balance', monedaPDF(ultimo.res.balance, true)],
  ]);

  doc.save(`reporte-transacciones-${sello()}.pdf`);
}

function exportarCortePDF(ultimo) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const M = 40;
  cabeceraPDF(doc, 'Reporte de cortes mensuales', metaReporte(ultimo, true));

  const head = [['N.º', 'Usuario', 'Período', 'Fecha de corte', 'Balance inicial', 'Total ingresos', 'Total egresos', 'Balance']];
  const body = ultimo.res.rows.map((c, i) => [
    String(i + 1),
    c.usuario ? pdfSafe(c.usuario.nombre) : '—',
    `${c.anio} · ${MESES[c.mes - 1] || c.mes}`,
    fmtD(c.fechaCorte),
    monedaPDF(c.balanceInicial),
    monedaPDF(c.totalIngresos),
    monedaPDF(c.totalEgresos),
    monedaPDF(c.balanceCorte, true),
  ]);

  window.autoTable(doc, {
    startY: 116,
    margin: { left: M, right: M },
    head,
    body,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, lineColor: [208, 220, 213], lineWidth: 0.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: PDF_VERDE, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [246, 249, 247] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 30 },
      1: { cellWidth: 110 },
      2: { cellWidth: 100 },
      3: { halign: 'center', cellWidth: 90 },
      4: { halign: 'right', cellWidth: 95 },
      5: { halign: 'right', cellWidth: 95 },
      6: { halign: 'right', cellWidth: 95 },
      7: { halign: 'right', cellWidth: 95 },
    },
    didDrawPage: piePDF,
  });

  totalesPDF(doc, doc.lastAutoTable.finalY + 20, [
    ['Total de cortes', ultimo.res.count],
    ['Total ingresos', '+' + monedaPDF(ultimo.res.totalIngresos)],
    ['Total egresos', '-' + monedaPDF(ultimo.res.totalEgresos)],
    ['Balance acumulado', monedaPDF(ultimo.res.balance, true)],
  ]);

  doc.save(`reporte-cortes-${sello()}.pdf`);
}
