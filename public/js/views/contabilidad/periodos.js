'use strict';

import API from '../../api.js';
import { esc, ic, toast, modal, confirmar } from '../../ui.js';
import { spinner, badgeEstado, errorBox, vacio } from './comun.js';

export async function render(el, ctx) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Períodos Contables</h3>
          <p>Rangos de fecha ABIERTOS / CERRADOS para registrar asientos</p>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-periodo">${ic.plus} Nuevo período</button>
      </div>
      <div id="periodos-body">${spinner()}</div>
    </div>
  `;

  const body = el.querySelector('#periodos-body');

  el.querySelector('#btn-nuevo-periodo').onclick = () => abrirModal(null, cargar);

  async function cargar() {
    body.innerHTML = spinner();
    try {
      const rows = await API.get('/contabilidad/periodos');
      if (!rows.length) {
        body.innerHTML = '<p style="padding:24px;color:var(--texto-suave)">Aún no hay períodos. Crea el primero con "Nuevo período".</p>';
        return;
      }
      body.innerHTML = tabla(rows);
      bind(body, rows, cargar);
    } catch (err) {
      body.innerHTML = errorBox(err.message);
    }
  }

  await cargar();
}

function tabla(rows) {
  return `
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>Nombre</th><th>Inicio</th><th>Fin</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead>
        <tbody>
          ${rows.map((p) => `
            <tr>
              <td><strong>${esc(p.nombre)}</strong></td>
              <td class="mono">${esc(p.fechaInicio)}</td>
              <td class="mono">${esc(p.fechaFin)}</td>
              <td>${badgeEstado(p.estado)}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn btn-outline btn-sm" data-editperiodo="${p.id}" title="Editar">${ic.edit}</button>
                ${p.estado === 'ABIERTO'
                  ? `<button class="btn btn-danger btn-sm" data-estado="${p.id}" data-nom="${esc(p.nombre)}" data-est="CERRADO" title="Cerrar período">${ic.ban} Cerrar</button>`
                  : `<button class="btn btn-primary btn-sm" data-estado="${p.id}" data-nom="${esc(p.nombre)}" data-est="ABIERTO" title="Reabrir período">Reabrir</button>`}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function bind(scope, rows, alGuardar) {
  scope.querySelectorAll('[data-editperiodo]').forEach((b) => {
    b.onclick = () => {
      const p = rows.find((x) => x.id === Number(b.dataset.editperiodo));
      abrirModal(p, alGuardar);
    };
  });
  scope.querySelectorAll('[data-estado]').forEach((b) => {
    b.onclick = () => {
      const cerrar = b.dataset.est === 'CERRADO';
      confirmar(cerrar
        ? `¿Cerrar el período "${b.dataset.nom}"? No se podrán registrar, modificar ni anular asientos dentro de este rango.`
        : `¿Reabrir el período "${b.dataset.nom}"?`, async () => {
        try {
          await API.patch(`/contabilidad/periodos/${b.dataset.estado}/estado`, { estado: b.dataset.est });
          toast('Período actualizado.');
          alGuardar();
        } catch (err) { toast(err.message, 'error'); }
      });
    };
  });
}

async function abrirModal(periodo, alGuardar) {
  const esEdicion = !!periodo;
  const html = `
    <form id="form-periodo" class="grid-form" autocomplete="off">
      <div class="field field-full">
        <label>Nombre</label>
        <input name="nombre" value="${periodo ? esc(periodo.nombre) : ''}" autocomplete="off" placeholder="Ej: Enero 2026" maxlength="120" required />
      </div>
      <div class="field">
        <label>Fecha inicial</label>
        <input name="fechaInicio" type="date" autocomplete="off" value="${periodo ? periodo.fechaInicio : ''}" required />
      </div>
      <div class="field">
        <label>Fecha final</label>
        <input name="fechaFin" type="date" autocomplete="off" value="${periodo ? periodo.fechaFin : ''}" required />
      </div>
      <div class="field field-full"><button class="btn btn-primary" type="submit">${esEdicion ? 'Guardar cambios' : 'Crear período'}</button></div>
    </form>`;

  modal(esEdicion ? 'Editar período' : 'Nuevo período', html, async (fd) => {
    const datos = { nombre: fd.get('nombre').trim(), fechaInicio: fd.get('fechaInicio'), fechaFin: fd.get('fechaFin') };
    if (esEdicion) await API.put(`/contabilidad/periodos/${periodo.id}`, datos);
    else await API.post('/contabilidad/periodos', datos);
    toast(esEdicion ? 'Período actualizado.' : 'Período creado.');
    alGuardar();
  });
}