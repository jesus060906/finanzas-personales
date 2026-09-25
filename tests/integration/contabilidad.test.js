'use strict';

const bcrypt = require('bcryptjs');
const { app, request, models, seedBasica, agenteAdmin, agenteUsuario } = require('../helpers');

let data;

const ANIO = new Date().getFullYear();

function iso(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

async function cuentaBase(agent) {
  return agent.post('/api/contabilidad/cuentas').send({
    codigo: '1.01.001',
    nombre: 'Caja General',
    tipo: 'ACTIVO',
    estado: 'ACTIVO',
  });
}

async function asientoDoble(agent, cuentaId, fecha, concepto = 'Aporte inicial') {
  return agent.post('/api/contabilidad/asientos').send({
    fecha,
    concepto,
    lineas: [
      { cuentaId, descripcion: 'Debe', debe: 1000, haber: 0 },
      { cuentaId, descripcion: 'Haber', debe: 0, haber: 1000 },
    ],
  });
}

beforeEach(async () => {
  data = await seedBasica();
});

describe('Acceso al módulo de contabilidad', () => {
  it('bloquea a un usuario tipo FISICA (403)', async () => {
    const agent = await agenteUsuario();
    const res = await agent.get('/api/contabilidad/cuentas');
    expect(res.status).toBe(403);
  });

  it('bloquea sin sesión (401)', async () => {
    const res = await request(app).get('/api/contabilidad/cuentas');
    expect(res.status).toBe(401);
  });

  it('permite a una empresa (JURIDICA) acceder', async () => {
    const agent = await agenteAdmin();
    const res = await agent.get('/api/contabilidad/cuentas');
    expect(res.status).toBe(200);
  });
});

describe('Plan de cuentas', () => {
  it('crea una cuenta y la lista', async () => {
    const agent = await agenteAdmin();
    const creada = await cuentaBase(agent);
    expect(creada.status).toBe(201);
    expect(creada.body).toMatchObject({ codigo: '1.01.001', nombre: 'Caja General', tipo: 'ACTIVO' });

    const lista = await agent.get('/api/contabilidad/cuentas');
    expect(lista.status).toBe(200);
    expect(lista.body.length).toBe(1);
    expect(lista.body[0].usuarioId).toBe(data.admin.id);
  });

  it('rechaza código con letras (400)', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/contabilidad/cuentas').send({
      codigo: 'AB1.01', nombre: 'Caja', tipo: 'ACTIVO', estado: 'ACTIVO',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza código duplicado (409)', async () => {
    const agent = await agenteAdmin();
    await cuentaBase(agent);
    const res = await cuentaBase(agent);
    expect(res.status).toBe(409);
  });

  it('rechaza tipo de cuenta inválido (400)', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/contabilidad/cuentas').send({
      codigo: '9.99.999', nombre: 'X', tipo: 'OTRO', estado: 'ACTIVO',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza cuenta padre de otra empresa', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/contabilidad/cuentas').send({
      codigo: '1.01.002', nombre: 'Sub', tipo: 'ACTIVO', estado: 'ACTIVO', padreId: 99999,
    });
    expect(res.status).toBe(400);
  });

  it('impide eliminar una cuenta con hijas (409) y permite eliminar sin uso', async () => {
    const agent = await agenteAdmin();
    const padre = await cuentaBase(agent);
    const hijo = await agent.post('/api/contabilidad/cuentas').send({
      codigo: '1.01.002', nombre: 'Caja Chica', tipo: 'ACTIVO', estado: 'ACTIVO', padreId: padre.body.id,
    });

    const bloqueado = await agent.delete(`/api/contabilidad/cuentas/${padre.body.id}`);
    expect(bloqueado.status).toBe(409);

    const ok = await agent.delete(`/api/contabilidad/cuentas/${hijo.body.id}`);
    expect(ok.status).toBe(200);
  });

  it('impide eliminar una cuenta con movimientos en asientos', async () => {
    const agent = await agenteAdmin();
    const cuenta = await cuentaBase(agent);
    await asientoDoble(agent, cuenta.body.id, iso(ANIO, 1, 15));

    const res = await agent.delete(`/api/contabilidad/cuentas/${cuenta.body.id}`);
    expect(res.status).toBe(409);
  });
});

