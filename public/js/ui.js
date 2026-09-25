'use strict';

const fmt = {
  money: (n) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 2 }).format(Number(n || 0)),
  moneyShort: (n) => {
    const v = Number(n || 0);
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return fmt.money(v / 1_000_000) + 'M';
    if (abs >= 1_000) return fmt.money(v / 1_000) + 'K';
    return fmt.money(v);
  },
  date: (d) => d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  dateTime: (d) => d ? new Date(d).toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
  yearMonth: (anio, mes) => new Date(anio, mes - 1, 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' }),
  pct: (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0),
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ic = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><path d="M5.6 5.6l12.8 12.8"></path></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8" rx="1"></rect></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10"></path><path d="M20.5 15a9 9 0 0 1-14.9 3.4L1 14"></path></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"></path><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><circle cx="12" cy="12" r="2.6"></circle><path d="M6 12h.01M18 12h.01"></path></svg>',
};

let toastTimer = null;
const REDUCED_MOTION = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function toast(mensaje, tipo = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.hidden = false;
  el.textContent = mensaje;
  el.className = 'toast' + (tipo === 'error' ? ' error' : tipo === 'warn' ? ' warn' : '');
  clearTimeout(toastTimer);

  const ocultar = () => {
    if (!el.classList.contains('toast-out')) return;
    el.hidden = true;
    el.classList.remove('toast-out');
  };

  toastTimer = setTimeout(() => {
    if (REDUCED_MOTION) {
      el.hidden = true;
      return;
    }
    el.classList.add('toast-out');
    el.addEventListener('transitionend', (e) => {
      if (e.target === el && e.propertyName === 'opacity') ocultar();
    }, { once: true });
    toastTimer = setTimeout(ocultar, 600);
  }, 3800);
}

function modal(titulo, contenidoHtml, onSubmit, opciones = {}) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal" role="dialog" aria-label="${esc(titulo)}">
      <div class="modal-header">
        <h3>${esc(titulo)}</h3>
        <button class="modal-close" aria-label="Cerrar">&times;</button>
      </div>
      <div class="modal-body">${contenidoHtml}</div>
    </div>`;
  document.body.appendChild(back);

  const cerrar = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', onKey);
  back.querySelector('.modal-close').onclick = cerrar;
  back.addEventListener('mousedown', (e) => { if (e.target === back) cerrar(); });

  if (onSubmit) {
    const form = back.querySelector('form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type="submit"]');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Guardando…';
        try {
          const resultado = await onSubmit(new FormData(form), back);
          if (resultado !== false) cerrar();
        } catch (err) {
          toast(err.message || 'Error', 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });
    }
  }
  return back;
}

function confirmar(mensaje, onConfirmar) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal" style="max-width:420px">
      <p style="font-size:.92rem;margin-bottom:18px">${esc(mensaje)}</p>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-outline" data-act="no">Cancelar</button>
        <button class="btn btn-danger" data-act="si">Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  const cerrar = () => back.remove();
  back.querySelector('[data-act="no"]').onclick = cerrar;
  back.addEventListener('mousedown', (e) => { if (e.target === back) cerrar(); });
  back.querySelector('[data-act="si"]').onclick = async () => {
    cerrar();
    await onConfirmar();
  };
}

function badgeEstado(estado) {
  return estado === 'ACTIVO'
    ? '<span class="badge ok">Activo</span>'
    : '<span class="badge no">Inactivo</span>';
}

function badgeTipo(tipo) {
  return tipo === 'INGRESO'
    ? '<span class="badge ok">Ingreso</span>'
    : '<span class="badge no">Egreso</span>';
}

function selectOptions(lista, valueId = 'id', label = 'descripcion', selected = null) {
  return lista.map((r) => `<option value="${r[valueId]}" ${Number(r[valueId]) === Number(selected) ? 'selected' : ''}>${esc(r[label])}</option>`).join('');
}

function spinner() {
  return '<div style="text-align:center;padding:60px;color:var(--texto-muy-suave)">Cargando…</div>';
}

function downloadCSV(filename, filas) {
  const enc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = filas.map((f) => f.map(enc).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export {
  fmt, MESES, esc, ic, toast, modal, confirmar,
  badgeEstado, badgeTipo, selectOptions, spinner, downloadCSV,
};