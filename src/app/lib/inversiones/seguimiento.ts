// Seguimiento: lo que FINA le dice a la persona DESPUÉS de que invirtió.
//
// Es la otra mitad de enseñar con la práctica. Registrar una inversión no es
// anotar y olvidar: cada cosa que pasa con esa plata (un vencimiento que se
// acerca, lo que ganó contra la inflación, una tasa que quedó atrás) es una
// oportunidad de explicar algo con un ejemplo que es suyo.
//
// Tono: informa y explica, no reta ni apura (guía §2.3, §5.4). Nada de "tenés
// que" ni de alertas en rojo. Cuando hay algo que decidir, se dice qué opciones
// hay, no cuál es la correcta. Y todo número lleva su estado de confianza.

import type { PosicionInversion } from '../../api/v2/tipos.js';
import { nombreProducto } from './catalogo.js';
import { diaMes, fmtPesos, nombreCuenta, nombrePropio, pct, rangoPctConSigno } from './formato.js';
import { bancosOrdenados, inflacionDeReferencia, realMensual, temDeTna, type Confianza } from './motor.js';
import { estaVigente, type Mercado } from './mercadoTipos.js';

export type Novedad = {
  id: string;
  /** 'info' = algo que saber · 'decision' = hay algo para decidir (no urgente) */
  tono: 'info' | 'decision';
  titulo: string;
  texto: string;
  confianza: Confianza;
  posicionId?: string;
};

/** Sólo se sugieren cuentas de billeteras y bancos que la gente reconoce: no cualquier entidad de la lista. */
const CUENTAS_CONOCIDAS = ['UALA', 'NARANJA X', 'BRUBANK'];

const MS_DIA = 24 * 60 * 60 * 1000;

function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / MS_DIA);
}

const diaMe = diaMes;
const hoyDe = (ahora: number) => new Date(ahora).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

/** Qué pasa ahora que ya lo hiciste: lo que no hay que hacer, y lo que sí a futuro. */
const QUE_SIGUE: Record<PosicionInversion['tipo'], string> = {
  cuenta_remunerada: 'No tenés que hacer nada: el saldo rinde solo todos los días. Lo único para mirar de vez en cuando es la tasa (el interés que te pagan), porque cambia seguido.',
  fci: 'Cada día el valor de tu cuotaparte (cada pedacito del fondo) se actualiza, y ahí se ve tu ganancia. No hace falta mirarlo todos los días: sirve verlo una vez por semana.',
  plazo_fijo: 'No tenés que hacer nada hasta el vencimiento (el día en que termina el plazo). Ese día el banco te devuelve la plata más el interés; ahí decidís si lo renovás o lo usás.',
  plazo_fijo_uva: 'No tenés que hacer nada hasta el vencimiento (el día en que termina el plazo). Tu plata se va actualizando con la inflación; ese día cobrás lo actualizado más el interés.',
  letra: 'Podés olvidarte hasta el vencimiento (el día en que el Estado te devuelve la plata): paga solo y entra a tu cuenta del broker. El precio en el medio puede moverse, pero no cambia lo que cobrás si esperás.',
  bono_cer: 'Cobrás la inflación más el extra si esperás hasta el vencimiento (el día en que el Estado te devuelve el capital ajustado). En el medio el precio sube y baja, y eso es normal: si no lo necesitás antes, no cambia lo que cobrás. Vender con miedo por una baja es lo que concreta la pérdida.',
  dolar: 'Los dólares no generan interés: lo que cambia es cuántos pesos valen. Mirarlo seguido no cambia nada; lo importante es para qué los guardaste.',
  cedear: 'El precio va a subir y bajar todos los días, y eso es normal. Está pensado para dejarlo varios años: mirarlo todos los días suele dar más ansiedad que información.',
};

