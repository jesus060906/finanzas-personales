'use strict';

const { app, request, models, seedBasica, agenteAdmin, agenteUsuario, USR } = require('../helpers');

beforeEach(async () => {
  await seedBasica();
});

describe('Gestión de usuarios (admin)', () => {
  it('lista usuarios sin exponer contraseñas', async () => {
    const agent = await agenteAdmin();
    const res = await agent.get('/api/usuarios');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((u) => expect(u.password).toBeUndefined());
  });

  it('crea un usuario y devuelve respuesta sin contraseña', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/usuarios').send({
      nombre: 'Pedro López',
      cedula: '001-2222222-7',
      email: 'pedro@prueba.local',
      password: 'clave123',
      limiteEgresos: 8000,
      tipoPersona: 'FISICA',
      fechaCorte: 20,
      rol: 'USUARIO',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Pedro López', cedula: '001-2222222-7', limiteEgresos: 8000 });
    expect(res.body.password).toBeUndefined();
  });

  it('rechaza cédula duplicada con 409', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/usuarios').send({
      nombre: 'Duplicado', cedula: USR.cedula, password: 'clave123',
    });
    expect(res.status).toBe(409);
  });

  it('rechaza contraseña corta con 400', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/usuarios').send({
      nombre: 'X', cedula: '001-3333333-6', password: '123',
    });
    expect(res.status).toBe(400);
  });

  it('actualiza el límite de egresos y la cédula', async () => {
    const agent = await agenteAdmin();
    const lista = await agent.get('/api/usuarios');
    const juan = lista.body.find((u) => u.cedula === USR.cedula);
    const res = await agent.put(`/api/usuarios/${juan.id}`).send({ limiteEgresos: 25000 });
    expect(res.status).toBe(200);
    expect(res.body.limiteEgresos).toBe(25000);
  });

  it('desactiva y reactiva un usuario', async () => {
    const agent = await agenteAdmin();
    const lista = await agent.get('/api/usuarios');
    const juan = lista.body.find((u) => u.cedula === USR.cedula);

    const off = await agent.patch(`/api/usuarios/${juan.id}/anular`);
    expect(off.body.estado).toBe('INACTIVO');

    const on = await agent.patch(`/api/usuarios/${juan.id}/anular`);
    expect(on.body.estado).toBe('ACTIVO');
  });

  it('consulta el resumen financiero', async () => {
    const agent = await agenteAdmin();
    const res = await agent.get('/api/usuarios/resumen');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((u) => {
      expect(typeof u.totalIngresos).toBe('number');
      expect(typeof u.balance).toBe('number');
    });
  });
});

describe('Permisos de rol', () => {
  it('bloquea listar usuarios a rol USUARIO con 403', async () => {
    const agent = await agenteUsuario();
    const res = await agent.get('/api/usuarios');
    expect(res.status).toBe(403);
  });

  it('bloquea crear usuarios a rol USUARIO con 403', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/usuarios').send({
      nombre: 'X', cedula: '001-0000000-9', password: 'clave123',
    });
    expect(res.status).toBe(403);
  });

  it('permite a cualquier rol autenticado consultar su propia información', async () => {
    const juan = await models.Usuario.findOne({ where: { cedula: USR.cedula } });
    const agent = await agenteUsuario();
    const res = await agent.get(`/api/usuarios/${juan.id}`);
    expect(res.status).toBe(200);
    expect(res.body.cedula).toBe(USR.cedula);
  });
});