'use strict';

import API from '../api.js';
import { fmt, esc, ic, toast, badgeEstado, confirmar } from '../ui.js';

let estado = { tipo: 'INGRESO', fijoTipo: '' };
let catUsuarios = [];
const limiteInfo = { monto: null, gastado: 0 };

export async function render(el, ctx, tipoInicial = '') {
  estado.tipo = tipoInicial || 'INGRESO';
  estado.fijoTipo = tipoInicial || '';
  const tituloForm = tipoInicial === 'INGRESO' ? 'Registrar ingreso' : tipoInicial === 'EGRESO' ? 'Registrar egreso' : 'Registrar transacción';
  el.innerHTML = `
    <div class="card" id="tx-form-card">
      <div class="card-header">
        <div>
          <h3>${tituloForm}</h3>
          <p>${tipoInicial === 'INGRESO' ? 'Ingreso vinculado a un usuario y su fuente' : tipoInicial === 'EGRESO' ? 'Egreso vinculado a un usuario y una categoría' : 'Ingreso o egreso vinculado a un usuario y una categoría'}</p>
        </div>
      </div>
      <form id="tx-form" class="grid-form" autocomplete="off">
        ${tipoInicial ? `
        <div class="field field-full">
          <label>Tipo de transacción (fijo)</label>
          <div class="switch-type" aria-disabled="true">
            <button type="button" class="active ${tipoInicial === 'INGRESO' ? 'ingreso' : 'egreso'}">${tipoInicial === 'INGRESO' ? '+ Ingreso' : '− Egreso'}</button>
          </div>
        </div>` : `
        <div class="field field-full">
          <label>Tipo de transacción</label>
          <div class="switch-type">
            <button type="button" data-tipo="INGRESO" class="active ingreso">+ Ingreso</button>
            <button type="button" data-tipo="EGRESO" class="egreso">− Egreso</button>
          </div>
        </div>`}
        ${ctx.session.rol === 'ADMIN' ? `
        <div class="field">
          <label for="tx-usuario">Usuario</label>
          <select id="tx-usuario" required><option value="">Cargando…</option></select>
        </div>` : ''}
        <div class="field">
          <label id="tx-cat-label">Ingreso</label>
          <select id="tx-cat" required><option value="">Cargando…</option></select>
        </div>
        <div class="field">
          <label for="tx-pago">Tipo de pago</label>
          <select id="tx-pago" required><option value="">Cargando…</option></select>
        </div>
        <div class="field">
          <label for="tx-fecha">Fecha de la transacción</label>
          <input id="tx-fecha" type="date" autocomplete="off" required />
        </div>
        <div class="field">
          <label for="tx-monto">Monto (RD$)</label>
          <input id="tx-monto" type="number" min="0.01" step="0.01" autocomplete="off" placeholder="0.00" required />
        </div>
        <div class="field field-full" id="tx-limite-vivo" hidden></div>
        <div class="field">
          <label for="tx-tarjeta">N.º de tarjeta</label>
          <input id="tx-tarjeta" type="text" inputmode="numeric" pattern="[0-9]{15,16}" minlength="15" maxlength="16" title="El número de tarjeta debe contener 15 o 16 dígitos." autocomplete="off" placeholder="Opcional · 15 o 16 dígitos" />
        </div>
        <div class="field field-full">
          <label for="tx-comentario">Comentario</label>
          <input id="tx-comentario" type="text" maxlength="255" autocomplete="off" placeholder="Ej: Mercado mensual" />
        </div>
        <div class="field field-full">
          <button class="btn btn-primary" type="submit">${ic.plus} Guardar transacción</button>
        </div>
      </form>
      <div id="tx-advertencia" hidden></div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Historial de transacciones</h3>
          <p>Últimas 500 registradas</p>
        </div>
        ${tipoInicial ? '' : `
        <div class="toolbar" style="margin:0">
          <select id="filtro-tipo" style="padding:8px 12px;border-radius:9px;border:1.5px solid var(--border);background:var(--surface-2);font-family:inherit;font-size:.84rem;font-weight:600">
            <option value="">Todos los tipos</option>
            <option value="INGRESO">Solo ingresos</option>
            <option value="EGRESO">Solo egresos</option>
          </select>
        </div>`}
      </div>
      <div class="table-wrap" id="tx-table">${spinner()}</div>
    </div>
  `;

  const form = el.querySelector('#tx-form');
  const advertencia = el.querySelector('#tx-advertencia');

  // Carga de catálogos
  const [pagos, egresos, ingresos, ...rest] = await Promise.all([
    API.get('/catalogos/tipos-pago'),
    API.get('/catalogos/egresos'),
    API.get('/catalogos/ingresos'),
    ctx.session.rol === 'ADMIN' ? API.get('/usuarios') : Promise.resolve(null),
  ]);

  const pagoSel = el.querySelector('#tx-pago');
  const egrSel = el.querySelector('#tx-cat');
  pagoSel.innerHTML = '<option value="">Seleccione…</option>' + pagos.filter((p) => p.estado === 'ACTIVO').map((p) => `<option value="${p.id}">${esc(p.descripcion)}</option>`).join('');

  const usuarios = rest[0] || null;
  const usuariosCargables = (usuarios || []).filter((u) => u.estado === 'ACTIVO' && u.rol !== 'ADMIN');
  catUsuarios = usuariosCargables;
  if (usuariosCargables.length) {
    const uSel = el.querySelector('#tx-usuario');
    uSel.innerHTML = usuariosCargables.map((u) => `<option value="${u.id}">${esc(u.nombre)} — ${esc(u.cedula)}</option>`).join('');
    uSel.value = ctx.session.id || '';
    uSel.addEventListener('change', () => cargarContextoLimite(ctx));
  }

  // Switch tipo
  const btns = el.querySelectorAll('.switch-type button');
  const aplicarTipo = () => {
    btns.forEach((b) => {
      if (!b.dataset.tipo) return;
      b.classList.toggle('active', b.dataset.tipo === estado.tipo);
      b.classList.toggle(estado.tipo === 'INGRESO' ? 'ingreso' : 'egreso', b.dataset.tipo === estado.tipo);
    });
    el.querySelector('#tx-cat-label').textContent = estado.tipo === 'INGRESO' ? 'Ingreso (fuente)' : 'Egreso (concepto)';
    const activos = (estado.tipo === 'INGRESO' ? ingresos : egresos).filter((r) => r.estado === 'ACTIVO' || !r.estado);
    egrSel.innerHTML = '<option value="">Seleccione…</option>' + activos.map((r) => {
      const sub = estado.tipo === 'INGRESO'
        ? (r.tipoIngreso ? r.tipoIngreso.descripcion : '')
        : (r.renglon ? r.renglon.descripcion : '');
      return `<option value="${r.id}">${esc(r.descripcion)}${sub ? ` · ${esc(sub)}` : ''}</option>`;
    }).join('');
    aplicarLimiteVivo();
  };
  btns.forEach((b) => {
    if (!b.dataset.tipo) return;
    b.onclick = () => { estado.tipo = b.dataset.tipo; aplicarTipo(); };
  });
  aplicarTipo();

  // Fecha por defecto
  el.querySelector('#tx-fecha').value = new Date().toISOString().slice(0, 10);
  el.querySelector('#tx-monto').addEventListener('input', aplicarLimiteVivo);

  // N.º de tarjeta: solo dígitos, sin letras, espacios ni símbolos
  const tarjetaInput = el.querySelector('#tx-tarjeta');
  tarjetaInput.addEventListener('input', () => {
    const previo = tarjetaInput.value;
    const limpio = previo.replace(/\D/g, '');
    if (limpio === previo) return;
    const cursor = previo.slice(0, tarjetaInput.selectionStart).replace(/\D/g, '').length;
    tarjetaInput.value = limpio;
    tarjetaInput.setSelectionRange(cursor, cursor);
  });

  cargarContextoLimite(ctx);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const esAdmin = ctx.session.rol === 'ADMIN';
    const body = {
      tipo: estado.tipo,
      usuarioId: esAdmin ? Number(el.querySelector('#tx-usuario').value) : ctx.session.id,
      tipoPagoId: Number(pagoSel.value),
      fechaTransaccion: el.querySelector('#tx-fecha').value,
      monto: Number(el.querySelector('#tx-monto').value),
      noTarjeta: tarjetaInput.value.trim() || null,
      comentario: el.querySelector('#tx-comentario').value.trim() || null,
    };
    if (estado.tipo === 'INGRESO') body.ingresoId = Number(egrSel.value);
    else body.egresoId = Number(egrSel.value);

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.textContent = 'Guardando…';
    try {
      const res = await API.post('/transacciones', body);
      toast('Transacción registrada correctamente.');
      el.querySelector('#tx-monto').value = '';
      tarjetaInput.value = '';
      el.querySelector('#tx-comentario').value = '';
      if (res.advertencia) {
        advertencia.hidden = false;
        advertencia.innerHTML = `<div class="alert warn">${ic.alert}<div><strong>Límite de gastos</strong><span>${esc(res.advertencia.mensaje)}</span></div></div>`;
      } else {
        advertencia.hidden = true;
      }
      cargarTabla(ctx);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });

  const filtroTipo = el.querySelector('#filtro-tipo');
  if (filtroTipo) {
    if (tipoInicial) filtroTipo.value = tipoInicial;
    filtroTipo.addEventListener('change', (e) => {
      cargarTabla(ctx, e.target.value);
    });
  }

  cargarTabla(ctx, tipoInicial);
}

