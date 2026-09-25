'use strict';

(() => {
  const form = document.getElementById('login-form');
  const error = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Entrando…';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ cedula: form.cedula.value.trim(), password: form.password.value }),
      });
      const data = await res.json();
      if (!res.ok) {
        error.textContent = data.error || 'Error al iniciar sesión.';
        error.hidden = false;
      } else {
        window.location.href = '/index.html';
      }
    } catch (err) {
      error.textContent = 'No se pudo conectar con el servidor.';
      error.hidden = false;
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Entrar al sistema';
    }
  });
})();