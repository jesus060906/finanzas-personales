'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/usuarios.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

router.get('/resumen', requireAuth, requireAdmin, ctrl.resumen);
router.get('/', requireAuth, requireAdmin, ctrl.listar);
router.get('/:id', requireAuth, ctrl.obtener);
router.post('/', requireAuth, requireAdmin, ctrl.crear);
router.put('/:id', requireAuth, requireAdmin, ctrl.actualizar);
router.patch('/:id/anular', requireAuth, requireAdmin, ctrl.anular);

module.exports = router;