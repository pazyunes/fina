import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ordenarTarjetas, TARJETAS } from '../../src/app/lib/inversiones/aprender';

import { aprendidasHoy, diaAR, LIMITE_DIARIO, META_DE_RACHA, puedeMarcarHoy, rachaDeAprendizaje, type Aprendida } from '../../src/app/lib/inversiones/aprender';

describe('mini lecciones para aprender', () => {
  it('todas tienen la misma forma y un id único', () => {
    assert.equal(new Set(TARJETAS.map((t) => t.id)).size, TARJETAS.length);
    for (const t of TARJETAS) {
      for (const campo of [t.titulo, t.idea, t.retener, ...t.bloques.flatMap((b) => [b.nombre, b.texto])]) assert.ok(campo.trim().length > 0, t.id);
      assert.ok(t.productos.length > 0, t.id);
      assert.ok(t.bloques.length >= 1 && t.bloques.length <= 2, t.id);
      if (t.clase === 'diferencia') assert.match(t.titulo, /^Diferencia entre /, t.id);
    }
  });

  it('hay de más de una clase, no sólo diferencias', () => {
    assert.ok(new Set(TARJETAS.map((t) => t.clase)).size >= 3);
    assert.ok(TARJETAS.length >= META_DE_RACHA * 2);
  });

  it('explican sin dar órdenes ni prometer rendimientos', () => {
    const texto = TARJETAS.flatMap((t) => [t.idea, ...t.bloques.map((b) => b.texto), t.retener, t.ejemplo ?? '']).join(' ');
    assert.doesNotMatch(texto, /tenés que|deberías|no te olvides|garantizad[oa] (que )?(ganás|rinde)/i);
  });

  it('los ejemplos con plata dicen que son de juguete', () => {
    for (const t of TARJETAS.filter((x) => x.ejemplo)) assert.match(t.ejemplo!, /de juguete/, t.id);
  });

  it('el ejemplo de TNA y TEA es correcto: 20% de TNA con intereses mensuales ≈ 21,9% de TEA', () => {
    const tea = Math.pow(1 + 0.2 / 12, 12) - 1;
    assert.equal((tea * 100).toFixed(1), '21.9');
    assert.match(TARJETAS.find((t) => t.id === 'tna-tea')!.ejemplo!, /21,9%/);
  });

  it('el ejemplo de rendimiento real es correcto: 2% sobre $100.000 son $102.000, y con 2,5% de inflación hay que pagar $102.500', () => {
    assert.equal(Math.round(100_000 * 1.02), 102_000);
    assert.equal(Math.round(100_000 * 1.025), 102_500);
    const e = TARJETAS.find((t) => t.id === 'rinde-vs-real')!.ejemplo!;
    assert.ok(e.includes('$102.000') && e.includes('$102.500'));
  });

  it('el ejemplo de interés compuesto es correcto: $100.000 al 2% por mes, tres meses', () => {
    const m1 = 100_000 * 1.02;
    const m2 = m1 * 1.02;
    const m3 = m2 * 1.02;
    assert.deepEqual([m1, m2, m3].map(Math.round), [102_000, 104_040, 106_121]);
    const e = TARJETAS.find((t) => t.id === 'interes-compuesto')!.ejemplo!;
    assert.ok(e.includes('$102.000') && e.includes('$104.040') && e.includes('$106.121'));
  });

  it('el ejemplo de inflación es correcto: $1.000 con 2,5% pasan a $1.025', () => {
    assert.equal(Math.round(1000 * 1.025), 1025);
    assert.ok(TARJETAS.find((t) => t.id === 'inflacion')!.ejemplo!.includes('$1.025'));
  });
});

describe('el orden de las cards', () => {
  it('lo recomendado y no aprendido va primero; lo aprendido, al final; el resto conserva su orden', () => {
    const o = ordenarTarjetas(TARJETAS, ['dolar'], ['tna-tea']);
    assert.equal(o.length, TARJETAS.length);
    assert.equal(o[0].id, 'oficial-mep');
    assert.equal(o[o.length - 1].id, 'tna-tea');
    const medio = o.slice(0, -1).map((t) => t.id).filter((id) => id !== 'oficial-mep' && !TARJETAS.find((t) => t.id === id)!.productos.includes('dolar'));
    assert.deepEqual(medio, TARJETAS.map((t) => t.id).filter((id) => medio.includes(id)));
  });
  it('sin recomendados ni aprendidas, queda como está', () => {
    assert.deepEqual(ordenarTarjetas(TARJETAS, []).map((t) => t.id), TARJETAS.map((t) => t.id));
  });
});

