'use strict';

const {
  esMontoValido,
  esFechaValida,
  esFechaCorteValida,
  esTarjetaValida,
  normalizarTarjeta,
  compactarIdentificador,
  digitoVerificadorCedula,
  digitoVerificadorRnc,
  esCedulaValida,
  esRncValida,
  esIdentificadorValido,
  validarEstado,
  validarRol,
  esTextoNoVacio,
  enLista,
  ESTADOS,
  ROLES,
  TIPOS_TRANSACCION,
  TIPOS_PERSONA,
  TARJETA_LONGITUDES,
} = require('../../src/utils/validators');

describe('esMontoValido', () => {
  it('acepta montos válidos mayores que cero', () => {
    expect(esMontoValido(10)).toBe(true);
    expect(esMontoValido(0.01)).toBe(true);
    expect(esMontoValido('1500.50')).toBe(true);
  });
  it('rechaza montos inválidos', () => {
    expect(esMontoValido(0)).toBe(false);
    expect(esMontoValido(-5)).toBe(false);
    expect(esMontoValido('')).toBe(false);
    expect(esMontoValido(null)).toBe(false);
    expect(esMontoValido(undefined)).toBe(false);
    expect(esMontoValido('abc')).toBe(false);
    expect(esMontoValido(NaN)).toBe(false);
  });
});

describe('esFechaValida', () => {
  it('acepta fechas en formato YYYY-MM-DD', () => {
    expect(esFechaValida('2026-09-15')).toBe(true);
    expect(esFechaValida('2024-02-29')).toBe(true);
  });
  it('rechaza fechas inválidas', () => {
    expect(esFechaValida('15/09/2026')).toBe(false);
    expect(esFechaValida('2026-13-01')).toBe(false);
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('')).toBe(false);
    expect(esFechaValida(null)).toBe(false);
  });
});

describe('esFechaCorteValida', () => {
  it('acepta días entre 1 y 28', () => {
    expect(esFechaCorteValida(1)).toBe(true);
    expect(esFechaCorteValida(28)).toBe(true);
  });
  it('rechaza días fuera de rango o no enteros', () => {
    expect(esFechaCorteValida(0)).toBe(false);
    expect(esFechaCorteValida(29)).toBe(false);
    expect(esFechaCorteValida(15.5)).toBe(false);
    expect(esFechaCorteValida('x')).toBe(false);
  });
});

describe('esTarjetaValida', () => {
  it('acepta exactamente 15 o 16 dígitos', () => {
    expect(esTarjetaValida('378282246310005')).toBe(true);
    expect(esTarjetaValida('4111111111111111')).toBe(true);
    expect(TARJETA_LONGITUDES).toEqual([15, 16]);
  });
  it('rechaza menos de 15 dígitos', () => {
    expect(esTarjetaValida('1')).toBe(false);
    expect(esTarjetaValida('411111111111')).toBe(false);
    expect(esTarjetaValida('12345678901234')).toBe(false);
  });
  it('rechaza más de 16 dígitos', () => {
    expect(esTarjetaValida('41111111111111112')).toBe(false);
    expect(esTarjetaValida('12345678901234567890')).toBe(false);
  });
  it('rechaza letras, espacios y símbolos', () => {
    expect(esTarjetaValida('**** 1234')).toBe(false);
    expect(esTarjetaValida('4111 1111 1111 1111')).toBe(false);
    expect(esTarjetaValida('4111-1111-1111-1111')).toBe(false);
    expect(esTarjetaValida('411111111111111a')).toBe(false);
    expect(esTarjetaValida('abcd1234efgh5678')).toBe(false);
    expect(esTarjetaValida('411111111111 111')).toBe(false);
  });
  it('rechaza valores que no son cadenas', () => {
    expect(esTarjetaValida(4111111111111111)).toBe(false);
    expect(esTarjetaValida({})).toBe(false);
    expect(esTarjetaValida(['4111111111111111'])).toBe(false);
  });
  it('trata la ausencia de tarjeta como válida porque el campo es opcional', () => {
    expect(esTarjetaValida(null)).toBe(true);
    expect(esTarjetaValida(undefined)).toBe(true);
    expect(esTarjetaValida('')).toBe(true);
    expect(esTarjetaValida('   ')).toBe(true);
  });
});

describe('normalizarTarjeta', () => {
  it('recorta espacios y convierte vacíos en null', () => {
    expect(normalizarTarjeta('  4111111111111111  ')).toBe('4111111111111111');
    expect(normalizarTarjeta('   ')).toBeNull();
    expect(normalizarTarjeta('')).toBeNull();
    expect(normalizarTarjeta(null)).toBeNull();
    expect(normalizarTarjeta(undefined)).toBeNull();
  });
});

