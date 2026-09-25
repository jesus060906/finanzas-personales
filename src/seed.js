'use strict';

const bcrypt = require('bcryptjs');
const {
  TipoEgreso, TipoIngreso, Renglon, TipoPago,
  Egreso, Ingreso, Usuario, Transaccion, Corte, sequelize,
} = require('./models');

async function seed() {
  const nUsuarios = await Usuario.count();
  if (nUsuarios > 0) return 'datos ya presentes';

  const t = await sequelize.transaction();

  const tiposEgreso = await TipoEgreso.bulkCreate([
    { descripcion: 'Gasto' },
    { descripcion: 'Inversión' },
    { descripcion: 'Costo' },
    { descripcion: 'Impuesto' },
    { descripcion: 'Seguro' },
  ], { transaction: t });

  const tiposIngreso = await TipoIngreso.bulkCreate([
    { descripcion: 'Salario Base' },
    { descripcion: 'Horas Extras' },
    { descripcion: 'Comisiones' },
    { descripcion: 'Bonificaciones' },
    { descripcion: 'Ingresos por Negocio' },
  ], { transaction: t });

  const renglones = await Renglon.bulkCreate([
    { descripcion: 'Comida' },
    { descripcion: 'Combustible' },
    { descripcion: 'Recreación' },
    { descripcion: 'Vivienda' },
    { descripcion: 'Salud' },
    { descripcion: 'Educación' },
    { descripcion: 'Transporte' },
  ], { transaction: t });

  const tiposPago = await TipoPago.bulkCreate([
    { descripcion: 'Efectivo' },
    { descripcion: 'Tarjeta de Crédito' },
    { descripcion: 'Tarjeta de Débito' },
    { descripcion: 'Cheque' },
    { descripcion: 'Transferencia Bancaria' },
  ], { transaction: t });

  await Egreso.bulkCreate([
    { tipoEgresoId: tiposEgreso[0].id, renglonId: renglones[0].id, tipoPagoDefectoId: tiposPago[0].id, descripcion: 'Compra Supermercado' },
    { tipoEgresoId: tiposEgreso[0].id, renglonId: renglones[0].id, tipoPagoDefectoId: tiposPago[0].id, descripcion: 'Compra Colmado' },
    { tipoEgresoId: tiposEgreso[1].id, renglonId: renglones[1].id, tipoPagoDefectoId: tiposPago[1].id, descripcion: 'Recarga Combustible' },
    { tipoEgresoId: tiposEgreso[2].id, renglonId: renglones[2].id, tipoPagoDefectoId: tiposPago[1].id, descripcion: 'Salida Familiar' },
    { tipoEgresoId: tiposEgreso[0].id, renglonId: renglones[3].id, tipoPagoDefectoId: tiposPago[4].id, descripcion: 'Alquiler de Vivienda' },
  ], { transaction: t });

  await Ingreso.bulkCreate([
    { tipoIngresoId: tiposIngreso[0].id, descripcion: 'Salario Base', institucion: 'Empresa Demo' },
    { tipoIngresoId: tiposIngreso[0].id, descripcion: 'Salario Base Consultora AXP', institucion: 'Consultora AXP' },
    { tipoIngresoId: tiposIngreso[3].id, descripcion: 'Bonificación Consultora AXP', institucion: 'Consultora AXP' },
    { tipoIngresoId: tiposIngreso[1].id, descripcion: 'Horas Extras', institucion: 'Empresa Demo' },
    { tipoIngresoId: tiposIngreso[4].id, descripcion: 'Facturación por Servicios', institucion: 'Comercial Norte, S.R.L.' },
  ], { transaction: t });

  const admin = await Usuario.create({
    nombre: 'Administrador',
    cedula: '000-0000000-0',
    email: 'admin@finanzas.local',
    password: await bcrypt.hash('admin123', 10),
    limiteEgresos: null,
    tipoPersona: 'JURIDICA',
    fechaCorte: 1,
    rol: 'ADMIN',
    estado: 'ACTIVO',
  }, { transaction: t });

  const juan = await Usuario.create({
    nombre: 'Juan Pérez',
    cedula: '001-1234567-3',
    email: 'juan@finanzas.local',
    password: await bcrypt.hash('usuario123', 10),
    limiteEgresos: 15000.0,
    tipoPersona: 'FISICA',
    fechaCorte: 28,
    rol: 'USUARIO',
    estado: 'ACTIVO',
  }, { transaction: t });

  const carlos = await Usuario.create({
    nombre: 'Carlos Rivera',
    cedula: '402-1234567-8',
    email: 'carlos.rivera@finanzas.local',
    password: await bcrypt.hash('usuario123', 10),
    limiteEgresos: 30000.0,
    tipoPersona: 'FISICA',
    fechaCorte: 10,
    rol: 'USUARIO',
    estado: 'ACTIVO',
  }, { transaction: t });

  const comercial = await Usuario.create({
    nombre: 'Comercial Norte, S.R.L.',
    cedula: '130-12345-4',
    email: 'finanzas@comercialnorte.com',
    password: await bcrypt.hash('empresa123', 10),
    limiteEgresos: 200000.0,
    tipoPersona: 'JURIDICA',
    fechaCorte: 28,
    rol: 'USUARIO',
    estado: 'ACTIVO',
  }, { transaction: t });

  // Transacciones de ejemplo (mes anterior: ya vencido, respeta la regla de que
  // solo se cortan períodos terminados; el mes en curso queda libre para demo en vivo)
  const hoy = new Date();
  let anio = hoy.getFullYear();
  let mes = hoy.getMonth() + 1;
  // retroceder al mes anterior (cuidando el cambio de año)
  mes -= 1;
  if (mes === 0) { mes = 12; anio -= 1; }
  const f = (dia) => `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

  const egresos = await Egreso.findAll({ transaction: t });
  const ingresos = await Ingreso.findAll({ transaction: t });

  const txs = [
    // Juan Pérez
    { numero: `TRX-IN-${anio}-000001`, tipo: 'INGRESO', usuarioId: juan.id, ingresoId: ingresos[0].id, tipoPagoId: tiposPago[4].id, fechaTransaccion: f(1), fechaRegistro: hoy, monto: 25000, comentario: 'Salario mensual' },
    { numero: `TRX-IN-${anio}-000002`, tipo: 'INGRESO', usuarioId: juan.id, ingresoId: ingresos[2].id, tipoPagoId: tiposPago[4].id, fechaTransaccion: f(5), fechaRegistro: hoy, monto: 5000, comentario: 'Bonificación' },
    { numero: `TRX-EG-${anio}-000001`, tipo: 'EGRESO', usuarioId: juan.id, egresoId: egresos[0].id, tipoPagoId: tiposPago[1].id, fechaTransaccion: f(3), fechaRegistro: hoy, monto: 3200.5, noTarjeta: '4111111111111111', comentario: 'Mercado mensual' },
    { numero: `TRX-EG-${anio}-000002`, tipo: 'EGRESO', usuarioId: juan.id, egresoId: egresos[2].id, tipoPagoId: tiposPago[0].id, fechaTransaccion: f(4), fechaRegistro: hoy, monto: 1500, comentario: 'Tanque lleno' },
    { numero: `TRX-EG-${anio}-000003`, tipo: 'EGRESO', usuarioId: juan.id, egresoId: egresos[4].id, tipoPagoId: tiposPago[4].id, fechaTransaccion: f(6), fechaRegistro: hoy, monto: 7000, comentario: 'Alquiler' },
    { numero: `TRX-EG-${anio}-000004`, tipo: 'EGRESO', usuarioId: juan.id, egresoId: egresos[3].id, tipoPagoId: tiposPago[1].id, fechaTransaccion: f(8), fechaRegistro: hoy, monto: 2000, comentario: 'Cine y cena' },
    // Carlos Rivera
    { numero: `TRX-IN-${anio}-000005`, tipo: 'INGRESO', usuarioId: carlos.id, ingresoId: ingresos[3].id, tipoPagoId: tiposPago[4].id, fechaTransaccion: f(1), fechaRegistro: hoy, monto: 18500, comentario: 'Horas extras' },
    { numero: `TRX-EG-${anio}-000005`, tipo: 'EGRESO', usuarioId: carlos.id, egresoId: egresos[0].id, tipoPagoId: tiposPago[0].id, fechaTransaccion: f(2), fechaRegistro: hoy, monto: 2450, comentario: 'Mercado' },
    { numero: `TRX-EG-${anio}-000006`, tipo: 'EGRESO', usuarioId: carlos.id, egresoId: egresos[2].id, tipoPagoId: tiposPago[1].id, fechaTransaccion: f(4), fechaRegistro: hoy, monto: 1200, noTarjeta: '378282246310005', comentario: 'Gasolina' },
    { numero: `TRX-EG-${anio}-000007`, tipo: 'EGRESO', usuarioId: carlos.id, egresoId: egresos[3].id, tipoPagoId: tiposPago[3].id, fechaTransaccion: f(6), fechaRegistro: hoy, monto: 1500, comentario: 'Restaurante' },
    // Comercial Norte, S.R.L.
    { numero: `TRX-IN-${anio}-000010`, tipo: 'INGRESO', usuarioId: comercial.id, ingresoId: ingresos[4].id, tipoPagoId: tiposPago[4].id, fechaTransaccion: f(2), fechaRegistro: hoy, monto: 150000, comentario: 'Cobro a cliente' },
    { numero: `TRX-IN-${anio}-000011`, tipo: 'INGRESO', usuarioId: comercial.id, ingresoId: ingresos[4].id, tipoPagoId: tiposPago[4].id, fechaTransaccion: f(8), fechaRegistro: hoy, monto: 95000, comentario: 'Ventas del mes' },
    { numero: `TRX-EG-${anio}-000010`, tipo: 'EGRESO', usuarioId: comercial.id, egresoId: egresos[4].id, tipoPagoId: tiposPago[4].id, fechaTransaccion: f(1), fechaRegistro: hoy, monto: 40000, comentario: 'Renta del local' },
    { numero: `TRX-EG-${anio}-000011`, tipo: 'EGRESO', usuarioId: comercial.id, egresoId: egresos[0].id, tipoPagoId: tiposPago[4].id, fechaTransaccion: f(5), fechaRegistro: hoy, monto: 25000, comentario: 'Materia prima' },
    { numero: `TRX-EG-${anio}-000012`, tipo: 'EGRESO', usuarioId: comercial.id, egresoId: egresos[1].id, tipoPagoId: tiposPago[4].id, fechaTransaccion: f(7), fechaRegistro: hoy, monto: 30000, comentario: 'Combustible de flota' },
  ];

  const creadas = await Transaccion.bulkCreate(txs, { transaction: t });

  const clampCorteDia = (anio, mes, dia) => Math.min(dia, new Date(anio, mes, 0).getDate());

  const resumenUsuario = (uid) => {
    const propias = creadas.filter((x) => x.usuarioId === uid);
    const ingresosU = propias.filter((x) => x.tipo === 'INGRESO').reduce((s, c) => s + Number(c.monto), 0);
    const egresosU = propias.filter((x) => x.tipo === 'EGRESO').reduce((s, c) => s + Number(c.monto), 0);
    return { ingresos: ingresosU, egresos: egresosU };
  };

  const rj = resumenUsuario(juan.id);
  await Corte.create({
    usuarioId: juan.id,
    anio: anio,
    mes: mes,
    fechaCorte: f(clampCorteDia(anio, mes, juan.fechaCorte)),
    balanceInicial: 0,
    totalIngresos: rj.ingresos,
    totalEgresos: rj.egresos,
    balanceCorte: rj.ingresos - rj.egresos,
  }, { transaction: t });

  const rm = resumenUsuario(comercial.id);
  await Corte.create({
    usuarioId: comercial.id,
    anio: anio,
    mes: mes,
    fechaCorte: f(clampCorteDia(anio, mes, comercial.fechaCorte)),
    balanceInicial: 0,
    totalIngresos: rm.ingresos,
    totalEgresos: rm.egresos,
    balanceCorte: rm.ingresos - rm.egresos,
  }, { transaction: t });

  await t.commit();
  return 'seed creado';
}

module.exports = { seed };