'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth');
const { rateLimit } = require('express-rate-limit');

function crearLimiter(limit = Number(process.env.AUTH_MAX_ATTEMPTS || 30)) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'Demasiados intentos. Espere unos minutos y vuelva a intentarlo.' }),
  });
}

router.post('/registro', crearLimiter(), ctrl.registro);
router.post('/login', crearLimiter(), ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);

module.exports = router;
module.exports.crearLimiter = crearLimiter;