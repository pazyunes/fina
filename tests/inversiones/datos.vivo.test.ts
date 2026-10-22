// Verifica los datos REALES de hoy (necesita internet): que cada fuente responda, que los
// números sean verosímiles, que las dos fuentes de cada dato crítico coincidan, y que las
// cuentas que hace FINA con esos datos den lo mismo que si se hicieran aparte, a mano.
//
//   npm run verificar:datos

import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { construirMercado } from '../../api/_mercado/fuentes';
import { calcularInflacionPersonal } from '../../src/app/lib/inversiones/inflacionPersonal';
import { recomendar } from '../../src/app/lib/inversiones/motor';
import type { Mercado } from '../../src/app/lib/inversiones/mercadoTipos';

let m: Mercado;
const AD = 'https://api.argentinadatos.com/v1';
const json = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  assert.ok(r.ok, `${url} respondió ${r.status}`);
  return (await r.json()) as T;
};

before(async () => {
  m = await construirMercado();
  console.log(`\n  Paquete armado ${m.generadoEn}. Fuentes que fallaron: ${m.fallas.length}. Alertas: ${m.alertas.length}.`);
  for (const a of m.alertas) console.log(`    [${a.gravedad}] ${a.clave}: ${a.mensaje}`);
});

describe('cada fuente respondió', () => {
  it('ninguna falló', () => assert.deepEqual(m.fallas, []));
  it('hay datos de todo lo importante', () => {
    for (const [nombre, v] of Object.entries({
      inflación: m.inflacion.meses.length, 'inflación esperada': m.inflacion.esperada12m, UVA: m.inflacion.uva30d, TAMAR: m.tasas.tamar,
      'plazo fijo': m.plazoFijo, cuentas: m.cuentas, fondos: m.fondos, dólar: m.dolar.oficial, MEP: m.dolar.mep, CEDEARs: m.cedears,
      'S&P 500': m.spy, 'índices INDEC': m.ipc, 'riesgo país': m.riesgoPais,
    })) assert.ok(v, `falta ${nombre}`);
  });
  it('los CEDEARs vienen de BYMA (la fuente oficial), no de la comunitaria', () => {
    assert.match(m.cedears?.fuente ?? '', /BYMA/);
  });
});

describe('los números son verosímiles', () => {
  it('la inflación mensual está entre −1% y 20%', () => {
    for (const x of m.inflacion.meses) assert.ok(x.valor > -1 && x.valor < 20, `${x.fecha}: ${x.valor}`);
  });
  it('TAMAR entre 5% y 100%; riesgo país entre 100 y 3.000 puntos', () => {
    assert.ok(m.tasas.tamar!.valor > 5 && m.tasas.tamar!.valor < 100);
    assert.ok(m.riesgoPais!.valor > 100 && m.riesgoPais!.valor < 3000);
  });
  it('dólar oficial, MEP y blue son parecidos entre sí (brecha menor a 40%)', () => {
    const o = m.dolar.oficial!.valor;
    assert.ok(o > 500 && o < 20000);
    assert.ok(m.dolar.mep!.valor / o > 0.9 && m.dolar.mep!.valor / o < 1.4);
    assert.ok(m.dolar.blue!.valor / o > 0.9 && m.dolar.blue!.valor / o < 1.4);
  });
  it('los fondos de dinero rinden entre 0,4 y 1,6 veces la TAMAR', () => {
    for (const f of m.fondos!.valor) {
      assert.ok(f.tna1 !== null, `${f.id} sin rendimiento`);
      const ratio = (f.tna1! * 100) / m.tasas.tamar!.valor;
      assert.ok(ratio > 0.4 && ratio < 1.6, `${f.id}: ${(f.tna1! * 100).toFixed(1)}% vs TAMAR ${m.tasas.tamar!.valor}`);
    }
  });
  it('las cuentas de las billeteras que ofrecemos tienen tasa vigente y tope', () => {
    for (const id of ['UALA', 'NARANJA X']) {
      const c = m.cuentas!.valor.find((x) => x.id === id);
      assert.ok(c, `falta ${id}`);
      assert.ok(c.tna > 0.02 && c.tna < 1.5, `${id}: ${c.tna}`);
    }
  });
  it('los 11 CEDEARs tienen precio, y el S&P 500 tiene su historia', () => {
    assert.equal(m.cedears!.valor.length, 11);
    for (const c of m.cedears!.valor) assert.ok(c.precio > 0);
    assert.ok(m.spy!.valor.anualizado10a! > -10 && m.spy!.valor.anualizado10a! < 40);
    assert.ok(m.spy!.valor.peorAnio! < 0, 'en 10 años siempre hubo algún período de 12 meses en baja');
  });
});

