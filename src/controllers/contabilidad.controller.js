'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  Usuario,
  CuentaContable,
  PeriodoContable,
  AsientoContable,
  AsientoLinea,
} = require('../models');
const {
  serverError, badRequest, notFound, forbidden, conflict,
} = require('../utils/http');
const { esFechaValida, esTextoNoVacio, enLista, ESTADOS } = require('../utils/validators');

const TIPOS_CUENTA = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO'];
const ESTADOS_PERIODO = ['ABIERTO', 'CERRADO'];

const igualAMasMenosUnCentavo = (a, b) => Math.abs(Number(a) - Number(b)) < 0.009;

// ============ UTILIDADES ============

async function cuentaDeEmpresa(usuarioId, id) {
  return CuentaContable.findOne({ where: { id, usuarioId } });
}

async function periodoCerradoQueContiene(usuarioId, fecha) {
  return PeriodoContable.findOne({
    where: {
      usuarioId,
      estado: 'CERRADO',
      fechaInicio: { [Op.lte]: fecha },
      fechaFin: { [Op.gte]: fecha },
    },
  });
}

async function generaCiclo(usuarioId, id, padreId) {
  if (id === padreId) return true;
  const visitados = new Set();
  let actual = padreId;
  while (actual) {
    if (actual === id || visitados.has(actual)) return true;
    visitados.add(actual);
    const padre = await CuentaContable.findOne({ where: { id: actual, usuarioId } });
    actual = padre ? padre.padreId : null;
  }
  return false;
}

async function generarNumeroAsiento(usuarioId, fecha) {
  const anio = new Date(`${fecha}T00:00:00Z`).getUTCFullYear();
  const prefijo = `AS-${anio}-`;
  const max = await AsientoContable.max('numero', {
    where: { usuarioId, numero: { [Op.like]: `${prefijo}%` } },
  });
  const base = max ? Number(String(max).split('-').pop()) : 0;
  const siguiente = Number.isFinite(base) && base >= 0 ? base + 1 : 1;
  return `${prefijo}${String(siguiente).padStart(6, '0')}`;
}

// Conversión estricta de un monto a número: solo dígitos con un único punto
// decimal opcional. Rechaza texto, signos, espacios ajenos, notación
// científica (1e3), hexadecimal (0x10), booleanos, etc.
function aDecimalValido(v) {
  if (v === null || v === undefined || v === '') return 0;
  const str = String(v).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) return NaN;
  return Number(str);
}

function validarLineasBase(lineas) {
  if (!Array.isArray(lineas) || lineas.length < 2) {
    return { error: 'El asiento debe contener al menos dos líneas contables.' };
  }
  const limpias = [];
  let totalDebe = 0;
  let totalHaber = 0;
  for (const l of lineas) {
    const debe = aDecimalValido(l && l.debe);
    const haber = aDecimalValido(l && l.haber);
    const cuentaId = Number(l && l.cuentaId);
    if (!Number.isInteger(cuentaId) || cuentaId <= 0) {
      return { error: 'Cada línea debe indicar una cuenta contable válida.' };
    }
    if (debe < 0 || haber < 0 || !Number.isFinite(debe) || !Number.isFinite(haber)) {
      return { error: 'Los montos de débito y crédito deben ser números no negativos.' };
    }
    if (debe <= 0 && haber <= 0) {
      return { error: 'Cada línea debe tener un débito o un crédito mayor que cero.' };
    }
    totalDebe += debe;
    totalHaber += haber;
    limpias.push({ cuentaId, descripcion: (l.descripcion || '').trim() || null, debe, haber });
  }
  if (totalDebe <= 0 || totalHaber <= 0) {
    return { error: 'El asiento debe incluir al menos un débito y un crédito.' };
  }
  if (!igualAMasMenosUnCentavo(totalDebe, totalHaber)) {
    return {
      error: `El asiento no cuadra: total débitos (${totalDebe.toFixed(2)}) debe ser igual a total créditos (${totalHaber.toFixed(2)}).`,
    };
  }
  return { lineas: limpias, totalDebe, totalHaber };
}

