// El motor de recomendaciones: toma los datos de mercado de HOY y decide qué le
// conviene a una persona, y qué NO.
//
// La idea que lo gobierna: una inversión no se juzga por cuánto rinde sino por
// cuánto rinde DESPUÉS de la inflación. Una tasa de 20% anual con una inflación
// de 25% anual no es una ganancia, es una pérdida lenta. En pesos eso no se ve
// ($1.200.000 parecen más que $1.000.000 aunque compren menos), así que el motor
// lo calcula y lo dice.
//
// Reglas que no se rompen:
//   · Todo sale de un dato con fecha. Si el dato está vencido, la opción no se
//     recomienda: nunca se usa un número viejo como si fuera de hoy.
//   · Se compara contra la inflación MÁS ALTA de las que conocemos (la de los
//     últimos meses, la esperada y la que marca la UVA). Preferimos descartar
//     una opción que en realidad le ganaba antes que recomendar una que pierde.
//   · Lo que no rinde por sí mismo (dólar, CEDEARs) no lleva un número de
//     rendimiento inventado: se dice qué es y qué se vio en el pasado reciente.
//   · Un dato estimado se devuelve como rango, nunca como número exacto.
//
// Todo es función pura (sin red, sin React): se prueba sola.

import {
  ORDEN_PRODUCTOS, PRODUCTOS, PROVEEDORES, proveedoresDe,
  type FuenteDato, type PerfilRiesgo, type Producto, type ProductoId, type ProveedorId, type Rol,
} from './catalogo.js';
import { diaMes, enMeses, fmtPesos, listaConY, nombreCuenta, nombrePropio, pct, pctConSigno, rangoPct, rangoPctConSigno } from './formato.js';
import { claveDeclarada, limitesDe, origenDeclarable } from './limites.js';
import { edadEnDias, estaVigente, type Dato, type Mercado } from './mercadoTipos.js';

export type Rango = { min: number; max: number };
export type Confianza = 'confirmado' | 'declarado' | 'estimado' | 'por-descubrir';

/** Margen para no llamar "pérdida" a una diferencia de una décima: 0,1 punto por mes. */
const EPS = 0.001;

// ── Inflación de referencia ──────────────────────────────────────────────
export type ComponenteInflacion = {
  id: 'indec' | 'indec-control' | 'rem' | 'uva' | 'personal';
  etiqueta: string;
  /** Fracción mensual. */
  mensual: number;
  fecha: string;
};

export type Inflacion = {
  /** La más alta de las vigentes: contra esta se compara todo. */
  mensual: number;
  /** Lo mismo expresado en un año, para que se entienda en la cabeza. */
  anual: number;
  mayor: ComponenteInflacion;
  componentes: ComponenteInflacion[];
};

export const mensualDeAnual = (anualPct: number): number => Math.pow(1 + anualPct / 100, 1 / 12) - 1;
export const temDeTna = (tna: number): number => (tna * 30) / 365;
export const realMensual = (tem: number, inflacion: number): number => (1 + tem) / (1 + inflacion) - 1;

/** Los datos que una alerta grave dejó "en revisión": lo que depende de ellos no se recomienda. */
export const enRevision = (m: Mercado, clave: string): boolean => m.alertas.some((a) => a.gravedad === 'grave' && a.clave === clave);

