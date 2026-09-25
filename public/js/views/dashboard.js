'use strict';

import API from '../api.js';
import { fmt, MESES, esc, ic, badgeEstado, badgeTipo } from '../ui.js';
import { accesoRapidoHTML, bindAccesoRapido } from './quick-access.js';

const ICONS = {
  balance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4-4M11 8v6M8 11h6"></path></svg>',
  ingreso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 14-4 4-4-4"></path><path d="M18 18V4M4 7c-1 1.5-1.2 3.5-.5 5 .7 1.5 2 2.5 3.5 2.5.7 0 1.4-.2 2-.5"></path></svg>',
  egreso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 14 4-4 4 4"></path><path d="M6 18V4"></path><path d="M22 7c-1-1.5-1.2-3.5-.5-5-.7 1.5-2 2.5-3.5 2.5-.7 0-1.4-.2-2-.5"></path></svg>',
  transacciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"></path><path d="M3 11V8a2 2 0 0 1 2-2h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v3a2 2 0 0 1-2 2H5"></path></svg>',
};

export async function render(el, ctx) {
  el.innerHTML = skeletonDashboardHTML();
  let data;
  try {
    data = await API.get('/reportes/dashboard');
  } catch (err) {
    el.innerHTML = errorDashboardHTML(err.message);
    const retry = el.querySelector('[data-retry]');
    if (retry) retry.onclick = () => render(el, ctx);
    return;
  }

  el.innerHTML = `<div class="dash-fade">${dashboardHTML(data, ctx)}</div>`;
  animarDashboard(el);
  bindChartTooltips(el);
  bindAccesoRapido(el, ctx);
}

