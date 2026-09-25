'use strict';

const { app, request, seedBasica, agenteAdmin, agenteUsuario, models } = require('../helpers');

let data;
const hoy = new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  data = await seedBasica();
});

describe('Registro de transacciones', () => {
  it('registra un ingreso como usuario regular', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'INGRESO',
      ingresoId: data.ingreso.id,
      tipoPagoId: data.tipoPago.id,
      fechaTransaccion: hoy,
      monto: 25000,
      comentario: 'Salario mensual',
    });
    expect(res.status).toBe(201);
    expect(res.body.transaccion.tipo).toBe('INGRESO');
    expect(res.body.transaccion.numero).toMatch(/^TRX-IN-\d{4}-/);
    expect(res.body.transaccion.usuarioId).toBe(data.usuario.id);
  });

  it('registra un egreso usando el tipo de pago por defecto', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'EGRESO',
      egresoId: data.egreso.id,
      fechaTransaccion: hoy,
      monto: 3200.5,
    });
    expect(res.status).toBe(201);
    expect(res.body.transaccion.egresoId).toBe(data.egreso.id);
    expect(res.body.transaccion.tipoPagoId).toBe(data.tipoPago.id);
  });

  it('rechaza monto menor o igual a cero con 400', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'INGRESO',
      ingresoId: data.ingreso.id,
      fechaTransaccion: hoy,
      monto: 0,
    });
    expect(res.status).toBe(400);
  });

  it('rechaza monto negativo con 400', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'EGRESO',
      egresoId: data.egreso.id,
      fechaTransaccion: hoy,
      monto: -100,
    });
    expect(res.status).toBe(400);
  });

  it('rechaza tipo de transacción inválido con 400', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'TRANSFERENCIA',
      fechaTransaccion: hoy,
      monto: 100,
    });
    expect(res.status).toBe(400);
  });

  it('rechaza fecha inválida con 400', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'INGRESO',
      ingresoId: data.ingreso.id,
      fechaTransaccion: '15/09/2026',
      monto: 100,
    });
    expect(res.status).toBe(400);
  });

  it('rechaza egreso sin egresoId con 400', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'EGRESO',
      fechaTransaccion: hoy,
      monto: 100,
    });
    expect(res.status).toBe(400);
  });

  it('un usuario regular no puede registrar transacciones para otro usuario', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'INGRESO',
      usuarioId: data.usuario2.id,
      ingresoId: data.ingreso.id,
      tipoPagoId: data.tipoPago.id,
      fechaTransaccion: hoy,
      monto: 100,
    });
    expect(res.status).toBe(201);
    expect(res.body.transaccion.usuarioId).toBe(data.usuario.id);
  });

  it('el administrador puede registrar transacciones para otro usuario', async () => {
    const agent = await agenteAdmin();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'EGRESO',
      usuarioId: data.usuario.id,
      egresoId: data.egreso.id,
      fechaTransaccion: hoy,
      monto: 500,
    });
    expect(res.status).toBe(201);
    expect(res.body.transaccion.usuarioId).toBe(data.usuario.id);
  });
});

describe('Validación del número de tarjeta', () => {
  const registrar = (agent, noTarjeta) => agent.post('/api/transacciones').send({
    tipo: 'EGRESO',
    egresoId: data.egreso.id,
    fechaTransaccion: hoy,
    monto: 100,
    noTarjeta,
  });

  it('acepta un número de tarjeta de 15 dígitos', async () => {
    const agent = await agenteUsuario();
    const res = await registrar(agent, '378282246310005');
    expect(res.status).toBe(201);
    expect(res.body.transaccion.noTarjeta).toBe('378282246310005');
  });

  it('acepta un número de tarjeta de 16 dígitos', async () => {
    const agent = await agenteUsuario();
    const res = await registrar(agent, '4111111111111111');
    expect(res.status).toBe(201);
    expect(res.body.transaccion.noTarjeta).toBe('4111111111111111');
  });

  it('acepta omitir el campo porque es opcional', async () => {
    const agent = await agenteUsuario();
    const res = await registrar(agent, undefined);
    expect(res.status).toBe(201);
    expect(res.body.transaccion.noTarjeta).toBeNull();
  });

  it('rechaza menos de 15 dígitos con 400', async () => {
    const agent = await agenteUsuario();
    for (const valor of ['1', '411111111111', '12345678901234']) {
      const res = await registrar(agent, valor);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('El número de tarjeta debe contener 15 o 16 dígitos.');
    }
  });

  it('rechaza más de 16 dígitos con 400', async () => {
    const agent = await agenteUsuario();
    for (const valor of ['41111111111111112', '12345678901234567890']) {
      const res = await registrar(agent, valor);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('El número de tarjeta debe contener 15 o 16 dígitos.');
    }
  });

  it('rechaza letras, espacios y símbolos con 400', async () => {
    const agent = await agenteUsuario();
    for (const valor of ['**** 1234', '4111 1111 1111 1111', '4111-1111-1111-1111', 'abcd1234efgh5678']) {
      const res = await registrar(agent, valor);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('El número de tarjeta debe contener 15 o 16 dígitos.');
    }
  });

  it('rechaza un número enviado como valor numérico con 400', async () => {
    const agent = await agenteUsuario();
    const res = await registrar(agent, 4111111111111111);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El número de tarjeta debe contener 15 o 16 dígitos.');
  });

  it('no guarda nada cuando el número de tarjeta es inválido', async () => {
    const agent = await agenteUsuario();
    const antes = await models.Transaccion.count();
    const res = await registrar(agent, '1234');
    expect(res.status).toBe(400);
    expect(await models.Transaccion.count()).toBe(antes);
  });
});

