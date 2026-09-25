'use strict';

const { app, request, seedBasica, agenteUsuario, ADM, USR } = require('../helpers');

beforeEach(async () => {
  await seedBasica();
});

describe('POST /api/auth/registro', () => {
  it('crea un usuario correctamente', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'Nueva Persona', cedula: '402-9999999-1', password: 'clave123' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Nueva Persona', cedula: '402-9999999-1' });
    expect(res.body.password).toBeUndefined();
  });

  it('rechaza cédula duplicada con 409', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'Otro', cedula: USR.cedula, password: 'clave123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/cédula/i);
  });

  it('rechaza campos obligatorios faltantes con 400', async () => {
    const res = await request(app).post('/api/auth/registro').send({ nombre: 'SoloNombre' });
    expect(res.status).toBe(400);
  });

  it('rechaza fecha de corte fuera de rango con 400', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'X', cedula: '402-0000011-1', password: 'clave123', fechaCorte: 40 });
    expect(res.status).toBe(400);
  });

  it('rechaza correo inválido con 400', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'X', cedula: '402-0000022-8', password: 'clave123', email: 'no-es-correo' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('inicia sesión y permite acceder a /me', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ cedula: USR.cedula, password: USR.password });
    expect(login.status).toBe(200);
    expect(login.body.rol).toBe('USUARIO');

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.cedula).toBe(USR.cedula);
  });

  it('rechaza contraseña incorrecta con 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ cedula: USR.cedula, password: 'incorrecta' });
    expect(res.status).toBe(401);
  });

  it('rechaza cédula inexistente con 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ cedula: '999-9999999-0', password: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me sin sesión', () => {
  it('devuelve 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('cierra la sesión', async () => {
    const agent = await agenteUsuario();
    const out = await agent.post('/api/auth/logout');
    expect(out.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });
});

describe('Acceso de administrador', () => {
  it('el admin puede llevar a cabo el flujo completo de sesión', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ cedula: ADM.cedula, password: ADM.password });
    expect(login.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.rol).toBe('ADMIN');
  });
});