export function inflacionDeReferencia(m: Mercado, ahora: number = Date.now(), personal: number | null = null): Inflacion | null {
  const componentes: ComponenteInflacion[] = [];

  const meses = m.inflacion.meses;
  if (meses.length >= 3) {
    const ultimos = meses.slice(-3);
    const fecha = ultimos[ultimos.length - 1].fecha;
    if (estaVigente('inflacion', fecha, ahora)) {
      const prom = ultimos.reduce((a, x) => a + x.valor, 0) / ultimos.length / 100;
      componentes.push({ id: 'indec', etiqueta: 'promedio de los últimos 3 meses (INDEC)', mensual: prom, fecha });
    }
  }
  // La segunda fuente (el INDEC publicado en datos.gob.ar): si difiere de la primera,
  // se compara contra la más alta, así nunca se subestima la inflación.
  const control = m.inflacion.control;
  if (control && control.length >= 3) {
    const ultimos = control.slice(-3);
    const ult = ultimos[ultimos.length - 1].fecha;
    const [anio, mes] = ult.split('-').map(Number);
    const finDeMes = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
    if (estaVigente('inflacion', finDeMes, ahora)) {
      const prom = ultimos.reduce((a, x) => a + x.valor, 0) / ultimos.length / 100;
      componentes.push({ id: 'indec-control', etiqueta: 'promedio de los últimos 3 meses (INDEC, segunda fuente)', mensual: prom, fecha: finDeMes });
    }
  }
  const rem = m.inflacion.esperada12m;
  if (rem && estaVigente('rem', rem.fecha, ahora)) {
    componentes.push({ id: 'rem', etiqueta: 'lo que espera el mercado para el próximo año (BCRA)', mensual: mensualDeAnual(rem.valor), fecha: rem.fecha });
  }
  const uva = m.inflacion.uva30d;
  if (uva && estaVigente('uva', uva.fecha, ahora)) {
    componentes.push({ id: 'uva', etiqueta: 'lo que subió la UVA en el último mes (BCRA)', mensual: uva.valor / 100, fecha: uva.fecha });
  }
  // La inflación de esta persona (lo que subió lo que ella consume): si es más alta que la
  // oficial, es contra esa que tiene que rendir lo que invierta.
  if (personal !== null && componentes.length > 0) {
    componentes.push({ id: 'personal', etiqueta: 'lo que subió lo que vos consumís (INDEC, con tus gastos)', mensual: personal, fecha: m.ipc?.fecha ?? componentes[0].fecha });
  }
  if (componentes.length === 0) return null;

  const mayor = componentes.reduce((a, b) => (b.mensual > a.mensual ? b : a));
  return { mensual: mayor.mensual, anual: Math.pow(1 + mayor.mensual, 12) - 1, mayor, componentes };
}

// ── Evaluación de cada opción ────────────────────────────────────────────
export type Veredicto = 'le-gana' | 'empata' | 'pierde' | 'variable' | 'sin-dato';

export type Evaluacion = {
  producto: ProductoId;
  proveedor: ProveedorId;
  veredicto: Veredicto;
  /** Tasa nominal anual, fracción. null si el producto no paga una tasa (dólar, CEDEARs). */
  tna: Rango | null;
  /** Rendimiento por mes, fracción. */
  tem: Rango | null;
  /** Lo que queda por mes después de la inflación, fracción. Puede ser negativo. */
  real: Rango | null;
  /** Fecha del dato más viejo del que depende. */
  fecha: string | null;
  fuente: string | null;
  vigente: boolean;
  confianza: Confianza;
  /** Una frase con lo que se sabe de esta opción hoy. */
  detalle: string;
  /** Topes, condiciones, plazos: lo que cambia la cuenta. */
  notas: string[];
};

function veredictoDe(real: Rango): Veredicto {
  if (real.max < -EPS) return 'pierde';
  if (real.min > EPS) return 'le-gana';
  return 'empata';
}

function sinDato(producto: ProductoId, proveedor: ProveedorId, motivo: string): Evaluacion {
  return {
    producto, proveedor, veredicto: 'sin-dato', tna: null, tem: null, real: null, fecha: null, fuente: null,
    vigente: false, confianza: 'por-descubrir', detalle: motivo, notas: [],
  };
}

function conTasa(
  producto: ProductoId, proveedor: ProveedorId, tna: Rango, inflacion: number,
  extra: Pick<Evaluacion, 'fecha' | 'fuente' | 'confianza' | 'detalle' | 'notas'> & { vigente?: boolean },
): Evaluacion {
  const tem = { min: temDeTna(tna.min), max: temDeTna(tna.max) };
  const real = { min: realMensual(tem.min, inflacion), max: realMensual(tem.max, inflacion) };
  return {
    producto, proveedor, veredicto: veredictoDe(real), tna, tem, real,
    fecha: extra.fecha, fuente: extra.fuente, vigente: extra.vigente ?? true, confianza: extra.confianza,
    detalle: extra.detalle, notas: extra.notas,
  };
}