describe('las dos fuentes coinciden', () => {
  it('no hay alertas graves', () => assert.deepEqual(m.alertas.filter((a) => a.gravedad === 'grave'), []));
  it('el dólar de DolarAPI coincide con Bluelytics (menos de 1,5%)', async () => {
    const b = await json<{ oficial: { value_sell: number }; blue: { value_sell: number } }>('https://api.bluelytics.com.ar/v2/latest');
    assert.ok(Math.abs(m.dolar.oficial!.valor / b.oficial.value_sell - 1) < 0.015, `oficial ${m.dolar.oficial!.valor} vs ${b.oficial.value_sell}`);
    assert.ok(Math.abs(m.dolar.blue!.valor / b.blue.value_sell - 1) < 0.015, `blue ${m.dolar.blue!.valor} vs ${b.blue.value_sell}`);
  });
  it('la inflación de ArgentinaDatos coincide con el INDEC publicado en datos.gob.ar (menos de 0,15 puntos por mes)', () => {
    assert.ok((m.inflacion.control ?? []).length >= 3, 'sin segunda fuente de inflación');
    let comparados = 0;
    for (const k of m.inflacion.control ?? []) {
      const propio = m.inflacion.meses.find((x) => x.fecha.slice(0, 7) === k.fecha.slice(0, 7));
      if (!propio) continue;
      comparados++;
      assert.ok(Math.abs(propio.valor - k.valor) < 0.15, `${k.fecha}: ${propio.valor} vs ${k.valor.toFixed(2)}`);
    }
    assert.ok(comparados >= 2);
  });
  it('los precios de BYMA coinciden con la otra fuente (menos de 3%)', async () => {
    const filas = await json<{ symbol: string; c: number }[]>('https://data912.com/live/arg_cedears');
    for (const c of m.cedears!.valor) {
      const otro = filas.find((f) => f.symbol === c.simbolo)?.c;
      if (!otro) continue;
      assert.ok(Math.abs(c.precio / otro - 1) < 0.03, `${c.simbolo}: BYMA ${c.precio} vs ${otro}`);
    }
  });
});

