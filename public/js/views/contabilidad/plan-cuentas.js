'use strict';

import API from '../../api.js';
import { esc, ic, toast, modal, confirmar } from '../../ui.js';
import { spinner, badgeEstado, TIPOS_CUENTA, selectCuentas, errorBox, vacio } from './comun.js';

export async function render(el, ctx) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Plan de Cuentas</h3>
          <p>Catálogo contable de la empresa</p>
        </div>
        <button class="btn btn-primary" id="btn-nueva-cuenta">${ic.plus} Nueva cuenta</button>
      </div>
      <div id="plan-body">${spinner()}</div>
    </div>
  `;

  const body = el.querySelector('#plan-body');

  el.querySelector('#btn-nueva-cuenta').onclick = () => abrirModal(null, cargar);

  async function cargar() {
    body.innerHTML = spinner();
    try {
      const rows = await API.get('/contabilidad/cuentas');
      if (!rows.length) {
        body.innerHTML = '<p style="padding:24px;color:var(--texto-suave)">Aún no hay cuentas. Crea la primera con "Nueva cuenta".</p>';
        return;
      }
      const niveles = nivelesDe(rows);
      body.innerHTML = tabla(rows, niveles);
      bind(body, rows, cargar);
    } catch (err) {
      body.innerHTML = errorBox(err.message);
    }
  }

  await cargar();
}

function nivelesDe(cuentas) {
  const mapa = new Map(cuentas.map((c) => [c.id, c]));
  const nivel = new Map();
  const profundidad = (id) => {
    if (nivel.has(id)) return nivel.get(id);
    const c = mapa.get(id);
    if (!c || !c.padreId) return 0;
    const p = 1 + profundidad(c.padreId);
    nivel.set(id, p);
    return p;
  };
  cuentas.forEach((c) => profundidad(c.id));
  return nivel;
}

function tabla(rows, niveles) {
  return `
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead>
        <tbody>
          ${rows.map((r) => {
            const nivel = niveles.get(r.id) || 0;
            const indent = `<span style="display:inline-block;width:${nivel * 22}px"></span>`;
            return `
              <tr>
                <td class="mono">${indent}${esc(r.codigo)}</td>
                <td><strong>${esc(r.nombre)}</strong>${r.padre ? `<small style="color:var(--texto-muy-suave)"> · bajo ${esc(r.padre.codigo)}</small>` : ''}</td>
                <td>${tipoBadge(r.tipo)}</td>
                <td>${badgeEstado(r.estado)}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn btn-outline btn-sm" data-editcuenta="${r.id}" title="Editar">${ic.edit}</button>
                  <button class="btn btn-danger btn-sm" data-delcuenta="${r.id}" data-nom="${esc(`${r.codigo} — ${r.nombre}`)}" title="Eliminar">${ic.ban}</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function tipoBadge(tipo) {
  const mapa = { ACTIVO: 'ok', PASIVO: 'no', PATRIMONIO: 'gold', INGRESO: 'ok', GASTO: 'no' };
  return `<span class="badge ${mapa[tipo] || 'muted'}">${esc(tipo)}</span>`;
}

function bind(scope, rows, alGuardar) {
  scope.querySelectorAll('[data-editcuenta]').forEach((b) => {
    b.onclick = () => {
      const r = rows.find((x) => x.id === Number(b.dataset.editcuenta));
      abrirModal(r, alGuardar);
    };
  });
  scope.querySelectorAll('[data-delcuenta]').forEach((b) => {
    b.onclick = () => confirmar(`¿Eliminar la cuenta "${b.dataset.nom}"?`, async () => {
      try {
        await API.del(`/contabilidad/cuentas/${b.dataset.delcuenta}`);
        toast('Cuenta eliminada.');
        alGuardar();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

async function abrirModal(cuenta, alGuardar) {
  const cuentas = await API.get('/contabilidad/cuentas').catch(() => []);
  const disponibles = cuentas.filter((c) => !cuenta || Number(c.id) !== Number(cuenta.id));
  const esEdicion = !!cuenta;

  const html = `
    <form id="form-cuenta" class="grid-form" autocomplete="off">
      <div class="field">
        <label>Código</label>
        <input name="codigo" value="${cuenta ? esc(cuenta.codigo) : ''}" autocomplete="off" maxlength="20" required />
      </div>
      <div class="field">
        <label>Nombre</label>
        <input name="nombre" value="${cuenta ? esc(cuenta.nombre) : ''}" autocomplete="off" maxlength="150" required />
      </div>
      <div class="field">
        <label>Tipo</label>
        <select name="tipo">
          ${TIPOS_CUENTA.map((t) => `<option value="${t}" ${cuenta && cuenta.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Cuenta padre</label>
        <select name="padreId">
          <option value="">— Sin padre —</option>
          ${selectCuentas(disponibles, cuenta ? cuenta.padreId : null)}
        </select>
      </div>
      <div class="field">
        <label>Estado</label>
        <select name="estado">
          <option value="ACTIVO" ${!cuenta || cuenta.estado === 'ACTIVO' ? 'selected' : ''}>Activo</option>
          <option value="INACTIVO" ${cuenta && cuenta.estado === 'INACTIVO' ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>
      <div class="field field-full"><button class="btn btn-primary" type="submit">Guardar</button></div>
    </form>`;

  modal(esEdicion ? 'Editar cuenta' : 'Nueva cuenta', html, async (fd) => {
    const datos = {
      codigo: fd.get('codigo').trim(),
      nombre: fd.get('nombre').trim(),
      tipo: fd.get('tipo'),
      estado: fd.get('estado'),
      padreId: fd.get('padreId') || null,
    };
    if (esEdicion) await API.put(`/contabilidad/cuentas/${cuenta.id}`, datos);
    else await API.post('/contabilidad/cuentas', datos);
    toast(esEdicion ? 'Cuenta actualizada.' : 'Cuenta creada.');
    alGuardar();
  });

  const inputCodigo = document.querySelector('#form-cuenta [name="codigo"]');
  inputCodigo.setAttribute('inputmode', 'decimal');
  inputCodigo.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const teclasNavegacion = ['Tab', 'Enter', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (teclasNavegacion.includes(e.key)) return;
    if (/^[0-9]$/.test(e.key)) return;
    if (e.key === '.') return;
    e.preventDefault();
  });
  inputCodigo.addEventListener('input', () => {
    inputCodigo.value = inputCodigo.value.replace(/[^0-9.]/g, '');
  });
}