export function generarNovedades(args: {
  posiciones: PosicionInversion[];
  mercado: Mercado | null;
  ahora?: number;
}): Novedad[] {
  const ahora = args.ahora ?? Date.now();
  const hoy = hoyDe(ahora);
  const m = args.mercado;
  const infl = m ? inflacionDeReferencia(m, ahora) : null;
  const activas = args.posiciones.filter((p) => p.estado === 'activa');
  const salida: Novedad[] = [];

  for (const p of activas) {
    const nombre = nombreProducto(p.tipo);
    const donde = p.proveedor ? ` en ${p.proveedor}` : '';
    const dias = diasEntre(p.inicio, hoy);

    // 1) Lo recién registrado: qué pasa ahora.
    if (dias <= 7) {
      salida.push({
        id: `sigue-${p.id}`, tono: 'info', posicionId: p.id, confianza: 'confirmado',
        titulo: `Ya está: ${nombre}${donde}`,
        texto: QUE_SIGUE[p.tipo],
      });
    }

    // 2) Vencimientos.
    if (p.vencimiento) {
      const faltan = diasEntre(hoy, p.vencimiento);
      if (faltan < 0) {
        salida.push({
          id: `vencio-${p.id}`, tono: 'decision', posicionId: p.id, confianza: 'confirmado',
          titulo: `Tu ${nombre.toLowerCase()}${donde} venció el ${diaMes(p.vencimiento)}`,
          texto: 'Si ya cobraste, marcalo como cerrado para que no figure más. Si lo renovaste o hiciste otro, registralo como uno nuevo.',
        });
      } else if (faltan <= 7) {
        const interes = p.tna && p.plazoDias ? p.monto * p.tna * (p.plazoDias / 365) : null;
        const cobro = interes !== null ? ` Vas a cobrar ${fmtPesos(p.monto)} de capital más ${fmtPesos(interes)} de interés.` : '';
        const tasas = m ? bancosOrdenados(m)[0] : undefined;
        const alternativas = p.tipo === 'plazo_fijo' && tasas && m && estaVigente('plazoFijo', m.plazoFijo?.fecha, ahora)
          ? ` Hoy la mejor tasa a 30 días la paga ${nombrePropio(tasas.entidad)}, ${pct(tasas.tna * 100, 1)} anual: sirve para comparar si lo renovás.`
          : '';
        salida.push({
          id: `vence-${p.id}`, tono: 'decision', posicionId: p.id, confianza: 'declarado',
          titulo: `Tu ${nombre.toLowerCase()}${donde} vence ${faltan === 0 ? 'hoy' : faltan === 1 ? 'mañana' : `en ${faltan} días`}`,
          texto: `El ${diaMes(p.vencimiento)} te devuelven la plata.${cobro}${alternativas} ${
            p.detalle.renuevaSolo === true ? 'Tal como lo anotaste, se renueva solo: si no querés que se renueve, tenés que avisarle al banco antes.'
            : p.detalle.renuevaSolo === false ? 'Tal como lo anotaste, no se renueva solo: ese día decidís si renovarlo, usarlo o pasarlo a otra inversión.'
            : 'Tenés tres caminos: renovarlo, usarlo, o pasarlo a otra inversión.'}`,
        });
      }
    }

    // 3) Lo ganado contra la inflación (sólo si hay tasa declarada y dato de inflación).
    if (p.tna !== null && infl && dias >= 10 && (p.tipo === 'plazo_fijo' || p.tipo === 'cuenta_remunerada')) {
      const tem = temDeTna(p.tna);
      const menor = Math.min(...infl.componentes.map((c) => c.mensual));
      const real = { min: realMensual(tem, infl.mensual), max: realMensual(tem, menor) };
      const ganado = p.monto * p.tna * (Math.min(dias, p.plazoDias ?? dias) / 365);
      const gana = real.min > 0.001;
      const pierde = real.max < -0.001;
      salida.push({
        id: `real-${p.id}`, tono: 'info', posicionId: p.id, confianza: 'estimado',
        titulo: `Cómo te va con tu ${nombre.toLowerCase()}${donde}`,
        texto: `Con la tasa que anotaste, a hoy generó unos ${fmtPesos(ganado)}. Contra la inflación, el resultado es ${rangoPctConSigno(real.min, real.max, 1)} por mes: ${
          gana ? 'le estás ganando.' : pierde ? 'rinde menos de lo que suben los precios, así que tu plata pierde poder de compra de a poco.' : 'queda a la par: conserva tu plata, no la hace crecer.'
        }`,
      });
    }

    // 4) Tasa de la cuenta contra el mercado.
    if (p.tipo === 'cuenta_remunerada' && p.tna !== null && m?.cuentas && estaVigente('cuenta', m.cuentas.fecha, ahora)) {
      // Sólo cuentas que rinden esa tasa sin pedir operaciones del mes: comparar
      // contra "24% si sumás $500.000" sería ofrecerle algo que quizá no puede cumplir.
      const sinExigencias = m.cuentas.valor.filter(
        (c) => CUENTAS_CONOCIDAS.includes(c.id) && estaVigente('cuenta', c.fecha, ahora) && !/acumul|sum[aá]s|operaciones/i.test(c.condiciones),
      );
      const mejor = sinExigencias.reduce<(typeof sinExigencias)[number] | null>((a, c) => (!a || c.tna > a.tna ? c : a), null);
      if (mejor && mejor.tna - p.tna >= 0.03) {
        const tope = mejor.tope ? ` hasta ${fmtPesos(mejor.tope)} de saldo` : '';
        salida.push({
          id: `tasa-${p.id}`, tono: 'decision', posicionId: p.id, confianza: 'confirmado',
          titulo: 'Hay una cuenta que hoy paga más',
          texto: `La tasa que anotaste es ${pct(p.tna * 100, 0)} anual. Hoy ${nombreCuenta(mejor.id)} publica ${pct(mejor.tna * 100, 0)}${tope}, sin pedir nada a cambio. Mover la plata es opcional: te lo contamos para que lo tengas en cuenta.`,
        });
      }
    }

    // 5) Fondo: cuánto valen hoy tus cuotapartes (dato exacto de CAFCI).
    if (p.tipo === 'fci' && p.cantidad && m?.fondos) {
      const fondo = String(p.detalle.fondo ?? '').toLowerCase();
      const clase = String(p.detalle.clase ?? '').toLowerCase();
      const f = m.fondos.valor.find((x) => {
        const id = x.id.toLowerCase();
        return fondo && id.startsWith(fondo) && (!clase || id.endsWith(`clase ${clase}`));
      });
      if (f) {
        const valor = p.cantidad * f.vcp;
        const dif = valor - p.monto;
        salida.push({
          id: `valor-${p.id}`, tono: 'info', posicionId: p.id, confianza: 'confirmado',
          titulo: `Tus cuotapartes valen hoy ${fmtPesos(valor)}`,
          texto: `Al ${diaMes(f.fecha)}, con el valor oficial de la cuotaparte. Pusiste ${fmtPesos(p.monto)}, así que ${dif >= 0 ? 'ganaste' : 'te falta recuperar'} ${fmtPesos(Math.abs(dif))} (${pct(Math.abs(dif / p.monto) * 100, 2)}).`,
        });
      }
    }

    // 6) CEDEAR: valor a precio de hoy.
    if (p.tipo === 'cedear' && p.cantidad && m?.cedears) {
      const ticker = String(p.detalle.ticker ?? '').toUpperCase();
      const c = m.cedears.valor.find((x) => x.simbolo === ticker);
      if (c) {
        const valor = p.cantidad * c.precio;
        const dif = valor / p.monto - 1;
        salida.push({
          id: `valor-${p.id}`, tono: 'info', posicionId: p.id, confianza: 'confirmado',
          titulo: `Tus ${ticker} valen hoy ${fmtPesos(valor)}`,
          texto: `A precio de hoy, sin contar la comisión de venta (lo que cobra el broker). Pagaste ${fmtPesos(p.monto)}: estás ${pct(Math.abs(dif) * 100, 1)} ${dif >= 0 ? 'arriba' : 'abajo'}. Es normal que cambie todos los días: está pensado para dejarlo años.`,
        });
      }
    }

    // 7) Dólares: cuánto valen hoy contra lo que costaron y contra la inflación.
    if (p.tipo === 'dolar' && p.cantidad && m?.dolar.mep && estaVigente('dolar', m.dolar.mep.fecha, ahora)) {
      const valor = p.cantidad * m.dolar.mep.valor;
      const dif = valor / p.monto - 1;
      const inflPeriodo = infl && dias >= 10 ? Math.pow(1 + infl.mensual, dias / 30) - 1 : null;
      salida.push({
        id: `valor-${p.id}`, tono: 'info', posicionId: p.id, confianza: 'confirmado',
        titulo: `Tus dólares valen hoy ${fmtPesos(valor)}`,
        texto: `Al dólar MEP de hoy (${fmtPesos(m.dolar.mep.valor)}). Pagaste ${fmtPesos(p.monto)}: ${pct(Math.abs(dif) * 100, 1)} ${dif >= 0 ? 'más' : 'menos'}.${
          inflPeriodo !== null ? ` En esos ${dias} días la inflación estimada fue de alrededor de ${pct(inflPeriodo * 100, 1)}: ${dif > inflPeriodo ? 'los dólares le ganaron.' : 'los dólares quedaron por debajo.'}` : ''
        }`,
      });
    }
  }

  const prioridad = (n: Novedad) => (n.id.startsWith('vence') || n.id.startsWith('vencio') ? 0 : n.tono === 'decision' ? 1 : n.id.startsWith('sigue') ? 2 : 3);
  return salida.sort((a, b) => prioridad(a) - prioridad(b)).slice(0, 6);
}

