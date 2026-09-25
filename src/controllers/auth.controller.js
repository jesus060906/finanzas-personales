'use strict';

const bcrypt = require('bcryptjs');
const { Usuario } = require('../models');
const {
  ESTADOS, esTextoNoVacio, esFechaCorteValida, esIdentificadorValido, enLista, TIPOS_PERSONA,
} = require('../utils/validators');
const { serverError, badRequest, conflict, unauthorized, notFound } = require('../utils/http');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function registro(req, res) {
  try {
    const {
      nombre, cedula, email = null, password, limiteEgresos = null,
      tipoPersona = 'FISICA', fechaCorte = 1,
    } = req.body;

    if (!esTextoNoVacio(nombre, 150) || !esTextoNoVacio(cedula, 20) || !esTextoNoVacio(password, 255)) {
      return badRequest(res, 'Nombre, cédula y contraseña son obligatorios.');
    }
    if (!enLista(tipoPersona, TIPOS_PERSONA)) {
      return badRequest(res, 'Tipo de persona inválido. Use FISICA o JURIDICA.');
    }
    if (!esIdentificadorValido(cedula, tipoPersona)) {
      return badRequest(res, tipoPersona === 'JURIDICA'
        ? 'El RNC no es válido. Debe tener 9 dígitos con un dígito verificador correcto.'
        : 'La cédula no es válida. Debe tener 11 dígitos con un dígito verificador correcto.');
    }
    if (!esFechaCorteValida(fechaCorte)) {
      return badRequest(res, 'La fecha de corte debe estar entre 1 y 28.');
    }
    if (email && !EMAIL_RE.test(email)) {
      return badRequest(res, 'Correo electrónico inválido.');
    }
    if (limiteEgresos !== null && limiteEgresos !== undefined && (Number(limiteEgresos) < 0 || !Number.isFinite(Number(limiteEgresos)))) {
      return badRequest(res, 'El límite de egresos debe ser un monto válido.');
    }

    const existe = await Usuario.findOne({ where: { cedula } });
    if (existe) return conflict(res, 'Ya existe un usuario con esa cédula.');

    const hash = await bcrypt.hash(password, 10);
    const usuario = await Usuario.create({
      nombre: nombre.trim(),
      cedula: cedula.trim(),
      email: email ? email.trim() : null,
      password: hash,
      limiteEgresos,
      tipoPersona,
      fechaCorte,
      rol: 'USUARIO',
      estado: 'ACTIVO',
    });
    res.status(201).json({ id: usuario.id, nombre: usuario.nombre, cedula: usuario.cedula, rol: usuario.rol });
  } catch (error) {
    serverError(res, error);
  }
}

async function login(req, res) {
  try {
    const { cedula, password } = req.body;
    if (!cedula || !password) return badRequest(res, 'Cédula y contraseña son obligatorios.');

    const usuario = await Usuario.findOne({
      where: { cedula },
      attributes: ['id', 'nombre', 'cedula', 'password', 'estado', 'rol', 'tipoPersona', 'limiteEgresos', 'fechaCorte'],
    });
    if (!usuario || usuario.estado !== 'ACTIVO') {
      return unauthorized(res, 'Credenciales inválidas o usuario inactivo.');
    }
    const valida = await bcrypt.compare(password, usuario.password);
    if (!valida) return unauthorized(res, 'Credenciales inválidas.');

    req.session.regenerate((err) => {
      if (err) return serverError(res, err);
      req.session.userId = usuario.id;
      req.session.rol = usuario.rol;
      res.json({
        id: usuario.id,
        nombre: usuario.nombre,
        cedula: usuario.cedula,
        rol: usuario.rol,
        tipoPersona: usuario.tipoPersona,
        limiteEgresos: usuario.limiteEgresos,
        fechaCorte: usuario.fechaCorte,
      });
    });
  } catch (error) {
    serverError(res, error);
  }
}

async function me(req, res) {
  try {
    const usuario = await Usuario.findByPk(req.session.userId, {
      attributes: ['id', 'nombre', 'cedula', 'limiteEgresos', 'tipoPersona', 'fechaCorte', 'rol', 'email', 'estado'],
    });
    if (!usuario) return notFound(res, 'Usuario no encontrado.');
    res.json(usuario);
  } catch (error) {
    serverError(res, error);
  }
}

function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('finanzas.sid');
    res.json({ ok: true });
  });
}

module.exports = { registro, login, me, logout, ESTADOS };