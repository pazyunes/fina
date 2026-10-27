import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fijosDelMes, fraseDelMes, mesACerrar, recomendaciones, resumenDelMes, type DatosDelMes } from '../../src/app/lib/cierreDeMes';

const MES = mesACerrar('2026-10-29')!;
const base: DatosDelMes = {
  gastos: [
    { fecha: '2026-10-02', montoArs: 30000, seccionId: 'c' },
    { fecha: '2026-10-10', montoArs: 20000, seccionId: 'c' },
    { fecha: '2026-10-11', montoArs: 5000, seccionId: 't' },
    { fecha: '2026-09-10', montoArs: 80000, seccionId: 'c' },
  ],
  ingresos: [{ fecha: '2026-10-01', montoArs: 200000 }],
  aportes: [],
  secciones: [{ id: 'c', nombre: 'Comida', tieneTope: false }, { id: 't', nombre: 'Transporte', tieneTope: true }],
  objetivos: [{ id: 'o', nombre: 'el viaje' }],
  fijos: [],
  dolar: 1500,
};

describe('qué mes se cierra', () => {
  it('en los últimos 3 días se mira el mes en curso', () => {
    assert.equal(mesACerrar('2026-10-29')?.clave, '2026-10');
    assert.equal(mesACerrar('2026-10-31')?.terminado, false);
  });
  it('en los primeros 5 días se mira el que terminó', () => {
    const m = mesACerrar('2026-11-03')!;
    assert.equal(m.clave, '2026-10');
    assert.equal(m.terminado, true);
    assert.equal(m.siguiente.nombre, 'noviembre');
  });
  it('a mitad de mes no toca', () => assert.equal(mesACerrar('2026-10-15'), null));
  it('pasa de año', () => {
    const m = mesACerrar('2027-01-02')!;
    assert.deepEqual([m.clave, m.nombre, m.siguiente.clave], ['2026-12', 'diciembre', '2027-01']);
  });
  it('febrero termina el 28 (o 29)', () => {
    assert.equal(mesACerrar('2027-02-26')?.clave, '2027-02');
    assert.equal(mesACerrar('2027-02-25'), null);
    assert.equal(mesACerrar('2028-02-27')?.clave, '2028-02');
  });
});

describe('el resumen del mes', () => {
  const r = resumenDelMes(base, MES);
  it('suma ingresos y gastos sólo del mes', () => {
    assert.equal(r.ingresos, 200000);
    assert.equal(r.gastado, 55000);
    assert.equal(r.quedo, 145000);
    assert.equal(r.gastadoMesAnterior, 80000);
  });
  it('cuenta los días con gastos y encuentra lo que más se llevó', () => {
    assert.equal(r.diasConGastos, 3);
    assert.equal(r.diasDelMes, 31);
    assert.deepEqual(r.mayor, { seccionId: 'c', nombre: 'Comida', monto: 50000 });
  });
  it('un mes sin nada no tiene datos', () => assert.equal(resumenDelMes({ ...base, gastos: [], ingresos: [] }, MES).hayDatos, false));
  it('si se gastó más de lo que entró, lo que quedó es negativo', () => assert.equal(resumenDelMes({ ...base, ingresos: [] }, MES).quedo, -55000));
});

describe('la frase', () => {
  it('sin datos, invita a anotar', () => assert.match(fraseDelMes(resumenDelMes({ ...base, gastos: [], ingresos: [] }, MES), MES), /Todavía no hay datos de octubre/));
  it('con aportes, habla de avanzar', () => {
    const d = { ...base, aportes: [{ fecha: '2026-10-05', montoArs: 10000 }] };
    assert.match(fraseDelMes(resumenDelMes(d, MES), MES), /Le sumaste \$10\.000 a tus objetivos/);
  });
  it('si gastó menos que el mes anterior, lo dice con el número', () => assert.match(fraseDelMes(resumenDelMes(base, MES), MES), /Gastaste \$25\.000 menos que en septiembre/));
  it('nunca reta', () => {
    const f = fraseDelMes(resumenDelMes({ ...base, ingresos: [], gastos: [{ fecha: '2026-10-02', montoArs: 99999, seccionId: 'c' }] }, MES), MES);
    assert.doesNotMatch(f, /pasaste|mal|deberías|tenés que|gasto hormiga/i);
  });
});

describe('recomendaciones', () => {
  it('sugiere un tope para lo que más se llevó, si no tiene', () => {
    const rec = recomendaciones(resumenDelMes(base, MES), base, MES);
    assert.deepEqual(rec[0].accion, { tipo: 'tope', seccionId: 'c' });
  });
  it('no sugiere tope si ya lo tiene', () => {
    const d = { ...base, secciones: [{ id: 'c', nombre: 'Comida', tieneTope: true }, { id: 't', nombre: 'Transporte', tieneTope: true }] };
    assert.ok(!recomendaciones(resumenDelMes(d, MES), d, MES).some((x) => x.accion.tipo === 'tope'));
  });
  it('si no aportó a un objetivo, sugiere separar apenas cobre', () => {
    assert.ok(recomendaciones(resumenDelMes(base, MES), base, MES).some((x) => x.accion.tipo === 'objetivo'));
  });
  it('sin objetivos, sugiere crear uno', () => {
    const d = { ...base, objetivos: [] };
    assert.ok(recomendaciones(resumenDelMes(d, MES), d, MES).some((x) => x.accion.tipo === 'nuevo-objetivo'));
  });
  it('nunca más de tres', () => assert.ok(recomendaciones(resumenDelMes({ ...base, ingresos: [] }, MES), { ...base, ingresos: [] }, MES).length <= 3));
});

describe('lo que ya se sabe del mes que viene', () => {
  const fijo = { descripcion: 'Alquiler', monto: 300000, moneda: 'ARS' as const, proximoPago: '2026-10-31', frecuencia: 'mensual' as const, diaAncla: 31 };
  it('un gasto mensual cae una vez', () => {
    const f = fijosDelMes({ ...base, fijos: [fijo] }, MES);
    assert.deepEqual(f.map((x) => x.fecha), ['2026-11-30']);
  });
  it('uno semanal cae todas las semanas', () => {
    const f = fijosDelMes({ ...base, fijos: [{ ...fijo, descripcion: 'Clase', proximoPago: '2026-10-28', frecuencia: 'semanal', diaAncla: null }] }, MES);
    assert.deepEqual(f.map((x) => x.fecha), ['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25']);
  });
  it('un cumpleaños anual cae sólo el año que corresponde', () => {
    const cumple = { ...fijo, descripcion: 'Cumpleaños de Ana', proximoPago: '2026-11-15', frecuencia: 'anual' as const, diaAncla: 15 };
    assert.equal(fijosDelMes({ ...base, fijos: [cumple] }, MES).length, 1);
    assert.equal(fijosDelMes({ ...base, fijos: [{ ...cumple, proximoPago: '2027-11-15' }] }, MES).length, 0);
  });
  it('los dólares se pasan a pesos al dólar de hoy; sin dólar se dejan afuera', () => {
    const usd = { ...fijo, monto: 10, moneda: 'USD' as const, proximoPago: '2026-11-05' };
    assert.equal(fijosDelMes({ ...base, fijos: [usd] }, MES)[0].montoArs, 15000);
    assert.equal(fijosDelMes({ ...base, fijos: [usd], dolar: null }, MES).length, 0);
  });
});