/** Lo que declaran varias personas que ven la tasa en su app: respaldo cuando la publicada falta o está vieja. */
function declaradaPara(producto: ProductoId, proveedor: ProveedorId, m: Mercado): { tna: number; n: number; fecha: string } | null {
  const o = origenDeclarable(producto, proveedor, PROVEEDORES[proveedor].nombre);
  return o ? (m.declaradas[claveDeclarada(o.tipo, o.lugar, o.fondo)] ?? null) : null;
}

function evaluarConDeclarada(
  producto: ProductoId, proveedor: ProveedorId, d: { tna: number; n: number; fecha: string }, infl: Inflacion,
): Evaluacion {
  return conTasa(producto, proveedor, { min: Math.max(0, d.tna - 0.01), max: d.tna + 0.01 }, infl.mensual, {
    fecha: d.fecha,
    fuente: 'tasas que declaran personas que lo usan',
    confianza: 'declarado',
    vigente: true,
    detalle: `Según lo que declaran ${d.n} personas que lo usan, rinde cerca de ${pct(d.tna * 100, 0)} anual.`,
    notas: ['Es lo que ven en su propia app: puede cambiar de un día para el otro.'],
  });
}

function evaluarFondo(
  producto: ProductoId, proveedor: ProveedorId, id: string, m: Mercado, infl: Inflacion, ahora: number,
): Evaluacion {
  const f = m.fondos?.valor.find((x) => x.id === id);
  const declarada = declaradaPara(producto, proveedor, m);
  const vigente = !!f && estaVigente('fondo', f.fecha, ahora);
  const medidas = f ? [f.tna1, f.tna7, f.tna30].filter((x): x is number => x !== null) : [];
  // Sin un dato publicado al día, se usa lo que declaran las personas (si son suficientes).
  if ((!f || !m.fondos || !vigente || medidas.length === 0) && declarada) return evaluarConDeclarada(producto, proveedor, declarada, infl);
  if (!f || !m.fondos) return sinDato(producto, proveedor, 'No tenemos el dato de este fondo.');
  if (medidas.length === 0) return sinDato(producto, proveedor, 'Todavía no tenemos rendimiento calculado para este fondo.');

  // Cuantos más días de historia, más angosto el rango. Con un solo día, el
  // rendimiento de un fondo varía un par de puntos de un día al otro.
  const margen = medidas.length === 1 ? 0.02 : medidas.length === 2 ? 0.01 : 0.005;
  const tna = { min: Math.max(0, Math.min(...medidas) - margen), max: Math.max(...medidas) + margen };

  const ventanas = [f.tna30 !== null ? 'el último mes' : null, f.tna7 !== null ? 'la última semana' : null, f.tna1 !== null ? 'el último día' : null].filter((x): x is string => x !== null);
  return conTasa(producto, proveedor, tna, infl.mensual, {
    fecha: f.fecha,
    fuente: m.fondos.fuente,
    confianza: 'estimado',
    vigente,
    detalle: `El fondo ${f.id.replace(/ - Clase .*$/, '')} rindió ${rangoPct(tna.min, tna.max, 1)} anual, calculado con cómo cambió su valor de cuotaparte en ${listaConY(ventanas)}.`,
    notas: ['Es lo que rindió en el pasado reciente: no está garantizado que lo siga haciendo.'],
  });
}

