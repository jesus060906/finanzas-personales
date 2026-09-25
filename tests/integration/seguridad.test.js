'use strict';

const express = require('express');
const { app, request, seedBasica, agenteAdmin, agenteUsuario, ADM } = require('../helpers');
const { crearLimiter } = require('../../src/routes/auth.routes');

let data;

beforeEach(async () => {
  data = await seedBasica();
});

describe('Seguridad backend (negativos)', () => {
  it('el registro público ignora el rol enviado por el cliente', async () => {
    const res = await request(app).post('/api/auth/registro').send({
      nombre: 'Intruso',
      cedula: '999-9999999-0',
      password: 'clave-segura-1',
      rol: 'ADMIN',
      tipoPersona: 'FISICA',
      fechaCorte: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.rol).toBe('USUARIO');
  });

  it('no expone el hash de contraseña en listas de usuarios', async () => {
    const admin = await agenteAdmin();
    const res = await admin.get('/api/usuarios');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const u of res.body) {
      expect(u.password).toBeUndefined();
    }
  });

  it('no expone el hash de contraseña al consultar un usuario', async () => {
    const admin = await agenteAdmin();
    const res = await admin.get(`/api/usuarios/${data.usuario.id}`);
    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();
  });

  it('un usuario no-admin NO puede ver el perfil de otro usuario', async () => {
    const juan = await agenteUsuario();
    const res = await juan.get(`/api/usuarios/${data.admin.id}`);
    expect(res.status).toBe(403);
  });

  it('un usuario no-admin SÍ puede ver su propio perfil', async () => {
    const juan = await agenteUsuario();
    const res = await juan.get(`/api/usuarios/${data.usuario.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(data.usuario.id);
  });

  it('un usuario no-admin no ve cortes de otros desde el historial', async () => {
    const juan = await agenteUsuario();
    const res = await juan.get(`/api/cortes?usuarioId=${data.admin.id}`);
    expect(res.status).toBe(200);
    for (const corte of res.body) {
      expect(corte.usuarioId).toBe(data.usuario.id);
    }
  });

  it('el corte es una operación POST (GET devuelve 404)', async () => {
    const admin = await agenteAdmin();
    const res = await admin.get('/api/cortes/proceso');
    expect(res.status).toBe(404);
  });

  it('malas credenciales no autentican', async () => {
    const res = await request(app).post('/api/auth/login').send({
      cedula: ADM.cedula,
      password: 'incorrecta',
    });
    expect(res.status).toBe(401);
  });
});

describe('Rate limiting (anti fuerza bruta)', () => {
  it('bloquea con 429 tras superar el máximo de intentos', async () => {
    const limitador = crearLimiter(3);
    const mini = express();
    mini.use(limitador);
    mini.post('/probe', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i += 1) {
      const r = await request(mini).post('/probe');
      expect(r.status).toBe(200);
    }
    const bloqueado = await request(mini).post('/probe');
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error).toMatch(/Demasiados intentos/);
  });
});

describe('Cabeceras de seguridad', () => {
  it('envía Content-Security-Policy', async () => {
    const res = await request(app).get('/login.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  });
});