describe('identificadores dominicanos (cédula y RNC)', () => {
  it('acepta cédulas reales verificadas contra python-stdnum', () => {
    expect(esCedulaValida('001-1391820-5')).toBe(true);
    expect(esCedulaValida('00113918205')).toBe(true);
    expect(esCedulaValida('402-0057193-9')).toBe(true);
    expect(esCedulaValida('224-0002211-1')).toBe(true);
    expect(esCedulaValida('402-1234567-8')).toBe(true);
  });

  it('rechaza cédulas con dígito verificador incorrecto', () => {
    expect(esCedulaValida('001-1391820-4')).toBe(false);
    expect(esCedulaValida('00113918204')).toBe(false);
    expect(esCedulaValida('001-1234567-8')).toBe(false);
    expect(esCedulaValida('402-1234567-9')).toBe(false);
  });

  it('rechaza cédulas con formato o largo incorrecto', () => {
    expect(esCedulaValida('001-123456-8')).toBe(false);
    expect(esCedulaValida('001-12345678-8')).toBe(false);
    expect(esCedulaValida('130-12345-6')).toBe(false);
    expect(esCedulaValida('')).toBe(false);
    expect(esCedulaValida('   ')).toBe(false);
    expect(esCedulaValida('abcdefghijk')).toBe(false);
    expect(esCedulaValida('001-1391820-A')).toBe(false);
    expect(esCedulaValida(null)).toBe(false);
    expect(esCedulaValida(undefined)).toBe(false);
    expect(esCedulaValida({})).toBe(false);
  });

  it('acepta RNC reales verificados contra python-stdnum', () => {
    expect(esRncValida('1-01-85004-3')).toBe(true);
    expect(esRncValida('101850043')).toBe(true);
    expect(esRncValida('1-31-24679-6')).toBe(true);
    expect(esRncValida('131246796')).toBe(true);
  });

  it('rechaza RNC con dígito verificador o formato incorrecto', () => {
    expect(esRncValida('101850042')).toBe(false);
    expect(esRncValida('130-12345-6')).toBe(false);
    expect(esRncValida('1-01-85004-4')).toBe(false);
    expect(esRncValida('10185004')).toBe(false);
    expect(esRncValida('1018500433')).toBe(false);
    expect(esRncValida('402-1234567-8')).toBe(false);
    expect(esRncValida(null)).toBe(false);
  });

  it('acepta las entradas de la lista blanca aunque no pase el algoritmo', () => {
    expect(esCedulaValida('001-1427236-0')).toBe(true);
    expect(esRncValida('101581601')).toBe(true);
  });

  it('descarta las entradas mal formadas de la lista blanca', () => {
    expect(esCedulaValida('0094662667')).toBe(false);
    expect(esCedulaValida('0710208838')).toBe(false);
    expect(esRncValida('10233317')).toBe(false);
  });

  it('despacha segun tipoPersona', () => {
    expect(esIdentificadorValido('402-1234567-8', 'FISICA')).toBe(true);
    expect(esIdentificadorValido('402-1234567-8', 'JURIDICA')).toBe(false);
    expect(esIdentificadorValido('1-01-85004-3', 'JURIDICA')).toBe(true);
    expect(esIdentificadorValido('1-01-85004-3', 'FISICA')).toBe(false);
    expect(esIdentificadorValido('402-1234567-8')).toBe(true);
  });

  it('compacta guiones y espacios y calcula digitos verificadores', () => {
    expect(compactarIdentificador(' 402-1234567-8 ')).toBe('40212345678');
    expect(compactarIdentificador('1-01-85004-3')).toBe('101850043');
    expect(digitoVerificadorCedula('4021234567')).toBe('8');
    expect(digitoVerificadorRnc('10185004')).toBe('3');
  });
});

describe('estados y roles', () => {
  it('valida estados', () => {
    expect(validarEstado('ACTIVO')).toBe(true);
    expect(validarEstado('INACTIVO')).toBe(true);
    expect(validarEstado('PENDIENTE')).toBe(false);
  });
  it('valida roles', () => {
    expect(validarRol('ADMIN')).toBe(true);
    expect(validarRol('USUARIO')).toBe(true);
    expect(validarRol('SUPER')).toBe(false);
  });
  it('enLista', () => {
    expect(enLista('EGRESO', TIPOS_TRANSACCION)).toBe(true);
    expect(enLista('FISICA', TIPOS_PERSONA)).toBe(true);
    expect(enLista('OTRO', ESTADOS)).toBe(false);
  });
});

describe('identificadores de las fixtures compartidas', () => {
  const { ADM, USR, USR2 } = require('../helpers');

  it('los usuarios semilla usan cédulas con dígito verificador correcto', () => {
    expect(esCedulaValida(ADM.cedula)).toBe(true);
    expect(esCedulaValida(USR.cedula)).toBe(true);
    expect(esCedulaValida(USR2.cedula)).toBe(true);
  });

  it('los usuarios semilla no repiten cédula', () => {
    const cedulas = [ADM, USR, USR2].map((u) => compactarIdentificador(u.cedula));
    expect(new Set(cedulas).size).toBe(cedulas.length);
  });
});

describe('esTextoNoVacio', () => {
  it('rechaza vacíos y espacios', () => {
    expect(esTextoNoVacio('')).toBe(false);
    expect(esTextoNoVacio('   ')).toBe(false);
    expect(esTextoNoVacio(null)).toBe(false);
  });
  it('respeta el límite de longitud', () => {
    expect(esTextoNoVacio('ok', 2)).toBe(true);
    expect(esTextoNoVacio('largo', 2)).toBe(false);
  });
  expect(ROLES).toEqual(['ADMIN', 'USUARIO']);
});