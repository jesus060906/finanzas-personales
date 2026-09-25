'use strict';

import API from '../api.js';
import { fmt, MESES, esc, ic, toast } from '../ui.js';

export async function render(el, ctx) {
  const hoy = new Date();
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Proceso de corte mensual</h3>
          <p>Resume ingresos, egresos y balance según la fecha de corte de cada usuario</p>
        </div>
      </div>
      <div class="toolbar" id="proc-toolbar">
        <div class="field" style="gap:4px">
          <label>Año</label>
          <select id="c-anio" style="padding:10px 12px;border:1.5px solid var(--border);border-radius:9px;font-family:inherit;font-weight:600"></select>
        </div>
        <div class="field" style="gap:4px">
          <label>Mes</label>
          <select id="c-mes" style="padding:10px 12px;border:1.5px solid var(--border);border-radius:9px;font-family:inherit;font-weight:600"></select>
        </div>
        ${ctx.session.rol === 'ADMIN' ? `
        <div class="field" style="gap:4px">
          <label>Usuario</label>
          <select id="c-usuario" style="padding:10px 12px;border:1.5px solid var(--border);border-radius:9px;font-family:inherit;font-weight:600">
            <option value="">Todos los usuarios</option>
          </select>
        </div>` : ''}
        <button class="btn btn-primary" id="btn-procesar" style="align-self:end">${ic.refresh} Procesar corte</button>
      </div>
      <div id="corte-aviso" class="alert warn" hidden>
        ${ic.alert}
        <div></div>
      </div>
      <div id="corte-resultado" hidden></div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Historial de cortes</h3>
          <p>Registros de los cortes procesados</p>
        </div>
      </div>
      <div class="table-wrap" id="corte-historial"><div style="padding:50px;text-align:center;color:var(--texto-muy-suave)">Cargando…</div></div>
    </div>
  `;

  // Llenar selects
  const selAnio = el.querySelector('#c-anio');
  for (let a = hoy.getFullYear(); a >= hoy.getFullYear() - 5; a--) {
    selAnio.add(new Option(a, a));
  }
  selAnio.value = hoy.getFullYear();
  const selMes = el.querySelector('#c-mes');
  MESES.forEach((m, i) => selMes.add(new Option(m, i + 1)));

  // Por defecto se selecciona el período más reciente que ya puede cerrarse.
  const ultimo = ultimoPeriodoCerrable(hoy);
  selAnio.value = String(ultimo.anio);
  selMes.value = ultimo.mes;

  if (ctx.session.rol === 'ADMIN') {
    const usuarios = await API.get('/usuarios').catch(() => []);
    const selU = el.querySelector('#c-usuario');
    usuarios.filter((u) => u.estado === 'ACTIVO').forEach((u) => selU.add(new Option(`${u.nombre} (${u.cedula})`, u.id)));
  }

  selAnio.addEventListener('change', () => actualizarDisponibilidad(el));
  selMes.addEventListener('change', () => actualizarDisponibilidad(el));
  actualizarDisponibilidad(el);

  el.querySelector('#btn-procesar').onclick = async () => {
    const btn = el.querySelector('#btn-procesar');
    btn.disabled = true;
    btn.textContent = 'Procesando…';
    const params = {
      anio: selAnio.value,
      mes: selMes.value,
      usuarioId: ctx.session.rol === 'ADMIN' ? el.querySelector('#c-usuario').value : undefined,
    };
    try {
      const q = [];
      if (params.anio) q.push(`anio=${encodeURIComponent(params.anio)}`);
      if (params.mes) q.push(`mes=${encodeURIComponent(params.mes)}`);
      if (params.usuarioId) q.push(`usuarioId=${encodeURIComponent(params.usuarioId)}`);
      const res = await API.post('/cortes/proceso' + (q.length ? '?' + q.join('&') : ''), {});
      pintarResultado(el, res);
      toast('Corte procesado.');
      cargarHistorial(ctx);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Procesar corte';
    }
  };

  await cargarHistorial(ctx);
}

// Primer día del mes siguiente al período. Como los meses en JS son 0-indexados,
// (anio, mes, 1) apunta al mes siguiente al indicado.
function primerDiaSiguienteMes(anio, mes) {
  return new Date(anio, mes, 1);
}

// Un período solo puede cerrarse cuando ya terminó: hoy >= primer día del mes siguiente.
function esPeriodoCerrable(anio, mes, hoy = new Date()) {
  return hoy >= primerDiaSiguienteMes(anio, mes);
}

// Estado del período respecto a la fecha REAL del sistema: 'pasado', 'curso' o
// 'futuro'. Compara SIEMPRE mes + año (clave = año*12 + mes), nunca solo el mes,
// por lo que se recalcula automáticamente al cambiar el mes del calendario.
function estadoMes(anio, mes, hoy = new Date()) {
  const clave = anio * 12 + (mes - 1);
  const claveHoy = hoy.getFullYear() * 12 + hoy.getMonth();
  if (clave < claveHoy) return 'pasado';
  if (clave === claveHoy) return 'curso';
  return 'futuro';
}

// Último período que puede cerrarse hoy. Si estamos en enero, el último mes
// cerrable es diciembre del año anterior.
function ultimoPeriodoCerrable(hoy = new Date()) {
  if (hoy.getMonth() === 0) return { anio: hoy.getFullYear() - 1, mes: 12 };
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() };
}

function estadoCierreInfo(anio, mes, hoy = new Date()) {
  const estado = estadoMes(anio, mes, hoy);
  if (estado === 'pasado') return { cerrable: true, estado, mensaje: '' };
  const siguiente = primerDiaSiguienteMes(anio, mes);
  const inicio = `El cierre estará disponible a partir del 1 de ${MESES[siguiente.getMonth()].toLowerCase()} de ${siguiente.getFullYear()}. `;
  const cola = 'Mientras tanto, puedes cerrar los meses anteriores que sigan pendientes.';
  const mensaje = estado === 'futuro'
    ? `El mes de ${MESES[mes - 1].toLowerCase()} de ${anio} todavía no ha comenzado. ${inicio}${cola}`
    : `No puedes cerrar el período de ${MESES[mes - 1].toLowerCase()} de ${anio} porque el mes todavía está en curso. ${inicio}${cola}`;
  return { cerrable: false, estado, mensaje };
}

function actualizarDisponibilidad(el) {
  const btn = el.querySelector('#btn-procesar');
  const aviso = el.querySelector('#corte-aviso');
  const anio = Number(el.querySelector('#c-anio').value);
  const mes = Number(el.querySelector('#c-mes').value);
  const info = estadoCierreInfo(anio, mes);

  btn.disabled = !info.cerrable;
  btn.title = info.cerrable ? '' : info.mensaje;
  if (info.cerrable) {
    aviso.hidden = true;
  } else {
    aviso.hidden = false;
    const titulo = info.estado === 'futuro' ? 'Período futuro' : 'Período en curso';
    aviso.querySelector('div').innerHTML = `<strong>${titulo}</strong> ${esc(info.mensaje)}`;
  }
}

function pintarResultado(el, res) {
  const caja = el.querySelector('#corte-resultado');
  const skipCount = res.resultados.filter((r) => r.skip).length;
  const nuevos = res.resultados.filter((r) => !r.skip);
  caja.hidden = false;
  caja.innerHTML = `
    <div class="alert info" style="margin-top:16px">
      ${ic.alert}
      <div>
        <strong>Corte de ${esc(MESES[res.mes - 1])} ${res.anio}</strong>
        ${skipCount ? `Se omitieron ${skipCount} cortes ya existentes.` : 'Todos los cortes del período fueron procesados.'}
        ${nuevos.length ? `Se generaron <b>${nuevos.length}</b> cortes.` : ''}
      </div>
    </div>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr><th>Usuario</th><th>Fecha de corte</th><th class="num">Balance inicial</th>
          <th class="num">Total ingresos</th><th class="num">Total egresos</th><th class="num">Balance al corte</th></tr>
        </thead>
        <tbody>
          ${nuevos.map((n) => `
            <tr>
              <td><strong>${esc(n.usuario)}</strong></td>
              <td>${fmt.date(n.fechaCorte)}</td>
              <td class="num">${fmt.money(n.balanceInicial)}</td>
              <td class="num pos">${fmt.money(n.totalIngresos)}</td>
              <td class="num neg">${fmt.money(n.totalEgresos)}</td>
              <td class="num ${n.balanceCorte >= 0 ? 'pos' : 'neg'}"><strong>${fmt.money(n.balanceCorte)}</strong></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function cargarHistorial(ctx) {
  const wrap = document.getElementById('corte-historial');
  if (!wrap) return;
  try {
    const res = await API.get('/cortes');
    const rows = res;
    wrap.innerHTML = rows.length ? `
      <table class="tbl">
        <thead>
          <tr><th>Usuario</th><th>Período</th><th>Fecha corte</th><th class="num">Balance inicial</th>
          <th class="num">Ingresos</th><th class="num">Egresos</th><th class="num">Balance</th></tr>
        </thead>
        <tbody>
          ${rows.map((c) => `
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
      </table>` : '<p style="padding:24px;color:var(--texto-muy-suave)">Aún no hay cortes procesados.</p>';
  } catch (err) {
    wrap.innerHTML = `<p style="padding:24px;color:var(--danger)">${esc(err.message)}</p>`;
  }
}