async function validarCuentasDeLineas(usuarioId, lineas) {
  for (const l of lineas) {
    const cuenta = await cuentaDeEmpresa(usuarioId, l.cuentaId);
    if (!cuenta || cuenta.estado !== 'ACTIVO') {
      return `Una de las cuentas no existe o no está activa en esta empresa (id ${l.cuentaId}).`;
    }
  }
  return null;
}

async function validarPeriodoAsiento(usuarioId, fecha, periodoId = null) {
  const cerrado = await periodoCerradoQueContiene(usuarioId, fecha);
  if (cerrado) {
    return `La fecha del asiento cae dentro del período cerrado "${cerrado.nombre}". No se pueden registrar ni modificar asientos en un período cerrado.`;
  }
  if (periodoId) {
    const periodo = await PeriodoContable.findOne({ where: { id: periodoId, usuarioId } });
    if (!periodo) return 'El período indicado no existe en esta empresa.';
    const dentro = fecha >= periodo.fechaInicio && fecha <= periodo.fechaFin;
    if (!dentro) return 'El asiento no coincide con el rango de fechas del período indicado.';
    if (periodo.estado === 'CERRADO') return `El período "${periodo.nombre}" está cerrado.`;
  }
  return null;
}

function filtrarRangoFechas(desde, hasta) {
  const cond = {};
  if (desde) cond.fecha = { ...(cond.fecha || {}), [Op.gte]: desde };
  if (hasta) cond.fecha = { ...(cond.fecha || {}), [Op.lte]: hasta };
  return cond;
}

// ============ PLAN DE CUENTAS ============

