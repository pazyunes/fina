import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ordenarTarjetas, TARJETAS } from '../../src/app/lib/inversiones/aprender';

describe('cards para aprender la diferencia entre dos cosas', () => {
  it('todas tienen la misma forma y un id único', () => {
    assert.equal(new Set(TARJETAS.map((t) => t.id)).size, TARJETAS.length);
    for (const t of TARJETAS) {
      for (const campo of [t.titulo, t.idea, t.izq.nombre, t.izq.texto, t.der.nombre, t.der.texto, t.retener]) assert.ok(campo.trim().length > 0, t.id);
      assert.ok(t.productos.length > 0, t.id);
      assert.match(t.titulo, /^Diferencia entre /, t.id);
    }
  });

  it('explican sin dar órdenes ni prometer rendimientos', () => {
    const texto = TARJETAS.flatMap((t) => [t.idea, t.izq.texto, t.der.texto, t.retener, t.ejemplo ?? '']).join(' ');
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

  it('las que tienen que ver con lo recomendado van primero, sin perder ninguna ni mezclar el orden del resto', () => {
    const o = ordenarTarjetas(TARJETAS, ['dolar']);
    assert.equal(o.length, TARJETAS.length);
    assert.equal(o[0].id, 'oficial-mep');
    assert.deepEqual(o.slice(1).map((t) => t.id), TARJETAS.filter((t) => t.id !== 'oficial-mep').map((t) => t.id));
    assert.deepEqual(ordenarTarjetas(TARJETAS, []).map((t) => t.id), TARJETAS.map((t) => t.id));
  });
});
