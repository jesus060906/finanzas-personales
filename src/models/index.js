'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TipoEgreso = sequelize.define('TipoEgreso', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  descripcion: { type: DataTypes.STRING(120), allowNull: false },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
}, { tableName: 'tipos_egresos' });

const TipoIngreso = sequelize.define('TipoIngreso', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  descripcion: { type: DataTypes.STRING(120), allowNull: false },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
}, { tableName: 'tipos_ingresos' });

const Renglon = sequelize.define('Renglon', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  descripcion: { type: DataTypes.STRING(120), allowNull: false },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
}, { tableName: 'renglones' });

const TipoPago = sequelize.define('TipoPago', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  descripcion: { type: DataTypes.STRING(120), allowNull: false },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
}, { tableName: 'tipos_pago' });

const Egreso = sequelize.define('Egreso', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipoEgresoId: { type: DataTypes.INTEGER, allowNull: false, field: 'tipo_egreso_id' },
  renglonId: { type: DataTypes.INTEGER, allowNull: false, field: 'renglon_id' },
  tipoPagoDefectoId: { type: DataTypes.INTEGER, allowNull: false, field: 'tipo_pago_defecto_id' },
  descripcion: { type: DataTypes.STRING(200), allowNull: false },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
}, { tableName: 'egresos' });

const Ingreso = sequelize.define('Ingreso', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipoIngresoId: { type: DataTypes.INTEGER, allowNull: false, field: 'tipo_ingreso_id' },
  descripcion: { type: DataTypes.STRING(200), allowNull: false },
  institucion: { type: DataTypes.STRING(200), allowNull: true },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
}, { tableName: 'ingresos' });

const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(150), allowNull: false },
  cedula: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  limiteEgresos: { type: DataTypes.DECIMAL(14, 2), allowNull: true, field: 'limite_egresos' },
  tipoPersona: {
    type: DataTypes.ENUM('FISICA', 'JURIDICA'),
    allowNull: false,
    defaultValue: 'FISICA',
    field: 'tipo_persona',
  },
  fechaCorte: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'fecha_corte' },
  email: { type: DataTypes.STRING(150), allowNull: true, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  rol: { type: DataTypes.ENUM('ADMIN', 'USUARIO'), allowNull: false, defaultValue: 'USUARIO' },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
}, {
  tableName: 'usuarios',
  defaultScope: {
    attributes: { exclude: ['password'] },
  },
});

const Transaccion = sequelize.define('Transaccion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  numero: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  tipo: { type: DataTypes.ENUM('INGRESO', 'EGRESO'), allowNull: false },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
  egresoId: { type: DataTypes.INTEGER, allowNull: true, field: 'egreso_id' },
  ingresoId: { type: DataTypes.INTEGER, allowNull: true, field: 'ingreso_id' },
  tipoPagoId: { type: DataTypes.INTEGER, allowNull: false, field: 'tipo_pago_id' },
  fechaTransaccion: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_transaccion' },
  fechaRegistro: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'fecha_registro' },
  monto: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  noTarjeta: {
    type: DataTypes.STRING(16),
    allowNull: true,
    field: 'no_tarjeta',
    validate: { is: { args: /^\d{15,16}$/, msg: 'El número de tarjeta debe contener 15 o 16 dígitos.' } },
  },
  comentario: { type: DataTypes.STRING(255), allowNull: true },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
}, { tableName: 'transacciones' });

const Corte = sequelize.define('Corte', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  mes: { type: DataTypes.INTEGER, allowNull: false },
  fechaCorte: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_corte' },
  balanceInicial: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'balance_inicial' },
  totalIngresos: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'total_ingresos' },
  totalEgresos: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'total_egresos' },
  balanceCorte: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'balance_corte' },
}, { tableName: 'cortes' });