async function listarCuentas(req, res) {
  try {
    const { tipo = null, estado = null } = req.query;
    const where = { usuarioId: req.empresa.id };
    if (tipo && enLista(tipo, TIPOS_CUENTA)) where.tipo = tipo;
    if (estado && enLista(estado, ESTADOS)) where.estado = estado;
    const rows = await CuentaContable.findAll({
      where,
      include: [{ model: CuentaContable, as: 'padre' }],
      order: [['codigo', 'ASC']],
    });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

async function crearCuenta(req, res) {
  try {
    const { codigo, nombre, tipo, padreId = null, estado = 'ACTIVO' } = req.body;
    if (!esTextoNoVacio(codigo, 20)) return badRequest(res, 'El código de cuenta es obligatorio (máx. 20 caracteres).');
    if (!/^[0-9.]+$/.test(String(codigo).trim())) return badRequest(res, 'El código de cuenta solo puede contener números y puntos.');
    if (!esTextoNoVacio(nombre, 150)) return badRequest(res, 'El nombre de cuenta es obligatorio (máx. 150 caracteres).');
    if (!enLista(tipo, TIPOS_CUENTA)) return badRequest(res, 'Tipo de cuenta inválido. Use ACTIVO, PASIVO, PATRIMONIO, INGRESO o GASTO.');
    if (!enLista(estado, ESTADOS)) return badRequest(res, 'Estado inválido.');

    const codigoLimpio = codigo.trim();
    const existe = await CuentaContable.findOne({ where: { usuarioId: req.empresa.id, codigo: codigoLimpio } });
    if (existe) return conflict(res, 'Ya existe una cuenta con ese código en este plan.');

    if (padreId) {
      const padre = await cuentaDeEmpresa(req.empresa.id, padreId);
      if (!padre) return badRequest(res, 'La cuenta padre indicada no pertenece a esta empresa.');
    }

    const cuenta = await CuentaContable.create({
      usuarioId: req.empresa.id,
      codigo: codigoLimpio,
      nombre: nombre.trim(),
      tipo,
      padreId: padreId || null,
      estado,
    });
    const creada = await CuentaContable.findByPk(cuenta.id, { include: [{ model: CuentaContable, as: 'padre' }] });
    res.status(201).json(creada);
  } catch (error) {
    serverError(res, error);
  }
}

async function actualizarCuenta(req, res) {
  try {
    const cuenta = await cuentaDeEmpresa(req.empresa.id, req.params.id);
    if (!cuenta) return notFound(res, 'Cuenta no encontrada.');

    const { codigo, nombre, tipo, padreId, estado } = req.body;
    const codigoLimpio = (codigo !== undefined ? String(codigo) : cuenta.codigo).trim();
    const nombreFinal = nombre !== undefined ? String(nombre) : cuenta.nombre;
    const tipoFinal = tipo !== undefined ? tipo : cuenta.tipo;
    const estadoFinal = estado !== undefined ? estado : cuenta.estado;

    if (!esTextoNoVacio(codigoLimpio, 20)) return badRequest(res, 'El código de cuenta es obligatorio (máx. 20 caracteres).');
    if (!/^[0-9.]+$/.test(codigoLimpio)) return badRequest(res, 'El código de cuenta solo puede contener números y puntos.');
    if (!esTextoNoVacio(nombreFinal, 150)) return badRequest(res, 'El nombre de cuenta es obligatorio (máx. 150 caracteres).');
    if (!enLista(tipoFinal, TIPOS_CUENTA)) return badRequest(res, 'Tipo de cuenta inválido.');
    if (!enLista(estadoFinal, ESTADOS)) return badRequest(res, 'Estado inválido.');

    const duplicado = await CuentaContable.findOne({
      where: { usuarioId: req.empresa.id, codigo: codigoLimpio, id: { [Op.ne]: cuenta.id } },
    });
    if (duplicado) return conflict(res, 'Ya existe otra cuenta con ese código en este plan.');

    let nuevoPadre = cuenta.padreId;
    if (padreId !== undefined) {
      nuevoPadre = padreId ? Number(padreId) : null;
      if (nuevoPadre) {
        const padre = await cuentaDeEmpresa(req.empresa.id, nuevoPadre);
        if (!padre) return badRequest(res, 'La cuenta padre indicada no pertenece a esta empresa.');
        if (await generaCiclo(req.empresa.id, cuenta.id, nuevoPadre)) {
          return badRequest(res, 'La cuenta padre seleccionada generaría un ciclo en la jerarquía.');
        }
      }
    }

    await cuenta.update({
      codigo: codigoLimpio,
      nombre: nombreFinal.trim(),
      tipo: tipoFinal,
      padreId: nuevoPadre,
      estado: estadoFinal,
    });
    const actualizada = await CuentaContable.findByPk(cuenta.id, { include: [{ model: CuentaContable, as: 'padre' }] });
    res.json(actualizada);
  } catch (error) {
    serverError(res, error);
  }
}

async function eliminarCuenta(req, res) {
  try {
    const cuenta = await cuentaDeEmpresa(req.empresa.id, req.params.id);
    if (!cuenta) return notFound(res, 'Cuenta no encontrada.');

    const hijas = await CuentaContable.findOne({ where: { padreId: cuenta.id, usuarioId: req.empresa.id } });
    if (hijas) return conflict(res, 'No se puede eliminar una cuenta que tiene cuentas hijas.');

    const usada = await AsientoLinea.findOne({ where: { cuentaId: cuenta.id } });
    if (usada) return conflict(res, 'No se puede eliminar una cuenta que tiene movimientos en asientos.');

    await cuenta.destroy();
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error);
  }
}

// ============ PERÍODOS CONTABLES ============

async function listarPeriodos(req, res) {
  try {
    const rows = await PeriodoContable.findAll({
      where: { usuarioId: req.empresa.id },
      order: [['fechaInicio', 'DESC']],
    });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

async function crearPeriodo(req, res) {
  try {
    const { nombre, fechaInicio, fechaFin, estado = 'ABIERTO' } = req.body;
    if (!esTextoNoVacio(nombre, 120)) return badRequest(res, 'El nombre del período es obligatorio (máx. 120 caracteres).');
    if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin)) {
      return badRequest(res, 'Las fechas del período deben ser válidas (formato YYYY-MM-DD).');
    }
    if (fechaInicio > fechaFin) return badRequest(res, 'La fecha inicial no puede ser posterior a la fecha final.');
    if (!enLista(estado, ESTADOS_PERIODO)) return badRequest(res, 'Estado de período inválido. Use ABIERTO o CERRADO.');

    const duplicado = await PeriodoContable.findOne({ where: { usuarioId: req.empresa.id, nombre: nombre.trim() } });
    if (duplicado) return conflict(res, 'Ya existe un período con ese nombre en esta empresa.');

    const periodo = await PeriodoContable.create({
      usuarioId: req.empresa.id,
      nombre: nombre.trim(),
      fechaInicio,
      fechaFin,
      estado,
    });
    res.status(201).json(periodo);
  } catch (error) {
    serverError(res, error);
  }
}

async function actualizarPeriodo(req, res) {
  try {
    const periodo = await PeriodoContable.findOne({ where: { id: req.params.id, usuarioId: req.empresa.id } });
    if (!periodo) return notFound(res, 'Período no encontrado.');

    const { nombre, fechaInicio, fechaFin } = req.body;
    const nombreFinal = nombre !== undefined ? String(nombre) : periodo.nombre;
    const inicio = fechaInicio !== undefined ? fechaInicio : periodo.fechaInicio;
    const fin = fechaFin !== undefined ? fechaFin : periodo.fechaFin;

    if (!esTextoNoVacio(nombreFinal, 120)) return badRequest(res, 'El nombre del período es obligatorio (máx. 120 caracteres).');
    if (!esFechaValida(inicio) || !esFechaValida(fin)) {
      return badRequest(res, 'Las fechas del período deben ser válidas (formato YYYY-MM-DD).');
    }
    if (inicio > fin) return badRequest(res, 'La fecha inicial no puede ser posterior a la fecha final.');

    const duplicado = await PeriodoContable.findOne({
      where: { usuarioId: req.empresa.id, nombre: nombreFinal.trim(), id: { [Op.ne]: periodo.id } },
    });
    if (duplicado) return conflict(res, 'Ya existe otro período con ese nombre en esta empresa.');

    await periodo.update({ nombre: nombreFinal.trim(), fechaInicio: inicio, fechaFin: fin });
    res.json(periodo);
  } catch (error) {
    serverError(res, error);
  }
}

async function cambiarEstadoPeriodo(req, res) {
  try {
    const { estado } = req.body;
    if (!enLista(estado, ESTADOS_PERIODO)) return badRequest(res, 'Estado de período inválido. Use ABIERTO o CERRADO.');

    const periodo = await PeriodoContable.findOne({ where: { id: req.params.id, usuarioId: req.empresa.id } });
    if (!periodo) return notFound(res, 'Período no encontrado.');

    await periodo.update({ estado });
    res.json(periodo);
  } catch (error) {
    serverError(res, error);
  }
}

// ============ ASIENTOS CONTABLES ============

async function crearAsientoConReintento(datos, lineas) {
  for (let intento = 0; intento < 5; intento++) {
    const numero = await generarNumeroAsiento(datos.usuarioId, datos.fecha);
    try {
      return await sequelize.transaction(async (t) => {
        const asiento = await AsientoContable.create({ ...datos, numero }, { transaction: t });
        await AsientoLinea.bulkCreate(lineas.map((l) => ({ ...l, asientoId: asiento.id })), { transaction: t });
        return asiento;
      });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError' && intento < 4) continue;
      throw err;
    }
  }
}

async function crearAsiento(req, res) {
  try {
    const { fecha, concepto, periodoId = null, lineas } = req.body;
    if (!esFechaValida(fecha)) return badRequest(res, 'La fecha del asiento es inválida (formato YYYY-MM-DD).');
    if (!esTextoNoVacio(concepto, 255)) return badRequest(res, 'El concepto del asiento es obligatorio (máx. 255 caracteres).');

    const val = validarLineasBase(lineas);
    if (val.error) return badRequest(res, val.error);

    const errCorreo = await validarCuentasDeLineas(req.empresa.id, val.lineas);
    if (errCorreo) return badRequest(res, errCorreo);

    const errPeriodo = await validarPeriodoAsiento(req.empresa.id, fecha, periodoId);
    if (errPeriodo) return badRequest(res, errPeriodo);

    const asiento = await crearAsientoConReintento({
      usuarioId: req.empresa.id,
      fecha,
      concepto: concepto.trim(),
      periodoId: periodoId || null,
      estado: 'ACTIVO',
    }, val.lineas);

    const creado = await AsientoContable.findByPk(asiento.id, {
      include: [{ model: AsientoLinea, as: 'lineas', include: [{ model: CuentaContable, as: 'cuenta' }] }],
    });
    res.status(201).json(creado);
  } catch (error) {
    serverError(res, error);
  }
}

async function listarAsientos(req, res) {
  try {
    const rows = await AsientoContable.findAll({
      where: { usuarioId: req.empresa.id },
      include: [{ model: AsientoLinea, as: 'lineas', include: [{ model: CuentaContable, as: 'cuenta' }] }],
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      limit: 500,
    });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

async function obtenerAsiento(req, res) {
  try {
    const asiento = await AsientoContable.findOne({
      where: { id: req.params.id, usuarioId: req.empresa.id },
      include: [{ model: AsientoLinea, as: 'lineas', include: [{ model: CuentaContable, as: 'cuenta' }] }],
    });
    if (!asiento) return notFound(res, 'Asiento no encontrado.');
    res.json(asiento);
  } catch (error) {
    serverError(res, error);
  }
}

async function actualizarAsiento(req, res) {
  try {
    const asiento = await AsientoContable.findOne({ where: { id: req.params.id, usuarioId: req.empresa.id } });
    if (!asiento) return notFound(res, 'Asiento no encontrado.');
    if (asiento.estado !== 'ACTIVO') return forbidden(res, 'No se puede modificar un asiento anulado.');

    const { fecha, concepto, periodoId, lineas } = req.body;
    const fechaFinal = fecha !== undefined ? fecha : asiento.fecha;
    const conceptoFinal = concepto !== undefined ? String(concepto) : asiento.concepto;
    const periodoFinal = periodoId !== undefined ? (periodoId || null) : asiento.periodoId;

    if (!esFechaValida(fechaFinal)) return badRequest(res, 'La fecha del asiento es inválida (formato YYYY-MM-DD).');
    if (!esTextoNoVacio(conceptoFinal, 255)) return badRequest(res, 'El concepto del asiento es obligatorio (máx. 255 caracteres).');

    const errPeriodo = await validarPeriodoAsiento(req.empresa.id, fechaFinal, periodoFinal);
    if (errPeriodo) return badRequest(res, errPeriodo);

    const val = validarLineasBase(lineas);
    if (val.error) return badRequest(res, val.error);
    const errCorreo = await validarCuentasDeLineas(req.empresa.id, val.lineas);
    if (errCorreo) return badRequest(res, errCorreo);

    await sequelize.transaction(async (t) => {
      await asiento.update({ fecha: fechaFinal, concepto: conceptoFinal.trim(), periodoId: periodoFinal }, { transaction: t });
      await AsientoLinea.destroy({ where: { asientoId: asiento.id }, transaction: t });
      await AsientoLinea.bulkCreate(val.lineas.map((l) => ({ ...l, asientoId: asiento.id })), { transaction: t });
    });

    const actualizado = await AsientoContable.findByPk(asiento.id, {
      include: [{ model: AsientoLinea, as: 'lineas', include: [{ model: CuentaContable, as: 'cuenta' }] }],
    });
    res.json(actualizado);
  } catch (error) {
    serverError(res, error);
  }
}

async function anularAsiento(req, res) {
  try {
    const asiento = await AsientoContable.findOne({ where: { id: req.params.id, usuarioId: req.empresa.id } });
    if (!asiento) return notFound(res, 'Asiento no encontrado.');
    if (asiento.estado !== 'ACTIVO') return forbidden(res, 'El asiento ya está anulado.');

    const errPeriodo = await validarPeriodoAsiento(req.empresa.id, asiento.fecha, asiento.periodoId);
    if (errPeriodo) return badRequest(res, errPeriodo);

    await asiento.update({ estado: 'ANULADO' });
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error);
  }
}

// ============ LIBRO DIARIO ============

async function libroDiario(req, res) {
  try {
    const { desde = null, hasta = null, cuentaId = null } = req.query;

    const whereAsiento = { usuarioId: req.empresa.id, estado: 'ACTIVO', ...filtrarRangoFechas(desde, hasta) };
    const asientos = await AsientoContable.findAll({
      where: whereAsiento,
      include: [{ model: AsientoLinea, as: 'lineas', include: [{ model: CuentaContable, as: 'cuenta' }] }],
      order: [['fecha', 'ASC'], ['numero', 'ASC'], ['id', 'ASC']],
    });

    const filas = [];
    let totalDebe = 0;
    let totalHaber = 0;
    for (const a of asientos) {
      for (const l of a.lineas) {
        if (cuentaId && l.cuentaId !== Number(cuentaId)) continue;
        const cuenta = l.cuenta;
        filas.push({
          asientoId: a.id,
          numero: a.numero,
          fecha: a.fecha,
          concepto: a.concepto,
          descripcion: l.descripcion,
          cuentaId: cuenta.id,
          cuentaCodigo: cuenta.codigo,
          cuentaNombre: cuenta.nombre,
          debe: Number(l.debe),
          haber: Number(l.haber),
        });
        totalDebe += Number(l.debe);
        totalHaber += Number(l.haber);
      }
    }

    res.json({ filas, totalDebe, totalHaber });
  } catch (error) {
    serverError(res, error);
  }
}

// ============ LIBRO MAYOR ============

async function libroMayor(req, res) {
  try {
    const { cuentaId, desde = null, hasta = null } = req.query;
    if (!cuentaId) return badRequest(res, 'Debe seleccionar una cuenta contable.');

    const cuenta = await cuentaDeEmpresa(req.empresa.id, cuentaId);
    if (!cuenta) return notFound(res, 'Cuenta no encontrada en esta empresa.');

    const whereAsiento = { usuarioId: req.empresa.id, estado: 'ACTIVO', ...filtrarRangoFechas(desde, hasta) };
    const lineas = await AsientoLinea.findAll({
      where: { cuentaId: cuenta.id },
      include: [{
        model: AsientoContable,
        as: 'asiento',
        where: whereAsiento,
      }],
      order: [
        [{ model: AsientoContable, as: 'asiento' }, 'fecha', 'ASC'],
        [{ model: AsientoContable, as: 'asiento' }, 'numero', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    let acumulado = 0;
    let totalDebe = 0;
    let totalHaber = 0;
    const movimientos = lineas.map((l) => {
      const debe = Number(l.debe);
      const haber = Number(l.haber);
      acumulado += debe - haber;
      totalDebe += debe;
      totalHaber += haber;
      return {
        fecha: l.asiento.fecha,
        numero: l.asiento.numero,
        concepto: l.asiento.concepto,
        descripcion: l.descripcion,
        debe,
        haber,
        saldoAcumulado: acumulado,
      };
    });

    res.json({
      cuenta: { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre },
      movimientos,
      totalDebe,
      totalHaber,
      saldo: acumulado,
    });
  } catch (error) {
    serverError(res, error);
  }
}

// ============ BALANCE DE COMPROBACIÓN ============

async function balanceComprobacion(req, res) {
  try {
    const { desde = null, hasta = null } = req.query;

    const whereAsiento = { usuarioId: req.empresa.id, estado: 'ACTIVO', ...filtrarRangoFechas(desde, hasta) };
    const lineas = await AsientoLinea.findAll({
      include: [
        { model: AsientoContable, as: 'asiento', where: whereAsiento },
        { model: CuentaContable, as: 'cuenta', where: { usuarioId: req.empresa.id } },
      ],
    });

    const porCuenta = new Map();
    for (const l of lineas) {
      const cuenta = l.cuenta;
      if (!porCuenta.has(cuenta.id)) {
        porCuenta.set(cuenta.id, { codigo: cuenta.codigo, nombre: cuenta.nombre, debe: 0, haber: 0 });
      }
      const agg = porCuenta.get(cuenta.id);
      agg.debe += Number(l.debe);
      agg.haber += Number(l.haber);
    }

    const filas = Array.from(porCuenta.values())
      .map((f) => ({ ...f, saldo: f.debe - f.haber }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    const totalDebe = filas.reduce((s, f) => s + f.debe, 0);
    const totalHaber = filas.reduce((s, f) => s + f.haber, 0);

    res.json({
      filas,
      totalDebe,
      totalHaber,
      cuadra: igualAMasMenosUnCentavo(totalDebe, totalHaber),
    });
  } catch (error) {
    serverError(res, error);
  }
}

module.exports = {
  listarCuentas,
  crearCuenta,
  actualizarCuenta,
  eliminarCuenta,
  listarPeriodos,
  crearPeriodo,
  actualizarPeriodo,
  cambiarEstadoPeriodo,
  crearAsiento,
  listarAsientos,
  obtenerAsiento,
  actualizarAsiento,
  anularAsiento,
  libroDiario,
  libroMayor,
  balanceComprobacion,
};