function evaluarCuenta(
  producto: ProductoId, proveedor: ProveedorId, f: Extract<FuenteDato, { tipo: 'cuenta' }>,
  m: Mercado, infl: Inflacion, ahora: number,
): Evaluacion {
  const base = m.cuentas?.valor.find((c) => c.id === f.id);
  const declarada = declaradaPara(producto, proveedor, m);
  if ((!base || !m.cuentas || !estaVigente('cuenta', base.fecha, ahora)) && declarada) return evaluarConDeclarada(producto, proveedor, declarada, infl);
  if (!base || !m.cuentas) return sinDato(producto, proveedor, 'No tenemos la tasa de esta cuenta.');
  const niveles = (f.extra ?? [])
    .map((id) => m.cuentas?.valor.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c && c.tna > base.tna);
  const techo = niveles.reduce((a, c) => Math.max(a, c.tna), base.tna);

  const notas: string[] = [];
  if (base.tope) notas.push(`La tasa rinde hasta ${fmtPesos(base.tope)} de saldo. Lo que pase de ahí rinde menos o nada.`);
  if (base.condiciones) notas.push(base.condiciones);
  for (const n of niveles) {
    if (n.condiciones) notas.push(`${nombreCuenta(n.id)}: ${n.condiciones}`);
  }
  return conTasa(producto, proveedor, { min: base.tna, max: techo }, infl.mensual, {
    fecha: base.fecha,
    fuente: m.cuentas.fuente,
    confianza: 'confirmado',
    vigente: estaVigente('cuenta', base.fecha, ahora),
    detalle: techo > base.tna
      ? `Paga ${pct(base.tna * 100, 0)} anual y puede llegar a ${pct(techo * 100, 0)} si cumplís las condiciones.`
      : `Paga ${pct(base.tna * 100, 0)} anual.`,
    notas,
  });
}

function tnaPlazo30(b: { tnaClientes: number; tasas: { plazoMinDias: number; plazoMaxDias: number; tna: number }[] }): number {
  const t = b.tasas.find((x) => x.plazoMinDias <= 30 && x.plazoMaxDias >= 30);
  return t ? t.tna : b.tnaClientes;
}

export type BancoOrdenado = { entidad: string; tna: number };

/** Bancos ordenados por la tasa que pagan a 30 días, de la mejor a la peor. */
export function bancosOrdenados(m: Mercado): BancoOrdenado[] {
  return (m.plazoFijo?.valor ?? [])
    .map((b) => ({ entidad: b.entidad, tna: tnaPlazo30(b) }))
    .filter((b) => b.tna > 0)
    .sort((a, b) => b.tna - a.tna);
}

function evaluarPlazoFijo(
  producto: ProductoId, proveedor: ProveedorId, m: Mercado, infl: Inflacion, ahora: number,
): Evaluacion {
  if (!m.plazoFijo) return sinDato(producto, proveedor, 'No tenemos las tasas de plazo fijo de hoy.');
  const vigente = estaVigente('plazoFijo', m.plazoFijo.fecha, ahora);

  if (producto === 'plazo_fijo_uva') {
    const uva = m.inflacion.uva30d;
    if (!uva) return sinDato(producto, proveedor, 'No tenemos la UVA de hoy.');
    // El capital se ajusta por UVA (que sigue a la inflación con rezago) más un
    // adicional que cada banco fija y que NO tenemos publicado. Por eso el
    // rango es angosto alrededor de la UVA y el "extra" se avisa.
    const tem = { min: Math.max(0, uva.valor / 100 - 0.003), max: uva.valor / 100 + 0.003 };
    const real = { min: realMensual(tem.min, infl.mensual), max: realMensual(tem.max, infl.mensual) };
    return {
      producto, proveedor, veredicto: veredictoDe(real), tna: null, tem, real,
      fecha: uva.fecha, fuente: uva.fuente, vigente: vigente && estaVigente('uva', uva.fecha, ahora), confianza: 'estimado',
      detalle: `Tu capital sube con la UVA: en el último mes subió ${pct(uva.valor, 1)}.`,
      notas: [
        'La UVA sigue a la inflación con un rezago de un par de meses: si la inflación se acelera, cobrás un poco menos de lo que sube el costo de vida; si se frena, un poco más.',
        'Cada banco puede sumar un adicional sobre la UVA. Ese adicional no lo tenemos publicado: preguntalo antes de confirmar.',
      ],
    };
  }

  const lista = bancosOrdenados(m);
  if (lista.length === 0) return sinDato(producto, proveedor, 'No tenemos tasas de plazo fijo vigentes.');
  const medianaTna = lista[Math.floor(lista.length / 2)].tna;
  const mejor = lista[0];
  const principales = lista.filter((b) => /NACION|GALICIA|SANTANDER|BBVA|MACRO|PROVINCIA/i.test(b.entidad)).slice(0, 3);
  return conTasa(producto, proveedor, { min: medianaTna, max: mejor.tna }, infl.mensual, {
    fecha: m.plazoFijo.fecha,
    fuente: m.plazoFijo.fuente,
    confianza: 'confirmado',
    vigente,
    detalle: `A 30 días, la tasa típica de los bancos es ${pct(medianaTna * 100, 1)} anual y la mejor hoy es ${pct(mejor.tna * 100, 1)}.`,
    notas: [
      `La mejor tasa hoy la paga ${nombrePropio(mejor.entidad)}. Las tasas son para clientes del banco.`,
      ...(/FINANCIERA/i.test(mejor.entidad) ? ['Esa entidad es una compañía financiera y no un banco: antes de dejar plata, fijate en la web del BCRA que figure como entidad autorizada.'] : []),
      ...(principales.length ? [`Bancos grandes: ${principales.map((b) => `${nombrePropio(b.entidad)} ${pct(b.tna * 100, 1)}`).join(', ')}.`] : []),
    ],
  });
}

