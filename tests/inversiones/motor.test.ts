// Las reglas del motor de recomendaciones, con un mercado fijo. Lo más importante: que
// NUNCA recomiende para ahorrar algo que hoy le pierde a la inflación, que no use datos
// viejos o dudosos, y que lo que se decide al empezar sea consistente con lo que se registra.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCTOS, PROVEEDORES, type PerfilRiesgo } from '../../src/app/lib/inversiones/catalogo';
import { armarGuia, CONTEXTO_VACIO, previosParaRegistro } from '../../src/app/lib/inversiones/guias';
import { esObligatorio, FORMULARIOS, opcionesDe, procesarRegistro, valoresIniciales } from '../../src/app/lib/inversiones/registro';
import { entradaDe } from '../../src/app/lib/inversiones/limites';
import { evaluar, inflacionDeReferencia, recomendar, type Contexto } from '../../src/app/lib/inversiones/motor';
import { armarCartera, PESO_CEDEAR, tramoDe, ventanaDeVencimiento } from '../../src/app/lib/inversiones/cartera';
import { AVISO_LEGAL } from '../../src/app/lib/inversiones/legal';
import { avisoDePlazo } from '../../src/app/lib/inversiones/plazo';
import type { Mercado } from '../../src/app/lib/inversiones/mercadoTipos';
import { AHORA, mercadoFixture } from './fixture';
import { chequear } from '../../api/_mercado/chequeos';
import { agregarDeclaradas } from '../../src/app/lib/inversiones/declaradas';
import { hayFallaEsencial, MENSAJE_DE_ERROR } from '../../src/app/lib/inversiones/estadoDatos';

const ctx = (m: Mercado, c: Partial<Contexto> = {}): Contexto => ({
  mercado: m, perfil: 'moderado', horizonteMeses: 12, monto: null, usa: [], yaInvierteEn: [], necesitaCaja: false, ahora: AHORA, ...c,
});
const item = (r: ReturnType<typeof recomendar>, id: string) => r.items.find((i) => i.rec.producto.id === id);
// Con letras del Tesoro en el mercado (el fixture base no las trae).
const conLetras = (m: Mercado): Mercado => ({
  ...m,
  letras: {
    valor: [
      { ticker: 'S13N6', tna: 0.30, tem: 0.025, vencimiento: '2026-11-13', dias: 23, precio: 1000 },
      { ticker: 'S30A7', tna: 0.29, tem: 0.0238, vencimiento: '2027-04-30', dias: 191, precio: 1000 },
    ],
    fecha: '2026-10-21', fuente: 'letras',
  },
});
const conInflacion = (m: Mercado, mensualPct: number): Mercado => ({
  ...m,
  inflacion: { ...m.inflacion, meses: m.inflacion.meses.map((x) => ({ ...x, valor: mensualPct })), esperada12m: null, uva30d: null, control: null },
});