describe('la racha de aprendizaje: cada 5 lecciones aprendidas', () => {
  const ids = (n: number) => TARJETAS.slice(0, n).map((t) => t.id);
  it('cuenta en rachas de 5', () => {
    assert.deepEqual(rachaDeAprendizaje(ids(0)), { aprendidas: 0, completas: 0, enCurso: 0, faltan: 5 });
    assert.deepEqual(rachaDeAprendizaje(ids(3)), { aprendidas: 3, completas: 0, enCurso: 3, faltan: 2 });
    assert.deepEqual(rachaDeAprendizaje(ids(5)), { aprendidas: 5, completas: 1, enCurso: 5, faltan: 0 });
    assert.deepEqual(rachaDeAprendizaje(ids(7)), { aprendidas: 7, completas: 1, enCurso: 2, faltan: 3 });
    assert.deepEqual(rachaDeAprendizaje(ids(10)), { aprendidas: 10, completas: 2, enCurso: 5, faltan: 0 });
  });
  it('no cuenta dos veces la misma ni ids que ya no existen', () => {
    assert.equal(rachaDeAprendizaje(['tna-tea', 'tna-tea', 'tna-tea']).aprendidas, 1);
    assert.equal(rachaDeAprendizaje(['no-existe', 'tna-tea']).aprendidas, 1);
  });
  it('desmarcar una vuelve atrás', () => {
    assert.equal(rachaDeAprendizaje(ids(5)).completas, 1);
    assert.equal(rachaDeAprendizaje(ids(4)).completas, 0);
  });
});

describe('un máximo de 5 lecciones por día', () => {
  const marcadas = (n: number, dia: string): Aprendida[] => TARJETAS.slice(0, n).map((t) => ({ id: t.id, dia }));
  it('el límite es 5', () => assert.equal(LIMITE_DIARIO, 5));
  it('se puede marcar hasta llegar a 5 hoy, y la sexta no', () => {
    assert.ok(puedeMarcarHoy([], '2026-10-22'));
    assert.ok(puedeMarcarHoy(marcadas(4, '2026-10-22'), '2026-10-22'));
    assert.ok(!puedeMarcarHoy(marcadas(5, '2026-10-22'), '2026-10-22'));
  });
  it('sólo cuentan las de hoy: las de ayer y las de datos viejos no', () => {
    const lista = [...marcadas(5, '2026-10-21'), { id: TARJETAS[6].id, dia: '' }, { id: TARJETAS[7].id, dia: '2026-10-22' }];
    assert.equal(aprendidasHoy(lista, '2026-10-22'), 1);
    assert.ok(puedeMarcarHoy(lista, '2026-10-22'));
  });
  it('al día siguiente se puede de nuevo', () => {
    assert.ok(!puedeMarcarHoy(marcadas(5, '2026-10-22'), '2026-10-22'));
    assert.ok(puedeMarcarHoy(marcadas(5, '2026-10-22'), '2026-10-23'));
  });
  it('desmarcar una de hoy libera un lugar', () => {
    const cinco = marcadas(5, '2026-10-22');
    assert.ok(puedeMarcarHoy(cinco.slice(1), '2026-10-22'));
  });
  it('el día es el de Argentina: a las 23:30 de allá todavía es el mismo día, a las 00:30 ya es otro', () => {
    assert.equal(diaAR(Date.parse('2026-10-23T02:30:00Z')), '2026-10-22');
    assert.equal(diaAR(Date.parse('2026-10-23T03:30:00Z')), '2026-10-23');
  });
  it('con el máximo diario se completa justo una racha por día', () => {
    assert.equal(LIMITE_DIARIO, META_DE_RACHA);
    assert.equal(rachaDeAprendizaje(marcadas(5, '2026-10-22').map((a) => a.id)).completas, 1);
  });
});
