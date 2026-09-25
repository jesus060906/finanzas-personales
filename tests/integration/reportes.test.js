'use strict';

const { app, request, seedBasica, agenteAdmin, agenteUsuario } = require('../helpers');

let data;

function fechaMes(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function mesActual() {
  const h = new Date();
  return { anio: h.getFullYear(), mes: h.getMonth() + 1 };
}

function mesAnterior() {
  const p = new Date();
  p.setDate(1);
  p.setMonth(p.getMonth() - 1);
  return { anio: p.getFullYear(), mes: p.getMonth() + 1 };
}

beforeEach(async () => {
  data = await seedBasica();
});

describe('GET /api/reportes/dashboard', () => {
  it('devuelve el resumen del usuario autenticado', async () => {
    const agent = await agenteUsuario();
    const res = await agent.get('/api/reportes/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.usuario.nombre).toBe('Juan Pérez');
    expect(res.body.mes).toHaveProperty('balance');
    expect(res.body.totales).toHaveProperty('transacciones');
    expect(res.body.limite).toBe(15000);
    expect(res.body.superaLimite).toBe(false);
    expect(res.body.pctUso).toBe(0);
    expect(res.body).toHaveProperty('porCategoria');
    expect(res.body).toHaveProperty('ultimoCorte');
    expect(res.body.porMes).toHaveLength(6);
    expect(res.body.porMes[5]).toMatchObject({ anio: mesActual().anio, mes: mesActual().mes });
  });

  it('refleja superación del límite y porcentaje de uso', async () => {
    const { anio, mes } = mesActual();
    const fecha = fechaMes(anio, mes, 5);
    const agent = await agenteUsuario();
    const creada = await agent.post('/api/transacciones').send({
      tipo: 'EGRESO', egresoId: data.egreso.id, fechaTransaccion: fecha, monto: 16000,
    });
    expect(creada.body.advertencia.tipo).toBe('LIMITE_EXCEDIDO');

    const res = await agent.get('/api/reportes/dashboard');
    expect(res.body.superaLimite).toBe(true);
    expect(res.body.mes.egresos).toBe(16000);
    expect(res.body.pctUso).toBe(107);
  });
});

describe('Consulta de transacciones por criterios', () => {
  it('filtra por tipo y calcula totales', async () => {
    const agent = await agenteUsuario();
    const fecha = fechaMes(2026, 1, 5);
    await agent.post('/api/transacciones').send({ tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: fecha, monto: 1000 });
    await agent.post('/api/transacciones').send({ tipo: 'EGRESO', egresoId: data.egreso.id, fechaTransaccion: fecha, monto: 300 });

    const res = await agent.get('/api/reportes/transacciones?tipo=EGRESO');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.countIngresos).toBe(0);
    expect(res.body.countEgresos).toBe(1);
    expect(res.body.totalEgresos).toBe(300);
    expect(res.body.balance).toBe(-300);
  });

  it('filtra por rango de fechas', async () => {
    const agent = await agenteUsuario();
    await agent.post('/api/transacciones').send({ tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: '2026-02-10', monto: 1000 });
    await agent.post('/api/transacciones').send({ tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: '2026-03-20', monto: 2000 });

    const res = await agent.get('/api/reportes/transacciones?desde=2026-03-01&hasta=2026-03-31');
    expect(res.body.count).toBe(1);
    expect(res.body.totalIngresos).toBe(2000);
  });

  it('filtra por monto mínimo y máximo', async () => {
    const agent = await agenteUsuario();
    await agent.post('/api/transacciones').send({ tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: '2026-02-10', monto: 100 });
    await agent.post('/api/transacciones').send({ tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: '2026-02-11', monto: 500 });
    await agent.post('/api/transacciones').send({ tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: '2026-02-12', monto: 1000 });

    const res = await agent.get('/api/reportes/transacciones?montoMin=200&montoMax=800');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.rows[0].monto).toBe(500);
  });

  it('filtra por tipo de pago', async () => {
    const agent = await agenteUsuario();
    await agent.post('/api/transacciones').send({ tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: '2026-02-10', monto: 100 });
    const res = await agent.get(`/api/reportes/transacciones?tipoPagoId=${data.tipoPago.id}`);
    expect(res.body.count).toBe(1);
  });
});

describe('Reporte de corte', () => {
  it('incluye cantidad de transacciones por corte', async () => {
    const admin = await agenteAdmin();
    const agente = await agenteUsuario();
    const { anio, mes } = mesAnterior();
    const fecha = fechaMes(anio, mes, 5);

    await agente.post('/api/transacciones').send({ tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: fecha, monto: 1000 });

    const proc = await admin.post(`/api/cortes/proceso?anio=${anio}&mes=${mes}&usuarioId=${data.usuario.id}`);
    expect(proc.status).toBe(200);

    const rep = await agente.get(`/api/reportes/corte?usuarioId=${data.usuario.id}`);
    expect(rep.status).toBe(200);
    const fila = rep.body.rows.find((c) => c.anio === anio && c.mes === mes);
    expect(fila).toBeTruthy();
    expect(typeof fila.cantidadTransacciones).toBe('number');
    expect(fila.totalIngresos).toBe(1000);
  });
});