function evaluarLetras(
  producto: ProductoId, proveedor: ProveedorId, m: Mercado, infl: Inflacion, ahora: number,
): Evaluacion {
  if (!m.letras) return sinDato(producto, proveedor, 'No tenemos el mercado de letras de hoy.');
  const lista = m.letras.valor.filter((l) => l.dias >= 15 && l.dias <= 200);
  if (lista.length === 0) return sinDato(producto, proveedor, 'No hay letras de corto plazo disponibles hoy.');
  const tems = lista.map((l) => l.tem);
  const corta = [...lista].sort((a, b) => a.dias - b.dias)[0];
  const tna = { min: Math.min(...tems) * 365 / 30, max: Math.max(...tems) * 365 / 30 };
  return conTasa(producto, proveedor, tna, infl.mensual, {
    fecha: m.letras.fecha,
    fuente: m.letras.fuente,
    confianza: 'confirmado',
    vigente: estaVigente('letras', m.letras.fecha, ahora),
    detalle: `Hoy hay ${lista.length} letras de entre ${Math.min(...lista.map((l) => l.dias))} y ${Math.max(...lista.map((l) => l.dias))} días. La más corta, ${corta.ticker}, vence el ${diaMes(corta.vencimiento)} y rinde ${pct(corta.tem * 100, 2)} por mes.`,
    notas: [
      'El rendimiento es el que figura al comprar y lo cobrás si esperás hasta el vencimiento.',
      ...(m.riesgoPais ? [`El riesgo país hoy es ${m.riesgoPais.valor} puntos (al ${diaMes(m.riesgoPais.fecha)}): cuanto más alto, más caro le sale al Estado endeudarse.`] : []),
    ],
  });
}

function evaluarDolar(
  producto: ProductoId, proveedor: ProveedorId, m: Mercado, infl: Inflacion, ahora: number,
): Evaluacion {
  const mep = m.dolar.mep;
  if (!mep) return sinDato(producto, proveedor, 'No tenemos la cotización del dólar MEP de hoy.');
  const var30 = m.dolar.mep30d;
  const partes = [`El dólar MEP está a ${fmtPesos(mep.valor)} (al ${diaMes(mep.fecha)}).`];
  if (var30 !== null) {
    partes.push(`En los últimos 30 días ${var30 >= 0 ? 'subió' : 'bajó'} ${pct(Math.abs(var30), 1)}; la inflación fue ${pct(infl.mensual * 100, 1)}.`);
  }
  return {
    producto, proveedor, veredicto: 'variable', tna: null, tem: null, real: null,
    fecha: mep.fecha, fuente: mep.fuente, vigente: estaVigente('dolar', mep.fecha, ahora) && !enRevision(m, 'dolar'), confianza: 'por-descubrir',
    detalle: partes.join(' '),
    notas: [
      'No genera interés: protege de una suba del dólar, pero si el dólar sube menos que la inflación, perdés poder de compra.',
      ...(m.dolar.brechaMep !== null ? [`Hoy el MEP está ${pct(m.dolar.brechaMep, 1)} por encima del oficial.`] : []),
    ],
  };
}