const CuentaContable = sequelize.define('CuentaContable', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
  codigo: { type: DataTypes.STRING(20), allowNull: false },
  nombre: { type: DataTypes.STRING(150), allowNull: false },
  tipo: {
    type: DataTypes.ENUM('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO'),
    allowNull: false,
  },
  padreId: { type: DataTypes.INTEGER, allowNull: true, field: 'padre_id' },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
}, {
  tableName: 'cuentas_contables',
  indexes: [{ unique: true, fields: ['usuario_id', 'codigo'] }],
});

const PeriodoContable = sequelize.define('PeriodoContable', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
  nombre: { type: DataTypes.STRING(120), allowNull: false },
  fechaInicio: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_inicio' },
  fechaFin: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_fin' },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ABIERTO' },
}, {
  tableName: 'periodos_contables',
  indexes: [{ unique: true, fields: ['usuario_id', 'nombre'] }],
});

const AsientoContable = sequelize.define('AsientoContable', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
  numero: { type: DataTypes.STRING(40), allowNull: false },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  concepto: { type: DataTypes.STRING(255), allowNull: false },
  periodoId: { type: DataTypes.INTEGER, allowNull: true, field: 'periodo_id' },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
}, {
  tableName: 'asientos_contables',
  indexes: [{ unique: true, fields: ['usuario_id', 'numero'] }],
});

const AsientoLinea = sequelize.define('AsientoLinea', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asientoId: { type: DataTypes.INTEGER, allowNull: false, field: 'asiento_id' },
  cuentaId: { type: DataTypes.INTEGER, allowNull: false, field: 'cuenta_id' },
  descripcion: { type: DataTypes.STRING(255), allowNull: true },
  debe: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  haber: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
}, { tableName: 'asiento_lineas' });

// ============ RELACIONES ============
Egreso.belongsTo(TipoEgreso, { as: 'tipoEgreso', foreignKey: 'tipoEgresoId' });
Egreso.belongsTo(Renglon, { as: 'renglon', foreignKey: 'renglonId' });
Egreso.belongsTo(TipoPago, { as: 'tipoPagoDefecto', foreignKey: 'tipoPagoDefectoId' });

Ingreso.belongsTo(TipoIngreso, { as: 'tipoIngreso', foreignKey: 'tipoIngresoId' });

Transaccion.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuarioId' });
Transaccion.belongsTo(Egreso, { as: 'egreso', foreignKey: 'egresoId' });
Transaccion.belongsTo(Ingreso, { as: 'ingreso', foreignKey: 'ingresoId' });
Transaccion.belongsTo(TipoPago, { as: 'tipoPago', foreignKey: 'tipoPagoId' });

Usuario.hasMany(Transaccion, { as: 'transacciones', foreignKey: 'usuarioId' });
Usuario.hasMany(Corte, { as: 'cortes', foreignKey: 'usuarioId' });
Corte.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuarioId' });

// ============ RELACIONES CONTABILIDAD (empresas) ============
CuentaContable.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuarioId' });
CuentaContable.belongsTo(CuentaContable, { as: 'padre', foreignKey: 'padreId' });
CuentaContable.hasMany(CuentaContable, { as: 'hijas', foreignKey: 'padreId' });
PeriodoContable.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuarioId' });
AsientoContable.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuarioId' });
AsientoContable.belongsTo(PeriodoContable, { as: 'periodo', foreignKey: 'periodoId' });
AsientoContable.hasMany(AsientoLinea, { as: 'lineas', foreignKey: 'asientoId' });
AsientoLinea.belongsTo(AsientoContable, { as: 'asiento', foreignKey: 'asientoId' });
AsientoLinea.belongsTo(CuentaContable, { as: 'cuenta', foreignKey: 'cuentaId' });

module.exports = {
  sequelize,
  TipoEgreso,
  TipoIngreso,
  Renglon,
  TipoPago,
  Egreso,
  Ingreso,
  Usuario,
  Transaccion,
  Corte,
  CuentaContable,
  PeriodoContable,
  AsientoContable,
  AsientoLinea,
};