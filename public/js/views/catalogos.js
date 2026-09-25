'use strict';

import API from '../api.js';
import { esc, ic, toast, modal, confirmar, badgeEstado, selectOptions } from '../ui.js';

const CATALOGOS = {
  'tipos-egresos': { id: 'tipos-egresos', titulo: 'Tipos de Egresos', descripcion: 'Clasificación de los egresos definidos', tipo: 'simple' },
  'tipos-ingresos': { id: 'tipos-ingresos', titulo: 'Tipos de Ingresos', descripcion: 'Clasificación de los ingresos definidos', tipo: 'simple' },
  'tipos-pago': { id: 'tipos-pago', titulo: 'Tipos de Pago', descripcion: 'Formas de pago disponibles', tipo: 'simple' },
  egresos: { id: 'egresos', titulo: 'Egresos Definidos', descripcion: 'Egresos predefinidos con tipo, renglón y pago por defecto', tipo: 'egresos' },
  ingresos: { id: 'ingresos', titulo: 'Ingresos Definidos', descripcion: 'Ingresos predefinidos con tipo e institución', tipo: 'ingresos' },
};

export async function render(el, ctx, catalogId) {
  const cfg = CATALOGOS[catalogId] || CATALOGOS['tipos-egresos'];

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>${cfg.titulo}</h3>
          <p>${cfg.descripcion}</p>
        </div>
      </div>
      <div id="catalogo-body">${spinner()}</div>
    </div>
  `;

  async function cargar() {
    const body = el.querySelector('#catalogo-body');
    body.innerHTML = spinner();
    try {
      if (cfg.tipo === 'egresos') {
        const [rows, tipos, renglones, pagos] = await Promise.all([
          API.get('/catalogos/egresos'),
          API.get('/catalogos/tipos-egresos'),
          API.get('/catalogos/renglones'),
          API.get('/catalogos/tipos-pago'),
        ]);
        body.innerHTML = tablaEgresos(rows);
        bindEgresos(body, rows, tipos, renglones, pagos, cargar);
      } else if (cfg.tipo === 'ingresos') {
        const [rows, tipos] = await Promise.all([
          API.get('/catalogos/ingresos'),
          API.get('/catalogos/tipos-ingresos'),
        ]);
        body.innerHTML = tablaIngresos(rows);
        bindIngresos(body, rows, tipos, cargar);
      } else {
        const rows = await API.get(`/catalogos/${cfg.id}`);
        body.innerHTML = tablaSimple(cfg.id, rows);
        bindSimple(body, cfg.id, rows, cargar);
      }
    } catch (err) {
      body.innerHTML = `<p style="padding:24px;color:var(--danger)">${esc(err.message)}</p>`;
    }
  }

  await cargar();
}

function tablaSimple(catalogId, rows) {
  return `
    <form id="form-simple" class="toolbar" autocomplete="off">
      <input name="descripcion" style="min-width:260px;padding:10px 13px;border:1.5px solid var(--border);border-radius:9px;font-family:inherit;font-size:.88rem" autocomplete="off" placeholder="Nueva descripción…" required />
      <button class="btn btn-primary" type="submit">${ic.plus} Agregar</button>
      <span class="spacer"></span>
      <span class="badge muted">${rows.length} registros</span>
    </form>
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>ID</th><th>Descripción</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead>
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
            </tr>`).join('') || '<tr><td class="empty" colspan="4">Sin registros.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function bindSimple(scope, catalogId, rows, alGuardar) {
  scope.querySelector('#form-simple').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      await API.post(`/catalogos/${catalogId}`, { descripcion: fd.get('descripcion').trim(), estado: 'ACTIVO' });
      toast('Registro agregado.');
      alGuardar();
    } catch (err) { toast(err.message, 'error'); }
  };
  scope.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => {
      const row = rows.find((r) => r.id === Number(b.dataset.edit));
      const html = `
        <form id="form-simple-edit" class="grid-form" autocomplete="off">
          <div class="field field-full">
            <label>Descripción</label>
            <input name="descripcion" value="${esc(row.descripcion)}" autocomplete="off" required />
          </div>
          <div class="field">
            <label>Estado</label>
            <select name="estado">
              <option value="ACTIVO" ${row.estado === 'ACTIVO' ? 'selected' : ''}>Activo</option>
              <option value="INACTIVO" ${row.estado === 'INACTIVO' ? 'selected' : ''}>Inactivo</option>
            </select>
          </div>
          <div class="field field-full"><button class="btn btn-primary" type="submit">Guardar cambios</button></div>
        </form>`;
      modal('Editar registro', html, async (fd) => {
        await API.put(`/catalogos/${catalogId}/${row.id}`, { descripcion: fd.get('descripcion').trim(), estado: fd.get('estado') });
        toast('Registro actualizado.');
        alGuardar();
      });
    };
  });
  scope.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => confirmar(`¿Desactivar "${b.dataset.nom}"?`, async () => {
      try {
        await API.del(`/catalogos/${catalogId}/${b.dataset.del}`);
        toast('Registro desactivado.');
        alGuardar();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

function tablaEgresos(rows) {
  return `
    <form id="form-egreso" class="grid-form" style="padding-bottom:18px;border-bottom:1px dashed var(--border);margin-bottom:16px" autocomplete="off">
      <div class="field">
        <label>Tipo de egreso</label>
        <select name="tipoEgresoId" id="eg-tipoEgresoId" required></select>
      </div>
      <div class="field">
        <label>Renglón</label>
        <select name="renglonId" id="eg-renglonId" required></select>
      </div>
      <div class="field">
        <label>Tipo de pago por defecto</label>
        <select name="tipoPagoDefectoId" id="eg-tipoPagoDefectoId" required></select>
      </div>
      <div class="field">
        <label>Descripción</label>
        <input name="descripcion" autocomplete="off" placeholder="Ej: Compra Supermercado" required maxlength="200" />
      </div>
      <div class="field">
        <label>&nbsp;</label>
        <button class="btn btn-primary" type="submit">${ic.plus} Agregar egreso</button>
      </div>
    </form>
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>ID</th><th>Descripción</th><th>Tipo</th><th>Renglón</th><th>Pago def.</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead>
        <tbody>${rows.map((r) => egresoRow(r)).join('') || '<tr><td class="empty" colspan="7">Sin egresos definidos.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function bindEgresos(scope, rows, tipos, renglones, pagos, alGuardar) {
  const llenarSelect = (id, lista) => { document.getElementById(id).innerHTML = selectOptions(lista.filter((x) => x.estado === 'ACTIVO')); };
  llenarSelect('eg-tipoEgresoId', tipos);
  llenarSelect('eg-renglonId', renglones);
  llenarSelect('eg-tipoPagoDefectoId', pagos);

  scope.querySelector('#form-egreso').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.post('/catalogos/egresos', {
        tipoEgresoId: Number(fd.get('tipoEgresoId')),
        renglonId: Number(fd.get('renglonId')),
        tipoPagoDefectoId: Number(fd.get('tipoPagoDefectoId')),
        descripcion: fd.get('descripcion').trim(),
        estado: 'ACTIVO',
      });
      toast('Egreso agregado.');
      alGuardar();
    } catch (err) { toast(err.message, 'error'); }
  };

  scope.querySelectorAll('[data-editeg]').forEach((b) => {
    b.onclick = () => {
      const row = rows.find((r) => r.id === Number(b.dataset.editeg));
      const html = `
        <form id="form-egreso-edit" class="grid-form" autocomplete="off">
          <div class="field field-full">
            <label>Descripción</label>
            <input name="descripcion" value="${esc(row.descripcion)}" autocomplete="off" required />
          </div>
          <div class="field">
            <label>Tipo de egreso</label>
            <select name="tipoEgresoId">${selectOptions(tipos, 'id', 'descripcion', row.tipoEgresoId)}</select>
          </div>
          <div class="field">
            <label>Renglón</label>
            <select name="renglonId">${selectOptions(renglones, 'id', 'descripcion', row.renglonId)}</select>
          </div>
          <div class="field">
            <label>Tipo de pago por defecto</label>
            <select name="tipoPagoDefectoId">${selectOptions(pagos, 'id', 'descripcion', row.tipoPagoDefectoId)}</select>
          </div>
          <div class="field">
            <label>Estado</label>
            <select name="estado">
              <option value="ACTIVO" ${row.estado === 'ACTIVO' ? 'selected' : ''}>Activo</option>
              <option value="INACTIVO" ${row.estado === 'INACTIVO' ? 'selected' : ''}>Inactivo</option>
            </select>
          </div>
          <div class="field field-full"><button class="btn btn-primary" type="submit">Guardar cambios</button></div>
        </form>`;
      modal('Editar egreso', html, async (fd) => {
        await API.put(`/catalogos/egresos/${row.id}`, {
          descripcion: fd.get('descripcion').trim(),
          tipoEgresoId: Number(fd.get('tipoEgresoId')),
          renglonId: Number(fd.get('renglonId')),
          tipoPagoDefectoId: Number(fd.get('tipoPagoDefectoId')),
          estado: fd.get('estado'),
        });
        toast('Egreso actualizado.');
        alGuardar();
      });
    };
  });
  scope.querySelectorAll('[data-deleg]').forEach((b) => {
    b.onclick = () => confirmar(`¿Desactivar "${b.dataset.nomeg}"?`, async () => {
      try {
        await API.del(`/catalogos/egresos/${b.dataset.deleg}`);
        toast('Egreso desactivado.');
        alGuardar();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

function tablaIngresos(rows) {
  return `
    <form id="form-ingreso" class="grid-form" style="padding-bottom:18px;border-bottom:1px dashed var(--border);margin-bottom:16px" autocomplete="off">
      <div class="field">
        <label>Tipo de ingreso</label>
        <select name="tipoIngresoId" id="in-tipoIngresoId" required></select>
      </div>
      <div class="field">
        <label>Descripción</label>
        <input name="descripcion" autocomplete="off" placeholder="Ej: Salario Base" required maxlength="200" />
      </div>
      <div class="field">
        <label>Institución / Empleador / Cliente</label>
        <input name="institucion" autocomplete="off" placeholder="Ej: Empresa Demo" maxlength="200" />
      </div>
      <div class="field">
        <label>&nbsp;</label>
        <button class="btn btn-primary" type="submit">${ic.plus} Agregar ingreso</button>
      </div>
    </form>
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>ID</th><th>Descripción</th><th>Tipo</th><th>Institución</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead>
        <tbody>${rows.map((r) => ingresoRow(r)).join('') || '<tr><td class="empty" colspan="6">Sin ingresos definidos.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function bindIngresos(scope, rows, tipos, alGuardar) {
  document.getElementById('in-tipoIngresoId').innerHTML = selectOptions(tipos.filter((x) => x.estado === 'ACTIVO'));

  scope.querySelector('#form-ingreso').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.post('/catalogos/ingresos', {
        tipoIngresoId: Number(fd.get('tipoIngresoId')),
        descripcion: fd.get('descripcion').trim(),
        institucion: fd.get('institucion').trim() || null,
        estado: 'ACTIVO',
      });
      toast('Ingreso agregado.');
      alGuardar();
    } catch (err) { toast(err.message, 'error'); }
  };

  scope.querySelectorAll('[data-editin]').forEach((b) => {
    b.onclick = () => {
      const row = rows.find((r) => r.id === Number(b.dataset.editin));
      const html = `
        <form id="form-ingreso-edit" class="grid-form" autocomplete="off">
          <div class="field">
            <label>Descripción</label>
            <input name="descripcion" value="${esc(row.descripcion)}" autocomplete="off" required />
          </div>
          <div class="field">
            <label>Tipo de ingreso</label>
            <select name="tipoIngresoId">${selectOptions(tipos, 'id', 'descripcion', row.tipoIngresoId)}</select>
          </div>
          <div class="field">
            <label>Institución / Empleador / Cliente</label>
            <input name="institucion" autocomplete="off" value="${esc(row.institucion || '')}" />
          </div>
          <div class="field">
            <label>Estado</label>
            <select name="estado">
              <option value="ACTIVO" ${row.estado === 'ACTIVO' ? 'selected' : ''}>Activo</option>
              <option value="INACTIVO" ${row.estado === 'INACTIVO' ? 'selected' : ''}>Inactivo</option>
            </select>
          </div>
          <div class="field field-full"><button class="btn btn-primary" type="submit">Guardar cambios</button></div>
        </form>`;
      modal('Editar ingreso', html, async (fd) => {
        await API.put(`/catalogos/ingresos/${row.id}`, {
          descripcion: fd.get('descripcion').trim(),
          tipoIngresoId: Number(fd.get('tipoIngresoId')),
          institucion: fd.get('institucion').trim() || null,
          estado: fd.get('estado'),
        });
        toast('Ingreso actualizado.');
        alGuardar();
      });
    };
  });
  scope.querySelectorAll('[data-delin]').forEach((b) => {
    b.onclick = () => confirmar(`¿Desactivar "${b.dataset.nomin}"?`, async () => {
      try {
        await API.del(`/catalogos/ingresos/${b.dataset.delin}`);
        toast('Ingreso desactivado.');
        alGuardar();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

function egresoRow(r) {
  return `
    <tr>
      <td class="mono">${r.id}</td>
      <td><strong>${esc(r.descripcion)}</strong></td>
      <td>${esc(r.tipoEgreso ? r.tipoEgreso.descripcion : '—')}</td>
      <td>${esc(r.renglon ? r.renglon.descripcion : '—')}</td>
      <td>${esc(r.tipoPagoDefecto ? r.tipoPagoDefecto.descripcion : '—')}</td>
      <td>${badgeEstado(r.estado)}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-outline btn-sm" data-editeg="${r.id}" title="Editar">${ic.edit}</button>
        ${r.estado === 'ACTIVO' ? `<button class="btn btn-danger btn-sm" data-deleg="${r.id}" data-nomeg="${esc(r.descripcion)}" title="Desactivar">${ic.ban}</button>` : ''}
      </td>
    </tr>`;
}

function ingresoRow(r) {
  return `
    <tr>
      <td class="mono">${r.id}</td>
      <td><strong>${esc(r.descripcion)}</strong></td>
      <td>${esc(r.tipoIngreso ? r.tipoIngreso.descripcion : '—')}</td>
      <td>${esc(r.institucion || '—')}</td>
      <td>${badgeEstado(r.estado)}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-outline btn-sm" data-editin="${r.id}" title="Editar">${ic.edit}</button>
        ${r.estado === 'ACTIVO' ? `<button class="btn btn-danger btn-sm" data-delin="${r.id}" data-nomin="${esc(r.descripcion)}" title="Desactivar">${ic.ban}</button>` : ''}
      </td>
    </tr>`;
}

function spinner() {
  return '<div style="text-align:center;padding:50px;color:var(--texto-muy-suave)">Cargando…</div>';
}