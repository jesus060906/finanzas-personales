'use strict';

import API from '../api.js';
import { fmt, esc, ic, toast, modal, confirmar, badgeEstado } from '../ui.js';

export async function render(el, ctx) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Gestión de usuarios</h3>
          <p>Usuarios del sistema, límites de egresos y resumen financiero</p>
        </div>
        <div class="toolbar" style="margin:0">
          <button class="btn btn-primary" id="btn-nuevo-usuario">${ic.plus} Nuevo usuario</button>
        </div>
      </div>
      <div class="table-wrap" id="tabla-usuarios"><div style="padding:50px;text-align:center;color:var(--texto-muy-suave)">Cargando…</div></div>
    </div>
  `;

  el.querySelector('#btn-nuevo-usuario').onclick = () => formularioUsuario(ctx, null, cargar);

  async function cargar() {
    const wrap = el.querySelector('#tabla-usuarios');
    try {
      const [usuarios, resumen] = await Promise.all([
        API.get('/usuarios'),
        API.get('/usuarios/resumen'),
      ]);
      const mapa = new Map(resumen.map((r) => [r.id, r]));
      wrap.innerHTML = `
        <table class="tbl">
          <thead>
            <tr>
              <th>Usuario</th><th>Cédula</th><th>Tipo</th><th>Corte</th>
              <th class="num">Límite RD$</th><th class="num">Ingresos</th><th class="num">Egresos</th>
              <th class="num">Balance</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${usuarios.map((u) => {
              const r = mapa.get(u.id) || {};
              return `
              <tr>
                <td><strong>${esc(u.nombre)}</strong><br><small style="color:var(--texto-muy-suave)">${esc(u.email || '—')}</small></td>
                <td class="mono">${esc(u.cedula)}</td>
                <td><span class="badge muted">${u.tipoPersona === 'FISICA' ? 'Física' : 'Jurídica'}</span></td>
                <td>Día ${u.fechaCorte}</td>
                <td class="num">${u.limiteEgresos === null ? '—' : fmt.money(u.limiteEgresos)}</td>
                <td class="num pos">${fmt.money(r.totalIngresos)}</td>
                <td class="num neg">${fmt.money(r.totalEgresos)}</td>
                <td class="num ${r.balance >= 0 ? 'pos' : 'neg'}">${fmt.money(r.balance)}</td>
                <td>${badgeEstado(u.estado)}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn btn-outline btn-sm" data-edit="${u.id}" title="Editar">${ic.edit}</button>
                  <button class="btn ${u.estado === 'ACTIVO' ? 'btn-danger' : 'btn-outline'} btn-sm" data-toggle="${u.id}" data-nombre="${esc(u.nombre)}" data-estado="${u.estado}" title="${u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}">${ic.ban}</button>
                </td>
              </tr>`;
            }).join('') || '<tr><td class="empty" colspan="10">No hay usuarios.</td></tr>'}
          </tbody>
        </table>`;

      wrap.querySelectorAll('[data-edit]').forEach((b) => {
        b.onclick = () => {
          const u = usuarios.find((x) => x.id === Number(b.dataset.edit));
          formularioUsuario(ctx, u, cargar);
        };
      });
      wrap.querySelectorAll('[data-toggle]').forEach((b) => {
        b.onclick = () => {
          const activar = b.dataset.estado === 'INACTIVO';
          confirmar(`¿${activar ? 'Activar' : 'Desactivar'} al usuario "${b.dataset.nombre}"?`, async () => {
            try {
              await API.patch(`/usuarios/${b.dataset.toggle}/anular`);
              toast(`Usuario ${activar ? 'activado' : 'desactivado'}.`);
              cargar();
            } catch (err) {
              toast(err.message, 'error');
            }
          });
        };
      });
    } catch (err) {
      wrap.innerHTML = `<p style="padding:24px;color:var(--danger)">${esc(err.message)}</p>`;
    }
  }

  await cargar();
}

function validarFormatoIdentificador(cedula, tipoPersona) {
  const c = cedula.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(c)) {
    return 'La cédula o RNC solo puede contener dígitos.';
  }
  if (tipoPersona === 'JURIDICA') {
    return /^\d{9}$/.test(c) ? null : 'El RNC debe tener 9 dígitos.';
  }
  return /^\d{11}$/.test(c) ? null : 'La cédula debe tener 11 dígitos.';
}

function formularioUsuario(ctx, usuario, alGuardar) {
  const esEdicion = !!usuario;
  const tipoInicial = usuario ? usuario.tipoPersona : 'FISICA';
  const PISTAS = { FISICA: '001-1234567-3', JURIDICA: '1-30-12345-4' };
  const html = `
    <form id="form-usuario" class="grid-form" autocomplete="off">
      <div class="field">
        <label>Nombre completo</label>
        <input name="nombre" value="${usuario ? esc(usuario.nombre) : ''}" autocomplete="off" required maxlength="150" />
      </div>
      <div class="field">
        <label>Cédula</label>
        <input name="cedula" value="${usuario ? esc(usuario.cedula) : ''}" inputmode="numeric" autocomplete="off" required maxlength="20" placeholder="${PISTAS[tipoInicial]}" title="Cédula: 11 dígitos. RNC: 9 dígitos." />
      </div>
      <div class="field">
        <label>Correo</label>
        <input name="email" type="email" autocomplete="off" value="${usuario ? esc(usuario.email || '') : ''}" />
      </div>
      <div class="field">
        <label>Contraseña</label>
        <input name="password" type="password" autocomplete="new-password" ${esEdicion ? 'placeholder="Dejar en blanco para no cambiar"' : 'required'} minlength="6" />
      </div>
      <div class="field">
        <label>Tipo de persona</label>
        <select name="tipoPersona">
          <option value="FISICA" ${usuario && usuario.tipoPersona === 'FISICA' ? 'selected' : ''}>Física</option>
          <option value="JURIDICA" ${usuario && usuario.tipoPersona === 'JURIDICA' ? 'selected' : ''}>Jurídica</option>
        </select>
      </div>
      <div class="field">
        <label>Día de corte mensual</label>
        <input name="fechaCorte" type="number" min="1" max="28" autocomplete="off" value="${usuario ? usuario.fechaCorte : 1}" required />
      </div>
      <div class="field">
        <label>Límite de egresos (RD$)</label>
        <input name="limiteEgresos" type="number" min="0" step="0.01" autocomplete="off" value="${usuario && usuario.limiteEgresos !== null ? usuario.limiteEgresos : ''}" placeholder="Sin límite" />
      </div>
      <div class="field">
        <label>Rol</label>
        <select name="rol">
          <option value="USUARIO" ${usuario && usuario.rol === 'USUARIO' ? 'selected' : ''}>Usuario</option>
          <option value="ADMIN" ${usuario && usuario.rol === 'ADMIN' ? 'selected' : ''}>Administrador</option>
        </select>
      </div>
      <div class="field field-full">
        <button class="btn btn-primary" type="submit">${ic.plus} ${esEdicion ? 'Guardar cambios' : 'Crear usuario'}</button>
      </div>
    </form>`;

  const back = modal(esEdicion ? 'Editar usuario' : 'Nuevo usuario', html, async (fd) => {
    const tipoPersona = fd.get('tipoPersona');
    const rol = fd.get('rol');
    const cedula = fd.get('cedula').trim();
    if (rol !== 'ADMIN') {
      const errorId = validarFormatoIdentificador(cedula, tipoPersona);
      if (errorId) throw new Error(errorId);
    }

    const body = {
      nombre: fd.get('nombre').trim(),
      cedula,
      email: fd.get('email').trim() || null,
      limiteEgresos: fd.get('limiteEgresos') ? Number(fd.get('limiteEgresos')) : null,
      tipoPersona,
      fechaCorte: Number(fd.get('fechaCorte')),
      rol,
    };
    const pass = fd.get('password');
    if (pass) body.password = pass;

    if (esEdicion) await API.put(`/usuarios/${usuario.id}`, body);
    else await API.post('/usuarios', body);
    toast(esEdicion ? 'Usuario actualizado.' : 'Usuario creado.');
    alGuardar();
  });

  const selTipo = back.querySelector('[name="tipoPersona"]');
  selTipo.addEventListener('change', () => {
    back.querySelector('[name="cedula"]').placeholder = PISTAS[selTipo.value];
  });
}