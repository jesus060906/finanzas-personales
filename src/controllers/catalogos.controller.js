'use strict';

const { Op } = require('sequelize');
const {
  TipoEgreso,
  TipoIngreso,
  Renglon,
  TipoPago,
  Egreso,
  Ingreso,
} = require('../models');
const { serverError, badRequest, notFound, conflict } = require('../utils/http');
const { esTextoNoVacio, validarEstado } = require('../utils/validators');

const CATALOGOS = {
  'tipos-egresos': TipoEgreso,
  'tipos-ingresos': TipoIngreso,
  renglones: Renglon,
  'tipos-pago': TipoPago,
};

function activos(models) {
  return Object.values(models).filter((m) => m.estado === 'ACTIVO');
}

async function descripcionDuplicada(model, descripcion, excluirId = null) {
  const where = {
    descripcion: { [Op.like]: String(descripcion).trim() },
  };
  if (excluirId) where.id = { [Op.ne]: excluirId };
  const count = await model.count({ where });
  return count > 0;
}

async function listar(req, res) {
  try {
    const model = CATALOGOS[req.params.catalogo];
    if (!model) return notFound(res, 'Catálogo no encontrado.');
    const rows = await model.findAll({ order: [['descripcion', 'ASC']] });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

async function crear(req, res) {
  try {
    const model = CATALOGOS[req.params.catalogo];
    if (!model) return notFound(res, 'Catálogo no encontrado.');
    const { descripcion, estado } = req.body;
    if (!esTextoNoVacio(descripcion, 120)) {
      return badRequest(res, 'La descripción es obligatoria y no puede superar 120 caracteres.');
    }
    if (estado && !validarEstado(estado)) return badRequest(res, 'Estado inválido.');
    if (await descripcionDuplicada(model, descripcion)) {
      return conflict(res, 'Ya existe un registro con esa descripción.');
    }
    const row = await model.create({ descripcion: descripcion.trim(), estado: estado || 'ACTIVO' });
    res.status(201).json(row);
  } catch (error) {
    serverError(res, error);
  }
}

async function actualizar(req, res) {
  try {
    const model = CATALOGOS[req.params.catalogo];
    if (!model) return notFound(res, 'Catálogo no encontrado.');
    const row = await model.findByPk(req.params.id);
    if (!row) return notFound(res, 'Registro no encontrado.');
    const descripcion = req.body.descripcion;
    if (descripcion !== undefined && !esTextoNoVacio(descripcion, 120)) {
      return badRequest(res, 'La descripción es obligatoria y no puede superar 120 caracteres.');
    }
    if (req.body.estado && !validarEstado(req.body.estado)) return badRequest(res, 'Estado inválido.');
    if (descripcion && (await descripcionDuplicada(model, descripcion, row.id))) {
      return conflict(res, 'Ya existe un registro con esa descripción.');
    }
    await row.update({
      descripcion: descripcion !== undefined ? descripcion.trim() : row.descripcion,
      estado: req.body.estado || row.estado,
    });
    res.json(row);
  } catch (error) {
    serverError(res, error);
  }
}

async function eliminar(req, res) {
  try {
    const model = CATALOGOS[req.params.catalogo];
    if (!model) return notFound(res, 'Catálogo no encontrado.');
    const row = await model.findByPk(req.params.id);
    if (!row) return notFound(res, 'Registro no encontrado.');
    await row.update({ estado: 'INACTIVO' });
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error);
  }
}

// ============ EGRESOS E INGRESOS DEFINIDOS ============
const includeEgreso = [
  { model: TipoEgreso, as: 'tipoEgreso' },
  { model: Renglon, as: 'renglon' },
  { model: TipoPago, as: 'tipoPagoDefecto' },
];

async function listarEgresos(req, res) {
  try {
    const rows = await Egreso.findAll({ include: includeEgreso, order: [['descripcion', 'ASC']] });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

async function listarEgresosActivos(req, res) {
  try {
    const rows = await Egreso.findAll({ where: { estado: 'ACTIVO' }, include: includeEgreso, order: [['descripcion', 'ASC']] });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

async function validarEgresoProps(body) {
  const { tipoEgresoId, renglonId, tipoPagoDefectoId, descripcion } = body;
  if (!esTextoNoVacio(descripcion, 200)) return 'La descripción es obligatoria y no puede superar 200 caracteres.';
  if (!tipoEgresoId || !renglonId || !tipoPagoDefectoId) {
    return 'Faltan campos obligatorios (tipo de egreso, renglón, tipo de pago).';
  }
  const [te, r, tp] = await Promise.all([
    TipoEgreso.findByPk(tipoEgresoId),
    Renglon.findByPk(renglonId),
    TipoPago.findByPk(tipoPagoDefectoId),
  ]);
  if (!te) return 'Tipo de egreso no existe.';
  if (!r) return 'Renglón no existe.';
  if (!tp) return 'Tipo de pago no existe.';
  return null;
}

async function crearEgreso(req, res) {
  try {
    const error = await validarEgresoProps(req.body);
    if (error) return badRequest(res, error);
    const { tipoEgresoId, renglonId, tipoPagoDefectoId, descripcion, estado } = req.body;
    if (estado && !validarEstado(estado)) return badRequest(res, 'Estado inválido.');
    const row = await Egreso.create({ tipoEgresoId, renglonId, tipoPagoDefectoId, descripcion: descripcion.trim(), estado: estado || 'ACTIVO' });
    const creado = await Egreso.findByPk(row.id, { include: includeEgreso });
    res.status(201).json(creado);
  } catch (error) {
    serverError(res, error);
  }
}

async function actualizarEgreso(req, res) {
  try {
    const row = await Egreso.findByPk(req.params.id);
    if (!row) return notFound(res, 'Registro no encontrado.');
    if (req.body.descripcion !== undefined && !esTextoNoVacio(req.body.descripcion, 200)) {
      return badRequest(res, 'La descripción es obligatoria y no puede superar 200 caracteres.');
    }
    if (req.body.estado && !validarEstado(req.body.estado)) return badRequest(res, 'Estado inválido.');
    await row.update(req.body);
    const actualizado = await Egreso.findByPk(row.id, { include: includeEgreso });
    res.json(actualizado);
  } catch (error) {
    serverError(res, error);
  }
}

async function eliminarEgreso(req, res) {
  try {
    const row = await Egreso.findByPk(req.params.id);
    if (!row) return notFound(res, 'Registro no encontrado.');
    await row.update({ estado: 'INACTIVO' });
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error);
  }
}

const includeIngreso = [{ model: TipoIngreso, as: 'tipoIngreso' }];

async function listarIngresos(req, res) {
  try {
    const rows = await Ingreso.findAll({ include: includeIngreso, order: [['descripcion', 'ASC']] });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

async function listarIngresosActivos(req, res) {
  try {
    const rows = await Ingreso.findAll({ where: { estado: 'ACTIVO' }, include: includeIngreso, order: [['descripcion', 'ASC']] });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

async function crearIngreso(req, res) {
  try {
    const { tipoIngresoId, descripcion, institucion, estado } = req.body;
    if (!esTextoNoVacio(descripcion, 200)) {
      return badRequest(res, 'La descripción es obligatoria y no puede superar 200 caracteres.');
    }
    if (!tipoIngresoId) return badRequest(res, 'Debe indicar el tipo de ingreso.');
    const ti = await TipoIngreso.findByPk(tipoIngresoId);
    if (!ti) return badRequest(res, 'Tipo de ingreso no existe.');
    if (estado && !validarEstado(estado)) return badRequest(res, 'Estado inválido.');
    const row = await Ingreso.create({
      tipoIngresoId,
      descripcion: descripcion.trim(),
      institucion: institucion || null,
      estado: estado || 'ACTIVO',
    });
    const creado = await Ingreso.findByPk(row.id, { include: includeIngreso });
    res.status(201).json(creado);
  } catch (error) {
    serverError(res, error);
  }
}

async function actualizarIngreso(req, res) {
  try {
    const row = await Ingreso.findByPk(req.params.id);
    if (!row) return notFound(res, 'Registro no encontrado.');
    if (req.body.descripcion !== undefined && !esTextoNoVacio(req.body.descripcion, 200)) {
      return badRequest(res, 'La descripción es obligatoria y no puede superar 200 caracteres.');
    }
    if (req.body.estado && !validarEstado(req.body.estado)) return badRequest(res, 'Estado inválido.');
    await row.update(req.body);
    const actualizado = await Ingreso.findByPk(row.id, { include: includeIngreso });
    res.json(actualizado);
  } catch (error) {
    serverError(res, error);
  }
}

async function eliminarIngreso(req, res) {
  try {
    const row = await Ingreso.findByPk(req.params.id);
    if (!row) return notFound(res, 'Registro no encontrado.');
    await row.update({ estado: 'INACTIVO' });
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error);
  }
}

module.exports = {
  listar,
  crear,
  actualizar,
  eliminar,
  listarEgresos,
  listarEgresosActivos,
  crearEgreso,
  actualizarEgreso,
  eliminarEgreso,
  listarIngresos,
  listarIngresosActivos,
  crearIngreso,
  actualizarIngreso,
  eliminarIngreso,
  activos,
};