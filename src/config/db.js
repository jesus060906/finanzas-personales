'use strict';

const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const dialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase();

let sequelize;

if (dialect === 'mysql') {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'finanzas_personales',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      dialect: 'mysql',
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
      timezone: process.env.DB_TIMEZONE || '-04:00',
      define: {
        underscored: true,
        freezeTableName: true,
        charset: 'utf8mb4',
      },
      pool: {
        max: Number(process.env.DB_POOL_MAX) || 10,
        min: Number(process.env.DB_POOL_MIN) || 0,
        acquire: 30000,
        idle: 10000,
      },
    },
  );
} else if (dialect === 'sqlite') {
  const storage = process.env.DB_STORAGE || 'data/finanzas.db';
  const realStorage = storage === ':memory:' ? storage : path.resolve(__dirname, '..', '..', storage);
  if (realStorage !== ':memory:') {
    fs.mkdirSync(path.dirname(realStorage), { recursive: true });
  }
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: realStorage,
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    define: {
      underscored: true,
      freezeTableName: true,
    },
  });
} else {
  throw new Error(`Dialecto de base de datos no soportado: ${dialect}. Use "mysql" o "sqlite".`);
}

module.exports = sequelize;