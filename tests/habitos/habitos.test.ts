import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { claveDeGasto, detectarHabitos, diaDeSemana, diasEnTexto, habitosDeHoy, repeticionesEseDia, type GastoParaHabito } from '../../src/app/lib/habitos';

// 2026-10-26 es lunes.
const HOY = '2026-10-26';
const g = (descripcion: string, fecha: string, monto = 3000, seccionId: string | null = 's1'): GastoParaHabito => ({ descripcion, monto, fecha, seccionId });
const LUNES_ANTERIORES = ['2026-10-19', '2026-10-12', '2026-10-05', '2026-09-28'];

describe('hábitos de gasto', () => {
  it('sabe qué día de la semana es cada fecha', () => {
    assert.equal(diaDeSemana('2026-10-26'), 1);
    assert.equal(diaDeSemana('2026-10-25'), 0);
  });

  it('junta "Café", "cafe " y "CAFÉ 2"', () => {
    assert.equal(claveDeGasto('Café'), claveDeGasto(' cafe '));
    assert.equal(claveDeGasto('CAFÉ 2'), claveDeGasto('café'));
  });

  it('tres lunes iguales ya son un hábito de los lunes', () => {
    const h = detectarHabitos(LUNES_ANTERIORES.slice(0, 3).map((f) => g('Café', f, 3200)), HOY);
    assert.equal(h.length, 1);
    assert.deepEqual(h[0].diasDeSemana, [1]);
    assert.equal(h[0].montoTipico, 3200);
    assert.equal(h[0].descripcion, 'Café');
  });

  it('con dos veces todavía no es un hábito', () => {
    assert.equal(detectarHabitos(LUNES_ANTERIORES.slice(0, 2).map((f) => g('Café', f)), HOY).length, 0);
  });

  it('tres gastos en días distintos de la semana no son un hábito de ningún día', () => {
    assert.equal(detectarHabitos([g('Café', '2026-10-19'), g('Café', '2026-10-21'), g('Café', '2026-10-23')], HOY).length, 0);
  });

  it('un hábito de varios días (lunes a viernes) los trae a todos', () => {
    const semana = ['2026-10-19', '2026-10-20', '2026-10-12', '2026-10-13', '2026-10-05', '2026-10-06'];
    const h = detectarHabitos(semana.map((f) => g('Café', f)), HOY);
    assert.deepEqual(h[0].diasDeSemana, [1, 2]);
  });

  it('si hace más de tres semanas que no lo repite, se da por terminado', () => {
    assert.equal(detectarHabitos(['2026-09-14', '2026-09-07', '2026-08-31'].map((f) => g('Café', f)), HOY).length, 0);
  });

  it('lo muy viejo (más de 8 semanas) no cuenta', () => {
    assert.equal(detectarHabitos(['2026-08-24', '2026-08-17', '2026-08-10'].map((f) => g('Café', f)), HOY).length, 0);
  });

  it('el monto típico es la mediana, redondeada', () => {
    const h = detectarHabitos([g('Café', '2026-10-19', 3000), g('Café', '2026-10-12', 3400), g('Café', '2026-10-05', 9000)], HOY);
    assert.equal(h[0].montoTipico, 3400);
  });

  it('dos gastos iguales el mismo día cuentan una vez', () => {
    assert.equal(detectarHabitos([g('Café', '2026-10-19'), g('Café', '2026-10-19'), g('Café', '2026-10-12')], HOY).length, 0);
  });

  it('una descripción muy corta no dice nada', () => {
    assert.equal(detectarHabitos(LUNES_ANTERIORES.slice(0, 3).map((f) => g('x', f)), HOY).length, 0);
  });
});

describe('qué recordar hoy', () => {
  const gastos = LUNES_ANTERIORES.slice(0, 3).map((f) => g('Café', f));
  const habitos = detectarHabitos(gastos, HOY);

  it('un lunes sin café anotado, se recuerda', () => assert.equal(habitosDeHoy(habitos, gastos, HOY).length, 1));
  it('si ya lo anotó hoy, no', () => assert.equal(habitosDeHoy(habitos, [...gastos, g('cafe', HOY)], HOY).length, 0));
  it('otro día de la semana, no', () => assert.equal(habitosDeHoy(habitos, gastos, '2026-10-27').length, 0));
});

describe('cuándo preguntar "¿te lo recordamos?"', () => {
  it('cuenta las veces que lo anotó ese día de la semana, contando la de hoy', () => {
    const gastos = [g('Café', '2026-10-26'), g('Café', '2026-10-19'), g('Café', '2026-10-21')];
    assert.equal(repeticionesEseDia(gastos, 'Café', '2026-10-26'), 2);
    assert.equal(repeticionesEseDia([...gastos, g('Café', '2026-10-12')], 'café', '2026-10-26'), 3);
  });
  it('lo de hace más de 8 semanas no cuenta', () => assert.equal(repeticionesEseDia([g('Café', '2026-10-26'), g('Café', '2026-08-24')], 'Café', '2026-10-26'), 1));
});

describe('los días, en texto', () => {
  it('uno, dos o tres', () => {
    assert.equal(diasEnTexto([1]), 'los lunes');
    assert.equal(diasEnTexto([1, 4]), 'los lunes y jueves');
    assert.equal(diasEnTexto([1, 3, 5]), 'los lunes, miércoles y viernes');
  });
});
