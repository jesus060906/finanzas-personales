'use strict';

const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const models = require('../src/models');

const ADM = { cedula: '000-0000000-0', password: 'admin123' };
const USR = { cedula: '001-1234567-3', password: 'usuario123' };
const USR2 = { cedula: '402-0000000-4', password: 'clave000' };

async function limpiarDb() {
  await models.sequelize.sync({ force: true });
}

async function seedBasica() {
  await limpiarDb();

  const tipoEgreso = await models.TipoEgreso.create({ descripcion: 'Gasto' });
  const tipoIngreso = await models.TipoIngreso.create({ descripcion: 'Salario Base' });
  const renglon = await models.Renglon.create({ descripcion: 'Comida' });
  const tipoPago = await models.TipoPago.create({ descripcion: 'Efectivo' });

  const egreso = await models.Egreso.create({
    tipoEgresoId: tipoEgreso.id,
    renglonId: renglon.id,
    tipoPagoDefectoId: tipoPago.id,
    descripcion: 'Compra Supermercado',
  });
  const ingreso = await models.Ingreso.create({
    tipoIngresoId: tipoIngreso.id,
    descripcion: 'Salario Base',
    institucion: 'Empresa Demo',
  });

  const admin = await models.Usuario.create({
    nombre: 'Administrador',
    cedula: ADM.cedula,
    email: 'admin@prueba.local',
    password: bcrypt.hashSync(ADM.password, 10),
    limiteEgresos: null,
    tipoPersona: 'JURIDICA',
    fechaCorte: 1,
    rol: 'ADMIN',
  });
  const usuario = await models.Usuario.create({
    nombre: 'Juan Pérez',
    cedula: USR.cedula,
    email: 'juan@prueba.local',
    password: bcrypt.hashSync(USR.password, 10),
    limiteEgresos: 15000,
    tipoPersona: 'FISICA',
    fechaCorte: 15,
    rol: 'USUARIO',
  });
  const usuario2 = await models.Usuario.create({
    nombre: 'María Gómez',
    cedula: USR2.cedula,
    email: 'maria@prueba.local',
    password: bcrypt.hashSync(USR2.password, 10),
    limiteEgresos: null,
    tipoPersona: 'FISICA',
    fechaCorte: 10,
    rol: 'USUARIO',
  });

  return {
    admin, usuario, usuario2, egreso, ingreso, tipoEgreso, tipoIngreso, renglon, tipoPago,
  };
}

async function login(agente, credencial) {
  return agente.post('/api/auth/login').send({
    cedula: credencial.cedula,
    password: credencial.password,
  });
}

function agenteAdmin() {
  const a = request.agent(app);
  return login(a, ADM).then(() => a);
}

function agenteUsuario() {
  const a = request.agent(app);
  return login(a, USR).then(() => a);
}

module.exports = {
  app,
  models,
  request,
  bcrypt,
  ADM,
  USR,
  USR2,
  seedBasica,
  limpiarDb,
  agenteAdmin,
  agenteUsuario,
  login,
};