describe('nuestras cuentas dan lo mismo que hechas aparte', () => {
  it('rendimiento de los fondos: (valor de hoy ÷ valor de ayer − 1) × 365 ÷ días', async () => {
    const hoy = await json<{ fondo: string; fecha: string; vcp: number }[]>(`${AD}/finanzas/fci/mercadoDinero/ultimo`);
    const ayer = await json<{ fondo: string; fecha: string; vcp: number }[]>(`${AD}/finanzas/fci/mercadoDinero/penultimo`);
    for (const f of m.fondos!.valor) {
      const a = hoy.find((x) => x.fondo === f.id)!;
      const b = ayer.find((x) => x.fondo === f.id)!;
      const dias = (new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) / 86400000;
      const esperado = (a.vcp / b.vcp - 1) * (365 / dias);
      assert.ok(Math.abs(f.tna1! - esperado) < 1e-9, `${f.id}: ${f.tna1} vs ${esperado}`);
    }
  });
  it('UVA del último mes: valor de hoy ÷ valor de hace 30 días − 1', async () => {
    const serie = await json<{ fecha: string; valor: number }[]>(`${AD}/finanzas/indices/uva`);
    const vig = serie.filter((x) => x.fecha <= new Date().toISOString().slice(0, 10));
    const ult = vig[vig.length - 1];
    const objetivo = new Date(new Date(`${ult.fecha}T12:00:00Z`).getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const base = [...vig].reverse().find((x) => x.fecha <= objetivo)!;
    const esperado = (ult.valor / base.valor - 1) * 100;
    assert.ok(Math.abs(m.inflacion.uva30d!.valor - esperado) < 1e-6, `${m.inflacion.uva30d!.valor} vs ${esperado}`);
  });
  it('inflación interanual: el producto de los últimos 12 meses', () => {
    const f = m.inflacion.meses.slice(-12).reduce((a, x) => a * (1 + x.valor / 100), 1);
    assert.ok(Math.abs(m.inflacion.interanual! - (f - 1) * 100) < 1e-9);
  });
  it('el dólar MEP en los pasos coincide con el de DolarAPI directo', async () => {
    const filas = await json<{ casa: string; venta: number }[]>('https://dolarapi.com/v1/dolares');
    const bolsa = filas.find((x) => x.casa === 'bolsa')!.venta;
    assert.ok(Math.abs(m.dolar.mep!.valor / bolsa - 1) < 0.01);
  });
});

describe('las recomendaciones de hoy con datos reales', () => {
  const ctx = { perfil: 'moderado' as const, horizonteMeses: 12, monto: null, usa: [], yaInvierteEn: [], necesitaCaja: true };
  it('nunca recomienda para ahorrar algo que hoy pierde contra la inflación', () => {
    for (const perfil of ['conservador', 'moderado', 'arriesgado'] as const) {
      const r = recomendar({ ...ctx, perfil, horizonteMeses: 60, mercado: m });
      assert.ok(!r.sinBase);
      for (const i of r.items.filter((x) => x.recomendado && x.rec.rol !== 'caja')) assert.notEqual(i.rec.mejor.veredicto, 'pierde', `${perfil}: ${i.rec.producto.nombre}`);
    }
  });
  it('recomienda al menos dos cosas, y todo lo recomendado tiene dato de hoy', () => {
    const r = recomendar({ ...ctx, mercado: m });
    const rec = r.items.filter((i) => i.recomendado);
    assert.ok(rec.length >= 2, `sólo ${rec.length}`);
    for (const i of rec) assert.ok(i.rec.mejor.vigente);
  });
  it('la inflación de referencia es la más alta de las fuentes', () => {
    const r = recomendar({ ...ctx, mercado: m });
    const mayor = Math.max(...r.inflacion!.componentes.map((c) => c.mensual));
    assert.equal(r.inflacion!.mensual, mayor);
  });
  it('la inflación personal de alguien que gasta en supermercado y transporte es un número razonable', () => {
    const hoy = Date.now();
    const gastos = [1, 2, 3, 4, 5, 6].flatMap((i) => [
      { montoArs: 20000, ts: hoy - i * 12 * 86400000, seccion: 'Supermercado' },
      { montoArs: 8000, ts: hoy - i * 13 * 86400000, seccion: 'Transporte' },
    ]);
    const p = calcularInflacionPersonal(gastos, m.ipc!.valor, 'CABA', hoy);
    assert.ok(p, 'no se pudo calcular');
    assert.ok(p.mensual > 0 && p.mensual < 0.1, `${p.mensual}`);
    assert.ok(p.cobertura > 0.9);
    assert.equal(p.region, 'gba');
  });
  it('hay índices de los 12 rubros para GBA y al menos 10 para el país', () => {
    assert.equal(Object.keys(m.ipc!.valor.gba).length, 12);
    assert.ok(Object.keys(m.ipc!.valor.nacional).length >= 10);
  });
});
