'use strict';

/*
 * Migración SQLite -> MySQL
 * --------------------------
 * Copia las tablas y datos de la base SQLite actual a MySQL preservando los ids
 * (para mantener intactas las relaciones entre registros).
 *
 * Uso:
 *   node scripts/migrar-sqlite-a-mysql.js            # migra a MySQL (no aplica force)
 *   node scripts/migrar-sqlite-a-mysql.js --force    # recrea las tablas MySQL antes de migrar
 *   node scripts/migrar-sqlite-a-mysql.js --desde data/finanzas.db
 *
 * El destino MySQL se lee de las variables de entorno (.env):
 *   DB_DIALECT=mysql, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */

require('dotenv').config();
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const modelos = require('../src/models');

const FORCE = process.argv.includes('--force');
const ARG_DESDE = process.argv.indexOf('--desde');
const SOURCE = ARG_DESDE >= 0 ? path.resolve(process.argv[ARG_DESDE + 1] || 'data/finanzas.db')
  : path.resolve(__dirname, '..', 'data', 'finanzas.db');

const ORDEN = [
  'tipos_egresos',
  'tipos_ingresos',
  'renglones',
  'tipos_pago',
  'egresos',
  'ingresos',
  'usuarios',
  'transacciones',
  'cortes',
];

function modeloDeTabla(tabla) {
  const mapa = {
    tipos_egresos: modelos.TipoEgreso,
    tipos_ingresos: modelos.TipoIngreso,
    renglones: modelos.Renglon,
    tipos_pago: modelos.TipoPago,
    egresos: modelos.Egreso,
    ingresos: modelos.Ingreso,
    usuarios: modelos.Usuario,
    transacciones: modelos.Transaccion,
    cortes: modelos.Corte,
  };
  return mapa[tabla];
}

// Convierte las columnas snake_case de SQLite a los atributos camelCase del modelo.
function aCamelCase(row, model) {
  const mapeo = {};
  for (const [key, attr] of Object.entries(model.rawAttributes)) {
    if (attr.field && attr.field !== key) mapeo[attr.field] = key;
  }
  const out = {};
  for (const [k, v] of Object.entries(row)) out[mapeo[k] || k] = v;
  return out;
}

async function tablasExistentes(db) {
  const rows = await db.query(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()",
    { type: QueryTypes.SELECT },
  );
  return new Set(rows.map((r) => r.name));
}

async function conteo(db, tabla) {
  const [row] = await db.query(`SELECT COUNT(*) AS c FROM \`${tabla}\``, { type: QueryTypes.SELECT });
  return Number(row.c);
}

async function main() {
  const destino = modelos.sequelize;
  if (destino.options.dialect !== 'mysql') {
    console.error('El destino debe ser MySQL. Configure DB_DIALECT=mysql en el archivo .env.');
    process.exit(1);
  }

  const origen = new Sequelize({ dialect: 'sqlite', storage: SOURCE, logging: false });
  try {
    await origen.authenticate();
  } catch (err) {
    console.error(`No se pudo abrir la base SQLite de origen: ${SOURCE}`);
    console.error(err.message);
    process.exit(1);
  }

  await destino.authenticate();

  if (FORCE) {
    console.log('→ Aplicando --force: se recrearán las tablas en MySQL...');
    await destino.sync({ force: true });
  } else {
    await destino.sync({ force: false });
    const existentes = await tablasExistentes(destino);
    for (const tabla of ORDEN) {
      if (existentes.has(tabla) && (await conteo(destino, tabla)) > 0) {
        console.error(`La tabla "${tabla}" ya contiene datos en MySQL. Ejecute con --force para reemplazarla y evite pérdida de datos.`);
        process.exit(1);
      }
    }
  }

  const t = await destino.transaction();
  const reporte = [];
  try {
    for (const tabla of ORDEN) {
      const model = modeloDeTabla(tabla);
      const filas = await origen.query(`SELECT * FROM "${tabla}"`, { type: QueryTypes.SELECT });
      if (filas.length > 0) {
        const normalizadas = filas.map((f) => aCamelCase(f, model));
        // Se preservan los ids explícitos para mantener las relaciones.
        await model.bulkCreate(normalizadas, { transaction: t });
      }
      reporte.push({ tabla, migradas: filas.length });
      console.log(`✔ ${tabla}: ${filas.length} filas`);
    }
    await t.commit();
  } catch (err) {
    await t.rollback();
    console.error('La migración falló y se revirtió la transacción:');
    console.error(err);
    process.exit(1);
  }

  console.log('\nVerificación de conteos (origen → destino):');
  for (const r of reporte) {
    const enDestino = await conteo(destino, r.tabla);
    const marca = enDestino === r.migradas ? 'OK' : `DIFERENCIA (${enDestino})`;
    console.log(`  ${r.tabla.padEnd(18)} ${String(r.migradas).padStart(4)} → ${String(enDestino).padStart(4)}  ${marca}`);
  }

  await destino.close();
  await origen.close();
  console.log('\nMigración completada.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});