'use strict';

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.SESSION_SECRET = 'secreto-de-pruebas-no-produccion';
process.env.AUTH_MAX_ATTEMPTS = '1000';