import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cuotaMensual, mesesHasta, paraInvertir, planDeObjetivo } from '../../src/app/lib/inversiones/objetivos';

const AHORA = new Date('2026-10-22T12:00:00Z').getTime();
const casi = (a: number, b: number, t = 1e-6) => assert.ok(Math.abs(a - b) <= t, `${a} ≉ ${b}`);

describe('para cuándo es el objetivo', () => {
  it('lee una fecha escrita como la guarda la app', () => {
    assert.equal(mesesHasta('22 de diciembre de 2026', AHORA), 2);
    assert.equal(mesesHasta('22 de octubre de 2027', AHORA), 12);
    assert.equal(mesesHasta('1 de enero de 2030', AHORA), 38);
  });
  it('"lo antes posible" se trata como corto plazo (3 meses)', () => assert.equal(mesesHasta('Lo antes posible', AHORA), 3));
  it('sin plazo, o con una fecha pasada, no hay cuenta que hacer', () => {
    assert.equal(mesesHasta('Todavía no lo pensé', AHORA), null);
    assert.equal(mesesHasta(null, AHORA), null);
    assert.equal(mesesHasta('1 de enero de 2020', AHORA), null);
  });
});

describe('cuánto separar por mes', () => {
  it('sin rendimiento es faltante ÷ meses', () => casi(cuotaMensual(120000, 12, 0), 10000));
  it('con rendimiento hace falta menos, y las cuotas llegan justo al objetivo', () => {
    const tem = 0.015;
    const c = cuotaMensual(120000, 12, tem);
    assert.ok(c < 10000);
    // Se verifica al revés: juntar esa cuota 12 meses a ese rendimiento da el objetivo.
    let acum = 0;
    for (let i = 0; i < 12; i++) acum = (acum + c) * (1 + tem);
    casi(acum, 120000, 1e-4);
  });
  it('nada que juntar o ningún plazo: cero', () => {
    assert.equal(cuotaMensual(0, 12, 0.01), 0);
    assert.equal(cuotaMensual(1000, 0, 0.01), 0);
  });
  it('el plan da un rango: con el rendimiento más alto hace falta menos', () => {
    const p = planDeObjetivo(120000, 12, { min: 0.01, max: 0.02 });
    assert.ok(p.invirtiendo!.min < p.invirtiendo!.max);
    assert.ok(p.invirtiendo!.max < p.sinInvertir);
    assert.equal(planDeObjetivo(120000, 12, null).invirtiendo, null);
  });
});

describe('qué objetivos sirven para invertir', () => {
  const base = { id: 'o1', nombre: 'Viaje', moneda: 'ARS', estado: 'active', montoTotal: 500000 };
  it('uno activo, en pesos, con monto y algo que falta', () => {
    const o = paraInvertir(base, 100000, '22 de octubre de 2027', AHORA)!;
    assert.equal(o.faltante, 400000);
    assert.equal(o.meses, 12);
  });
  it('no se ofrece uno en dólares, ya cumplido, cancelado o sin monto', () => {
    assert.equal(paraInvertir({ ...base, moneda: 'USD' }, 0, null, AHORA), null);
    assert.equal(paraInvertir(base, 500000, null, AHORA), null);
    assert.equal(paraInvertir({ ...base, estado: 'cancelled' }, 0, null, AHORA), null);
    assert.equal(paraInvertir({ ...base, montoTotal: null }, 0, null, AHORA), null);
  });
});
