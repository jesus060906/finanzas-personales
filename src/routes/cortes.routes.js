'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/cortes.controller');
const { requireAuth } = require('../middlewares/auth');

router.post('/proceso', requireAuth, ctrl.procesar);
router.get('/', requireAuth, ctrl.historial);

module.exports = router;