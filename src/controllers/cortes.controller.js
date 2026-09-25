'use strict';

const { Op } = require('sequelize');
const { Corte, Usuario, Transaccion } = require('../models');
const { serverError, forbidden, badRequest } = require('../utils/http');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function diasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

// Primer día del mes siguiente al período (anio, mes). Como los meses en JS
// son 0-indexados, (anio, mes, 1) ya apunta al mes siguiente al indicado.
function primerDiaSiguienteMes(anio, mes) {
  return new Date(anio, mes, 1);
}

// Un período mensual solo puede cerrarse cuando ya terminó, es decir, cuando la
// fecha actual es mayor o igual al primer día del mes siguiente. Esto evita
// depender de la cantidad de días (28, 29, 30 o 31) o de comparaciones por string.
function periodoCerrable(anio, mes, hoy = new Date()) {
  return hoy >= primerDiaSiguienteMes(anio, mes);
}

// Estado del período respecto a la fecha REAL del sistema: 'pasado', 'curso' o
// 'futuro'. Compara SIEMPRE mes + año (clave = año*12 + mes), nunca solo el mes,
// por lo que se recalcula automáticamente al cambiar el mes del calendario.
function estadoPeriodo(anio, mes, hoy = new Date()) {
  const clave = anio * 12 + (mes - 1);
  const claveHoy = hoy.getFullYear() * 12 + hoy.getMonth();
  if (clave < claveHoy) return 'pasado';
  if (clave === claveHoy) return 'curso';
  return 'futuro';
}

function mensajePeriodoEnCurso(anio, mes, hoy = new Date()) {
  if (periodoCerrable(anio, mes, hoy)) return '';
  const siguiente = primerDiaSiguienteMes(anio, mes);
  const inicio = `El cierre estará disponible a partir del 1 de ${MESES[siguiente.getMonth()].toLowerCase()} de ${siguiente.getFullYear()}.`;
  if (estadoPeriodo(anio, mes, hoy) === 'futuro') {
    return `El mes de ${MESES[mes - 1].toLowerCase()} de ${anio} todavía no ha comenzado. ${inicio}`;
  }
  return `No puedes cerrar el período de ${MESES[mes - 1].toLowerCase()} de ${anio} porque el mes todavía está en curso. ${inicio}`;
}

function clampCorte(anio, mes, fechaCorte) {
  return Math.min(fechaCorte, diasDelMes(anio, mes));
}

function toISO(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function validarAnioMes(anio, mes) {
  const a = Number(anio);
  const m = Number(mes);
  if (!Number.isInteger(a) || a < 1900 || a > 2100) return { error: 'Año inválido.' };
  if (!Number.isInteger(m) || m < 1 || m > 12) return { error: 'Mes inválido (1-12).' };
  return { anio: a, mes: m };
}

async function procesar(req, res) {
  try {
    const hoy = new Date();
    const { anio: a = hoy.getFullYear(), mes: m = hoy.getMonth() + 1 } = req.query;
    const validado = validarAnioMes(a, m);
    if (validado.error) return res.status(400).json({ error: validado.error });
    const { anio, mes } = validado;

    if (!periodoCerrable(anio, mes, hoy)) {
      return badRequest(res, mensajePeriodoEnCurso(anio, mes, hoy));
    }

    const usuarioId = req.query.usuarioId ? Number(req.query.usuarioId) : null;
    const soloUsuario = req.session.rol !== 'ADMIN' ? req.session.userId : null;

    if (soloUsuario && usuarioId && usuarioId !== soloUsuario) {
      return forbidden(res, 'No puede procesar cortes de otro usuario.');
    }

    const whereUsuario = { estado: 'ACTIVO' };
    if (soloUsuario) whereUsuario.id = soloUsuario;
    if (usuarioId && !soloUsuario) whereUsuario.id = usuarioId;

    const usuarios = await Usuario.findAll({ where: whereUsuario, order: [['nombre', 'ASC']] });

    const resultados = [];
    for (const usuario of usuarios) {
      const fechaCorteDia = clampCorte(anio, mes, usuario.fechaCorte || 1);
      const fechaCorte = toISO(anio, mes, fechaCorteDia);

      const yaExiste = await Corte.findOne({ where: { usuarioId: usuario.id, anio, mes } });
      if (yaExiste) {
        resultados.push({ usuarioId: usuario.id, usuario: usuario.nombre, skip: true, mensaje: 'Ya existe un corte para este período.' });
        continue;
      }

      const previo = await Corte.findOne({
        where: { usuarioId: usuario.id, fechaCorte: { [Op.lt]: fechaCorte } },
        order: [['fechaCorte', 'DESC']],
      });
      const balanceInicial = previo ? Number(previo.balanceCorte) : 0;

      const inicioPeriodo = previo ? previo.fechaCorte : '1900-01-01';
      const txs = await Transaccion.findAll({
        where: {
          usuarioId: usuario.id,
          estado: 'ACTIVO',
          fechaTransaccion: { [Op.gt]: inicioPeriodo, [Op.lte]: fechaCorte },
        },
      });

      let totalIngresos = 0;
      let totalEgresos = 0;
      for (const t of txs) {
        if (t.tipo === 'INGRESO') totalIngresos += Number(t.monto);
        else totalEgresos += Number(t.monto);
      }
      const balanceCorte = balanceInicial + totalIngresos - totalEgresos;

      const corte = await Corte.create({
        usuarioId: usuario.id,
        anio, mes,
        fechaCorte,
        balanceInicial, totalIngresos, totalEgresos, balanceCorte,
      });

      resultados.push({
        id: corte.id, usuarioId: usuario.id, usuario: usuario.nombre, anio, mes,
        fechaCorte, balanceInicial, totalIngresos, totalEgresos, balanceCorte,
        cantidadTransacciones: txs.length,
      });
    }

    res.json({ anio, mes, resultados });
  } catch (error) {
    serverError(res, error);
  }
}

async function historial(req, res) {
  try {
    const where = {};
    if (req.session.rol !== 'ADMIN') where.usuarioId = req.session.userId;
    if (req.query.usuarioId && req.session.rol === 'ADMIN') where.usuarioId = Number(req.query.usuarioId);
    const rows = await Corte.findAll({
      where,
      include: [{ model: Usuario, as: 'usuario' }],
      order: [['anio', 'DESC'], ['mes', 'DESC'], ['usuarioId', 'ASC']],
    });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

module.exports = { procesar, historial, diasDelMes, clampCorte, toISO, validarAnioMes, periodoCerrable, estadoPeriodo, mensajePeriodoEnCurso };