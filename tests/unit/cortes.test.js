'use strict';

const {
  diasDelMes,
  clampCorte,
  toISO,
  validarAnioMes,
  periodoCerrable,
  estadoPeriodo,
  mensajePeriodoEnCurso,
} = require('../../src/controllers/cortes.controller');

describe('diasDelMes', () => {
  it('devuelve la cantidad de días de cada mes', () => {
    expect(diasDelMes(2024, 2)).toBe(29);
    expect(diasDelMes(2025, 2)).toBe(28);
    expect(diasDelMes(2026, 4)).toBe(30);
    expect(diasDelMes(2026, 12)).toBe(31);
  });
});

describe('clampCorte', () => {
  it('limita la fecha de corte a los días del mes', () => {
    expect(clampCorte(2026, 2, 15)).toBe(15);
    expect(clampCorte(2025, 2, 28)).toBe(28);
    expect(clampCorte(2025, 2, 29)).toBe(28);
    expect(clampCorte(2026, 4, 31)).toBe(30);
    expect(clampCorte(2026, 9, 20)).toBe(20);
  });
});

describe('toISO', () => {
  it('formatea la fecha con ceros a la izquierda', () => {
    expect(toISO(2026, 9, 5)).toBe('2026-09-05');
    expect(toISO(2026, 12, 31)).toBe('2026-12-31');
  });
});

describe('validarAnioMes', () => {
  it('acepta año y mes válidos', () => {
    expect(validarAnioMes(2026, 9)).toEqual({ anio: 2026, mes: 9 });
  });
  it('rechaza año o mes inválidos', () => {
    expect(validarAnioMes(1800, 5).error).toBeTruthy();
    expect(validarAnioMes(2026, 0).error).toBeTruthy();
    expect(validarAnioMes(2026, 13).error).toBeTruthy();
    expect(validarAnioMes('x', 5).error).toBeTruthy();
  });
});

describe('periodoCerrable', () => {
  const enCurso = new Date(2026, 8, 18); // 18 de septiembre de 2026

  it('rechaza el mes actual en curso', () => {
    expect(periodoCerrable(2026, 9, enCurso)).toBe(false);
  });
  it('permite cerrar un mes anterior', () => {
    expect(periodoCerrable(2026, 8, enCurso)).toBe(true);
  });
  it('permite cerrar un mes anterior pendiente (julio)', () => {
    expect(periodoCerrable(2026, 7, enCurso)).toBe(true);
  });
  it('septiembre se cierra desde el 1 de octubre', () => {
    expect(periodoCerrable(2026, 9, new Date(2026, 9, 1, 0, 0, 0))).toBe(true);
    expect(periodoCerrable(2026, 9, new Date(2026, 8, 30, 23, 59, 59))).toBe(false);
  });
  it('el primer día del mes siguiente ya habilita el cierre del anterior', () => {
    expect(periodoCerrable(2026, 8, new Date(2026, 8, 1))).toBe(true);
  });
  it('maneja meses de 30 días (abril)', () => {
    expect(periodoCerrable(2026, 4, new Date(2026, 3, 30, 23, 59, 59))).toBe(false);
    expect(periodoCerrable(2026, 4, new Date(2026, 4, 1))).toBe(true);
  });
  it('maneja meses de 31 días (diciembre)', () => {
    expect(periodoCerrable(2026, 12, new Date(2026, 11, 31, 23, 59, 59))).toBe(false);
  });
  it('maneja febrero no bisiesto (28 días)', () => {
    expect(periodoCerrable(2025, 2, new Date(2025, 1, 28, 23, 59, 59))).toBe(false);
    expect(periodoCerrable(2025, 2, new Date(2025, 2, 1))).toBe(true);
  });
  it('maneja febrero bisiesto (29 días)', () => {
    expect(periodoCerrable(2024, 2, new Date(2024, 1, 29, 23, 59, 59))).toBe(false);
    expect(periodoCerrable(2024, 2, new Date(2024, 2, 1))).toBe(true);
  });
  it('maneja el cambio de año (diciembre a enero)', () => {
    expect(periodoCerrable(2026, 12, new Date(2026, 11, 20))).toBe(false);
    expect(periodoCerrable(2026, 12, new Date(2027, 0, 1))).toBe(true);
    expect(periodoCerrable(2027, 1, new Date(2027, 0, 15))).toBe(false);
  });
});

describe('estadoPeriodo', () => {
  const enCurso = new Date(2026, 8, 18); // 18 de septiembre de 2026

  it('clasifica el mes actual como en curso', () => {
    expect(estadoPeriodo(2026, 9, enCurso)).toBe('curso');
  });
  it('clasifica meses anteriores como pasados, incluidos años previos', () => {
    expect(estadoPeriodo(2026, 8, enCurso)).toBe('pasado');
    expect(estadoPeriodo(2025, 12, enCurso)).toBe('pasado');
  });
  it('clasifica meses posteriores como futuros, incluidos años siguientes', () => {
    expect(estadoPeriodo(2026, 10, enCurso)).toBe('futuro');
    expect(estadoPeriodo(2027, 1, enCurso)).toBe('futuro');
  });
});

describe('mensajePeriodoEnCurso', () => {
  it('genera un mensaje dinámico para el período en curso', () => {
    const msg = mensajePeriodoEnCurso(2026, 9, new Date(2026, 8, 18));
    expect(msg).toContain('septiembre de 2026');
    expect(msg).toContain('1 de octubre de 2026');
  });
  it('no genera mensaje si el período ya puede cerrarse', () => {
    expect(mensajePeriodoEnCurso(2026, 8, new Date(2026, 8, 18))).toBe('');
  });
  it('calcula bien el siguiente mes al cambiar de año', () => {
    const msg = mensajePeriodoEnCurso(2026, 12, new Date(2026, 11, 20));
    expect(msg).toContain('diciembre de 2026');
    expect(msg).toContain('1 de enero de 2027');
  });
  it('distingue un mes futuro del mes en curso', () => {
    const msg = mensajePeriodoEnCurso(2026, 10, new Date(2026, 8, 18));
    expect(msg).toContain('octubre de 2026');
    expect(msg).toContain('todavía no ha comenzado');
    expect(msg).not.toContain('todavía está en curso');
    expect(msg).toContain('1 de noviembre de 2026');
  });
  it('califica diciembre del año anterior como pasado al llegar el nuevo período', () => {
    expect(mensajePeriodoEnCurso(2025, 12, new Date(2026, 0, 15))).toBe('');
  });
});