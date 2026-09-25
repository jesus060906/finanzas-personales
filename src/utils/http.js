'use strict';

// Respuesta de error consistente para la API.
// Nunca se expone internals del servidor al cliente.
function serverError(res, err, mensaje = 'Error interno del servidor.') {
  console.error(err);
  return res.status(500).json({ error: mensaje });
}

function badRequest(res, mensaje) {
  return res.status(400).json({ error: mensaje });
}

function unauthorized(res, mensaje) {
  return res.status(401).json({ error: mensaje });
}

function forbidden(res, mensaje) {
  return res.status(403).json({ error: mensaje });
}

function notFound(res, mensaje) {
  return res.status(404).json({ error: mensaje });
}

function conflict(res, mensaje) {
  return res.status(409).json({ error: mensaje });
}

module.exports = {
  serverError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
};