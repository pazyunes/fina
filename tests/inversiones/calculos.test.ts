// Los cálculos que ve la persona, verificados contra cuentas hechas a mano. Si uno de
// estos falla, un número en pantalla está mal.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calcularSobrante, colchon, sugerirMonto } from '../../src/app/lib/inversiones/cuanto';
import { enMeses, fmtPesos, nombrePropio, pct, pctConSigno, rangoPctConSigno, redondearMonto } from '../../src/app/lib/inversiones/formato';
import { calcularInflacionPersonal } from '../../src/app/lib/inversiones/inflacionPersonal';
import { regionDeZona, rubroDeSeccion } from '../../src/app/lib/inversiones/ipc';
import { avisoDeMonto, limitesDe, precioCedear } from '../../src/app/lib/inversiones/limites';
import { realMensual, temDeTna, mensualDeAnual } from '../../src/app/lib/inversiones/motor';
import { leerNumero, procesarRegistro, soloNumeros, valoresIniciales } from '../../src/app/lib/inversiones/registro';
import { describirRinde } from '../../src/app/lib/inversiones/rinde';
import { evaluar, inflacionDeReferencia } from '../../src/app/lib/inversiones/motor';
import { AHORA, mercadoFixture } from './fixture';

const casi = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} no es cercano a ${b}`);

describe('fórmulas de rendimiento', () => {
  it('una TNA de 20% rinde 1,64% por mes (20 × 30 ÷ 365), como dice la clase de "TNA ÷ 12"', () => {
    casi(temDeTna(0.2), 0.016438356, 1e-8);
    // La regla simple de la clase (÷ 12) da 1,67%: la diferencia es chica y la nuestra usa los días reales.
    assert.ok(Math.abs(temDeTna(0.2) - 0.2 / 12) < 0.0005);
  });
  it('el rendimiento real descuenta la inflación: 1,64% contra 1,9% es −0,25%', () => {
    casi(realMensual(0.016438356, 0.019), 1.016438356 / 1.019 - 1, 1e-12);
    assert.ok(realMensual(0.016438356, 0.019) < 0);
  });
  it('si rinde igual que la inflación, el real es cero', () => casi(realMensual(0.02, 0.02), 0));
  it('una inflación anual de 21,1% son 1,6% por mes', () => casi(mensualDeAnual(21.1), 0.016, 0.0005));
});

describe('"cuánto rinde": el ejemplo con plata', () => {
  const m = mercadoFixture();
  const infl = inflacionDeReferencia(m, AHORA)!;
  it('cuenta de Ualá a 19%: $100.000 pasan a ~$101.600 en un mes', () => {
    const ev = evaluar('cuenta_remunerada', 'uala', m, infl, AHORA)!;
    const f = describirRinde('cuenta_remunerada', ev, m)!;
    assert.equal(f.titulo, '19% anual');
    assert.match(f.ejemplo, /\$101\.600/);
    assert.match(f.detalle ?? '', /1,6% por mes/);
  });
  it('avisa que la tasa de Ualá puede subir con condiciones y que tiene tope', () => {
    const ev = evaluar('cuenta_remunerada', 'uala', m, infl, AHORA)!;
    const f = describirRinde('cuenta_remunerada', ev, m)!;
    assert.match(f.aclaracion ?? '', /24% anual/);
    assert.match(f.aclaracion ?? '', /\$1\.000\.000/);
  });
  it('el dólar no promete rendimiento y da un ejemplo hipotético de +10%', () => {
    const f = describirRinde('dolar', null, m)!;
    assert.equal(f.titulo, 'Sin rendimiento fijo');
    assert.match(f.ejemplo, /\$110\.000/);
  });
  it('los CEDEARs usan el dato real del S&P 500 cuando lo hay, y el texto histórico cuando no', () => {
    assert.match(describirRinde('cedear', null, m)!.ejemplo, /15% por año/);
    assert.match(describirRinde('cedear', null, m)!.ejemplo, /18%/);
    assert.match(describirRinde('cedear', null, mercadoFixture({ spy: null }))!.ejemplo, /10% por año/);
  });
});

describe('inflación de referencia: siempre la más alta que conocemos', () => {
  it('con los datos de hoy es el promedio INDEC de 3 meses: (2,1 + 1,7 + 1,9) ÷ 3 = 1,9%', () => {
    const i = inflacionDeReferencia(mercadoFixture(), AHORA)!;
    casi(i.mensual, 0.019, 1e-9);
    assert.equal(i.mayor.id, 'indec');
  });
  it('si la inflación personal es más alta, manda esa', () => {
    const i = inflacionDeReferencia(mercadoFixture(), AHORA, 0.024)!;
    assert.equal(i.mayor.id, 'personal');
    casi(i.mensual, 0.024);
  });
  it('si la segunda fuente del INDEC da más, manda esa (nunca se subestima)', () => {
    const m = mercadoFixture({ inflacion: { ...mercadoFixture().inflacion, control: [{ fecha: '2026-06-01', valor: 3 }, { fecha: '2026-07-01', valor: 3 }, { fecha: '2026-08-01', valor: 3 }] } });
    const i = inflacionDeReferencia(m, AHORA)!;
    assert.equal(i.mayor.id, 'indec-control');
    casi(i.mensual, 0.03, 1e-9);
  });
  it('si la inflación está vieja, no se usa; si nada está vigente, no hay referencia', () => {
    const viejo = mercadoFixture({ inflacion: { meses: [{ fecha: '2026-01-31', valor: 2 }, { fecha: '2026-02-28', valor: 2 }, { fecha: '2026-03-31', valor: 2 }], esperada12m: null, uva30d: null, interanual: null, control: null } });
    assert.equal(inflacionDeReferencia(viejo, AHORA), null);
  });
});

describe('formato', () => {
  it('porcentajes con coma y signo de menos real', () => {
    assert.equal(pct(1.9), '1,9%');
    assert.equal(pct(-0.25), '−0,3%');
    assert.equal(pctConSigno(0.1), '+0,1%');
    assert.equal(pctConSigno(0.01), '0,0%', '+0,0% no dice nada: sin signo');
    assert.equal(rangoPctConSigno(-0.003, 0.001), 'entre −0,3% y +0,1%');
  });
  it('montos en pesos argentinos', () => {
    assert.equal(fmtPesos(1250000), '$1.250.000');
    assert.equal(redondearMonto(3123), 3000);
    assert.equal(redondearMonto(100), 1000, 'nunca menos de $1.000');
  });
  it('nombres de bancos legibles, con tilde donde va', () => {
    assert.equal(nombrePropio('BANCO DE LA NACION ARGENTINA'), 'Banco de la Nación Argentina');
    assert.equal(nombrePropio('BANCO DE GALICIA Y BUENOS AIRES S.A.'), 'Banco de Galicia y Buenos Aires S.A.');
    assert.equal(nombrePropio('BANCO BBVA ARGENTINA S.A.'), 'Banco BBVA Argentina S.A.');
  });
  it('meses y años', () => {
    assert.equal(enMeses(1), '1 mes');
    assert.equal(enMeses(36), '3 años');
  });
});

describe('lectura de números (convención argentina)', () => {
  it('puntos de miles y coma decimal', () => {
    assert.equal(leerNumero('1.250.000'), 1250000);
    assert.equal(leerNumero('1.250,5'), 1250.5);
    assert.equal(leerNumero('2.428,729'), 2428.729);
    assert.equal(leerNumero('21,5'), 21.5);
  });
  it('un punto con 1-2 decimales se entiende como decimal; con 3, como miles', () => {
    assert.equal(leerNumero('21.5'), 21.5);
    assert.equal(leerNumero('1.250'), 1250);
  });
  it('lo que no es número no es número, y los campos numéricos no dejan pasar letras', () => {
    assert.equal(leerNumero('abc'), null);
    assert.equal(leerNumero(''), null);
    assert.equal(soloNumeros('12abc,5x.0'), '12,5.0');
  });
});

describe('mínimos, máximos y monedas', () => {
  const m = mercadoFixture();
  it('un CEDEAR cuesta lo que cuesta uno: ese es el mínimo, y bloquea', () => {
    assert.equal(precioCedear(m, 'SPY'), 21000);
    const l = limitesDe('cedear', 'cocos', m, 'SPY');
    assert.equal(l.min, 21000);
    assert.equal(l.minDuro, true);
    assert.equal(avisoDeMonto(l, 10000)?.bloquea, true);
    assert.equal(avisoDeMonto(l, 21000), null);
  });
  it('Ualá: la tasa rinde entre $10.000 y $1.000.000 (se lee de las condiciones publicadas)', () => {
    const l = limitesDe('cuenta_remunerada', 'uala', m);
    assert.equal(l.min, 10000);
    assert.equal(l.max, 1_000_000);
    assert.equal(avisoDeMonto(l, 5000)?.bloquea, false, 'es un aviso, no una prohibición');
    assert.ok(avisoDeMonto(l, 2_000_000));
    assert.equal(avisoDeMonto(l, 50_000), null);
  });
});

describe('cuánto poner', () => {
  const mes = (a: number, m: number, d: number) => new Date(a, m - 1, d, 12).getTime();
  const ahora = mes(2026, 10, 21);
  it('parte del PEOR mes y no del promedio', () => {
    const s = calcularSobrante(
      [{ montoArs: 600000, ts: mes(2026, 9, 5) }, { montoArs: 600000, ts: mes(2026, 8, 5) }, { montoArs: 600000, ts: mes(2026, 7, 5) }],
      [{ montoArs: 450000, ts: mes(2026, 9, 9) }, { montoArs: 500000, ts: mes(2026, 8, 9) }, { montoArs: 580000, ts: mes(2026, 7, 9) }],
      ahora,
    )!;
    assert.equal(s.piso, 20000);
    assert.equal(s.mediana, 100000);
    const sug = sugerirMonto(s);
    assert.equal(sug.tipo, 'regular');
    assert.equal(sug.primero, 3000, '15% del peor mes ($20.000), redondeado');
  });
  it('el mes en curso no cuenta (está a medias)', () => {
    const s = calcularSobrante(
      [{ montoArs: 600000, ts: mes(2026, 9, 5) }, { montoArs: 600000, ts: mes(2026, 8, 5) }, { montoArs: 5, ts: mes(2026, 10, 2) }],
      [{ montoArs: 400000, ts: mes(2026, 9, 9) }, { montoArs: 400000, ts: mes(2026, 8, 9) }],
      ahora,
    )!;
    assert.equal(s.meses, 2);
  });
  it('un mes sin ingresos cargados no cuenta como "no sobró nada": no se sabe', () => {
    assert.equal(calcularSobrante([{ montoArs: 600000, ts: mes(2026, 9, 5) }], [{ montoArs: 100, ts: mes(2026, 8, 9) }], ahora), null);
  });
  it('si no se sabe o no sobra, no se dice nada (sin mensajes)', () => {
    assert.deepEqual(sugerirMonto(null).mensajes, []);
    assert.deepEqual(sugerirMonto({ piso: -5, mediana: -1, meses: 3, gastoMensual: 1 }).mensajes, []);
  });
  it('el colchón son tres meses de gastos', () => {
    const c = colchon(500000, 100000, 50000);
    assert.equal(c.meta, 1500000);
    assert.equal(c.falta, 1350000);
    assert.equal(c.cubierto, false);
    assert.equal(colchon(500000, 1500000, 0).cubierto, true);
  });
});

describe('registro: lo que se deduce de lo cargado', () => {
  const m = mercadoFixture();
  const proceso = (tipo: Parameters<typeof procesarRegistro>[0], v: Record<string, string>) => procesarRegistro(tipo, valoresIniciales(tipo, v, AHORA), m, 'manual', AHORA);
  it('plazo fijo: vencimiento = inicio + días, e interés = capital × TNA × días ÷ 365', () => {
    const r = proceso('plazo_fijo', { proveedor: 'Banco de la Nación Argentina', monto: '200.000', tna: '20', plazo: '30', inicio: '2026-10-21', renueva: 'no', precancelable: 'si' });
    assert.equal(r.borrador?.vencimiento, '2026-11-20');
    assert.equal(r.borrador?.tna, 0.2);
    assert.ok(r.resumen.some((x) => x.includes('$3.288')), r.resumen.join(' | '));
  });
  it('un plazo fijo UVA a menos de 90 días avisa, pero se puede guardar', () => {
    const r = proceso('plazo_fijo_uva', { proveedor: 'Banco Galicia', monto: '100.000', plazo: '60', tna: '0', renueva: 'no' });
    assert.ok(r.borrador);
    assert.ok(r.avisos.some((a) => a.includes('90')));
  });
  it('una tasa absurda (60% en un plazo fijo) avisa que revise si es TEA', () => {
    const r = proceso('plazo_fijo', { proveedor: 'X', monto: '100.000', tna: '60', plazo: '30' });
    assert.ok(r.avisos.some((a) => a.includes('TEA')));
  });
  it('CEDEAR: se compran enteros, y el total = cantidad × precio + comisión', () => {
    assert.ok(proceso('cedear', { proveedor: 'Cocos Capital', ticker: 'SPY', cantidad: '1,5', precio: '21.000' }).errores.cantidad);
    const ok = proceso('cedear', { proveedor: 'Cocos Capital', ticker: 'SPY', cantidad: '2', precio: '21.000', comision: '500' });
    assert.equal(ok.borrador?.monto, 42500);
  });
  it('dólares: los pesos que costaron = dólares × precio', () => {
    assert.equal(proceso('dolar', { proveedor: 'Balanz', cantidad: '100', precio: '1.550' }).borrador?.monto, 155000);
  });
  it('no se puede registrar algo en el futuro, ni un monto en cero, ni campos obligatorios vacíos', () => {
    assert.ok(proceso('cuenta_remunerada', { proveedor: 'Ualá', monto: '1.000', inicio: '2027-01-01' }).errores.inicio);
    assert.ok(proceso('cuenta_remunerada', { proveedor: 'Ualá', monto: '0' }).errores.monto);
    assert.ok(proceso('cuenta_remunerada', { proveedor: 'Ualá', monto: '' }).errores.monto);
  });
  it('Ualá con menos de $10.000 avisa que no rinde esa tasa', () => {
    const r = proceso('cuenta_remunerada', { proveedor: 'Ualá', monto: '5.000' });
    assert.ok(r.avisos.some((a) => a.includes('$10.000')));
  });
});

describe('inflación personal', () => {
  const idx = (v0: number, mensual: number) => [0, 1, 2, 3, 4].map((i) => ({ fecha: `2026-0${i + 4}-01`, valor: v0 * Math.pow(1 + mensual, i) }));
  const ipc = {
    nacional: { general: idx(100, 0.01), alimentos: idx(100, 0.03), transporte: idx(100, 0.005) },
    gba: { general: idx(100, 0.012), alimentos: idx(100, 0.02), transporte: idx(100, 0.04) },
  };
  const hoy = new Date('2026-09-25T12:00:00Z').getTime();
  const gasto = (monto: number, mes: number, seccion: string) => ({ montoArs: monto, ts: new Date(`2026-0${mes}-10T12:00:00Z`).getTime(), seccion });
  const todos = (seccion: string) => [7, 8, 9].flatMap((mes) => [1, 2, 3, 4].map(() => gasto(10000, mes, seccion)));

  it('las secciones de FINA caen en el rubro del INDEC que corresponde', () => {
    assert.equal(rubroDeSeccion('Supermercado'), 'alimentos');
    assert.equal(rubroDeSeccion('Delivery'), 'restaurantes');
    assert.equal(rubroDeSeccion('Farmacia'), 'salud');
    assert.equal(rubroDeSeccion('Transporte'), 'transporte');
    assert.equal(rubroDeSeccion('Compras online'), 'general', 'lo que no se sabe no se inventa');
    assert.equal(rubroDeSeccion(null), 'general');
  });
  it('CABA y GBA usan el índice de GBA; el resto del país, el nacional', () => {
    assert.equal(regionDeZona('CABA'), 'gba');
    assert.equal(regionDeZona('GBA'), 'gba');
    assert.equal(regionDeZona('Otra provincia'), 'nacional');
    assert.equal(regionDeZona(null), 'nacional');
  });
  it('quien gasta todo en supermercado, fuera de GBA, siente la suba de alimentos (3%) y no la general (1%)', () => {
    const r = calcularInflacionPersonal(todos('Supermercado'), ipc, 'Otra provincia', hoy)!;
    casi(r.mensual, 0.03, 1e-9);
    casi(r.oficial, 0.01, 1e-9);
    assert.equal(r.region, 'nacional');
  });
  it('en GBA usa los índices de GBA', () => {
    const r = calcularInflacionPersonal(todos('Transporte'), ipc, 'CABA', hoy)!;
    casi(r.mensual, 0.04, 1e-9);
    assert.equal(r.region, 'gba');
  });
  it('mezcla los rubros según lo que pesa cada uno', () => {
    const gastos = [...todos('Supermercado'), ...todos('Transporte')];
    const r = calcularInflacionPersonal(gastos, ipc, 'Otra provincia', hoy)!;
    casi(r.mensual, 0.5 * 0.03 + 0.5 * 0.005, 1e-9);
  });
  it('con pocos gastos, o casi todo sin rubro, no se calcula (no se muestra nada)', () => {
    assert.equal(calcularInflacionPersonal(todos('Supermercado').slice(0, 5), ipc, 'GBA', hoy), null);
    assert.equal(calcularInflacionPersonal(todos('Compras online'), ipc, 'GBA', hoy), null);
    assert.equal(calcularInflacionPersonal(todos('Supermercado'), null, 'GBA', hoy), null);
  });
});