function evaluarCedears(
  producto: ProductoId, proveedor: ProveedorId, m: Mercado, ahora: number,
): Evaluacion {
  if (!m.cedears) return sinDato(producto, proveedor, 'No tenemos precios de CEDEARs hoy.');
  const spy = m.cedears.valor.find((c) => c.simbolo === 'SPY') ?? m.cedears.valor[0];
  return {
    producto, proveedor, veredicto: 'variable', tna: null, tem: null, real: null,
    fecha: m.cedears.fecha, fuente: m.cedears.fuente, vigente: estaVigente('cedears', m.cedears.fecha, ahora) && !enRevision(m, 'cedears'), confianza: 'por-descubrir',
    detalle: `Un CEDEAR de ${spy.simbolo} (las 500 empresas más grandes de EE.UU.) cuesta ${fmtPesos(spy.precio)} y hoy ${spy.variacionDia >= 0 ? 'subió' : 'bajó'} ${pct(Math.abs(spy.variacionDia), 1)}.`,
    notas: ['No hay un rendimiento que se pueda prometer: sube y baja con el mercado y con el dólar.'],
  };
}

export function evaluar(
  producto: ProductoId, proveedor: ProveedorId, m: Mercado, infl: Inflacion, ahora: number = Date.now(),
): Evaluacion | null {
  const fuente = PROVEEDORES[proveedor].productos[producto];
  if (!fuente) return null;
  switch (fuente.tipo) {
    case 'fondo': return evaluarFondo(producto, proveedor, fuente.id, m, infl, ahora);
    case 'cuenta': return evaluarCuenta(producto, proveedor, fuente, m, infl, ahora);
    case 'plazo': return evaluarPlazoFijo(producto, proveedor, m, infl, ahora);
    case 'letras': return evaluarLetras(producto, proveedor, m, infl, ahora);
    case 'dolar': return evaluarDolar(producto, proveedor, m, infl, ahora);
    case 'cedears': return evaluarCedears(producto, proveedor, m, ahora);
  }
}

// ── Recomendar ───────────────────────────────────────────────────────────
export type Contexto = {
  mercado: Mercado;
  perfil: PerfilRiesgo;
  /** Cuántos meses puede dejar la plata quieta. null = no lo dijo. */
  horizonteMeses: number | null;
  /** Cuánta plata quiere invertir, si lo dijo. */
  monto?: number | null;
  /** Proveedores que la persona dijo que ya usa. */
  usa: ProveedorId[];
  /** Productos en los que ya invierte. */
  yaInvierteEn: ProductoId[];
  /** Todavía no tiene unos meses de gastos a mano. */
  necesitaCaja: boolean;
  /** La inflación de esta persona (fracción mensual), si se pudo calcular. */
  inflacionPersonal?: number | null;
  ahora?: number;
};

export type Recomendacion = {
  producto: Producto;
  rol: Rol;
  /** Todas las opciones con dato vigente, la mejor primero (las de proveedores que ya usa, antes a igualdad). */
  opciones: Evaluacion[];
  mejor: Evaluacion;
  /** La mejor opción entre los proveedores que ya usa, si no es la misma que `mejor`. */
  mejorConLoQueUsa: Evaluacion | null;
  avisos: string[];
  yaLoHace: boolean;
};

/** Una inversión de la lista: se puede elegir cualquiera, y las que hoy convienen van marcadas. */
export type ItemProducto = {
  rec: Recomendacion;
  recomendado: boolean;
  /** Por qué no se recomienda hoy, en una frase corta. null si se recomienda o si no hay nada que decir. */
  motivo: string | null;
};

export type Resultado = {
  inflacion: Inflacion | null;
  /** Primero las recomendadas, después las demás. */
  items: ItemProducto[];
  /** Sin inflación vigente no se recomienda nada: no hay contra qué comparar. */
  sinBase: boolean;
};

const puntaje = (e: Evaluacion): number => (e.real ? e.real.max : -1);

