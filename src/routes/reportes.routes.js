'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/reportes.controller');
const { requireAuth } = require('../middlewares/auth');

router.get('/dashboard', requireAuth, ctrl.resumenDash);
router.get('/transacciones', requireAuth, ctrl.consulta);
router.get('/corte', requireAuth, ctrl.reporteCorte);

module.exports = router;