'use strict';

const { CEDULAS, RNCS } = require('./listasBlancas');

const ESTADOS = ['ACTIVO', 'INACTIVO'];
const ROLES = ['ADMIN', 'USUARIO'];
const TIPOS_TRANSACCION = ['INGRESO', 'EGRESO'];
const TIPOS_PERSONA = ['FISICA', 'JURIDICA'];
const TARJETA_LONGITUDES = [15, 16];
const TARJETA_RE = /^\d{15,16}$/;

function esMontoValido(monto) {
  if (monto === undefined || monto === null || monto === '') return false;
  const n = Number(monto);
  return Number.isFinite(n) && n > 0;
}

function esFechaValida(fecha) {
  if (!fecha) return false;
  const str = String(fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

function esFechaCorteValida(dia) {
  const n = Number(dia);
  return Number.isInteger(n) && n >= 1 && n <= 28;
}

function enLista(valor, lista) {
  return lista.includes(valor);
}

function validarEstado(estado) {
  return enLista(estado, ESTADOS);
}

function validarRol(rol) {
  return enLista(rol, ROLES);
}

function esTextoNoVacio(valor, max = Infinity) {
  return typeof valor === 'string' && valor.trim().length > 0 && valor.trim().length <= max;
}

function esTarjetaValida(valor) {
  if (valor === undefined || valor === null) return true;
  if (typeof valor !== 'string') return false;
  const limpio = valor.trim();
  if (limpio === '') return true;
  return TARJETA_RE.test(limpio);
}

function normalizarTarjeta(valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') return valor;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

function compactarIdentificador(valor) {
  return String(valor).replace(/[\s-]/g, '');
}

function digitoVerificadorCedula(cuerpo) {
  const pesos = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    const producto = Number(cuerpo[i]) * pesos[i];
    suma += producto > 9 ? Math.floor(producto / 10) + (producto % 10) : producto;
  }
  return String((10 - (suma % 10)) % 10);
}

function digitoVerificadorRnc(cuerpo) {
  const pesos = [7, 9, 8, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 8; i++) suma += Number(cuerpo[i]) * pesos[i];
  return String((10 - (suma % 11)) % 9 + 1);
}

function esCedulaValida(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return false;
  const c = compactarIdentificador(valor);
  if (!/^\d{11}$/.test(c)) return false;
  if (CEDULAS.has(c)) return true;
  return digitoVerificadorCedula(c.slice(0, 10)) === c[10];
}

function esRncValida(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return false;
  const c = compactarIdentificador(valor);
  if (!/^\d{9}$/.test(c)) return false;
  if (RNCS.has(c)) return true;
  return digitoVerificadorRnc(c.slice(0, 8)) === c[8];
}

function esIdentificadorValido(valor, tipoPersona = 'FISICA') {
  return tipoPersona === 'JURIDICA' ? esRncValida(valor) : esCedulaValida(valor);
}

module.exports = {
  ESTADOS,
  ROLES,
  TIPOS_TRANSACCION,
  TIPOS_PERSONA,
  TARJETA_LONGITUDES,
  esMontoValido,
  esFechaValida,
  esFechaCorteValida,
  esTarjetaValida,
  normalizarTarjeta,
  compactarIdentificador,
  digitoVerificadorCedula,
  digitoVerificadorRnc,
  esCedulaValida,
  esRncValida,
  esIdentificadorValido,
  validarEstado,
  validarRol,
  esTextoNoVacio,
  enLista,
};