/** Cuántas recomendaciones se marcan como máximo: más de eso deja de ser una recomendación. */
const MAX_RECOMENDADAS = 4;

export function recomendar(ctx: Contexto): Resultado {
  const ahora = ctx.ahora ?? Date.now();
  const infl = inflacionDeReferencia(ctx.mercado, ahora, ctx.inflacionPersonal ?? null);
  if (!infl) return { inflacion: null, items: [], sinBase: true };

  const candidatos: ItemProducto[] = [];

  for (const id of ORDEN_PRODUCTOS) {
    const p = PRODUCTOS[id];
    const evals = proveedoresDe(id)
      .map((pr) => evaluar(id, pr.id, ctx.mercado, infl, ahora))
      .filter((e): e is Evaluacion => e !== null);
    const vigentes = evals.filter((e) => e.vigente && e.veredicto !== 'sin-dato');
    // Sin un dato de hoy no hay con qué armar la ficha ni el paso a paso: no se lista.
    if (vigentes.length === 0) continue;

    // Un proveedor que hoy rinde menos que la inflación no se ofrece si hay otro
    // que no: la misma regla que para el producto, aplicada a cada opción.
    const conRendimiento = vigentes.filter((e) => e.veredicto !== 'variable');
    const todasPierden = conRendimiento.length > 0 && conRendimiento.every((e) => e.veredicto === 'pierde');
    const noPierden = vigentes.filter((e) => e.veredicto !== 'pierde');
    const candidatas = noPierden.length > 0 ? noPierden : vigentes;
    const opciones = [...candidatas].sort((a, b) => {
      const d = puntaje(b) - puntaje(a);
      if (Math.abs(d) > 0.0005) return d;
      return Number(ctx.usa.includes(b.proveedor)) - Number(ctx.usa.includes(a.proveedor));
    });
    const mejor = opciones[0];
    const conLoQueUsa = opciones.find((o) => ctx.usa.includes(o.proveedor)) ?? null;
    const avisos: string[] = [];
    if (todasPierden) avisos.push('Hoy todas las opciones de este tipo rinden menos que la inflación. Sirven para tener la plata a mano, no para que crezca.');

    const rec: Recomendacion = {
      producto: p,
      rol: p.rol,
      opciones,
      mejor,
      mejorConLoQueUsa: conLoQueUsa && conLoQueUsa.proveedor !== mejor.proveedor ? conLoQueUsa : null,
      avisos,
      yaLoHace: ctx.yaInvierteEn.includes(id),
    };

    // Por qué NO se recomienda hoy (la primera razón que aplique).
    let motivo: string | null = null;
    const minimo = limitesDe(id, mejor.proveedor, ctx.mercado);
    if (!p.perfiles.includes(ctx.perfil)) {
      motivo = 'Es para quien acepta más altibajos que los que dijiste que aceptás.';
    } else if (ctx.horizonteMeses === null && p.horizonteMinimoMeses >= 12) {
      motivo = 'Pide dejar la plata varios años.';
    } else if (ctx.horizonteMeses !== null && ctx.horizonteMeses < p.horizonteMinimoMeses) {
      motivo = `Pide dejar la plata al menos ${enMeses(p.horizonteMinimoMeses)}.`;
    } else if (ctx.monto && minimo.min !== null && minimo.minDuro && ctx.monto < minimo.min) {
      motivo = `Con ese monto no alcanza: lo mínimo es ${fmtPesos(minimo.min)}.`;
    } else if (todasPierden && p.rol !== 'caja') {
      motivo = 'Hoy rinde menos que la inflación (lo que suben los precios).';
    }
    candidatos.push({ rec, recomendado: motivo === null, motivo });
  }

  // Para tener plata a mano se permite una opción que pierde contra la inflación
  // sólo si NO hay otra opción disponible mejor. Si la hay, la que pierde sobra.
  const hayCajaQueNoPierde = candidatos.some((c) => c.recomendado && c.rec.rol === 'caja' && c.rec.mejor.veredicto !== 'pierde');
  for (const c of candidatos) {
    if (c.recomendado && c.rec.rol === 'caja' && c.rec.mejor.veredicto === 'pierde' && hayCajaQueNoPierde) {
      c.recomendado = false;
      c.motivo = 'Hoy rinde menos que la inflación (lo que suben los precios) y hay otra opción igual de disponible que rinde más.';
    }
  }

  // Primero lo que necesita: sin colchón, la caja; con colchón, el ahorro.
  const ordenRol: Record<Rol, number> = ctx.necesitaCaja
    ? { caja: 0, ahorro: 1, crecimiento: 2 }
    : { ahorro: 0, caja: 1, crecimiento: 2 };
  const recomendadas = candidatos
    .filter((c) => c.recomendado)
    .sort((a, b) => {
      if (ordenRol[a.rec.rol] !== ordenRol[b.rec.rol]) return ordenRol[a.rec.rol] - ordenRol[b.rec.rol];
      // Lo que ya hace va después de lo que todavía no: se prioriza diversificar.
      if (a.rec.yaLoHace !== b.rec.yaLoHace) return Number(a.rec.yaLoHace) - Number(b.rec.yaLoHace);
      return puntaje(b.rec.mejor) - puntaje(a.rec.mejor);
    });
  // Se marcan hasta MAX_RECOMENDADAS, pero siempre la mejor de cada rol: si alguien puede dejar
  // la plata cinco años, los CEDEARs (el único que crece a largo plazo) no pueden quedar afuera
  // sólo porque hay cuatro opciones de ahorro delante.
  const elegidas = new Set<ItemProducto>();
  for (const rol of ['caja', 'ahorro', 'crecimiento'] as const) {
    const mejorDelRol = recomendadas.find((c) => c.rec.rol === rol);
    if (mejorDelRol) elegidas.add(mejorDelRol);
  }
  for (const c of recomendadas) {
    if (elegidas.size >= MAX_RECOMENDADAS) break;
    elegidas.add(c);
  }
  const marcadas = recomendadas.filter((c) => elegidas.has(c));
  const resto = [
    ...recomendadas.filter((c) => !elegidas.has(c)).map((c) => ({ ...c, recomendado: false, motivo: null })),
    ...candidatos.filter((c) => !c.recomendado),
  ];
  return { inflacion: infl, items: [...marcadas, ...resto], sinBase: false };
}