async function cargarTabla(ctx, tipo = '') {
  const wrap = document.getElementById('tx-table');
  if (!wrap) return;
  try {
    const todos = await API.get('/transacciones');
    const filas = todos.filter((t) => (tipo ? t.tipo === tipo : true));
    if (!filas.length) {
      wrap.innerHTML = '<table class="tbl"><thead><tr><th>No.</th><th>Tipo</th><th>Usuario</th><th>Concepto</th><th>Pago</th><th>Fecha</th><th class="num">Monto</th><th>Estado</th><th></th></tr></thead><tbody><tr><td class="empty" colspan="9">No hay transacciones que mostrar.</td></tr></tbody></table>';
      return;
    }
    wrap.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>No.</th><th>Tipo</th><th>Usuario</th><th>Concepto</th><th>Pago</th>
            <th>Fecha</th><th class="num">Monto</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${filas.map((t) => txRow(t, ctx)).join('')}
        </tbody>
      </table>`;

    wrap.querySelectorAll('[data-anular]').forEach((b) => {
      b.onclick = () => confirmar(`¿Anular la transacción ${b.dataset.anular}? El monto dejará de contarse en los reportes.`, async () => {
        try {
          await API.patch(`/transacciones/${b.dataset.id}/anular`);
          toast('Transacción anulada.');
          cargarTabla(ctx, elTipo());
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    wrap.innerHTML = `<p style="padding:24px;color:var(--danger)">${esc(err.message)}</p>`;
  }
}

function elTipo() {
  const sel = document.getElementById('filtro-tipo');
  if (sel) return sel.value;
  return estado.fijoTipo || '';
}

async function cargarContextoLimite(ctx) {
  const esAdmin = ctx.session.rol === 'ADMIN';
  const selUsuario = document.getElementById('tx-usuario');
  const usuarioId = esAdmin && selUsuario ? Number(selUsuario.value) : ctx.session.id;

  if (esAdmin) {
    const u = catUsuarios.find((x) => Number(x.id) === usuarioId);
    limiteInfo.monto = u && u.limiteEgresos !== null && u.limiteEgresos !== undefined ? Number(u.limiteEgresos) : null;
  } else {
    limiteInfo.monto = ctx.session.limiteEgresos !== null && ctx.session.limiteEgresos !== undefined ? Number(ctx.session.limiteEgresos) : null;
  }
  limiteInfo.gastado = 0;

  try {
    const h = new Date();
    const mes = String(h.getMonth() + 1).padStart(2, '0');
    const desde = `${h.getFullYear()}-${mes}-01`;
    const hasta = `${h.getFullYear()}-${mes}-${new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate()}`;
    let url = `/reportes/transacciones?tipo=EGRESO&desde=${desde}&hasta=${hasta}`;
    if (esAdmin) url += `&usuarioId=${usuarioId}`;
    const r = await API.get(url);
    limiteInfo.gastado = Number(r.totalEgresos) || 0;
  } catch (_) { /* sin límite no afecta */ }
  aplicarLimiteVivo();
}

function aplicarLimiteVivo() {
  const vive = document.getElementById('tx-limite-vivo');
  const montoInput = document.getElementById('tx-monto');
  if (!vive || !montoInput) return;

  if (estado.tipo !== 'EGRESO' || limiteInfo.monto === null) {
    vive.hidden = true;
    vive.innerHTML = '';
    return;
  }

  const monto = Number(montoInput.value) || 0;
  const limite = limiteInfo.monto;
  if (monto <= 0) {
    vive.hidden = true;
    vive.innerHTML = '';
    return;
  }

  const proyectado = limiteInfo.gastado + monto;
  const disponible = limite - proyectado;
  if (proyectado > limite) {
    vive.hidden = false;
    vive.innerHTML = `
      <div class="alert warn">
        ${ic.alert}
        <div>
          <strong>Alerta de límite superado</strong>
          <span>Este egreso lleva el mes a <b>${fmt.money(proyectado)}</b>, superando tu límite de ${fmt.money(limite)} (${fmt.pct(proyectado, limite)}%). Ya has gastado ${fmt.money(limiteInfo.gastado)} este mes.</span>
        </div>
      </div>`;
  } else {
    vive.hidden = false;
    vive.innerHTML = `
      <div class="alert info">
        <span style="font-size:.9rem">Quedarían <b>${fmt.money(disponible)}</b> disponibles este mes (de ${fmt.money(limite)}). Ya gastado: ${fmt.money(limiteInfo.gastado)}.</span>
      </div>`;
  }
}

function txRow(t, ctx) {
  const concepto = t.tipo === 'INGRESO'
    ? (t.ingreso ? t.ingreso.descripcion : 'Ingreso')
    : (t.egreso ? t.egreso.descripcion : 'Egreso');
  const sub = t.tipo === 'INGRESO'
    ? (t.ingreso && t.ingreso.tipoIngreso ? t.ingreso.tipoIngreso.descripcion : '')
    : (t.egreso && t.egreso.renglon ? t.egreso.renglon.descripcion : '');
  return `
    <tr>
      <td class="mono" style="font-size:.78rem">${esc(t.numero)}</td>
      <td>${badgeTipo(t.tipo)}</td>
      <td>${esc(t.usuario ? t.usuario.nombre : '—')}</td>
      <td>
        <strong>${esc(concepto)}</strong>
        ${sub ? `<br><small style="color:var(--texto-muy-suave)">${esc(sub)}</small>` : ''}
      </td>
      <td>${esc(t.tipoPago ? t.tipoPago.descripcion : '—')}</td>
      <td>${fmt.date(t.fechaTransaccion)}</td>
      <td class="num ${t.tipo === 'INGRESO' ? 'pos' : 'neg'}">${t.tipo === 'INGRESO' ? '+' : '−'}${fmt.money(t.monto)}</td>
      <td>${badgeEstado(t.estado)}</td>
      <td style="text-align:right">
        ${t.estado === 'ACTIVO' ? `<button class="btn btn-ghost btn-sm" data-anular="${esc(t.numero)}" data-id="${t.id}" title="Anular">${ic.ban} Anular</button>` : '—'}
      </td>
    </tr>`;
}

function badgeTipo(tipo) {
  return tipo === 'INGRESO' ? '<span class="badge ok">Ingreso</span>' : '<span class="badge no">Egreso</span>';
}

function spinner() {
  return '<div style="text-align:center;padding:50px;color:var(--texto-muy-suave)">Cargando…</div>';
}