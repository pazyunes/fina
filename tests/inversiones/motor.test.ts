// Las reglas del motor de recomendaciones, con un mercado fijo. Lo más importante: que
// NUNCA recomiende para ahorrar algo que hoy le pierde a la inflación, que no use datos
// viejos o dudosos, y que lo que se decide al empezar sea consistente con lo que se registra.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCTOS, PROVEEDORES, type PerfilRiesgo } from '../../src/app/lib/inversiones/catalogo';
import { armarGuia, CONTEXTO_VACIO, previosParaRegistro } from '../../src/app/lib/inversiones/guias';
import { FORMULARIOS, opcionesDe, procesarRegistro, valoresIniciales } from '../../src/app/lib/inversiones/registro';
import { entradaDe } from '../../src/app/lib/inversiones/limites';
import { evaluar, inflacionDeReferencia, recomendar, type Contexto } from '../../src/app/lib/inversiones/motor';
import type { Mercado } from '../../src/app/lib/inversiones/mercadoTipos';
import { AHORA, mercadoFixture } from './fixture';
import { chequear } from '../../api/_mercado/chequeos';
import { agregarDeclaradas } from '../../src/app/lib/inversiones/declaradas';
import { hayFallaEsencial, MENSAJE_DE_ERROR } from '../../src/app/lib/inversiones/estadoDatos';

const ctx = (m: Mercado, c: Partial<Contexto> = {}): Contexto => ({
  mercado: m, perfil: 'moderado', horizonteMeses: 12, monto: null, usa: [], yaInvierteEn: [], necesitaCaja: true, ahora: AHORA, ...c,
});
const item = (r: ReturnType<typeof recomendar>, id: string) => r.items.find((i) => i.rec.producto.id === id);
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
  it('el fondo común no se recomienda si hay otra opción igual de disponible que rinde más', () => {
    const fci = item(recomendar(ctx(m)), 'fci')!;
    assert.equal(fci.recomendado, false);
    assert.match(fci.motivo ?? '', /inflación/);
  });
  it('se pueden elegir TODAS las inversiones: las no recomendadas igual aparecen, con su motivo', () => {
    const r = recomendar(ctx(m));
    for (const id of ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva', 'dolar', 'cedear']) assert.ok(item(r, id), `falta ${id}`);
    assert.equal(item(r, 'cedear')!.recomendado, false);
    assert.ok(item(r, 'cedear')!.motivo);
  });
  it('las recomendadas van primero', () => {
    const r = recomendar(ctx(m));
    const primerNo = r.items.findIndex((i) => !i.recomendado);
    assert.ok(r.items.slice(primerNo).every((i) => !i.recomendado));
  });
  it('sin colchón, entre las recomendadas está la caja (plata disponible)', () => {
    const r = recomendar(ctx(m, { necesitaCaja: true }));
    assert.ok(r.items.filter((i) => i.recomendado).some((i) => i.rec.rol === 'caja'));
  });
});

