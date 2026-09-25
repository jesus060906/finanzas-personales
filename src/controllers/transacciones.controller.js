'use strict';

const { Op } = require('sequelize');
const { Transaccion, Egreso, Ingreso, Usuario, TipoPago } = require('../models');
const { serverError, badRequest, notFound, forbidden } = require('../utils/http');
const {
  esMontoValido, esFechaValida, esTarjetaValida, normalizarTarjeta, enLista, TIPOS_TRANSACCION,
} = require('../utils/validators');

const include = [
  { model: Usuario, as: 'usuario' },
  { model: Egreso, as: 'egreso', include: ['tipoEgreso', 'renglon', 'tipoPagoDefecto'] },
  { model: Ingreso, as: 'ingreso', include: ['tipoIngreso'] },
  { model: TipoPago, as: 'tipoPago' },
];

async function generarNumero(tipo) {
  const anio = new Date().getFullYear();
  const prefijo = tipo === 'INGRESO' ? 'IN' : 'EG';
  const prefijoCompleto = `TRX-${prefijo}-${anio}-`;
  const max = await Transaccion.max('numero', {
    where: { numero: { [Op.like]: `${prefijoCompleto}%` } },
  });
  const base = max ? Number(String(max).split('-').pop()) : 0;
  const siguiente = Number.isFinite(base) && base >= 0 ? base + 1 : 1;
  return `${prefijoCompleto}${String(siguiente).padStart(6, '0')}`;
}

async function crearConReintento(datos) {
  for (let intento = 0; intento < 5; intento++) {
    const numero = await generarNumero(datos.tipo);
    try {
      return await Transaccion.create({ ...datos, numero });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError' && intento < 4) continue;
      throw err;
    }
  }
}

async function validarCatalogo(tipo, egresoId, ingresoId) {
  if (tipo === 'EGRESO') {
    if (!egresoId) return { error: 'Debe indicar el egreso para una transacción de egreso.' };
    const egreso = await Egreso.findByPk(egresoId, { include: ['tipoPagoDefecto'] });
    if (!egreso || egreso.estado !== 'ACTIVO') return { error: 'Egreso no encontrado o inactivo.' };
    return { egreso };
  }
  if (tipo === 'INGRESO') {
    if (!ingresoId) return { error: 'Debe indicar el ingreso para una transacción de ingreso.' };
    const ingreso = await Ingreso.findByPk(ingresoId);
    if (!ingreso || ingreso.estado !== 'ACTIVO') return { error: 'Ingreso no encontrado o inactivo.' };
    return { ingreso };
  }
  return { error: 'Tipo de transacción inválido. Use INGRESO o EGRESO.' };
}

async function crear(req, res) {
  try {
    const {
      tipo, usuarioId, egresoId = null, ingresoId = null,
      tipoPagoId = null, fechaTransaccion, monto, noTarjeta = null, comentario = null,
    } = req.body;

    if (!enLista(tipo, TIPOS_TRANSACCION)) {
      return badRequest(res, 'Tipo de transacción inválido. Use INGRESO o EGRESO.');
    }
    if (!esMontoValido(monto)) {
      return badRequest(res, 'El monto debe ser un número mayor que cero.');
    }
    if (!esFechaValida(fechaTransaccion)) {
      return badRequest(res, 'La fecha de transacción es inválida (formato YYYY-MM-DD).');
    }
    const tarjeta = normalizarTarjeta(noTarjeta);
    if (!esTarjetaValida(tarjeta)) {
      return badRequest(res, 'El número de tarjeta debe contener 15 o 16 dígitos.');
    }

    // Rol USUARIO solo puede registrar para sí mismo
    const targetId = req.session.rol === 'ADMIN' ? (usuarioId || req.session.userId) : req.session.userId;

    const usuario = await Usuario.findByPk(targetId);
    if (!usuario) return notFound(res, 'Usuario no encontrado.');

    const val = await validarCatalogo(tipo, egresoId, ingresoId);
    if (val.error) return badRequest(res, val.error);

    let tipoPagoFinal = tipoPagoId;
    if (tipo === 'EGRESO' && !tipoPagoFinal && val.egreso.tipoPagoDefecto) {
      tipoPagoFinal = val.egreso.tipoPagoDefecto.id;
    }
    if (!tipoPagoFinal) {
      return badRequest(res, 'Debe indicar el tipo de pago.');
    }
    const tipoPago = await TipoPago.findByPk(tipoPagoFinal);
    if (!tipoPago) return badRequest(res, 'El tipo de pago indicado no existe.');

    const tx = await crearConReintento({
      tipo, usuarioId: targetId,
      egresoId: tipo === 'EGRESO' ? val.egreso.id : null,
      ingresoId: tipo === 'INGRESO' ? val.ingreso.id : null,
      tipoPagoId: tipoPagoFinal, fechaTransaccion, monto: Number(monto),
      noTarjeta: tarjeta, comentario, estado: 'ACTIVO',
    });

    const creada = await Transaccion.findByPk(tx.id, { include });
    const advertencia = await verificarLimite(targetId, tipo, Number(monto), fechaTransaccion);
    res.status(201).json({ transaccion: creada, advertencia });
  } catch (error) {
    serverError(res, error);
  }
}

async function verificarLimite(usuarioId, tipo, montoNuevo, fechaTransaccion) {
  try {
    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario || !usuario.limiteEgresos) return null;
    const [anio, mes] = String(fechaTransaccion).split('-').map(Number);
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 1);
    const txs = await Transaccion.findAll({
      where: {
        usuarioId,
        tipo: 'EGRESO',
        estado: 'ACTIVO',
        fechaTransaccion: { [Op.gte]: inicio, [Op.lt]: fin },
      },
    });
    let total = 0;
    for (const t of txs) total += Number(t.monto);
    if (tipo === 'EGRESO') total += montoNuevo;
    const limite = Number(usuario.limiteEgresos);
    if (total > limite) {
      return {
        tipo: 'LIMITE_EXCEDIDO',
        mensaje: `El usuario ${usuario.nombre} ha superado el límite mensual de gastos (${limite}). Total del mes: ${total}.`,
        total, limite, pct: Math.round((total / limite) * 100),
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function listar(req, res) {
  try {
    const where = { estado: 'ACTIVO' };
    if (req.session.rol !== 'ADMIN') where.usuarioId = req.session.userId;
    const rows = await Transaccion.findAll({ where, include, order: [['fechaTransaccion', 'DESC'], ['id', 'DESC']], limit: 500 });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

async function anular(req, res) {
  try {
    const tx = await Transaccion.findByPk(req.params.id);
    if (!tx) return notFound(res, 'Transacción no encontrada.');
    if (req.session.rol !== 'ADMIN' && tx.usuarioId !== req.session.userId) {
      return forbidden(res, 'No puede anular transacciones de otro usuario.');
    }
    await tx.update({ estado: 'INACTIVO' });
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error);
  }
}

module.exports = { crear, listar, anular, verificarLimite, generarNumero };