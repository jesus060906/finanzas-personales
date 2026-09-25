'use strict';

import { toast } from './ui.js';

export const MONEDA_FORMAT = '"RD$" #,##0.00';
const VERDE = '0E4E3C';
const GRIS = '8A8A8A';
const bordeXLSX = {
  top: { style: 'thin', color: { argb: 'FFE2E8E3' } },
  left: { style: 'thin', color: { argb: 'FFE2E8E3' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8E3' } },
  right: { style: 'thin', color: { argb: 'FFE2E8E3' } },
};

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function aExcel(nombre, construir) {
  (async () => {
    const wb = new window.ExcelJS.Workbook();
    construir(wb);
    const buf = await wb.xlsx.writeBuffer();
    descargar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre);
  })().catch((err) => {
    console.error(err);
    toast('No se pudo generar el archivo Excel', 'error');
  });
}

export function fmtD(s) {
  return (s || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1') || 'Todas';
}

export function sello() {
  return new Date().toISOString().slice(0, 10);
}

export function ahoraLegible() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${fmtD(d.toISOString().slice(0, 10))} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function metaGenerado(desde, hasta, extra) {
  return ['Generado: ' + ahoraLegible(), `Desde: ${fmtD(desde)} · Hasta: ${fmtD(hasta)}`, ...(extra || [])].join(' · ');
}

export function cabeceraXLSX(ws, titulo, meta) {
  const C = ws.columns.length;
  const marca = ws.addRow(['Finanzas Personales']);
  ws.mergeCells(1, 1, 1, C);
  marca.getCell(1).font = { bold: true, size: 16, color: { argb: VERDE } };
  marca.getCell(1).alignment = { horizontal: 'center' };

  const sub = ws.addRow([titulo]);
  ws.mergeCells(2, 1, 2, C);
  sub.getCell(1).font = { size: 12, color: { argb: 'FF555555' } };
  sub.getCell(1).alignment = { horizontal: 'center' };

  const metaRow = ws.addRow([meta]);
  ws.mergeCells(3, 1, 3, C);
  metaRow.getCell(1).font = { size: 9, color: { argb: GRIS } };
  metaRow.getCell(1).alignment = { horizontal: 'center' };

  ws.addRow([]);
}

export function encabezadoXLSX(ws, head) {
  const r = ws.addRow(head);
  r.height = 22;
  r.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = bordeXLSX;
  });
  return r;
}

export function filaXLSX(ws, celdas, alineaciones) {
  const r = ws.addRow(celdas);
  r.height = 18;
  r.eachCell((c, col) => {
    c.border = bordeXLSX;
    c.alignment = { vertical: 'middle', horizontal: alineaciones[col - 1] || 'left' };
  });
  return r;
}

export function totalRowXLSX(ws, label, value, esDinero = true) {
  const r = ws.addRow([label, value]);
  r.getCell(1).font = { bold: true, size: 10, color: { argb: VERDE } };
  r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  r.getCell(2).font = { bold: true, size: 10 };
  r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
  r.getCell(2).numFmt = esDinero ? MONEDA_FORMAT : '0';
  return r;
}