'use strict';

import API from '../../api.js';
import { esc, ic, toast, modal, confirmar, fmt } from '../../ui.js';
import { spinner, badgeEstado, selectCuentas, errorBox, vacio } from './comun.js';

export async function render(el, ctx) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Asientos Contables</h3>
          <p>Registros de partida doble de la empresa</p>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-asiento">${ic.plus} Nuevo asiento</button>
      </div>
      <div id="asientos-body">${spinner()}</div>
    </div>
  `;

  const body = el.querySelector('#asientos-body');

  el.querySelector('#btn-nuevo-asiento').onclick = () => abrirModal(null, cargar);

  async function cargar() {
    body.innerHTML = spinner();
    try {
      const rows = await API.get('/contabilidad/asientos');
      body.innerHTML = tabla(rows);
      bind(body, rows, cargar);
    } catch (err) {
      body.innerHTML = errorBox(err.message);
    }
  }

  await cargar();
}

function totAsiento(a, campo) {
  return (a.lineas || []).reduce((s, l) => s + Number(l[campo] || 0), 0);
}

function tabla(rows) {
  return `
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>Nº</th><th>Fecha</th><th>Concepto</th><th style="text-align:right">Débito</th><th style="text-align:right">Crédito</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead>
        <tbody>
          ${rows.map((a) => {
            const deb = totAsiento(a, 'debe');
            const hab = totAsiento(a, 'haber');
            return `
              <tr>
                <td class="mono">${esc(a.numero)}</td>
                <td class="mono">${esc(a.fecha)}</td>
                <td>
                  <strong>${esc(a.concepto)}</strong>
                  <button class="btn btn-outline btn-sm" data-togglelineas="${a.id}" title="Ver líneas" style="margin-left:8px">${a.lineas.length} líneas</button>
                </td>
                <td style="text-align:right" class="mono">${fmt.money(deb)}</td>
                <td style="text-align:right" class="mono">${fmt.money(hab)}</td>
                <td>${badgeEstado(a.estado)}</td>
                <td style="text-align:right;white-space:nowrap">
                  ${a.estado === 'ACTIVO' ? `
                    <button class="btn btn-outline btn-sm" data-editasiento="${a.id}" title="Editar">${ic.edit}</button>
                    <button class="btn btn-danger btn-sm" data-anulaasiento="${a.id}" data-nom="${esc(a.numero)}" title="Anular">${ic.ban}</button>
                  ` : ''}
                </td>
              </tr>
              <tr class="fila-detalle" data-detalle="${a.id}" hidden>
                <td colspan="7" style="background:var(--surface-2)">
                  <table class="tbl" style="margin:0">
                    <thead><tr><th>Cuenta</th><th>Detalle</th><th style="text-align:right">Débito</th><th style="text-align:right">Crédito</th></tr></thead>
                    <tbody>
                      ${(a.lineas || []).map((l) => `
                        <tr>
                          <td class="mono">${esc(l.cuenta ? `${l.cuenta.codigo} — ${l.cuenta.nombre}` : '—')}</td>
                          <td>${esc(l.descripcion || '—')}</td>
                          <td style="text-align:right" class="mono">${Number(l.debe) ? fmt.money(l.debe) : ''}</td>
                          <td style="text-align:right" class="mono">${Number(l.haber) ? fmt.money(l.haber) : ''}</td>
                        </tr>`).join('')}
                    </tbody>
                  </table>
                </td>
              </tr>`;
          }).join('') || vacio('Sin asientos registrados.', 7)}
        </tbody>
      </table>
    </div>`;
}

function bind(scope, rows, alGuardar) {
  scope.querySelectorAll('[data-togglelineas]').forEach((b) => {
    b.onclick = () => {
      const detalle = scope.querySelector(`[data-detalle="${b.dataset.togglelineas}"]`);
      detalle.hidden = !detalle.hidden;
    };
  });
  scope.querySelectorAll('[data-editasiento]').forEach((b) => {
    b.onclick = () => {
      const a = rows.find((x) => x.id === Number(b.dataset.editasiento));
      abrirModal(a, alGuardar);
    };
  });
  scope.querySelectorAll('[data-anulaasiento]').forEach((b) => {
    b.onclick = () => confirmar(`¿Anular el asiento ${b.dataset.nom}? Se conservará en el registro como ANULADO.`, async () => {
      try {
        await API.patch(`/contabilidad/asientos/${b.dataset.anulaasiento}/anular`);
        toast('Asiento anulado.');
        alGuardar();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

async function abrirModal(asiento, alGuardar) {
  const [cuentas, periodos] = await Promise.all([
    API.get('/contabilidad/cuentas').catch(() => []),
    API.get('/contabilidad/periodos').catch(() => []),
  ]);
  const esEdicion = !!asiento;
  const lineasDefault = asiento ? asiento.lineas.map((l) => ({ cuentaId: l.cuentaId, descripcion: l.descripcion, debe: Number(l.debe), haber: Number(l.haber) })) : [];

  const html = `
    <form id="form-asiento" class="grid-form" autocomplete="off">
      <div class="field">
        <label>Fecha</label>
        <input name="fecha" type="date" autocomplete="off" value="${asiento ? asiento.fecha : hoy()}" required />
      </div>
      <div class="field field-full">
        <label>Concepto</label>
        <input name="concepto" value="${asiento ? esc(asiento.concepto) : ''}" autocomplete="off" maxlength="255" required />
      </div>
      <div class="field field-full">
        <label>Período contable (opcional)</label>
        <select name="periodoId" id="asiento-periodo">
          <option value="">— Sin período —</option>
          ${periodos.map((p) => `<option value="${p.id}" ${asiento && Number(asiento.periodoId) === p.id ? 'selected' : ''}>${esc(p.nombre)} (${esc(p.estado)})</option>`).join('')}
        </select>
      </div>
      <div class="field field-full">
        <div class="lineas-head">
          <label>Líneas contables (partida doble)</label>
          <button type="button" class="btn btn-add-linea" id="btn-agregar-linea">${ic.plus} Agregar línea</button>
        </div>
        <div class="lineas-panel">
          <div class="lineas-grid lineas-grid--header" aria-hidden="true">
            <span>Cuenta</span>
            <span>Detalle</span>
            <span>Débito</span>
            <span>Crédito</span>
            <span></span>
          </div>
          <div id="lineas-editor"></div>
        </div>
        <div class="lineas-totales">
          <span class="lt-label lt-title">Totales</span>
          <span style="flex:1"></span>
          <div class="lt-item"><span class="lt-label">Débito</span><strong class="mono" id="total-debe">0.00</strong></div>
          <div class="lt-item"><span class="lt-label">Crédito</span><strong class="mono" id="total-haber">0.00</strong></div>
          <span id="lineas-cuadre"></span>
        </div>
      </div>
      <div class="field field-full"><button class="btn btn-primary" type="submit">${esEdicion ? 'Guardar cambios' : 'Registrar asiento'}</button></div>
    </form>`;

  modal(esEdicion ? `Editar asiento ${asiento.numero}` : 'Nuevo asiento', html, async () => {
    const lineas = leerLineas();
    if (lineas.length < 2) throw new Error('El asiento debe tener al menos dos líneas.');
    const totalDebe = lineas.reduce((s, l) => s + (l.debe || 0), 0);
    const totalHaber = lineas.reduce((s, l) => s + (l.haber || 0), 0);
    if (Math.abs(totalDebe - totalHaber) > 0.009) {
      throw new Error(`El asiento no cuadra: total débitos (${totalDebe.toFixed(2)}) debe ser igual a total créditos (${totalHaber.toFixed(2)}).`);
    }
    const datos = {
      fecha: document.querySelector('#form-asiento [name="fecha"]').value,
      concepto: document.querySelector('#form-asiento [name="concepto"]').value.trim(),
      periodoId: document.querySelector('#form-asiento [name="periodoId"]').value || null,
      lineas,
    };
    if (esEdicion) await API.put(`/contabilidad/asientos/${asiento.id}`, datos);
    else await API.post('/contabilidad/asientos', datos);
    toast(esEdicion ? 'Asiento actualizado.' : 'Asiento registrado.');
    alGuardar();
  });

  const editor = document.getElementById('lineas-editor');
  const agrega = (linea) => editor.insertAdjacentHTML('beforeend', lineaRow(cuentas, linea));
  document.getElementById('btn-agregar-linea').onclick = () => agrega(null);
  (lineasDefault.length ? lineasDefault : [null, null]).forEach(agrega);
  editor.addEventListener('click', (e) => {
    if (e.target.classList.contains('l-remove')) e.target.closest('.linea-row').remove();
  });
  editor.addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('l-debe') && !e.target.classList.contains('l-haber')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const teclasNavegacion = ['Tab', 'Enter', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (teclasNavegacion.includes(e.key)) return;
    if (/^[0-9]$/.test(e.key)) return;
    if (e.key === '.' && !e.target.value.includes('.')) return;
    e.preventDefault();
  });
  editor.addEventListener('input', (e) => {
    if (e.target.classList.contains('l-debe') || e.target.classList.contains('l-haber')) {
      let valor = e.target.value.replace(/[^0-9.]/g, '');
      const punto = valor.indexOf('.');
      if (punto !== -1) valor = valor.slice(0, punto + 1) + valor.slice(punto + 1).replace(/\./g, '');
      e.target.value = valor;
    }
    actualizarTotales();
  });
  actualizarTotales();
}

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function lineaRow(cuentas, linea = null) {
  return `
    <div class="linea-row lineas-grid">
      <select class="l-cuenta" title="Cuenta contable">${selectCuentas(cuentas, linea ? linea.cuentaId : null)}</select>
      <input class="l-desc" autocomplete="off" placeholder="Detalle (opcional)" value="${linea && linea.descripcion ? esc(linea.descripcion) : ''}" />
      <input class="l-debe" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${linea && linea.debe ? linea.debe : ''}" />
      <input class="l-haber" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${linea && linea.haber ? linea.haber : ''}" />
      <button type="button" class="btn l-remove" title="Quitar línea">&times;</button>
    </div>`;
}

function leerLineas() {
  return Array.from(document.querySelectorAll('#lineas-editor .linea-row')).map((row) => ({
    cuentaId: Number(row.querySelector('.l-cuenta').value),
    descripcion: row.querySelector('.l-desc').value.trim() || null,
    debe: Number(row.querySelector('.l-debe').value || 0),
    haber: Number(row.querySelector('.l-haber').value || 0),
  }));
}

function actualizarTotales() {
  const lineas = leerLineas();
  const deb = lineas.reduce((s, l) => s + l.debe, 0);
  const hab = lineas.reduce((s, l) => s + l.haber, 0);
  const elDebe = document.getElementById('total-debe');
  const elHaber = document.getElementById('total-haber');
  const elCuadre = document.getElementById('lineas-cuadre');
  if (!elDebe) return;
  elDebe.textContent = deb.toFixed(2);
  elHaber.textContent = hab.toFixed(2);
  const cuadra = Math.abs(deb - hab) < 0.009;
  elCuadre.innerHTML = deb > 0 || hab > 0
    ? `<span class="badge ${cuadra ? 'ok' : 'no'}">${cuadra ? 'Cuadra' : 'No cuadra'}</span>`
    : '';
}