describe('recomendaciones con los datos de hoy', () => {
  const m = mercadoFixture();
  it('Mercado Pago y Naranja X no se ofrecen en cuenta remunerada: hoy rinden menos que la inflación', () => {
    const cuenta = item(recomendar(ctx(m)), 'cuenta_remunerada')!;
    assert.deepEqual(cuenta.rec.opciones.map((o) => o.proveedor), ['uala']);
    assert.ok(cuenta.rec.opciones.every((o) => o.veredicto !== 'pierde'));
  });
  it('el fondo común se ofrece como plata a mano (así figura en la tabla del asesor), aunque hoy rinda menos que la inflación, y lo avisa', () => {
    const fci = item(recomendar(ctx(m, { horizonteMeses: 6 })), 'fci')!;
    assert.equal(fci.recomendado, true);
    assert.equal(fci.rec.mejor.veredicto, 'pierde');
    assert.ok(fci.rec.avisos.some((a) => /menos que la inflación/.test(a)));
  });
  it('se pueden elegir TODAS las inversiones: las no recomendadas igual aparecen, con su motivo', () => {
    const r = recomendar(ctx(conLetras(m), { horizonteMeses: 6 }));
    for (const id of ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva', 'letra', 'bono_cer', 'dolar', 'cedear']) assert.ok(item(r, id), `falta ${id}`);
    assert.equal(item(r, 'cedear')!.recomendado, false);
    assert.ok(item(r, 'cedear')!.motivo);
  });
  it('las recomendadas van primero', () => {
    const r = recomendar(ctx(m));
    const primerNo = r.items.findIndex((i) => !i.recomendado);
    assert.ok(r.items.slice(primerNo).every((i) => !i.recomendado));
  });
  it('sin un gasto cercano que no se cubra, no se aparta nada por las dudas: no se fuerza la caja', () => {
    const r = recomendar(ctx(m, { perfil: 'moderado', horizonteMeses: 24, necesitaCaja: false }));
    assert.ok(!r.items.some((i) => i.recomendado && i.rec.rol === 'caja'));
  });
  it('con un gasto cercano que los ingresos no cubren, se suma la mejor opción para tener plata disponible', () => {
    const r = recomendar(ctx(m, { perfil: 'moderado', horizonteMeses: 24, necesitaCaja: true }));
    assert.ok(r.items.some((i) => i.recomendado && i.rec.rol === 'caja'));
  });
});

describe('el plazo y el perfil cambian lo que se sugiere; el monto, no', () => {
  const m = mercadoFixture();
  const ar = (c: Partial<Contexto>) => recomendar(ctx(m, { perfil: 'arriesgado', horizonteMeses: 60, ...c }));
  it('CEDEARs con $10.000: no alcanza (un CEDEAR cuesta $21.000)', () => {
    const c = item(ar({ monto: 10000 }), 'cedear')!;
    assert.equal(c.recomendado, false);
    assert.match(c.motivo ?? '', /no alcanza/);
  });
  it('CEDEARs con $100.000 y varios años: se recomiendan', () => {
    assert.equal(item(ar({ monto: 100000 }), 'cedear')!.recomendado, true);
  });
  it('a menos de 1 año no hay CEDEARs para nadie, ni siquiera para el arriesgado: el plazo manda sobre el perfil', () => {
    for (const horizonteMeses of [2, 6, 11]) {
      const c = item(ar({ monto: 100000, horizonteMeses }), 'cedear')!;
      assert.equal(c.recomendado, false, `${horizonteMeses}m`);
      assert.match(c.motivo ?? '', /al menos 1 año/);
    }
  });
  it('de 1 a 3 años, los CEDEARs son para moderado (30%) y arriesgado (50%)', () => {
    assert.equal(item(ar({ monto: 100000, horizonteMeses: 24 }), 'cedear')!.recomendado, true);
    assert.equal(item(ar({ perfil: 'conservador', monto: 100000, horizonteMeses: 24 }), 'cedear')!.recomendado, false);
  });
  it('sin saber el horizonte, tampoco se recomienda lo de varios años', () => {
    assert.equal(item(ar({ monto: 100000, horizonteMeses: null }), 'cedear')!.recomendado, false);
  });
});

describe('la regla anti-pérdida: para ahorrar, nunca algo que pierde contra la inflación', () => {
  const base = mercadoFixture();
  for (const infl of [0.5, 1, 1.5, 1.9, 2.5, 3, 4, 6, 10]) {
    for (const perfil of ['conservador', 'moderado', 'arriesgado'] as PerfilRiesgo[]) {
      it(`inflación ${infl}% por mes, perfil ${perfil}`, () => {
        const m = conInflacion(base, infl);
        const r = recomendar(ctx(m, { perfil, horizonteMeses: 60, monto: 500000 }));
        for (const i of r.items.filter((x) => x.recomendado && x.rec.rol !== 'caja')) {
          assert.notEqual(i.rec.mejor.veredicto, 'pierde', `${i.rec.producto.nombre} se recomienda aunque pierde`);
        }
        // Y una opción que pierde nunca se ofrece si hay otra del mismo producto que no.
        for (const i of r.items) {
          const algunaNoPierde = i.rec.opciones.some((o) => o.veredicto !== 'pierde');
          if (algunaNoPierde) assert.ok(i.rec.opciones.every((o) => o.veredicto !== 'pierde'));
        }
      });
    }
  }
  it('si la inflación es muy alta (10%), el plazo fijo no se sugiere (a 6 meses)', () => {
    const r = recomendar(ctx(conInflacion(base, 10), { monto: 500000, horizonteMeses: 6 }));
    assert.equal(item(r, 'plazo_fijo')!.recomendado, false);
  });
});

describe('datos viejos o dudosos no se usan', () => {
  it('un fondo con dato de hace 50 días no se evalúa como vigente', () => {
    const m = mercadoFixture({ fondos: { ...mercadoFixture().fondos!, valor: mercadoFixture().fondos!.valor.map((f) => ({ ...f, fecha: '2026-09-01' })) } });
    const infl = inflacionDeReferencia(m, AHORA)!;
    assert.equal(evaluar('fci', 'cocos', m, infl, AHORA)!.vigente, false);
  });
  it('si las tasas de las billeteras están viejas, Ualá deja de ofrecerse (no se usa una tasa de hace 50 días)', () => {
    const base = mercadoFixture();
    const m = mercadoFixture({ cuentas: { ...base.cuentas!, valor: base.cuentas!.valor.map((c) => ({ ...c, fecha: '2026-09-01' })) } });
    const cuenta = item(recomendar(ctx(m)), 'cuenta_remunerada');
    assert.ok(cuenta === undefined || cuenta.rec.opciones.every((o) => o.proveedor !== 'uala'));
  });
  it('si TODOS los datos de un producto están viejos, el producto deja de aparecer', () => {
    const base = mercadoFixture();
    const m = mercadoFixture({ plazoFijo: { ...base.plazoFijo!, fecha: '2026-09-01' } });
    assert.equal(item(recomendar(ctx(m)), 'plazo_fijo'), undefined);
  });
  it('con un horizonte de 5 años, siempre aparece al menos una opción de crecimiento (CEDEARs) entre las recomendadas', () => {
    const r = recomendar(ctx(mercadoFixture(), { perfil: 'arriesgado', horizonteMeses: 60, monto: 500000 }));
    assert.ok(r.items.some((i) => i.recomendado && i.rec.rol === 'crecimiento'));
    assert.ok(r.items.filter((i) => i.recomendado).length <= 4);
  });
  it('una alerta grave sobre los precios de CEDEARs los saca de la lista', () => {
    const m = mercadoFixture({ alertas: [{ clave: 'cedears', gravedad: 'grave', mensaje: 'precios distintos' }] });
    assert.equal(item(recomendar(ctx(m, { perfil: 'arriesgado', horizonteMeses: 60 })), 'cedear'), undefined);
  });
  it('una alerta grave sobre el dólar saca el dólar de la lista', () => {
    const m = mercadoFixture({ alertas: [{ clave: 'dolar', gravedad: 'grave', mensaje: 'no coincide' }] });
    assert.equal(item(recomendar(ctx(m)), 'dolar'), undefined);
  });
  it('una alerta de aviso NO saca nada', () => {
    const m = mercadoFixture({ alertas: [{ clave: 'dolar', gravedad: 'aviso', mensaje: 'difiere 2%' }] });
    assert.ok(item(recomendar(ctx(m)), 'dolar'));
  });
  it('sin inflación vigente no se recomienda nada', () => {
    const m = mercadoFixture({ inflacion: { meses: [], esperada12m: null, uva30d: null, interanual: null, control: null } });
    const r = recomendar(ctx(m));
    assert.equal(r.sinBase, true);
    assert.equal(r.items.length, 0);
  });
});

describe('chequeos entre fuentes', () => {
  const m = mercadoFixture();
  const sinControl = { dolar: null, plazoFijo30: null, cedears: null };
  it('todo coincide: ninguna alerta', () => {
    const a = chequear(m, { dolar: { oficial: 1546, blue: 1568 }, plazoFijo30: { valor: 22.4, fecha: '2026-10-20', fuente: 'BCRA' }, cedears: { SPY: 21010, AAPL: 28300, QQQ: 58650 } }, AHORA);
    assert.deepEqual(a, []);
  });
  it('dólar: 2% de diferencia avisa; 6% es grave', () => {
    assert.equal(chequear(m, { ...sinControl, dolar: { oficial: 1545 * 1.02, blue: null } }, AHORA)[0].gravedad, 'aviso');
    assert.equal(chequear(m, { ...sinControl, dolar: { oficial: 1545 * 1.06, blue: null } }, AHORA)[0].gravedad, 'grave');
  });
  it('inflación: si el INDEC publicado difiere más de 0,15 puntos, avisa', () => {
    const mm = mercadoFixture({ inflacion: { ...m.inflacion, control: [{ fecha: '2026-08-01', valor: 2.4 }] } });
    const a = chequear(mm, sinControl, AHORA).find((x) => x.clave === 'inflacion');
    assert.ok(a);
    assert.match(a.mensaje, /1,7|1\.7/);
  });
  it('CEDEARs: 4% de diferencia avisa; más de 10% es grave', () => {
    assert.equal(chequear(m, { ...sinControl, cedears: { SPY: 21000 * 1.04 } }, AHORA).find((x) => x.clave === 'cedears')?.gravedad, 'aviso');
    assert.equal(chequear(m, { ...sinControl, cedears: { SPY: 21000 * 1.2 } }, AHORA).find((x) => x.clave === 'cedears')?.gravedad, 'grave');
  });
  it('un fondo que rinde el doble que la TAMAR es sospechoso', () => {
    const mm = mercadoFixture({ fondos: { ...m.fondos!, valor: [{ ...m.fondos!.valor[0], tna1: 0.6 }] } });
    assert.ok(chequear(mm, sinControl, AHORA).some((x) => x.clave === 'fondos'));
  });
  it('un dato viejo genera una alerta que dice de cuándo es', () => {
    const mm = mercadoFixture({ plazoFijo: { ...m.plazoFijo!, fecha: '2026-09-01' } });
    const a = chequear(mm, sinControl, AHORA).find((x) => x.clave.startsWith('viejo:Los plazos'));
    assert.ok(a);
    assert.match(a.mensaje, /01\/09\/2026/);
  });
  it('una fuente que falló queda anotada', () => {
    assert.ok(chequear(mercadoFixture({ fallas: ['letras: respondió 500'] }), sinControl, AHORA).some((x) => x.clave === 'falla:letras'));
  });
});

describe('lo que se decide al empezar es lo mismo que se pregunta al registrar', () => {
  const m = mercadoFixture();
  const casos: [keyof typeof PROVEEDORES, keyof typeof PRODUCTOS, Partial<typeof CONTEXTO_VACIO>][] = [
    ['uala', 'cuenta_remunerada', { monto: 20000 }],
    ['naranja_x', 'cuenta_remunerada', { monto: 30000 }],
    ['mercado_pago', 'cuenta_remunerada', { monto: 15000 }],
    ['cocos', 'fci', { monto: 50000 }],
    ['balanz', 'fci', { monto: 50000 }],
    ['banco', 'plazo_fijo', { monto: 100000, plazoDias: 30, banco: 'BANCO DE LA NACION ARGENTINA' }],
    ['banco', 'plazo_fijo_uva', { monto: 100000, plazoDias: 90, banco: 'BANCO BBVA ARGENTINA S.A.' }],
    ['cocos', 'dolar', { monto: 50000 }],
    ['balanz', 'dolar', { dolares: 40, monto: 62000 }],
    ['cocos', 'cedear', { ticker: 'SPY', cantidad: 2, monto: 42000 }],
    ['balanz', 'cedear', { ticker: 'AAPL', cantidad: 1, monto: 28280 }],
    ['iol', 'cedear', { ticker: 'SPY', cantidad: 1, monto: 21000 }],
    ['galicia_securities', 'dolar', { monto: 80000 }],
    ['ppi', 'dolar', { monto: 50000 }],
    ['ieb', 'cedear', { ticker: 'QQQ', cantidad: 1, monto: 58700 }],
    ['iol', 'bono_cer', { ticker: 'TZXM7', monto: 80000 }],
    ['cocos', 'bono_cer', { ticker: 'TZXD6', monto: 50000 }],
  ];
  for (const [prov, prod, extra] of casos) {
    it(`${PROVEEDORES[prov].nombre} · ${PRODUCTOS[prod].nombre}`, () => {
      const c = { ...CONTEXTO_VACIO, mercado: m, ...extra };
      const previos = previosParaRegistro(prov, prod, c);
      // Lo que no se decide al empezar (la tasa, las cuotapartes, si se renueva solo) lo agrega la persona al registrar.
      const valores = valoresIniciales(prod, previos, AHORA);
      for (const campo of FORMULARIOS[prod].campos) {
        if (!esObligatorio(campo, valores) || valores[campo.id]) continue;
        // Una letra o un bono que el mercado conoce trae su propio vencimiento.
        if (campo.id === 'vencimiento' && (prod === 'letra' || prod === 'bono_cer')) continue;
        const lista = opcionesDe(campo, valores, m);
        valores[campo.id] = campo.tipo === 'opcion' ? (lista[0]?.id ?? 'x') : campo.tipo === 'porcentaje' ? '19' : '1000';
      }
      const r = procesarRegistro(prod, valores, m, 'manual', AHORA);
      assert.deepEqual(r.errores, {}, JSON.stringify(previos));
      assert.ok(r.borrador);
      // Todo lo que trae precargado es una opción válida de su lista (no un valor suelto).
      for (const campo of FORMULARIOS[prod].campos) {
        const lista = opcionesDe(campo, valoresIniciales(prod, previos, AHORA), m);
        const v = previos[campo.id];
        if (v && campo.tipo === 'opcion' && lista.length > 0) assert.ok(lista.some((o) => o.id === v), `${campo.id}=${v} no está en la lista`);
      }
    });
  }
  it('cada inversión que se ofrece tiene guía y registro, con la misma forma de decidir', () => {
    for (const prod of ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva', 'letra', 'bono_cer', 'dolar', 'cedear'] as const) {
      const algunProveedor = Object.values(PROVEEDORES).find((p) => p.productos[prod]);
      assert.ok(algunProveedor, `ningún proveedor para ${prod}`);
      assert.ok(armarGuia(algunProveedor.id, prod, { ...CONTEXTO_VACIO, mercado: m }), `sin guía para ${prod}`);
      assert.ok(FORMULARIOS[prod], `sin registro para ${prod}`);
      assert.ok(entradaDe(prod));
    }
  });
  it('las guías no meten el monto de la persona adentro de una frase', () => {
    for (const [prov, prod] of casos.map((c) => [c[0], c[1]] as const)) {
      const g = armarGuia(prov, prod, { ...CONTEXTO_VACIO, mercado: m, monto: 77777 })!;
      for (const p of g.pasos) for (const t of [p.titulo, p.haces, p.loVes, p.lograras, p.chequeo]) assert.ok(!t.includes('77.777'), `${prov}/${prod}: ${t}`);
    }
  });
});

describe('textos para alguien que no sabe nada', () => {
  const todos = Object.values(PRODUCTOS).flatMap((p) => [p.queEs, p.dondeQuedaTuPlata, p.riesgoTexto, p.cuandoLaSacas, p.garantia]);
  it('todo "broker" se explica la primera vez que aparece en cada ficha', () => {
    for (const p of Object.values(PRODUCTOS)) {
      const texto = [p.queEs, p.dondeQuedaTuPlata, p.riesgoTexto, p.cuandoLaSacas, p.garantia].join(' ');
      const i = texto.indexOf('broker');
      if (i >= 0) assert.match(texto.slice(i, i + 80), /broker \(|broker: |\(.*broker/, `${p.id}: "broker" sin explicar`);
    }
  });
  it('los CEDEARs se presentan como inversión de largo plazo y explican qué es un ETF', () => {
    const c = PRODUCTOS.cedear;
    assert.match(c.queEs, /largo plazo/);
    assert.match(c.queEs, /ETF como SPY \(/);
    assert.match(c.queEs, /No es para retirar pronto/);
  });
  it('"horario de mercado" y "días hábiles" siempre vienen con su aclaración', () => {
    for (const t of todos) {
      if (/días hábiles/.test(t)) assert.match(t, /días hábiles \(/, t);
      if (/mercado está abierto/.test(t)) assert.match(t, /lunes a viernes/, t);
    }
  });
  it('toda palabra del glosario tiene definición y no hay dos iguales en una ficha', () => {
    for (const p of Object.values(PRODUCTOS)) {
      const nombres = p.glosario.map((g) => g.termino);
      assert.equal(new Set(nombres).size, nombres.length, `${p.id} repite términos`);
      for (const g of p.glosario) assert.ok(g.significado.length > 15, `${p.id}.${g.termino} sin definición`);
    }
  });
});

describe('tasas declaradas por las personas (billeteras y fondos sin API)', () => {
  const fila = (user: string, tna: number, dia = '2026-10-20', kind = 'cuenta_remunerada', provider = 'Ualá', fund = '') => ({ user_id: user, kind, provider, fund, tna, declared_on: dia });
  it('con menos de 3 personas no se usa nada (una sola persona o un error de tipeo no pesa)', () => {
    assert.deepEqual(agregarDeclaradas([fila('a', 0.2), fila('b', 0.21)]), {});
  });
  it('con 3 o más se usa la MEDIANA, y se dice cuántas son', () => {
    const r = agregarDeclaradas([fila('a', 0.19), fila('b', 0.2), fila('c', 0.21), fila('d', 0.9)]);
    const d = r['cuenta_remunerada|Ualá|'];
    assert.equal(d.n, 4);
    assert.ok(Math.abs(d.tna - 0.205) < 1e-9, 'la mediana ignora al que puso 90%');
  });
  it('cada persona cuenta una vez por lugar, con su declaración más reciente', () => {
    const r = agregarDeclaradas([fila('a', 0.1, '2026-10-15'), fila('a', 0.2, '2026-10-20'), fila('b', 0.2), fila('c', 0.2)]);
    assert.equal(r['cuenta_remunerada|Ualá|'].n, 3);
    assert.ok(Math.abs(r['cuenta_remunerada|Ualá|'].tna - 0.2) < 1e-9);
  });
  it('los lugares no se mezclan (un fondo no se confunde con una cuenta)', () => {
    const r = agregarDeclaradas([
      fila('a', 0.2), fila('b', 0.2), fila('c', 0.2),
      fila('a', 0.18, '2026-10-20', 'fci', 'Cocos Capital', 'Cocos Ahorro'), fila('b', 0.18, '2026-10-20', 'fci', 'Cocos Capital', 'Cocos Ahorro'),
    ]);
    assert.ok(r['cuenta_remunerada|Ualá|']);
    assert.equal(r['fci|Cocos Capital|Cocos Ahorro'], undefined, 'sólo 2 personas');
  });
  it('si la tasa publicada de Ualá falta o está vieja, se usa lo declarado y se marca como declarado', () => {
    const base = mercadoFixture();
    const m = mercadoFixture({
      cuentas: { ...base.cuentas!, valor: base.cuentas!.valor.map((c) => ({ ...c, fecha: '2026-09-01' })) },
      declaradas: { 'cuenta_remunerada|Ualá|': { tna: 0.22, n: 5, fecha: '2026-10-20' } },
    });
    const infl = inflacionDeReferencia(m, AHORA)!;
    const ev = evaluar('cuenta_remunerada', 'uala', m, infl, AHORA)!;
    assert.equal(ev.confianza, 'declarado');
    assert.equal(ev.vigente, true);
    assert.match(ev.detalle, /5 personas/);
  });
  it('si la tasa publicada está al día, NO se reemplaza por lo declarado', () => {
    const m = mercadoFixture({ declaradas: { 'cuenta_remunerada|Ualá|': { tna: 0.5, n: 9, fecha: '2026-10-20' } } });
    const infl = inflacionDeReferencia(m, AHORA)!;
    assert.equal(evaluar('cuenta_remunerada', 'uala', m, infl, AHORA)!.confianza, 'confirmado');
  });
  it('el fondo de Mercado Pago usa lo declarado cuando el dato de CAFCI está viejo', () => {
    const base = mercadoFixture();
    const m = mercadoFixture({
      fondos: { ...base.fondos!, valor: base.fondos!.valor.map((f) => ({ ...f, fecha: '2026-09-01' })) },
      declaradas: { 'fci|Mercado Pago|Mercado Fondo': { tna: 0.2, n: 4, fecha: '2026-10-20' } },
    });
    const infl = inflacionDeReferencia(m, AHORA)!;
    assert.equal(evaluar('cuenta_remunerada', 'mercado_pago', m, infl, AHORA)!.confianza, 'declarado');
  });
  it('si lo declarado se aleja mucho de lo publicado, se le avisa a quien mantiene FINA', () => {
    const m = mercadoFixture({ declaradas: { 'cuenta_remunerada|Ualá|': { tna: 0.26, n: 6, fecha: '2026-10-20' } } });
    const a = chequear(m, { dolar: null, plazoFijo30: null, cedears: null }, AHORA).find((x) => x.clave === 'cuentas');
    assert.ok(a);
    assert.match(a.mensaje, /6 personas/);
  });
});

describe('cuando los datos fallan, la persona sólo ve "hubo un error"', () => {
  it('una falla esencial, datos desactualizados o una alerta grave => error', () => {
    assert.equal(hayFallaEsencial(mercadoFixture({ fallas: ['plazo fijo: respondió 500'] })), true);
    assert.equal(hayFallaEsencial(mercadoFixture({ fallas: ['dólar: timeout'] })), true);
    assert.equal(hayFallaEsencial(mercadoFixture({ desactualizado: true })), true);
    assert.equal(hayFallaEsencial(mercadoFixture({ alertas: [{ clave: 'dolar', gravedad: 'grave', mensaje: 'x' }] })), true);
  });
  it('una falla de algo opcional, o un simple aviso, NO bloquea', () => {
    assert.equal(hayFallaEsencial(mercadoFixture({ fallas: ['S&P 500: respondió 429'] })), false);
    assert.equal(hayFallaEsencial(mercadoFixture({ fallas: ['índices del INDEC: respondió 500'] })), false);
    assert.equal(hayFallaEsencial(mercadoFixture({ alertas: [{ clave: 'dolar', gravedad: 'aviso', mensaje: 'x' }] })), false);
    assert.equal(hayFallaEsencial(mercadoFixture()), false);
  });
  it('el mensaje es corto y no cuenta qué fuente falló', () => {
    assert.equal(MENSAJE_DE_ERROR.titulo, 'Hubo un error al traer los datos');
    assert.equal(MENSAJE_DE_ERROR.texto, 'Probá de nuevo más tarde.');
  });
});

describe('la cartera: la tabla del asesor (el plazo decide en qué, el perfil cuánto, el monto nada)', () => {
  const m = conLetras(mercadoFixture());
  const perfiles = ['conservador', 'moderado', 'arriesgado'] as const;
  const plazos = [1, 2, 6, 11, 12, 24, 35, 36, 48, 60];
  const alternativas = (c: Partial<Contexto>, mercado: Mercado = m) => recomendar(ctx(mercado, c)).items.filter((i) => i.recomendado);
  const ids = (c: Partial<Contexto>, mercado: Mercado = m) => alternativas(c, mercado).map((i) => i.rec.producto.id);
  /** Lo que va a cada porcentaje: { 0.7: ['plazo_fijo_uva'], 0.3: ['bono_cer'] }. */
  const partes = (perfil: (typeof perfiles)[number], horizonteMeses: number | null, mercado: Mercado = m) => {
    const salida: Record<string, string[]> = {};
    for (const i of alternativas({ perfil, horizonteMeses }, mercado)) (salida[i.peso === null ? 'sin %' : String(Math.round(i.peso * 100))] ??= []).push(i.rec.producto.id);
    for (const k of Object.keys(salida)) salida[k].sort();
    return salida;
  };
  const A_MANO = ['cuenta_remunerada', 'fci', 'plazo_fijo'];

  it('los tramos de plazo', () => {
    assert.equal(tramoDe(2), 'corto');
    assert.equal(tramoDe(3), 'medio');
    assert.equal(tramoDe(11), 'medio');
    assert.equal(tramoDe(12), 'largo');
    assert.equal(tramoDe(35), 'largo');
    assert.equal(tramoDe(36), 'mlargo');
    assert.equal(tramoDe(null), 'medio');
  });

  it('el monto no cambia nada: lo mismo con $50.000 que con $5.000.000', () => {
    for (const perfil of perfiles) for (const horizonteMeses of plazos) {
      const poco = ids({ perfil, horizonteMeses, monto: 50_000 });
      assert.deepEqual(ids({ perfil, horizonteMeses, monto: 5_000_000 }), poco, `${perfil} ${horizonteMeses}m`);
      assert.deepEqual(ids({ perfil, horizonteMeses, monto: null }), poco, `${perfil} ${horizonteMeses}m sin monto`);
    }
  });

  it('las partes de la plata suman 100% y cada alternativa dice qué parte le toca', () => {
    for (const perfil of perfiles) for (const horizonteMeses of [...plazos, null]) {
      const cartera = armarCartera(perfil, horizonteMeses);
      assert.ok(Math.abs(cartera.reduce((a, gr) => a + gr.peso, 0) - 1) < 1e-9, `${perfil} ${horizonteMeses}m`);
      const marcadas = alternativas({ perfil, horizonteMeses });
      assert.ok(marcadas.length >= 1, `${perfil} ${horizonteMeses}m`);
      const permitidos = cartera.filter((gr) => gr.peso > 0).map((gr) => gr.peso);
      for (const i of marcadas) assert.ok(i.peso === null || permitidos.some((x) => Math.abs(x - i.peso!) < 1e-9), `${perfil} ${horizonteMeses}m: ${i.rec.producto.id} ${i.peso}`);
      assert.ok(marcadas.some((i) => i.peso !== null), `${perfil} ${horizonteMeses}m: alguna lleva porcentaje`);
    }
  });

  it('menos de 3 meses: 100% a mano (plazo fijo, cuenta, money market y letras cortas), igual para los tres perfiles', () => {
    for (const horizonteMeses of [1, 2]) for (const perfil of perfiles) {
      assert.deepEqual(partes(perfil, horizonteMeses), { 100: ['cuenta_remunerada', 'fci', 'letra', 'plazo_fijo'] }, `${perfil} ${horizonteMeses}m`);
    }
  });

  it('a muy corto plazo, lo que rinde menos que la inflación igual sirve: es mejor que nada', () => {
    const r = recomendar(ctx(conInflacion(mercadoFixture(), 6), { horizonteMeses: 2 }));
    assert.ok(r.items.some((i) => i.recomendado && i.rec.rol === 'caja'));
  });

  it('3 a 12 meses: conservador 70% a mano + 30% renta fija; moderado 50/50; arriesgado 30% a mano + 70% renta fija; sin CEDEARs', () => {
    const esperado = { conservador: [70, 30], moderado: [50, 50], arriesgado: [30, 70] } as const;
    for (const horizonteMeses of [3, 6, 11]) for (const perfil of perfiles) {
      const x = partes(perfil, horizonteMeses);
      const [mano, fija] = esperado[perfil];
      const RENTA_FIJA = ['letra', 'bono_cer', 'plazo_fijo_uva'];
      // En el moderado las dos partes son del 50%: se juntan bajo el mismo número.
      const delPorcentaje = (n: number) => x[String(n)] ?? [];
      const aMano = delPorcentaje(mano).filter((id) => A_MANO.includes(id)).sort();
      const deRentaFija = delPorcentaje(fija).filter((id) => RENTA_FIJA.includes(id));
      assert.deepEqual(aMano, [...A_MANO].sort(), `${perfil} ${horizonteMeses}m: a mano`);
      assert.ok(deRentaFija.length > 0, `${perfil} ${horizonteMeses}m: renta fija`);
      assert.ok(Object.values(x).flat().every((id) => [...A_MANO, ...RENTA_FIJA].includes(id)), `${perfil} ${horizonteMeses}m: sólo a mano y renta fija`);
      assert.ok(!ids({ perfil, horizonteMeses }).includes('cedear'));
    }
  });

  it('1 a 3 años: conservador 70% plazo fijo UVA + 30% bonos CER; moderado 70% renta fija + 30% CEDEARs; arriesgado 50/50', () => {
    for (const horizonteMeses of [12, 24, 35]) {
      assert.deepEqual(partes('conservador', horizonteMeses), { 70: ['plazo_fijo_uva'], 30: ['bono_cer'] }, `conservador ${horizonteMeses}m`);
      assert.deepEqual(partes('moderado', horizonteMeses), { 70: ['bono_cer', 'plazo_fijo_uva'], 30: ['cedear'] }, `moderado ${horizonteMeses}m`);
      assert.deepEqual(partes('arriesgado', horizonteMeses), { 50: ['bono_cer', 'cedear', 'plazo_fijo_uva'] }, `arriesgado ${horizonteMeses}m`);
    }
  });

  it('más de 3 años: conservador 80% renta fija + 20% CEDEARs; moderado 50/50; arriesgado 100% CEDEARs + la cuenta sin porcentaje', () => {
    for (const horizonteMeses of [36, 48, 60]) {
      assert.deepEqual(partes('conservador', horizonteMeses), { 80: ['bono_cer', 'plazo_fijo_uva'], 20: ['cedear'] }, `conservador ${horizonteMeses}m`);
      assert.deepEqual(partes('moderado', horizonteMeses), { 50: ['bono_cer', 'cedear', 'plazo_fijo_uva'] }, `moderado ${horizonteMeses}m`);
      assert.deepEqual(partes('arriesgado', horizonteMeses), { 100: ['cedear'], 'sin %': ['cuenta_remunerada'] }, `arriesgado ${horizonteMeses}m`);
    }
    assert.equal(PESO_CEDEAR.mlargo.conservador, 0.2);
  });

  it('la cuenta remunerada no es renta fija: no entra de 1 a 3 años ni en la renta fija de más de 3 años', () => {
    for (const perfil of perfiles) for (const horizonteMeses of [12, 24, 35]) assert.ok(!ids({ perfil, horizonteMeses }).includes('cuenta_remunerada'), `${perfil} ${horizonteMeses}m`);
    for (const perfil of ['conservador', 'moderado'] as const) assert.ok(!ids({ perfil, horizonteMeses: 60 }).includes('cuenta_remunerada'));
  });

  it('CEDEARs: nunca a menos de 1 año (el plazo manda sobre el perfil); de 1 a 3 años moderado y arriesgado; a más de 3 años, todos', () => {
    for (const perfil of perfiles) for (const horizonteMeses of [1, 2, 3, 6, 11, 12, 24, 35, 36, 60, null]) {
      const tramo = tramoDe(horizonteMeses);
      const esperado = horizonteMeses !== null && (tramo === 'mlargo' || (tramo === 'largo' && perfil !== 'conservador'));
      assert.equal(ids({ perfil, horizonteMeses }).includes('cedear'), esperado, `${perfil} ${horizonteMeses}m`);
    }
  });

  it('si no hay datos de CEDEARs, su parte pasa a la renta fija y siempre queda un porcentaje', () => {
    const sinCedears = { ...m, cedears: null };
    for (const perfil of perfiles) {
      const x = alternativas({ perfil, horizonteMeses: 60 }, sinCedears);
      assert.ok(x.length > 0 && x.some((i) => i.peso === 1), perfil);
      assert.ok(!x.some((i) => i.rec.producto.id === 'cedear'));
    }
  });

  it('el vencimiento coincide con el plazo: las letras y los bonos CER que se ofrecen vencen dentro de ese plazo', () => {
    const infl = inflacionDeReferencia(m, AHORA)!;
    const tickers = (id: 'letra' | 'bono_cer', meses: number | null) => (evaluar(id, 'cocos', m, infl, AHORA, meses)?.detalle ?? '');
    // Letras: a 2 meses sólo la que vence en 23 días; a 6 meses también (pero no la de 191 días); sin plazo, las dos.
    assert.match(tickers('letra', 2), /Hoy hay 1 letras de entre 23 y 23 días/);
    assert.match(tickers('letra', 6), /Hoy hay 1 letras/);
    assert.match(tickers('letra', null), /Hoy hay 2 letras de entre 23 y 191 días/);
    // Bonos CER: cada plazo mira su ventana.
    const ventana = (meses: number) => ventanaDeVencimiento('bono_cer', meses);
    assert.deepEqual(ventana(6), { min: 90, max: 180 });
    assert.deepEqual(ventana(24), { min: 365, max: 1095 });
    assert.deepEqual(ventana(60), { min: 1095, max: 2000 });
    const e6 = evaluar('bono_cer', 'cocos', m, infl, AHORA, 6)!;
    const e60 = evaluar('bono_cer', 'cocos', m, infl, AHORA, 60)!;
    assert.ok(e60.tem && e6.tem);
    assert.notDeepEqual(e60.real, e6.real, 'a 5 años se miran bonos largos, no los de 6 meses');
    assert.equal(evaluar('bono_cer', 'cocos', { ...m, bonosCer: { ...m.bonosCer!, valor: m.bonosCer!.valor.filter((b) => b.dias < 365) } }, infl, AHORA, 24)?.veredicto, 'sin-dato', 'sin bonos que venzan en ese plazo, no se ofrece');
  });

  it('los bonos CER son renta fija: aparecen de 3 a 12 meses, no a menos de 3 meses', () => {
    assert.ok(ids({ perfil: 'moderado', horizonteMeses: 6 }).includes('bono_cer'));
    assert.ok(ids({ perfil: 'arriesgado', horizonteMeses: 6 }).includes('bono_cer'));
    assert.ok(!ids({ horizonteMeses: 2 }).includes('bono_cer'));
    const e = item(recomendar(ctx(m, { horizonteMeses: 6 })), 'bono_cer')!.rec.mejor;
    assert.equal(e.confianza, 'estimado');
    assert.ok(e.tem && e.real, 'se estima lo que rinde por encima de la inflación, como rango');
    assert.match(PRODUCTOS.bono_cer.puedeBajar, /^Sí/);
  });

  it('un bono CER sin datos de hoy no se ofrece', () => {
    const sin = { ...m, bonosCer: null };
    assert.equal(item(recomendar(ctx(sin, { horizonteMeses: 6 })), 'bono_cer'), undefined);
  });

  it('el dólar no es una inversión: sólo con un objetivo en dólares, y sólo si está bajo', () => {
    for (const perfil of perfiles) for (const horizonteMeses of plazos) assert.ok(!ids({ perfil, horizonteMeses }).includes('dolar'), 'sin objetivo en dólares, nunca');
    assert.ok(ids({ horizonteMeses: 6, objetivoEnDolares: true }).includes('dolar'), 'MEP +1,1% en el mes contra 1,9% de inflación: está bajo');
    const alto = { ...m, dolar: { ...m.dolar, mep30d: 6 } };
    const r = recomendar(ctx(alto, { horizonteMeses: 6, objetivoEnDolares: true }));
    assert.equal(item(r, 'dolar')!.recomendado, false);
    assert.match(item(r, 'dolar')!.motivo ?? '', /no está bajo/);
  });

  it('el dólar no tiene un porcentaje de la cartera (no es una inversión)', () => {
    const d = alternativas({ horizonteMeses: 6, objetivoEnDolares: true }).find((i) => i.rec.producto.id === 'dolar');
    assert.equal(d?.peso, null);
  });

  it('a las que quedan afuera se les dice por qué', () => {
    const r = recomendar(ctx(m, { horizonteMeses: 12 }));
    for (const i of r.items.filter((x) => !x.recomendado)) assert.ok(i.motivo, i.rec.producto.nombre);
  });
});

describe('es obligatorio todo dato sin el cual no se ve cómo crece la plata ni se avisa qué pasa al vencer', () => {
  const m = mercadoFixture();
  const registrar = (prod: keyof typeof FORMULARIOS, v: Record<string, string>) => procesarRegistro(prod, { ...valoresIniciales(prod, {}, AHORA), ...v }, m, 'manual', AHORA);

  it('cuenta remunerada y fondo: sin tasa no se puede registrar, con tasa sí', () => {
    const cuenta = { proveedor: 'Ualá', monto: '50000' };
    assert.ok(registrar('cuenta_remunerada', { ...cuenta, tna: '' }).errores.tna);
    const ok = registrar('cuenta_remunerada', { ...cuenta, tna: '19' });
    assert.deepEqual(ok.errores, {});
    assert.equal(ok.borrador?.tna, 0.19);
    const fondo = { proveedor: 'Cocos Capital', fondo: 'Cocos Ahorro', tipoFondo: 'money_market', monto: '50000', cantidad: '20', precio: '2500' };
    assert.ok(registrar('fci', { ...fondo, tna: '' }).errores.tna);
    assert.deepEqual(registrar('fci', { ...fondo, tna: '19' }).errores, {});
  });

  it('fondo: las cuotapartes y su valor son obligatorios (sin ellos no se calcula cuánto vale hoy)', () => {
    const e = registrar('fci', { proveedor: 'Cocos Capital', fondo: 'Cocos Ahorro', tipoFondo: 'money_market', monto: '50000', tna: '19' }).errores;
    assert.ok(e.cantidad && e.precio);
  });

  it('plazo fijo: si se renueva solo y si es precancelable son obligatorios', () => {
    const e = registrar('plazo_fijo', { proveedor: 'Banco Nación', monto: '100000', tna: '20', plazo: '30' }).errores;
    assert.ok(e.renueva && e.precancelable);
  });

  it('plazo fijo UVA: el interés extra (0 si no suma) y si se renueva solo son obligatorios', () => {
    const e = registrar('plazo_fijo_uva', { proveedor: 'Banco Galicia', monto: '100000', plazo: '90' }).errores;
    assert.ok(e.tna && e.renueva);
    const ok = registrar('plazo_fijo_uva', { proveedor: 'Banco Galicia', monto: '100000', plazo: '90', tna: '0', renueva: 'si' });
    assert.deepEqual(ok.errores, {});
    assert.equal(ok.borrador?.detalle.renuevaSolo, true);
  });

  it('fondo: la tasa sólo se pide en un money market; en renta fija o variable no hay una tasa para anotar', () => {
    const base = { proveedor: 'Otro', fondo: 'Un fondo de acciones', monto: '50000', cantidad: '20', precio: '2500' };
    assert.ok(registrar('fci', { ...base, tipoFondo: 'money_market' }).errores.tna);
    for (const tipoFondo of ['renta_fija', 'renta_variable', 'mixto']) assert.deepEqual(registrar('fci', { ...base, tipoFondo }).errores, {}, tipoFondo);
    const r = registrar('fci', { ...base, tipoFondo: 'renta_variable' });
    assert.equal(r.borrador?.detalle.tipoFondo, 'renta_variable');
    assert.ok(r.resumen.some((t) => /puede bajar/.test(t)), 'se avisa que este fondo puede bajar');
  });

  it('CEDEAR: la comisión es un porcentaje de lo operado, no pesos', () => {
    const r = registrar('cedear', { proveedor: 'Cocos Capital', ticker: 'SPY', cantidad: '2', precio: '21000', comision: '1' });
    assert.deepEqual(r.errores, {});
    assert.equal(r.borrador?.detalle.comisionPct, 1);
    assert.equal(r.borrador?.detalle.comision, 420, '1% de 2 × $21.000');
    assert.equal(r.borrador?.monto, 42420);
    assert.ok(registrar('cedear', { proveedor: 'Cocos Capital', ticker: 'SPY', cantidad: '1', precio: '21000', comision: '150' }).errores.comision, 'más de 100% no puede ser');
  });

  it('bono CER: se completa el vencimiento con el del mercado, y el ticker es obligatorio', () => {
    const base = { proveedor: 'Cocos Capital', monto: '50000', inicio: '2026-10-01' };
    assert.ok(registrar('bono_cer', base).errores.ticker);
    const ok = registrar('bono_cer', { ...base, ticker: 'tzxm7', vencimiento: '' });
    assert.deepEqual(ok.errores, {});
    assert.equal(ok.borrador?.vencimiento, '2027-03-31');
    assert.equal(ok.borrador?.detalle.ticker, 'TZXM7');
    assert.ok(registrar('bono_cer', { ...base, ticker: 'XXXX1', vencimiento: '2027-05-01' }).avisos.some((a) => /No encontramos/.test(a)));
  });

  it('CEDEAR: cualquier ticker se puede anotar (hay cientos y también acciones argentinas), con un aviso si no lo conocemos', () => {
    const r = registrar('cedear', { proveedor: 'IOL (InvertirOnline)', ticker: 'GGAL', cantidad: '10', precio: '5000', comision: '0,6' });
    assert.deepEqual(r.errores, {});
    assert.equal(r.borrador?.detalle.ticker, 'GGAL');
    assert.ok(r.avisos.some((a) => /GGAL/.test(a)));
  });

  it('CEDEAR: la comisión es obligatoria (0 si no cobraron) y letra: la cantidad', () => {
    const base = { proveedor: 'Cocos Capital', ticker: 'SPY', cantidad: '1', precio: '21000' };
    assert.ok(registrar('cedear', base).errores.comision);
    assert.deepEqual(registrar('cedear', { ...base, comision: '0' }).errores, {});
    assert.ok(registrar('letra', { proveedor: 'Cocos Capital', ticker: 'S13N6', monto: '100000' }).errores.cantidad);
  });

  it('lo que no cambia ningún cálculo sigue siendo opcional: clase y plazo de rescate del fondo, tipo de dólar', () => {
    const opcionales = (t: keyof typeof FORMULARIOS) => FORMULARIOS[t].campos.filter((c) => !c.obligatorio).map((c) => c.id).sort();
    assert.deepEqual(opcionales('fci'), ['clase', 'rescate']);
    assert.equal(esObligatorio(FORMULARIOS.fci.campos.find((c) => c.id === 'tna')!, { tipoFondo: 'renta_fija' }), false);
    assert.equal(esObligatorio(FORMULARIOS.fci.campos.find((c) => c.id === 'tna')!, { tipoFondo: '' }), true, 'sin elegir el tipo, la tasa se pide');
    assert.deepEqual(opcionales('dolar'), ['tipo']);
    for (const t of ['cuenta_remunerada', 'plazo_fijo', 'plazo_fijo_uva', 'cedear', 'letra'] as const) assert.deepEqual(opcionales(t), [], t);
    assert.deepEqual(opcionales('bono_cer'), ['cantidad']);
  });
});

describe('criterio del asesor: aviso legal, "¿puede bajar?", plazo que no encaja', () => {
  it('el aviso legal dice que todas las inversiones pueden perder capital y que FINA no garantiza rendimientos', () => {
    const texto = AVISO_LEGAL.join(' ');
    assert.match(texto, /pérdida de capital/);
    assert.match(texto, /no garantiza ningún rendimiento/);
  });
  it('cada inversión responde si su plata puede bajar', () => {
    for (const p of Object.values(PRODUCTOS)) assert.ok(p.puedeBajar.length > 20, p.id);
    for (const id of ['plazo_fijo', 'plazo_fijo_uva', 'cuenta_remunerada'] as const) assert.match(PRODUCTOS[id].puedeBajar, /^No/, id);
    for (const id of ['cedear', 'dolar'] as const) assert.match(PRODUCTOS[id].puedeBajar, /^Sí/, id);
  });
  it('si lo elegido no encaja con el plazo, se avisa; si encaja, no', () => {
    assert.match(avisoDePlazo(PRODUCTOS.cedear, 3) ?? '', /vendés con pérdida/);
    assert.ok(avisoDePlazo(PRODUCTOS.cedear, 60) === null);
    assert.match(avisoDePlazo(PRODUCTOS.plazo_fijo, 120) ?? '', /más de 3 años/);
    assert.ok(avisoDePlazo(PRODUCTOS.cedear, null) === null);
  });
  it('el dólar se aclara como "no es una inversión"', () => {
    assert.match(PRODUCTOS.dolar.resumen, /no es una inversión/);
    assert.match(PRODUCTOS.dolar.queEs, /no es una inversión/);
  });
  it('las letras se garantizan por el Tesoro, y todos los brokers ofrecen CEDEARs, letras y dólar', () => {
    assert.match(PRODUCTOS.letra.garantia, /Tesoro/);
    for (const b of ['cocos', 'balanz', 'iol', 'galicia_securities', 'ppi', 'ieb'] as const) {
      for (const prod of ['cedear', 'letra', 'dolar'] as const) assert.ok(PROVEEDORES[b].productos[prod], `${b} ${prod}`);
    }
  });
});
