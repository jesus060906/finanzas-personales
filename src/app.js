'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const authRoutes = require('./routes/auth.routes');
const catalogosRoutes = require('./routes/catalogos.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const transaccionesRoutes = require('./routes/transacciones.routes');
const cortesRoutes = require('./routes/cortes.routes');
const reportesRoutes = require('./routes/reportes.routes');
const contabilidadRoutes = require('./routes/contabilidad.routes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
}));
app.use(express.json({ limit: '1mb' }));

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('Falta SESSION_SECRET. En producción es obligatorio definirlo en el entorno (no en el código).');
}

app.use(session({
  name: 'finanzas.sid',
  secret: process.env.SESSION_SECRET || 'finanzas-personales-clave-local-dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8,
    secure: process.env.COOKIE_SECURE === 'true',
  },
}));

const soloDocsProduccion = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  if (req.session && req.session.userId && req.session.rol === 'ADMIN') return next();
  return res.status(403).json({ error: 'Documentación restringida en producción (solo administradores).' });
};

// Documentación Swagger/OpenAPI
app.use('/api-docs', soloDocsProduccion, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API
app.use('/api/auth', authRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/transacciones', transaccionesRoutes);
app.use('/api/cortes', cortesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/contabilidad', contabilidadRoutes);

// Frontend estático
app.use(express.static(path.join(__dirname, '..', 'public')));

// 404 API
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// Manejo global de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

module.exports = app;