// ── Resumen del estado del mercado, para mostrarlo ───────────────────────
export type Indicador = { id: string; etiqueta: string; valor: string; fecha: string; fuente: string; vigente: boolean };

export function indicadores(m: Mercado, ahora: number = Date.now()): Indicador[] {
  const salida: Indicador[] = [];
  const meses = m.inflacion.meses;
  if (meses.length > 0) {
    const u = meses[meses.length - 1];
    salida.push({
      id: 'inflacion', etiqueta: 'Inflación del último mes', valor: pct(u.valor, 1), fecha: u.fecha,
      fuente: 'INDEC', vigente: estaVigente('inflacion', u.fecha, ahora),
    });
  }
  const push = <T,>(id: string, etiqueta: string, d: Dato<T> | null, fmt: (v: T) => string, clave: Parameters<typeof estaVigente>[0]) => {
    if (d) salida.push({ id, etiqueta, valor: fmt(d.valor), fecha: d.fecha, fuente: d.fuente, vigente: estaVigente(clave, d.fecha, ahora) });
  };
  push('rem', 'Inflación esperada a 12 meses', m.inflacion.esperada12m, (v) => pct(v, 1), 'rem');
  push('uva', 'UVA en el último mes', m.inflacion.uva30d, (v) => pctConSigno(v, 1), 'uva');
  push('tamar', 'Tasa que pagan los bancos (TAMAR)', m.tasas.tamar, (v) => `${pct(v, 1)} anual`, 'tasaBcra');
  push('mep', 'Dólar MEP', m.dolar.mep, (v) => fmtPesos(v), 'dolar');
  push('oficial', 'Dólar oficial', m.dolar.oficial, (v) => fmtPesos(v), 'dolar');
  push('riesgo', 'Riesgo país', m.riesgoPais, (v) => `${v} puntos`, 'riesgoPais');
  return salida;
}

export { edadEnDias };