/**
 * Qué hay hoy para esta inversión, en una o dos frases cada cosa: lo que dice el
 * mercado de hoy sobre lo que la persona tiene. Es la parte "del día" de la ficha
 * de cada inversión.
 */
export function queHayHoy(p: PosicionInversion, m: Mercado | null, ahora: number = Date.now()): string[] {
  if (!m) return [];
  const salida: string[] = [];
  switch (p.tipo) {
    case 'plazo_fijo':
    case 'plazo_fijo_uva': {
      const lista = bancosOrdenados(m);
      if (p.tipo === 'plazo_fijo' && lista.length > 0 && estaVigente('plazoFijo', m.plazoFijo?.fecha, ahora)) {
        salida.push(`Hoy los bancos pagan entre ${pct(lista[lista.length - 1].tna * 100, 1)} y ${pct(lista[0].tna * 100, 1)} anual a 30 días. La mejor tasa es la de ${nombrePropio(lista[0].entidad)}.`);
      }
      if (p.tipo === 'plazo_fijo_uva' && m.inflacion.uva30d) {
        salida.push(`En el último mes la UVA subió ${pct(m.inflacion.uva30d.valor, 1)}: eso es lo que se sumó a tu plata por la inflación.`);
      }
      break;
    }
    case 'cuenta_remunerada': {
      const conocidas = (m.cuentas?.valor ?? []).filter((c) => CUENTAS_CONOCIDAS.includes(c.id) && estaVigente('cuenta', c.fecha, ahora));
      if (conocidas.length > 0) {
        const mejor = conocidas.reduce((a, c) => (c.tna > a.tna ? c : a));
        salida.push(`Hoy la cuenta que más paga es ${nombreCuenta(mejor.id)}: ${pct(mejor.tna * 100, 0)} anual${mejor.condiciones ? ` (${mejor.condiciones.replace(/\.$/, '')})` : ''}.`);
      }
      break;
    }
    case 'fci': {
      const fondo = String(p.detalle.fondo ?? '').toLowerCase();
      const f = m.fondos?.valor.find((x) => fondo && x.id.toLowerCase().startsWith(fondo));
      if (f && f.tna1 !== null && estaVigente('fondo', f.fecha, ahora)) {
        salida.push(`Al ${diaMe(f.fecha)} tu fondo rindió cerca de ${pct(f.tna1 * 100, 0)} anual (calculado con cómo cambió el valor de su cuotaparte).`);
      }
      break;
    }
    case 'dolar': {
      const mep = m.dolar.mep;
      if (mep && estaVigente('dolar', mep.fecha, ahora)) {
        const v = m.dolar.mep30d;
        salida.push(`Hoy el dólar MEP está a ${fmtPesos(mep.valor)}${v !== null ? `; en el último mes ${v >= 0 ? 'subió' : 'bajó'} ${pct(Math.abs(v), 1)}` : ''}.`);
      }
      break;
    }
    case 'cedear': {
      const ticker = String(p.detalle.ticker ?? '').toUpperCase();
      const c = m.cedears?.valor.find((x) => x.simbolo === ticker);
      if (c && estaVigente('cedears', m.cedears?.fecha, ahora)) {
        salida.push(`Hoy ${ticker} cotiza a ${fmtPesos(c.precio)} y ${c.variacionDia >= 0 ? 'subió' : 'bajó'} ${pct(Math.abs(c.variacionDia), 1)} en el día.`);
      }
      break;
    }
    case 'letra':
    case 'bono_cer':
      break;
  }
  return salida;
}
