'use strict';

const bcrypt = require('bcryptjs');
const { Usuario, Transaccion } = require('../models');
const { serverError, badRequest, notFound, conflict, forbidden } = require('../utils/http');
const {
  esTextoNoVacio, esFechaCorteValida, esIdentificadorValido, validarRol, enLista, TIPOS_PERSONA,
} = require('../utils/validators');

const safeAttrs = ['id', 'nombre', 'cedula', 'limiteEgresos', 'tipoPersona', 'fechaCorte', 'email', 'rol', 'estado'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarIdentificador(cedula, tipoPersona, rol) {
  if (rol === 'ADMIN') return null;
  if (!esIdentificadorValido(cedula, tipoPersona)) {
    return tipoPersona === 'JURIDICA'
      ? 'El RNC no es válido. Debe tener 9 dígitos con un dígito verificador correcto.'
      : 'La cédula no es válida. Debe tener 11 dígitos con un dígito verificador correcto.';
  }
  return null;
}

function validarDatosUsuario(body, { esPasswordRequerida = true } = {}) {
  const {
    nombre, cedula, email = null, password, limiteEgresos = null,
    tipoPersona = 'FISICA', fechaCorte = 1, rol = 'USUARIO',
  } = body;

  if (!esTextoNoVacio(nombre, 150)) return 'El nombre es obligatorio (máx. 150 caracteres).';
  if (!esTextoNoVacio(cedula, 20)) return 'La cédula es obligatoria (máx. 20 caracteres).';
  if (esPasswordRequerida && !esTextoNoVacio(password, 255)) return 'La contraseña es obligatoria (mín. 6 caracteres).';
  if (password && password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (email && !EMAIL_RE.test(email)) return 'Correo electrónico inválido.';
  if (!enLista(tipoPersona, TIPOS_PERSONA)) return 'Tipo de persona inválido. Use FISICA o JURIDICA.';
  if (!esFechaCorteValida(fechaCorte)) return 'La fecha de corte debe estar entre 1 y 28.';
  if (rol && !validarRol(rol)) return 'Rol inválido. Use ADMIN o USUARIO.';
  if (limiteEgresos !== null && limiteEgresos !== undefined && (Number(limiteEgresos) < 0 || !Number.isFinite(Number(limiteEgresos)))) {
    return 'El límite de egresos debe ser un monto válido.';
  }
  return null;
}

async function listar(req, res) {
  try {
    const rows = await Usuario.findAll({ attributes: safeAttrs, order: [['nombre', 'ASC']] });
    res.json(rows);
  } catch (error) {
    serverError(res, error);
  }
}

async function obtener(req, res) {
  try {
    if (req.session.rol !== 'ADMIN' && Number(req.params.id) !== Number(req.session.userId)) {
      return forbidden(res, 'No puede consultar la información de otro usuario.');
    }
    const usuario = await Usuario.findByPk(req.params.id, { attributes: safeAttrs });
    if (!usuario) return notFound(res, 'Usuario no encontrado.');
    res.json(usuario);
  } catch (error) {
    serverError(res, error);
  }
}

async function crear(req, res) {
  try {
    const error = validarDatosUsuario(req.body);
    if (error) return badRequest(res, error);

    const errorId = validarIdentificador(
      req.body.cedula,
      req.body.tipoPersona || 'FISICA',
      req.body.rol || 'USUARIO',
    );
    if (errorId) return badRequest(res, errorId);

    const existe = await Usuario.findOne({ where: { cedula: req.body.cedula.trim() } });
    if (existe) return conflict(res, 'Ya existe un usuario con esa cédula.');

    const hash = await bcrypt.hash(req.body.password, 10);
    const usuario = await Usuario.create({
      nombre: req.body.nombre.trim(),
      cedula: req.body.cedula.trim(),
      email: req.body.email ? req.body.email.trim() : null,
      password: hash,
      limiteEgresos: req.body.limiteEgresos ?? null,
      tipoPersona: req.body.tipoPersona || 'FISICA',
      fechaCorte: req.body.fechaCorte || 1,
      rol: req.body.rol || 'USUARIO',
      estado: 'ACTIVO',
    });
    const { password: _pwd, ...limpio } = usuario.toJSON();
    res.status(201).json(limpio);
  } catch (error) {
    serverError(res, error);
  }
}

async function actualizar(req, res) {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return notFound(res, 'Usuario no encontrado.');

    const { password, ...datos } = req.body;
    const filtrado = {
      ...datos,
      nombre: datos.nombre !== undefined ? datos.nombre : usuario.nombre,
      cedula: datos.cedula !== undefined ? datos.cedula : usuario.cedula,
      email: 'email' in datos ? datos.email : usuario.email,
      limiteEgresos: datos.limiteEgresos !== undefined ? datos.limiteEgresos : usuario.limiteEgresos,
      fechaCorte: datos.fechaCorte !== undefined ? datos.fechaCorte : usuario.fechaCorte,
      tipoPersona: datos.tipoPersona !== undefined ? datos.tipoPersona : usuario.tipoPersona,
      rol: datos.rol !== undefined ? datos.rol : usuario.rol,
    };
    const error = validarDatosUsuario(filtrado, { esPasswordRequerida: false });
    if (password) {
      if (password.length < 6) return badRequest(res, 'La contraseña debe tener al menos 6 caracteres.');
      filtrado.password = await bcrypt.hash(password, 10);
    }
    if (error) return badRequest(res, error);

    if (req.body.cedula !== undefined) {
      const errorId = validarIdentificador(req.body.cedula, filtrado.tipoPersona, filtrado.rol);
      if (errorId) return badRequest(res, errorId);
    }

    const duplicado = await Usuario.findOne({ where: { cedula: filtrado.cedula.trim() } });
    if (duplicado && duplicado.id !== usuario.id) return conflict(res, 'Ya existe un usuario con esa cédula.');

    await usuario.update(filtrado);
    const { password: _pwd, ...limpio } = usuario.toJSON();
    res.json(limpio);
  } catch (error) {
    serverError(res, error);
  }
}

async function anular(req, res) {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return notFound(res, 'Usuario no encontrado.');
    if (usuario.id === req.session.userId) {
      return badRequest(res, 'No puede desactivar su propia cuenta.');
    }
    await usuario.update({ estado: usuario.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' });
    const { password: _pwd, ...limpio } = usuario.toJSON();
    res.json(limpio);
  } catch (error) {
    serverError(res, error);
  }
}

async function resumen(req, res) {
  try {
    const { id } = req.params;
    const usuarios = id ? [await Usuario.findByPk(id, { attributes: safeAttrs })] : await Usuario.findAll({ attributes: safeAttrs });
    const filas = [];
    for (const u of usuarios.filter(Boolean)) {
      const txs = await Transaccion.findAll({ where: { usuarioId: u.id, estado: 'ACTIVO' } });
      let totalIngresos = 0;
      let totalEgresos = 0;
      for (const t of txs) {
        if (t.tipo === 'INGRESO') totalIngresos += Number(t.monto);
        else totalEgresos += Number(t.monto);
      }
      filas.push({
        id: u.id, nombre: u.nombre, cedula: u.cedula, fechaCorte: u.fechaCorte,
        limiteEgresos: u.limiteEgresos, totalIngresos, totalEgresos,
        balance: totalIngresos - totalEgresos,
        superaLimite: u.limiteEgresos !== null && totalEgresos > Number(u.limiteEgresos),
      });
    }
    res.json(filas);
  } catch (error) {
    serverError(res, error);
  }
}

module.exports = { listar, obtener, crear, actualizar, anular, resumen };