describe('Límite mensual de egresos', () => {
  it('alerta cuando un egreso supera el límite mensual del usuario', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'EGRESO',
      egresoId: data.egreso.id,
      fechaTransaccion: hoy,
      monto: 16000,
    });
    expect(res.status).toBe(201);
    expect(res.body.advertencia).toMatchObject({ tipo: 'LIMITE_EXCEDIDO' });
    expect(res.body.advertencia.total).toBeGreaterThanOrEqual(16000);
  });

  it('no alerta si el mes está dentro del límite', async () => {
    const agent = await agenteUsuario();
    const res = await agent.post('/api/transacciones').send({
      tipo: 'EGRESO',
      egresoId: data.egreso.id,
      fechaTransaccion: hoy,
      monto: 2000,
    });
    expect(res.status).toBe(201);
    expect(res.body.advertencia).toBeNull();
  });
});

describe('Listado y anulación', () => {
  it('lista solo transacciones activas y propias', async () => {
    const agent = await agenteUsuario();
    await agent.post('/api/transacciones').send({
      tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: hoy, monto: 1000,
    });
    const res = await agent.get('/api/transacciones');
    expect(res.status).toBe(200);
    expect(res.body.every((t) => t.estado === 'ACTIVO')).toBe(true);
    expect(res.body.every((t) => t.usuarioId === data.usuario.id)).toBe(true);
  });

  it('anula una transacción y deja de aparecer en el listado', async () => {
    const agent = await agenteUsuario();
    const creada = await agent.post('/api/transacciones').send({
      tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: hoy, monto: 1000,
    });
    const id = creada.body.transaccion.id;

    const anulada = await agent.patch(`/api/transacciones/${id}/anular`);
    expect(anulada.status).toBe(200);

    const lista = await agent.get('/api/transacciones');
    expect(lista.body.find((t) => t.id === id)).toBeUndefined();
  });

  it('no permite anular transacciones de otro usuario', async () => {
    const agent = await agenteAdmin();
    const creada = await agent.post('/api/transacciones').send({
      tipo: 'INGRESO',
      usuarioId: data.usuario2.id,
      ingresoId: data.ingreso.id,
      tipoPagoId: data.tipoPago.id,
      fechaTransaccion: hoy,
      monto: 1000,
    });
    const id = creada.body.transaccion.id;

    const otro = await agenteUsuario();
    const res = await otro.patch(`/api/transacciones/${id}/anular`);
    expect(res.status).toBe(403);
  });

  it('genera números de transacción correlativos', async () => {
    const agent = await agenteUsuario();
    const a = await agent.post('/api/transacciones').send({
      tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: hoy, monto: 100,
    });
    const b = await agent.post('/api/transacciones').send({
      tipo: 'INGRESO', ingresoId: data.ingreso.id, tipoPagoId: data.tipoPago.id, fechaTransaccion: hoy, monto: 200,
    });
    expect(a.body.transaccion.numero).not.toBe(b.body.transaccion.numero);
  });

  it('no colisiona cuando existen huecos en la numeración', async () => {
    const agent = await agenteUsuario();
    const prefijoFecha = new Date().getFullYear();
    const numeroAlto = `TRX-EG-${prefijoFecha}-000050`;
    await models.Transaccion.create({
      numero: numeroAlto, tipo: 'EGRESO', usuarioId: data.usuario.id, egresoId: data.egreso.id,
      tipoPagoId: data.tipoPago.id, fechaTransaccion: hoy, monto: 1, estado: 'ACTIVO',
    });

    const res = await agent.post('/api/transacciones').send({
      tipo: 'EGRESO', egresoId: data.egreso.id, fechaTransaccion: hoy, monto: 100,
    });
    expect(res.status).toBe(201);
    const siguiente = `TRX-EG-${prefijoFecha}-000051`;
    expect(res.body.transaccion.numero).toBe(siguiente);
  });
});