'use strict';

const { Op } = require('sequelize');
const {
  Transaccion, Usuario, Corte, Egreso, Ingreso, TipoPago,
} = require('../models');
const { serverError } = require('../utils/http');

const include = [
  { model: Usuario, as: 'usuario' },
  { model: Egreso, as: 'egreso', include: ['tipoEgreso', 'renglon', 'tipoPagoDefecto'] },
  { model: Ingreso, as: 'ingreso', include: ['tipoIngreso'] },
  { model: TipoPago, as: 'tipoPago' },
];

const includeEgreso = { model: Egreso, as: 'egreso', include: ['tipoEgreso', 'renglon', 'tipoPagoDefecto'] };
const includeIngreso = { model: Ingreso, as: 'ingreso', include: ['tipoIngreso'] };

async function consulta(req, res) {
  try {
    const {
      usuarioId, desde, hasta, tipo, egresoId, ingresoId,
      tipoPagoId, tipoEgresoId, tipoIngresoId, renglonId, estado = 'ACTIVO',
      montoMin, montoMax,
    } = req.query;

    const where = {};
    if (estado) where.estado = estado;
    if (req.session.rol !== 'ADMIN') where.usuarioId = req.session.userId;
    if (usuarioId && req.session.rol === 'ADMIN') where.usuarioId = Number(usuarioId);
    if (tipo) where.tipo = tipo;
    if (egresoId) where.egresoId = Number(egresoId);
    if (ingresoId) where.ingresoId = Number(ingresoId);
    if (tipoPagoId) where.tipoPagoId = Number(tipoPagoId);

    if (desde || hasta) {
      where.fechaTransaccion = {};
      if (desde) where.fechaTransaccion[Op.gte] = desde;
      if (hasta) where.fechaTransaccion[Op.lte] = hasta;
    }
    if (montoMin !== undefined && montoMin !== '') {
      where.monto = where.monto || {};
      where.monto[Op.gte] = Number(montoMin);
    }
    if (montoMax !== undefined && montoMax !== '') {
      where.monto = where.monto || {};
      where.monto[Op.lte] = Number(montoMax);
    }

    const txInclude = [...include];
    if (tipoEgresoId) {
      txInclude[1] = { ...includeEgreso, required: true, where: { tipoEgresoId: Number(tipoEgresoId) } };
    }
    if (renglonId) {
      txInclude[1] = {
        ...includeEgreso, required: true,
        where: { ...(txInclude[1].where || {}), renglonId: Number(renglonId) },
      };
    }
    if (tipoIngresoId) {
      txInclude[2] = { ...includeIngreso, required: true, where: { tipoIngresoId: Number(tipoIngresoId) } };
    }

    const rows = await Transaccion.findAll({ where, include: txInclude, order: [['fechaTransaccion', 'DESC']] });

    const totalIngresos = rows.filter((r) => r.tipo === 'INGRESO').reduce((s, r) => s + Number(r.monto), 0);
    const totalEgresos = rows.filter((r) => r.tipo === 'EGRESO').reduce((s, r) => s + Number(r.monto), 0);

    res.json({
      count: rows.length,
      countIngresos: rows.filter((r) => r.tipo === 'INGRESO').length,
      countEgresos: rows.filter((r) => r.tipo === 'EGRESO').length,
      totalIngresos,
      totalEgresos,
      balance: totalIngresos - totalEgresos,
      rows,
    });
  } catch (error) {
    serverError(res, error);
  }
}

async function consultaCorteDetalle(corte) {
  const previo = await Corte.findOne({
    where: { usuarioId: corte.usuarioId, fechaCorte: { [Op.lt]: corte.fechaCorte } },
    order: [['fechaCorte', 'DESC']],
  });
  const inicio = previo ? previo.fechaCorte : '1900-01-01';
  return Transaccion.count({
    where: {
      usuarioId: corte.usuarioId,
      estado: 'ACTIVO',
      fechaTransaccion: { [Op.gt]: inicio, [Op.lte]: corte.fechaCorte },
    },
  });
}