function dashboardHTML(data, ctx) {
  const avatar = (ctx.session.nombre || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return `
    <div class="alert ${data.superaLimite ? 'warn' : 'info'}">
      ${ic.alert}
      <div>
        <strong>${esc(data.usuario.nombre)}</strong>
        ${
          data.superaLimite
            ? `Has superado tu límite de egresos del mes (${fmt.money(data.limite)}). Egresos actuales: <b>${fmt.money(data.mes.egresos)}</b>.`
            : data.limite
              ? `Tu límite de egresos este mes es ${fmt.money(data.limite)}. Vas ${fmt.pct(data.mes.egresos, Number(data.limite))}% del límite.`
              : `Bienvenido de nuevo. Hoy es ${MESES[data.mes.mes - 1]}, estás al día con tus finanzas.`
        }
      </div>
    </div>

    <div class="kpi-grid">
      <div class="card kpi balance">
        <div class="kpi-label"><span class="kpi-icon">${ICONS.balance}</span> Balance del mes</div>
        <div class="kpi-value" data-valor="${data.mes.balance}">${fmt.money(data.mes.balance)}</div>
        <div class="kpi-sub">${esc(MESES[data.mes.mes - 1])} ${data.mes.anio}</div>
      </div>
      <div class="card kpi ingreso">
        <div class="kpi-label"><span class="kpi-icon">${ICONS.ingreso}</span> Ingresos del mes</div>
        <div class="kpi-value" data-valor="${data.mes.ingresos}">${fmt.money(data.mes.ingresos)}</div>
        <div class="kpi-sub">${data.totales.transacciones} transacciones registradas</div>
      </div>
      <div class="card kpi egreso">
        <div class="kpi-label"><span class="kpi-icon">${ICONS.egreso}</span> Egresos del mes</div>
        <div class="kpi-value" data-valor="${data.mes.egresos}">${fmt.money(data.mes.egresos)}</div>
        <div class="kpi-sub">${data.superaLimite ? '<b>Límite superado</b>' : 'Dentro del límite'}</div>
      </div>
      <div class="card kpi transacciones">
        <div class="kpi-label"><span class="kpi-icon">${ICONS.transacciones}</span> Balance general</div>
        <div class="kpi-value" data-valor="${data.totales.balance}">${fmt.money(data.totales.balance)}</div>
        <div class="kpi-sub">Histórico ${data.totales.ingresos > data.totales.egresos ? '+' : ''}${fmt.moneyShort(data.totales.balance)}</div>
      </div>
    </div>

    <div class="two-col">
      ${comparativasHTML(data.mes.ingresos, data.mes.egresos, data.mes.balance, MESES[data.mes.mes - 1], data.mes.anio)}

      <div class="card">
        <div class="card-header">
          <div>
            <h3>Balance de los últimos 6 meses</h3>
            <p>Ingresos y egresos por mes</p>
          </div>
        </div>
        ${chartMensualHTML(data.porMes || [])}
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Egresos del mes por categoría</h3>
            <p>Distribución según los renglones de egreso</p>
          </div>
          ${avatar && ctx.session.rol === 'ADMIN' ? `<span class="user-avatar" style="width:40px;height:40px">${avatar}</span>` : ''}
        </div>
        ${barsHTML(data.porCategoria)}
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3>Última actividad</h3>
            <p>Transacción más reciente</p>
          </div>
        </div>
        ${ultimaTxHTML(data.ultimaTx)}
      </div>
    </div>

    ${accesoRapidoHTML()}
  `;
}

let tooltipE = null;
function obtenerTooltip() {
  if (tooltipE) return tooltipE;
  tooltipE = document.createElement('div');
  tooltipE.className = 'chart-tip';
  tooltipE.hidden = true;
  document.body.appendChild(tooltipE);
  return tooltipE;
}

function mostrarTip(tip, e, html) {
  tip.innerHTML = html;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let x = e.clientX + 14;
  let y = e.clientY + 14;
  if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
  if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
  tip.style.left = `${Math.max(8, x)}px`;
  tip.style.top = `${Math.max(8, y)}px`;
}

function bindChartTooltips(el) {
  const tip = obtenerTooltip();
  const enlazar = (target, contenido) => {
    target.addEventListener('mouseenter', (e) => { target.classList.add('hover'); mostrarTip(tip, e, contenido(target)); });
    target.addEventListener('mousemove', (e) => mostrarTip(tip, e, contenido(target)));
    target.addEventListener('mouseleave', () => { target.classList.remove('hover'); tip.hidden = true; });
  };

  el.querySelectorAll('.mc-col').forEach((col) => {
    enlazar(col, (c) => `
      <strong>${esc(c.dataset.mes)}</strong>
      <span style="color:var(--texto-muy-suave)">Ingresos</span> <b>${fmt.money(c.dataset.ing)}</b>
      <span style="color:var(--texto-muy-suave)">Egresos</span> <b>${fmt.money(c.dataset.egr)}</b>
      <span style="color:var(--texto-muy-suave)">Balance</span> <b>${Number(c.dataset.bal) >= 0 ? '+' : ''}${fmt.money(c.dataset.bal)}</b>`);
  });

  el.querySelectorAll('.cb-row[data-tooltip]').forEach((row) => {
    enlazar(row, (r) => `
      <strong>${esc(r.dataset.nombre)}</strong>
      <b>${fmt.money(Number(r.dataset.monto))}</b>`);
  });
}

function comparativasHTML(ingresos, egresos, balance = ingresos - egresos, mes = '', anio = '') {
  // Las tres barras comparten UNA única escala: el máximo de (ingresos, egresos, balance).
  // Así las longitudes son exactamente proporcionales a los valores REALES (p. ej.
  // Ingresos 18,500 → 100%, Egresos 5,650 → ~30.5%, Balance 12,850 → ~69.5%).
  const max = Math.max(ingresos, egresos, balance, 0);
  const ancho = (valor) => (max > 0 ? (Math.max(valor, 0) / max) * 100 : 0);

  const fila = (nombre, color, valor) => {
    const w = ancho(valor);
    return `
      <div class="cb-row" data-tooltip data-nombre="${nombre}" data-monto="${valor}">
        <span class="cb-label"><i style="background:${color}"></i>${nombre}</span>
        <div class="cb-track">
          <div class="bar-fill" style="background:${color};width:${w}%" data-ancho="${w}"></div>
        </div>
        <span class="cb-val" data-valor="${valor}">${fmt.money(valor)}</span>
      </div>`;
  };

  const cuerpo = max === 0
    ? '<p class="dn-empty">Sin movimientos este mes.</p>'
    : `<div class="dn-card__bars">
        ${fila('Ingresos', 'var(--dn-ingreso)', ingresos)}
        ${fila('Egresos', 'var(--dn-egreso)', egresos)}
        ${fila('Balance', 'var(--dn-balance)', balance)}
      </div>`;

  return `
    <section class="dn-card">
      <header class="dn-card__head">
        <h3>Ingresos vs Egresos del mes</h3>
        ${mes ? `<p>Proporción de ${esc(mes)} ${anio}</p>` : ''}
      </header>
      <div class="dn-card__body">
        ${cuerpo}
      </div>
    </section>`;
}

function chartMensualHTML(porMes) {
  if (!porMes.length) {
    return '<p style="color:var(--texto-muy-suave);font-size:.86rem">Sin datos históricos.</p>';
  }
  const max = Math.max(1, ...porMes.map((m) => Math.max(m.ingresos, m.egresos)));
  const alt = (v) => Math.max(3, Math.round((v / max) * 100));
  return `
    <div class="month-chart">
      ${porMes.map((m) => {
        const aIng = alt(m.ingresos);
        const aEgr = alt(m.egresos);
        return `
        <div class="mc-col" data-mes="${esc(MESES[m.mes - 1])}" data-ing="${m.ingresos}" data-egr="${m.egresos}" data-bal="${m.balance}">
          <div class="mc-val" data-valor="${m.balance}" data-fmt="short">${fmt.moneyShort(m.balance)}</div>
          <div class="mc-pair">
            <div class="mc-bar ing" style="height:${aIng}%" data-alto="${aIng}"></div>
            <div class="mc-bar egr" style="height:${aEgr}%" data-alto="${aEgr}"></div>
          </div>
          <div class="mc-month">${esc(MESES[m.mes - 1].slice(0, 3))}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="mc-legend">
      <span><i style="background:var(--ingreso)"></i> Ingresos</span>
      <span><i style="background:var(--egreso)"></i> Egresos</span>
      <span class="mc-legend-val">Balance neto sobre cada mes</span>
    </div>`;
}

function barsHTML(porCategoria) {
  const total = Object.values(porCategoria).reduce((s, v) => s + v, 0);
  const entries = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return '<p style="color:var(--texto-muy-suave);font-size:.86rem">Sin egresos registrados este mes.</p>';
  }
  return `<div class="bars">
    ${entries.map(([label, valor]) => {
      const ancho = Math.max(2, fmt.pct(valor, total));
      return `
      <div class="bar-row">
        <span class="bar-label" title="${esc(label)}">${esc(label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${ancho}%" data-ancho="${ancho}"></div></div>
        <span class="bar-val" data-valor="${valor}" data-fmt="short">${fmt.moneyShort(valor)}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function ultimaTxHTML(tx) {
  if (!tx) return '<p style="color:var(--texto-muy-suave);font-size:.86rem">Aún no hay transacciones.</p>';
  const concepto = tx.tipo === 'INGRESO'
    ? (tx.ingreso && tx.ingreso.descripcion) || 'Ingreso'
    : (tx.egreso && tx.egreso.descripcion) || 'Egreso';
  return `
    <div class="mini-list">
      <div class="row">
        <div>
          <strong>${esc(concepto)}</strong>
          <br><small>${badgeTipo(tx.tipo)} · ${esc(tx.numero)}</small>
        </div>
        <span class="amt ${tx.tipo === 'INGRESO' ? 'pos' : 'neg'}">${tx.tipo === 'INGRESO' ? '+' : '-'}${fmt.money(tx.monto)}</span>
      </div>
      <div class="row"><span>Fecha</span><span class="amt" style="font-size:.84rem;font-weight:600">${fmt.date(tx.fechaTransaccion)}</span></div>
      <div class="row"><span>Forma de pago</span><span class="amt" style="font-size:.84rem;font-weight:600">${esc(tx.tipoPago ? tx.tipoPago.descripcion : '—')}</span></div>
      <div class="row"><span>Estado</span><span>${badgeEstado(tx.estado)}</span></div>
    </div>`;
}

// ===== Animación de aparición de los DATOS REALES =====
// No se generan datos falsos: cada elemento parte de 0 y se interpola hasta su
// valor REAL (data-len / data-alto / data-ancho / data-valor). Al terminar,
// SIEMPRE se aplica el valor exacto obtenido de la API.
const REDUCED_MOTION = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function animarValor(nodo, aplicar, fin, { duracion = 600, delay = 0, ease = easeOutCubic } = {}) {
  const inicio = performance.now() + delay;
  const paso = (ahora) => {
    const p = Math.min(1, Math.max(0, (ahora - inicio) / duracion));
    aplicar(nodo, fin * ease(p));
    if (p < 1) requestAnimationFrame(paso);
    else aplicar(nodo, fin);
  };
  requestAnimationFrame(paso);
}

function animarDashboard(el) {
  const lanzar = (nodo, aplicar, fin, opciones) => {
    if (REDUCED_MOTION) return; // respeta accesibilidad; el DOM ya muestra el valor final real
    animarValor(nodo, aplicar, fin, opciones);
  };

  // Barras horizontales de escala única (Ingresos vs Egresos y por categoría): cada
  // barra crece desde 0 hasta su ancho REAL, sin tocar los datos ni las proporciones.

  // "Balance de los últimos 6 meses": cada barra crece desde 0 hasta su altura real.
  let colIndex = 0;
  el.querySelectorAll('.mc-col').forEach((col) => {
    const delay = colIndex * 70;
    col.querySelectorAll('.mc-bar[data-alto]').forEach((bar) => {
      const alto = Number(bar.dataset.alto);
      bar.style.transition = 'none';
      lanzar(bar, (n, v) => { n.style.height = `${v}%`; }, alto, { duracion: 550, delay });
    });
    colIndex += 1;
  });

  // Barras horizontales de escala única (Ingresos vs Egresos y por categoría): crecen
  // desde 0 hasta su ancho real. Mismo desplazamiento escalonado en ambas series.
  let barIndex = 0;
  el.querySelectorAll('.bar-fill[data-ancho]').forEach((fill) => {
    const ancho = Number(fill.dataset.ancho);
    fill.style.transition = 'none';
    lanzar(fill, (n, v) => { n.style.width = `${v}%`; }, ancho, { duracion: 500, delay: barIndex * 60 });
    barIndex += 1;
  });

  // Montos (KPIs y cantidades de los gráficos): cuentan desde 0 hasta el valor real.
  let montoIndex = 0;
  el.querySelectorAll('[data-valor]').forEach((nodo) => {
    const fin = Number(nodo.dataset.valor);
    const formato = nodo.dataset.fmt === 'short' ? fmt.moneyShort : fmt.money;
    lanzar(nodo, (n, v) => { n.textContent = formato(v); }, fin, { duracion: 750, delay: Math.min(montoIndex * 50, 450) });
    montoIndex += 1;
  });
}

function skeletonDashboardHTML() {
  const rows = (n, estilo) => Array.from({ length: n }, () => `<div class="skeleton ${estilo || ''}"></div>`).join('');
  return `
    <div class="skeleton sk-banner"></div>

    <div class="kpi-grid">
      ${Array.from({ length: 4 }, () => `
        <div class="card sk-card">
          <div class="skeleton sk-kpi-label"></div>
          <div class="skeleton sk-kpi-value"></div>
          <div class="skeleton sk-kpi-sub"></div>
        </div>`).join('')}
    </div>

    <div class="two-col">
<div class="sk-dn-card">
          <div class="sk-dn-head">
            <div class="skeleton sk-dn-title"></div>
            <div class="skeleton sk-dn-subtitle"></div>
          </div>
          <div class="sk-dn-body">
            ${[88, 38, 64].map((w) => `<div class="skeleton sk-cb-line" style="width:${w}%"></div>`).join('')}
          </div>
        </div>

      <div class="card">
        <div class="sk-head">
          <div class="skeleton sk-title"></div>
          <div class="skeleton sk-subtitle"></div>
        </div>
        <div class="sk-chart-bars">
          ${Array.from({ length: 6 }, (_, i) => `<div class="skeleton sk-cbar" style="height:${[72, 52, 80, 40, 62, 48][i]}%"></div>`).join('')}
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="sk-head">
          <div class="skeleton sk-title"></div>
          <div class="skeleton sk-subtitle"></div>
        </div>
        <div class="sk-rows">
          ${Array.from({ length: 4 }, () => `
            <div class="sk-row"><div class="skeleton sk-bar-line"></div><div class="skeleton sk-bar-total"></div></div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="sk-head">
          <div class="skeleton sk-title"></div>
          <div class="skeleton sk-subtitle"></div>
        </div>
        <div class="sk-list">
          <div class="skeleton sk-list-title"></div>
          ${rows(3, 'sk-list-line')}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <div class="skeleton sk-title"></div>
      <div class="skeleton sk-actions"></div>
    </div>
  `;
}

function errorDashboardHTML(mensaje) {
  return `
    <div class="card" style="text-align:center;padding:48px 24px">
      <div style="color:var(--danger)">${ic.alert}</div>
      <p style="font-weight:800;font-size:1.02rem;margin-top:14px">No se pudieron cargar los datos del dashboard</p>
      <p style="color:var(--texto-suave);font-size:.86rem;margin-top:6px">${esc(mensaje)}</p>
      <button class="btn btn-primary" data-retry style="margin-top:20px">${ic.refresh} Reintentar</button>
    </div>
  `;
}