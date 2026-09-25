'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/contabilidad.controller');
const { requireEmpresa } = require('../middlewares/auth');

// Plan de cuentas
router.get('/cuentas', requireEmpresa, ctrl.listarCuentas);
router.post('/cuentas', requireEmpresa, ctrl.crearCuenta);
router.put('/cuentas/:id', requireEmpresa, ctrl.actualizarCuenta);
router.delete('/cuentas/:id', requireEmpresa, ctrl.eliminarCuenta);

// Períodos contables
router.get('/periodos', requireEmpresa, ctrl.listarPeriodos);
router.post('/periodos', requireEmpresa, ctrl.crearPeriodo);
router.put('/periodos/:id', requireEmpresa, ctrl.actualizarPeriodo);
router.patch('/periodos/:id/estado', requireEmpresa, ctrl.cambiarEstadoPeriodo);

// Asientos contables
router.get('/asientos', requireEmpresa, ctrl.listarAsientos);
router.post('/asientos', requireEmpresa, ctrl.crearAsiento);
router.get('/asientos/:id', requireEmpresa, ctrl.obtenerAsiento);
router.put('/asientos/:id', requireEmpresa, ctrl.actualizarAsiento);
router.patch('/asientos/:id/anular', requireEmpresa, ctrl.anularAsiento);

// Libros y reportes
router.get('/libro-diario', requireEmpresa, ctrl.libroDiario);
router.get('/libro-mayor', requireEmpresa, ctrl.libroMayor);
router.get('/balance-comprobacion', requireEmpresa, ctrl.balanceComprobacion);

module.exports = router;