describe('Períodos contables', () => {
  it('crea y lista períodos', async () => {
    const agent = await agenteAdmin();
    const creado = await agent.post('/api/contabilidad/periodos').send({
      nombre: 'Enero 2026', fechaInicio: iso(ANIO, 1, 1), fechaFin: iso(ANIO, 1, 31), estado: 'ABIERTO',
    });
    expect(creado.status).toBe(201);
    expect(creado.body.estado).toBe('ABIERTO');

    const lista = await agent.get('/api/contabilidad/periodos');
    expect(lista.status).toBe(200);
    expect(lista.body.length).toBe(1);
  });

  it('rechaza período con nombre duplicado (409)', async () => {
    const agent = await agenteAdmin();
    const body = { nombre: 'Enero 2026', fechaInicio: iso(ANIO, 1, 1), fechaFin: iso(ANIO, 1, 31) };
    await agent.post('/api/contabilidad/periodos').send(body);
    const res = await agent.post('/api/contabilidad/periodos').send(body);
    expect(res.status).toBe(409);
  });

  it('rechaza fechas invertidas (400)', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/contabilidad/periodos').send({
      nombre: 'Mal', fechaInicio: iso(ANIO, 2, 1), fechaFin: iso(ANIO, 1, 1), estado: 'ABIERTO',
    });
    expect(res.status).toBe(400);
  });

  it('bloquea asientos en un período cerrado y permite tras reabrirlo', async () => {
    const agent = await agenteAdmin();
    const cuenta = await cuentaBase(agent);
    const periodo = await agent.post('/api/contabilidad/periodos').send({
      nombre: 'P1', fechaInicio: iso(ANIO, 1, 1), fechaFin: iso(ANIO, 1, 31), estado: 'ABIERTO',
    });

    await agent.patch(`/api/contabilidad/periodos/${periodo.body.id}/estado`).send({ estado: 'CERRADO' });

    const bloqueado = await asientoDoble(agent, cuenta.body.id, iso(ANIO, 1, 15));
    expect(bloqueado.status).toBe(400);

    await agent.patch(`/api/contabilidad/periodos/${periodo.body.id}/estado`).send({ estado: 'ABIERTO' });

    const permitido = await asientoDoble(agent, cuenta.body.id, iso(ANIO, 1, 16));
    expect(permitido.status).toBe(201);
  });
});

