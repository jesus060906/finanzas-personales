'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/transacciones.controller');
const { requireAuth } = require('../middlewares/auth');

router.get('/', requireAuth, ctrl.listar);
router.post('/', requireAuth, ctrl.crear);
router.patch('/:id/anular', requireAuth, ctrl.anular);

module.exports = router;