describe('monto y plazo cambian lo que se recomienda', () => {
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
  it('si necesita la plata en menos de 3 años, los CEDEARs no se recomiendan', () => {
    const c = item(ar({ monto: 100000, horizonteMeses: 6 }), 'cedear')!;
    assert.equal(c.recomendado, false);
    assert.match(c.motivo ?? '', /al menos 3 años/);
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
  it('si la inflación es muy alta (10%), nada de ahorro en pesos queda recomendado', () => {
    const r = recomendar(ctx(conInflacion(base, 10), { monto: 500000 }));
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
  ];
  for (const [prov, prod, extra] of casos) {
    it(`${PROVEEDORES[prov].nombre} · ${PRODUCTOS[prod].nombre}`, () => {
      const c = { ...CONTEXTO_VACIO, mercado: m, ...extra };
      const previos = previosParaRegistro(prov, prod, c);
      // Lo que no se decide al empezar (la tasa, las cuotapartes, si se renueva solo) lo agrega la persona al registrar.
      const valores = valoresIniciales(prod, previos, AHORA);
      for (const campo of FORMULARIOS[prod].campos) {
        if (!campo.obligatorio || valores[campo.id]) continue;
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
    for (const prod of ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva', 'dolar', 'cedear'] as const) {
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

describe('las dos mejores para el monto y el plazo', () => {
  const m = mercadoFixture();
  const ids = (c: Partial<Contexto>) => recomendar(ctx(m, c)).items.filter((i) => i.recomendado).map((i) => i.rec.producto.id);

  it('son dos, ni más ni menos, para cualquier perfil, plazo y monto', () => {
    for (const perfil of ['conservador', 'moderado', 'arriesgado'] as const) {
      for (const horizonteMeses of [1, 2, 6, 24, 48, 60, null]) {
        for (const necesitaCaja of [true, false]) {
          for (const monto of [null, 50_000, 5_000_000]) {
            const n = ids({ perfil, horizonteMeses, necesitaCaja, monto, faltaColchon: necesitaCaja ? 1_500_000 : null }).length;
            assert.equal(n, 2, `${perfil} ${horizonteMeses}m caja=${necesitaCaja} $${monto}: ${n}`);
          }
        }
      }
    }
  });

  it('el plazo cambia lo que se recomienda: la UVA pide al menos 3 meses', () => {
    const corto = ids({ horizonteMeses: 2, necesitaCaja: false });
    const medio = ids({ horizonteMeses: 6, necesitaCaja: false });
    assert.ok(!corto.includes('plazo_fijo_uva'));
    assert.ok(medio.includes('plazo_fijo_uva'));
  });

  it('el monto cambia lo que se recomienda: pasado el tope de la cuenta, lo que sobra no rinde', () => {
    const poco = ids({ horizonteMeses: 12, necesitaCaja: true, monto: 50_000, faltaColchon: 1_500_000 });
    const mucho = ids({ horizonteMeses: 12, necesitaCaja: true, monto: 5_000_000, faltaColchon: 1_500_000 });
    assert.ok(poco.includes('cuenta_remunerada'));
    assert.ok(!mucho.includes('cuenta_remunerada'));
  });

  it('sin colchón y con un monto que no lo supera, la cuenta para tener plata a mano va siempre', () => {
    for (const horizonteMeses of [2, 12, 48]) {
      assert.ok(ids({ perfil: 'arriesgado', horizonteMeses, necesitaCaja: true, monto: 100_000, faltaColchon: 1_500_000 }).includes('cuenta_remunerada'), `${horizonteMeses}`);
    }
  });

  it('los CEDEARs sólo para quien acepta más altibajos y puede dejar la plata años', () => {
    assert.ok(ids({ perfil: 'arriesgado', horizonteMeses: 60, necesitaCaja: false }).includes('cedear'));
    assert.ok(!ids({ perfil: 'arriesgado', horizonteMeses: 12, necesitaCaja: false }).includes('cedear'));
    assert.ok(!ids({ perfil: 'conservador', horizonteMeses: 60, necesitaCaja: false }).includes('cedear'));
  });

  it('a las que quedan afuera se les dice cuáles rinden más', () => {
    const r = recomendar(ctx(m, { horizonteMeses: 12, necesitaCaja: false, monto: 100_000 }));
    const afuera = r.items.filter((i) => !i.recomendado && i.motivo && /hoy rinden más/.test(i.motivo));
    const marcadas = r.items.filter((i) => i.recomendado).map((i) => i.rec.producto.nombre.toLowerCase());
    for (const i of afuera) for (const n of marcadas) assert.ok(i.motivo!.includes(n), i.motivo!);
  });

  it('una opción que no puede puntuarse (el dólar) no desplaza a las que rinden', () => {
    assert.ok(!ids({ perfil: 'arriesgado', horizonteMeses: 12, necesitaCaja: false }).includes('dolar'));
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
    const fondo = { proveedor: 'Cocos Capital', fondo: 'Cocos Ahorro', monto: '50000', cantidad: '20', precio: '2500' };
    assert.ok(registrar('fci', { ...fondo, tna: '' }).errores.tna);
    assert.deepEqual(registrar('fci', { ...fondo, tna: '19' }).errores, {});
  });

  it('fondo: las cuotapartes y su valor son obligatorios (sin ellos no se calcula cuánto vale hoy)', () => {
    const e = registrar('fci', { proveedor: 'Cocos Capital', fondo: 'Cocos Ahorro', monto: '50000', tna: '19' }).errores;
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

  it('CEDEAR: la comisión es obligatoria (0 si no cobraron) y letra: la cantidad', () => {
    const base = { proveedor: 'Cocos Capital', ticker: 'SPY', cantidad: '1', precio: '21000' };
    assert.ok(registrar('cedear', base).errores.comision);
    assert.deepEqual(registrar('cedear', { ...base, comision: '0' }).errores, {});
    assert.ok(registrar('letra', { proveedor: 'Cocos Capital', ticker: 'S13N6', monto: '100000' }).errores.cantidad);
  });

  it('lo que no cambia ningún cálculo sigue siendo opcional: clase y plazo de rescate del fondo, tipo de dólar', () => {
    const opcionales = (t: keyof typeof FORMULARIOS) => FORMULARIOS[t].campos.filter((c) => !c.obligatorio).map((c) => c.id).sort();
    assert.deepEqual(opcionales('fci'), ['clase', 'rescate']);
    assert.deepEqual(opcionales('dolar'), ['tipo']);
    for (const t of ['cuenta_remunerada', 'plazo_fijo', 'plazo_fijo_uva', 'cedear', 'letra'] as const) assert.deepEqual(opcionales(t), [], t);
  });
});