describe('Asientos contables', () => {
  it('registra un asiento de partida doble y lo lista', async () => {
    const agent = await agenteAdmin();
    const cuenta = await cuentaBase(agent);
    const res = await asientoDoble(agent, cuenta.body.id, iso(ANIO, 3, 10));
    expect(res.status).toBe(201);
    expect(res.body.lineas.length).toBe(2);
    expect(res.body.numero).toMatch(/^AS-/);

    const lista = await agent.get('/api/contabilidad/asientos');
    expect(lista.status).toBe(200);
    expect(lista.body.length).toBe(1);

    const unico = await agent.get(`/api/contabilidad/asientos/${res.body.id}`);
    expect(unico.status).toBe(200);
  });

  it('rechaza asiento desbalanceado (400)', async () => {
    const agent = await agenteAdmin();
    const cuenta = await cuentaBase(agent);
    const res = await agent.post('/api/contabilidad/asientos').send({
      fecha: iso(ANIO, 3, 10),
      concepto: 'Mal balanceado',
      lineas: [
        { cuentaId: cuenta.body.id, debe: 1000, haber: 0 },
        { cuentaId: cuenta.body.id, debe: 0, haber: 900 },
      ],
    });
    expect(res.status).toBe(400);
  });

  it('rechaza montos no numéricos en las líneas (400)', async () => {
    const agent = await agenteAdmin();
    const cuenta = await cuentaBase(agent);
    const res = await agent.post('/api/contabilidad/asientos').send({
      fecha: iso(ANIO, 3, 10),
      concepto: 'Montos inválidos',
      lineas: [
        { cuentaId: cuenta.body.id, debe: 'abc', haber: 'abc' },
        { cuentaId: cuenta.body.id, debe: '1e3', haber: '1000' },
      ],
    });
    expect(res.status).toBe(400);
    const total = await agent.get('/api/contabilidad/asientos');
    expect(total.body).toHaveLength(0);
  });

  it('rechaza asiento con menos de dos líneas', async () => {
    const agent = await agenteAdmin();
    const cuenta = await cuentaBase(agent);
    const res = await agent.post('/api/contabilidad/asientos').send({
      fecha: iso(ANIO, 3, 10), concepto: 'Poco', lineas: [{ cuentaId: cuenta.body.id, debe: 100, haber: 0 }],
    });
    expect(res.status).toBe(400);
  });

  it('rechaza asiento con cuenta que no pertenece a la empresa', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/contabilidad/asientos').send({
      fecha: iso(ANIO, 3, 10), concepto: 'Raro',
      lineas: [{ cuentaId: 77777, debe: 100, haber: 0 }, { cuentaId: 77777, debe: 0, haber: 100 }],
    });
    expect(res.status).toBe(400);
  });

  it('modifica un asiento existente', async () => {
    const agent = await agenteAdmin();
    const cuenta = await cuentaBase(agent);
    const creado = await asientoDoble(agent, cuenta.body.id, iso(ANIO, 3, 10));

    const res = await agent.put(`/api/contabilidad/asientos/${creado.body.id}`).send({
      fecha: iso(ANIO, 3, 11),
      concepto: 'Aporte actualizado',
      lineas: [
        { cuentaId: cuenta.body.id, debe: 2000, haber: 0 },
        { cuentaId: cuenta.body.id, debe: 0, haber: 2000 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.concepto).toBe('Aporte actualizado');
  });

  it('anula un asiento y rechaza re-anular', async () => {
    const agent = await agenteAdmin();
    const cuenta = await cuentaBase(agent);
    const creado = await asientoDoble(agent, cuenta.body.id, iso(ANIO, 3, 10));

    const anulado = await agent.patch(`/api/contabilidad/asientos/${creado.body.id}/anular`);
    expect(anulado.status).toBe(200);

    const otraVez = await agent.patch(`/api/contabilidad/asientos/${creado.body.id}/anular`);
    expect(otraVez.status).toBe(403);
  });

  it('no permite modificar un asiento anulado', async () => {
    const agent = await agenteAdmin();
    const cuenta = await cuentaBase(agent);
    const creado = await asientoDoble(agent, cuenta.body.id, iso(ANIO, 3, 10));
    await agent.patch(`/api/contabilidad/asientos/${creado.body.id}/anular`);

    const res = await agent.put(`/api/contabilidad/asientos/${creado.body.id}`).send({
      fecha: iso(ANIO, 3, 12),
      concepto: 'Intento',
      lineas: [
        { cuentaId: cuenta.body.id, debe: 1, haber: 0 },
        { cuentaId: cuenta.body.id, debe: 0, haber: 1 },
      ],
    });
    expect(res.status).toBe(403);
  });
});

describe('Aislamiento entre empresas', () => {
  async function segundaEmpresa(agent) {
    const u = await models.Usuario.create({
      nombre: 'Otra Empresa',
      cedula: '999-0000000-3',
      email: 'otra@prueba.local',
      password: bcrypt.hashSync('clave123', 10),
      limiteEgresos: null,
      tipoPersona: 'JURIDICA',
      fechaCorte: 1,
      rol: 'USUARIO',
    });
    await agent.post('/api/auth/login').send({ cedula: '999-0000000-3', password: 'clave123' });
    return u;
  }

  it('una empresa no ve ni puede usar las cuentas de otra', async () => {
    const admin = await agenteAdmin();
    const cuenta = await cuentaBase(admin);

    const otro = request.agent(app);
    await segundaEmpresa(otro);

    const lista = await otro.get('/api/contabilidad/cuentas');
    expect(lista.status).toBe(200);
    expect(lista.body.length).toBe(0);

    const asiento = await otro.post('/api/contabilidad/asientos').send({
      fecha: iso(ANIO, 4, 1),
      concepto: 'Intrusión',
      lineas: [
        { cuentaId: cuenta.body.id, debe: 500, haber: 0 },
        { cuentaId: cuenta.body.id, debe: 0, haber: 500 },
      ],
    });
    expect(asiento.status).toBe(400);

    const detalle = await otro.get(`/api/contabilidad/asientos/${cuenta.body.id}`);
    expect(detalle.status).toBe(404);
  });
});

describe('Libros y reportes', () => {
  let agent;
  let cuenta;

  beforeEach(async () => {
    agent = await agenteAdmin();
    cuenta = await cuentaBase(agent);
    await asientoDoble(agent, cuenta.body.id, iso(ANIO, 5, 10), 'Aporte mayo');
    await asientoDoble(agent, cuenta.body.id, iso(ANIO, 5, 20), 'Aporte fin mayo');
  });

  it('libro diario devuelve movimientos y totales', async () => {
    const res = await agent.get('/api/contabilidad/libro-diario');
    expect(res.status).toBe(200);
    expect(res.body.filas.length).toBe(4);
    expect(res.body.totalDebe).toBe(2000);
    expect(res.body.totalHaber).toBe(2000);
  });

  it('libro diario filtra por rango de fechas y por cuenta', async () => {
    const res = await agent.get(`/api/contabilidad/libro-diario?desde=${iso(ANIO, 5, 15)}&hasta=${iso(ANIO, 5, 31)}&cuentaId=${cuenta.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.filas.length).toBe(2);
    expect(res.body.totalDebe).toBe(1000);
  });

  it('libro mayor acumula saldo por cuenta', async () => {
    const res = await agent.get(`/api/contabilidad/libro-mayor?cuentaId=${cuenta.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.movimientos.length).toBe(4);
    expect(res.body.saldo).toBe(0);
    expect(res.body.totalDebe).toBe(2000);
  });

  it('libro mayor exige cuentaId', async () => {
    const res = await agent.get('/api/contabilidad/libro-mayor');
    expect(res.status).toBe(400);
  });

  it('balance de comprobación cuadra', async () => {
    const res = await agent.get('/api/contabilidad/balance-comprobacion');
    expect(res.status).toBe(200);
    expect(res.body.filas.length).toBe(1);
    expect(res.body.cuadra).toBe(true);
    expect(res.body.totalDebe).toBe(2000);
    expect(res.body.totalHaber).toBe(2000);
  });
});