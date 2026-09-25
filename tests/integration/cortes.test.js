'use strict';

const { app, request, seedBasica, agenteAdmin, agenteUsuario } = require('../helpers');

let data;

function fechaMes(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
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

describe('Proceso de corte mensual', () => {
  it('procesa un corte con el balance correcto', async () => {
    const { anio, mes } = mesAnterior();
    const fecha = fechaMes(anio, mes, 5);
    const admin = await agenteAdmin();

    await admin.post('/api/transacciones').send({
      tipo: 'INGRESO', usuarioId: data.usuario.id, ingresoId: data.ingreso.id,
      tipoPagoId: data.tipoPago.id, fechaTransaccion: fecha, monto: 1000,
    });
    await admin.post('/api/transacciones').send({
      tipo: 'EGRESO', usuarioId: data.usuario.id, egresoId: data.egreso.id,
      fechaTransaccion: fecha, monto: 300,
    });

    const res = await admin.post(`/api/cortes/proceso?anio=${anio}&mes=${mes}&usuarioId=${data.usuario.id}`);
    expect(res.status).toBe(200);

    const corte = res.body.resultados.find((r) => r.usuarioId === data.usuario.id);
    expect(corte).toBeTruthy();
    expect(corte).toMatchObject({
      balanceInicial: 0,
      totalIngresos: 1000,
      totalEgresos: 300,
      balanceCorte: 700,
      cantidadTransacciones: 2,
    });
  });

  it('omite cortes ya existentes para el mismo período', async () => {
    const { anio, mes } = mesAnterior();
    const admin = await agenteAdmin();

    const primero = await admin.post(`/api/cortes/proceso?anio=${anio}&mes=${mes}&usuarioId=${data.usuario.id}`);
    expect(primero.body.resultados.find((r) => r.usuarioId === data.usuario.id && r.skip)).toBeUndefined();

    const segundo = await admin.post(`/api/cortes/proceso?anio=${anio}&mes=${mes}&usuarioId=${data.usuario.id}`);
    const revisado = segundo.body.resultados.find((r) => r.usuarioId === data.usuario.id);
    expect(revisado.skip).toBe(true);
  });

  it('valida año y mes', async () => {
    const admin = await agenteAdmin();
    const res = await admin.post('/api/cortes/proceso?anio=999&mes=13');
    expect(res.status).toBe(400);
  });

  it('rechaza cerrar el mes actual desde el backend', async () => {
    const hoy = new Date();
    const admin = await agenteAdmin();
    const res = await admin.post(`/api/cortes/proceso?anio=${hoy.getFullYear()}&mes=${hoy.getMonth() + 1}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/todavía está en curso/);
  });

  it('bloquea a un usuario procesar cortes de otro', async () => {
    const { anio, mes } = mesAnterior();
    const agent = await agenteUsuario();
    const res = await agent.post(`/api/cortes/proceso?anio=${anio}&mes=${mes}&usuarioId=${data.usuario2.id}`);
    expect(res.status).toBe(403);
  });
});

describe('Historial de cortes', () => {
  it('listá los cortes propios para un usuario regular', async () => {
    const { anio, mes } = mesAnterior();
    const admin = await agenteAdmin();
    await admin.post(`/api/cortes/proceso?anio=${anio}&mes=${mes}&usuarioId=${data.usuario.id}`);

    const agent = await agenteUsuario();
    const res = await agent.get('/api/cortes');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    res.body.forEach((c) => expect(c.usuarioId).toBe(data.usuario.id));
  });
});