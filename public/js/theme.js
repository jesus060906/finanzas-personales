'use strict';

(function () {
  const STORAGE_KEY = 'fp-tema';
  const TEMA_ACTUAL = document.querySelector('html') || document.documentElement;

  const ICONOS = {
    luna: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>',
  };

  function leer() {
    let tema = 'claro';
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado === 'claro' || guardado === 'oscuro') tema = guardado;
    } catch (_) {  }
    return tema;
  }

  function guardar(tema) {
    try { localStorage.setItem(STORAGE_KEY, tema); } catch (_) {  }
  }

  function esOscuro() {
    return TEMA_ACTUAL.dataset.theme === 'oscuro';
  }

  function pintarBotones() {
    const oscuro = esOscuro();
    const accion = oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    document.querySelectorAll('[data-tema-toggle]').forEach((btn) => {
      btn.innerHTML = oscuro ? ICONOS.sol : ICONOS.luna;
      btn.setAttribute('aria-label', accion);
      btn.title = accion;
    });
  }

  function aplicar(tema) {
    TEMA_ACTUAL.dataset.theme = tema;
    guardar(tema);
    pintarBotones();
  }

  function inicializar() {
    TEMA_ACTUAL.dataset.theme = leer();
    pintarBotones();
    document.querySelectorAll('[data-tema-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        aplicar(esOscuro() ? 'claro' : 'oscuro');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();