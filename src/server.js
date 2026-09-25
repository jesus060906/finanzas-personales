'use strict';

const app = require('./app');
const { sequelize } = require('./models');
const { seed } = require('./seed');

const PORT = process.env.PORT || 3000;

async function iniciar() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: false });
  await seed();
  app.listen(PORT, () => {
    console.log(`Sistema de Finanzas Personales corriendo en http://localhost:${PORT}`);
  });
}

iniciar().catch((err) => {
  console.error('Error al iniciar el sistema:', err);
  process.exit(1);
});