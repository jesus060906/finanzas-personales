'use strict';

import API from '../api.js';
import { esc, ic, toast, modal, confirmar, badgeEstado } from '../ui.js';

export async function render(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Renglones</h3>
          <p>Clasificación funcional que agrupa los egresos</p>
        </div>
        <div class="toolbar" style="margin:0">
          <button class="btn btn-primary" id="btn-nuevo-renglon">${ic.plus} Nuevo renglón</button>
        </div>
      </div>
      <div class="table-wrap" id="tabla-renglones"><div style="padding:50px;text-align:center;color:var(--texto-muy-suave)">Cargando…</div></div>
    </div>
  `;

  el.querySelector('#btn-nuevo-renglon').onclick = () => formulario(null, cargar);

  async function cargar() {
    const wrap = el.querySelector('#tabla-renglones');
    try {
      const rows = await API.get('/catalogos/renglones');
      wrap.innerHTML = `
        <table class="tbl">
          <thead>
            <tr><th>ID</th><th>Descripción</th><th>Estado</th><th style="text-align:right">Acciones</th></tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td class="mono">${r.id}</td>
                <td><strong>${esc(r.descripcion)}</strong></td>
                <td>${badgeEstado(r.estado)}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn btn-outline btn-sm" data-edit="${r.id}" title="Editar">${ic.edit}</button>
                  ${r.estado === 'ACTIVO' ? `<button class="btn btn-danger btn-sm" data-del="${r.id}" data-nom="${esc(r.descripcion)}" title="Desactivar">${ic.ban}</button>` : ''}
                </td>
              </tr>`).join('') || '<tr><td class="empty" colspan="4">Sin renglones.</td></tr>'}
          </tbody>
        </table>`;

      wrap.querySelectorAll('[data-edit]').forEach((b) => {
        b.onclick = () => formulario(rows.find((x) => x.id === Number(b.dataset.edit)), cargar);
      });
      wrap.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => confirmar(`¿Desactivar "${b.dataset.nom}"?`, async () => {
          try {
            await API.del(`/catalogos/renglones/${b.dataset.del}`);
            toast('Renglón desactivado.');
            cargar();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      wrap.innerHTML = `<p style="padding:24px;color:var(--danger)">${esc(err.message)}</p>`;
    }
  }

  function formulario(row, alGuardar) {
    const esEdicion = !!row;
    const html = `
      <form id="form-renglon" class="grid-form" autocomplete="off">
        <div class="field field-full">
          <label>Descripción</label>
          <input name="descripcion" value="${row ? esc(row.descripcion) : ''}" autocomplete="off" placeholder="Ej: Comida" required maxlength="120" />
        </div>
        <div class="field">
          <label>Estado</label>
          <select name="estado">
            <option value="ACTIVO" ${row && row.estado === 'ACTIVO' ? 'selected' : ''}>Activo</option>
            <option value="INACTIVO" ${row && row.estado === 'INACTIVO' ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>
        <div class="field field-full">
          <button class="btn btn-primary" type="submit">${ic.plus} ${esEdicion ? 'Guardar cambios' : 'Crear renglón'}</button>
        </div>
      </form>`;
    modal(esEdicion ? 'Editar renglón' : 'Nuevo renglón', html, async (fd) => {
      const body = { descripcion: fd.get('descripcion').trim(), estado: fd.get('estado') };
      if (esEdicion) {
        await API.put(`/catalogos/renglones/${row.id}`, body);
        toast('Renglón actualizado.');
      } else {
        await API.post('/catalogos/renglones', body);
        toast('Renglón creado.');
      }
      alGuardar();
    });
  }

  await cargar();
}