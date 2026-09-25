'use strict';

const { Usuario } = require('../models');

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'No autorizado. Debe iniciar sesión.' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.rol === 'ADMIN') {
    return next();
  }
  return res.status(403).json({ error: 'Acción reservada al administrador.' });
}

async function requireEmpresa(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'No autorizado. Debe iniciar sesión.' });
  }
  try {
    const usuario = await Usuario.findByPk(req.session.userId);
    if (!usuario || usuario.estado !== 'ACTIVO') {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    if (usuario.tipoPersona !== 'JURIDICA') {
      return res.status(403).json({ error: 'Este módulo solo está disponible para entidades empresariales.' });
    }
    req.empresa = usuario;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

module.exports = { requireAuth, requireAdmin, requireEmpresa };