'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/catalogos.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

// ============ Egresos definidos (específicos primero) ============
router.get('/egresos/activos', requireAuth, ctrl.listarEgresosActivos);
router.get('/egresos', requireAuth, ctrl.listarEgresos);
router.post('/egresos', requireAuth, requireAdmin, ctrl.crearEgreso);
router.put('/egresos/:id', requireAuth, requireAdmin, ctrl.actualizarEgreso);
router.delete('/egresos/:id', requireAuth, requireAdmin, ctrl.eliminarEgreso);

// ============ Ingresos definidos ============
router.get('/ingresos/activos', requireAuth, ctrl.listarIngresosActivos);
router.get('/ingresos', requireAuth, ctrl.listarIngresos);
router.post('/ingresos', requireAuth, requireAdmin, ctrl.crearIngreso);
router.put('/ingresos/:id', requireAuth, requireAdmin, ctrl.actualizarIngreso);
router.delete('/ingresos/:id', requireAuth, requireAdmin, ctrl.eliminarIngreso);

// ============ Catálogos simples ============
const sinonimos = {
  'tipo-egreso': 'tipos-egresos',
  'tipo-ingreso': 'tipos-ingresos',
  'tipo-pago': 'tipos-pago',
  renglon: 'renglones',
};

router.get('/:catalogo', requireAuth, (req, res) => {
  req.params.catalogo = sinonimos[req.params.catalogo] || req.params.catalogo;
  ctrl.listar(req, res);
});
router.post('/:catalogo', requireAuth, requireAdmin, (req, res) => {
  req.params.catalogo = sinonimos[req.params.catalogo] || req.params.catalogo;
  ctrl.crear(req, res);
});
router.put('/:catalogo/:id', requireAuth, requireAdmin, (req, res) => {
  req.params.catalogo = sinonimos[req.params.catalogo] || req.params.catalogo;
  ctrl.actualizar(req, res);
});
router.delete('/:catalogo/:id', requireAuth, requireAdmin, (req, res) => {
  req.params.catalogo = sinonimos[req.params.catalogo] || req.params.catalogo;
  ctrl.eliminar(req, res);
});

module.exports = router;