async function reporteCorte(req, res) {
  try {
    const { desde, hasta, usuarioId } = req.query;
    const where = {};
    if (req.session.rol !== 'ADMIN') where.usuarioId = req.session.userId;
    if (usuarioId && req.session.rol === 'ADMIN') where.usuarioId = Number(usuarioId);
    if (desde || hasta) {
      where.fechaCorte = {};
      if (desde) where.fechaCorte[Op.gte] = desde;
      if (hasta) where.fechaCorte[Op.lte] = hasta;
    }
    const rows = await Corte.findAll({
      where,
      include: [{ model: Usuario, as: 'usuario' }],
      order: [['fechaCorte', 'DESC']],
      limit: 500,
    });

    const enriquecidas = [];
    for (const c of rows) {
      const cantidadTransacciones = await consultaCorteDetalle(c);
      enriquecidas.push({ ...c.toJSON(), cantidadTransacciones });
    }

    const totalIngresos = rows.reduce((s, r) => s + Number(r.totalIngresos), 0);
    const totalEgresos = rows.reduce((s, r) => s + Number(r.totalEgresos), 0);
    res.json({ count: rows.length, totalIngresos, totalEgresos, rows: enriquecidas });
  } catch (error) {
    serverError(res, error);
  }
}

async function resumenDash(req, res) {
  try {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const inicioMes = toISO(anio, mes, 1);
    const inicioSiguiente = toISO(anio, mes + 1, 1);
    const usuarioId = req.session.userId;

    const usuario = await Usuario.findByPk(usuarioId);
    const [txsMes, txsTotales] = await Promise.all([
      Transaccion.findAll({
        where: {
          usuarioId,
          estado: 'ACTIVO',
          fechaTransaccion: { [Op.gte]: inicioMes, [Op.lt]: inicioSiguiente },
        },
        include,
      }),
      Transaccion.findAll({ where: { usuarioId, estado: 'ACTIVO' }, include }),
    ]);

    let ingresosMes = 0, egresosMes = 0;
    for (const t of txsMes) if (t.tipo === 'INGRESO') ingresosMes += Number(t.monto); else egresosMes += Number(t.monto);
    let ingresosTotal = 0, egresosTotal = 0;
    for (const t of txsTotales) if (t.tipo === 'INGRESO') ingresosTotal += Number(t.monto); else egresosTotal += Number(t.monto);

    const limite = usuario.limiteEgresos !== null && usuario.limiteEgresos !== undefined ? Number(usuario.limiteEgresos) : null;
    const pctUso = limite ? Math.round((egresosMes / limite) * 100) : null;
    const superaLimite = limite !== null && egresosMes > limite;

    const ultimaTx = txsTotales[0] || null;
    const ultimoCorte = await Corte.findOne({
      where: { usuarioId },
      order: [['anio', 'DESC'], ['mes', 'DESC'], ['id', 'DESC']],
    });

    const porCategoria = {};
    for (const t of txsMes) {
      if (t.tipo !== 'EGRESO') continue;
      const label = (t.egreso && t.egreso.renglon && t.egreso.renglon.descripcion) || 'Sin categoría';
      porCategoria[label] = (porCategoria[label] || 0) + Number(t.monto);
    }

    const porMesMap = {};
    for (const t of txsTotales) {
      const key = String(t.fechaTransaccion).slice(0, 7);
      porMesMap[key] = porMesMap[key] || { ingresos: 0, egresos: 0 };
      if (t.tipo === 'INGRESO') porMesMap[key].ingresos += Number(t.monto);
      else porMesMap[key].egresos += Number(t.monto);
    }
    const porMes = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      const d = porMesMap[key] || { ingresos: 0, egresos: 0 };
      porMes.push({
        anio: m.getFullYear(),
        mes: m.getMonth() + 1,
        ingresos: d.ingresos,
        egresos: d.egresos,
        balance: d.ingresos - d.egresos,
      });
    }

    res.json({
      usuario: { nombre: usuario.nombre, rol: usuario.rol, limiteEgresos: limite },
      mes: {
        anio, mes,
        ingresos: ingresosMes, egresos: egresosMes, balance: ingresosMes - egresosMes,
        transacciones: txsMes.length,
      },
      totales: {
        ingresos: ingresosTotal, egresos: egresosTotal, balance: ingresosTotal - egresosTotal,
        transacciones: txsTotales.length,
      },
      limite,
      superaLimite,
      pctUso,
      ultimaTx,
      ultimoCorte,
      porCategoria,
      porMes,
    });
  } catch (error) {
    serverError(res, error);
  }
}

function toISO(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

module.exports = { consulta, reporteCorte, resumenDash };