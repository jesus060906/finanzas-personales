'use strict';

const { app, request, seedBasica, agenteAdmin, agenteUsuario } = require('../helpers');

beforeEach(async () => {
  await seedBasica();
});

describe('Catálogos simples', () => {
  it('lista tipos de egresos', async () => {
    const agent = await agenteAdmin();
    const res = await agent.get('/api/catalogos/tipos-egresos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('rechaza listar sin autenticación', async () => {
    const res = await request(app).get('/api/catalogos/tipos-egresos');
    expect(res.status).toBe(401);
  });

  it('crea un tipo de egreso', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/catalogos/tipos-egresos').send({ descripcion: 'Inversión' });
    expect(res.status).toBe(201);
    expect(res.body.descripcion).toBe('Inversión');
    expect(res.body.estado).toBe('ACTIVO');
  });

  it('rechaza descripción duplicada con 409', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/catalogos/tipos-egresos').send({ descripcion: 'Gasto' });
    expect(res.status).toBe(409);
  });

  it('rechaza descripción vacía con 400', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/catalogos/tipos-egresos').send({ descripcion: '   ' });
    expect(res.status).toBe(400);
  });

  it('actualiza y desactiva registros', async () => {
    const agent = await agenteAdmin();
    const creado = await agent.post('/api/catalogos/renglones').send({ descripcion: 'Transporte' });
    const id = creado.body.id;

    const editado = await agent.put(`/api/catalogos/renglones/${id}`).send({ descripcion: 'Transporte Público' });
    expect(editado.status).toBe(200);
    expect(editado.body.descripcion).toBe('Transporte Público');

    const desactivado = await agent.delete(`/api/catalogos/renglones/${id}`);
    expect(desactivado.status).toBe(200);
    const listado = await agent.get('/api/catalogos/renglones');
    const fila = listado.body.find((r) => r.id === id);
    expect(fila.estado).toBe('INACTIVO');
  });

  it('bloquea creación de catálogos a usuarios sin rol admin', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/catalogos/tipos-egresos').send({ descripcion: 'No permitido' });
    expect(res.status).toBe(403);
  });
});

describe('Egresos definidos', () => {
  it('crea un egreso definido', async () => {
    const agent = await agenteAdmin();
    const cat = await agent.get('/api/catalogos/tipos-egresos');
    const ren = await agent.get('/api/catalogos/renglones');
    const pagos = await agent.get('/api/catalogos/tipos-pago');

    const res = await agent.post('/api/catalogos/egresos').send({
      tipoEgresoId: cat.body[0].id,
      renglonId: ren.body[0].id,
      tipoPagoDefectoId: pagos.body[0].id,
      descripcion: 'Recarga Combustible',
    });
    expect(res.status).toBe(201);
    expect(res.body.descripcion).toBe('Recarga Combustible');
    expect(res.body.tipoEgreso).toBeTruthy();
  });

  it('rechaza egreso sin renglón con 400', async () => {
    const agent = await agenteAdmin();
    const cat = await agent.get('/api/catalogos/tipos-egresos');
    const pagos = await agent.get('/api/catalogos/tipos-pago');
    const res = await agent.post('/api/catalogos/egresos').send({
      tipoEgresoId: cat.body[0].id,
      tipoPagoDefectoId: pagos.body[0].id,
      descripcion: 'Sin renglón',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza egreso con relación inexistente con 400', async () => {
    const agent = await agenteAdmin();
    const ren = await agent.get('/api/catalogos/renglones');
    const pagos = await agent.get('/api/catalogos/tipos-pago');
    const res = await agent.post('/api/catalogos/egresos').send({
      tipoEgresoId: 9999,
      renglonId: ren.body[0].id,
      tipoPagoDefectoId: pagos.body[0].id,
      descripcion: 'Relación inválida',
    });
    expect(res.status).toBe(400);
  });

  it('lista egresos activos y todos', async () => {
    const agent = await agenteAdmin();
    const activos = await agent.get('/api/catalogos/egresos/activos');
    expect(activos.status).toBe(200);
    expect(activos.body.every((e) => e.estado === 'ACTIVO')).toBe(true);
  });
});

describe('Ingresos definidos', () => {
  it('crea y edita un ingreso definido', async () => {
    const agent = await agenteAdmin();
    const tipos = await agent.get('/api/catalogos/tipos-ingresos');
    const res = await agent.post('/api/catalogos/ingresos').send({
      tipoIngresoId: tipos.body[0].id,
      descripcion: 'Bonificación Consultora',
      institucion: 'Consultora AXP',
    });
    expect(res.status).toBe(201);
    expect(res.body.tipoIngreso).toBeTruthy();

    const edit = await agent.put(`/api/catalogos/ingresos/${res.body.id}`).send({ descripcion: 'Bonificación Anual' });
    expect(edit.status).toBe(200);
    expect(edit.body.descripcion).toBe('Bonificación Anual');
  });

  it('rechaza ingreso sin tipo válido', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/catalogos/ingresos').send({ descripcion: 'Sin tipo' });
    expect(res.status).toBe(400);
  });
});