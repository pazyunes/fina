// Registrar una inversión con los datos que de verdad la definen.
//
// "En qué y cuánto" no alcanza: un plazo fijo se define por su tasa, su plazo y
// su vencimiento; un fondo, por cuál es y a qué valor de cuotaparte entraste;
// un CEDEAR, por el ticker, la cantidad y el precio. Cada tipo pide SÓLO lo que
// la persona ve en su app después de invertir —no lo que tendría que saber—, y
// cada campo dice dónde encontrarlo.
//
// Las validaciones son de dos clases:
//   · errores: lo que no puede ser (un monto en cero, una fecha que no existe).
//     Bloquean guardar.
//   · avisos: lo que es raro pero posible (una tasa muy distinta a la del
//     mercado, un plazo fijo UVA a menos de 90 días). No bloquean: la persona
//     sabe lo que tiene en su app, pero merece que le avisemos que revise.

import type { LecturaCaptura } from '../../api/v2/capturas.js';
import type { PosicionInversion, TipoPosicion } from '../../api/v2/tipos.js';
import { ALIAS_PROVEEDOR, BROKERS, PROVEEDORES } from './catalogo.js';
import { diaMes, fmtPesos, nombrePropio, pct } from './formato.js';
import { avisoDeMonto, explicarTicker, limitesDe, listaDeCedears, precioCedear } from './limites.js';
import { bancosOrdenados } from './motor.js';
import type { Mercado } from './mercadoTipos.js';

export type TipoCampo = 'texto' | 'monto' | 'numero' | 'porcentaje' | 'fecha' | 'opcion';

export type Opcion = { id: string; label: string };

export type CampoDef = {
  id: string;
  etiqueta: string;
  tipo: TipoCampo;
  obligatorio: boolean;
  /** Si está, manda sobre `obligatorio`: el dato sólo se pide cuando se cumple (la tasa de un fondo sólo en los money market). */
  obligatorioSi?: (v: Valores) => boolean;
  /** Dónde se encuentra este dato en la app, o qué significa si es una palabra técnica. */
  ayuda: string;
  /** Una lista fija, o una que depende de lo ya elegido (por ejemplo, el fondo depende de dónde lo compró). */
  opciones?: Opcion[] | ((v: Valores, m: Mercado | null) => Opcion[]);
  placeholder?: string;
  /** Sugerencias mientras se escribe, sin cerrar la lista: se puede anotar algo que no figure (una acción argentina, por ejemplo). */
  sugerencias?: (v: Valores, m: Mercado | null) => Opcion[];
};

/** ¿Hay que completarlo, con lo ya cargado? */
export const esObligatorio = (c: CampoDef, v: Valores): boolean => (c.obligatorioSi ? c.obligatorioSi(v) : c.obligatorio);

export type FormDef = {
  tipo: TipoPosicion;
  titulo: string;
  campos: CampoDef[];
};

export type Valores = Record<string, string>;

const SI_NO: Opcion[] = [{ id: 'si', label: 'Sí' }, { id: 'no', label: 'No' }];
const opc = (xs: string[]): Opcion[] => xs.map((x) => ({ id: x, label: x }));

const BILLETERAS = opc(['Mercado Pago', 'Ualá', 'Naranja X', 'Otra']);
const BROKERS_OPC = opc([...BROKERS.map((b) => PROVEEDORES[b].nombre), 'Otro']);
const PARA_FONDOS = opc([...BROKERS.map((b) => PROVEEDORES[b].nombre), 'Mercado Pago', 'Otro']);
const ES_MONEY_MARKET = (v: Valores): boolean => (v.tipoFondo ?? 'money_market') === 'money_market';
const TIPOS_DE_FONDO: Opcion[] = [
  { id: 'money_market', label: 'Money market (liquidez)' },
  { id: 'renta_fija', label: 'Renta fija (bonos)' },
  { id: 'renta_variable', label: 'Renta variable (acciones)' },
  { id: 'mixto', label: 'Mixto u otro' },
];

/** Los fondos que ofrece cada lugar. Si eligió "Otro", la lista queda vacía y se escribe a mano. */
const FONDOS_DE: Record<string, string> = {
  'Mercado Pago': 'Mercado Fondo',
  'Cocos Capital': 'Cocos Ahorro',
  Balanz: 'Balanz Capital Money Market',
};

/** Los bancos con tasa publicada hoy. Si no hay lista, el campo se escribe a mano. */
function bancosDe(_v: Valores, m: Mercado | null): Opcion[] {
  if (!m) return [];
  const nombres = [...new Set(bancosOrdenados(m).map((b) => nombrePropio(b.entidad)))].sort((a, b) => a.localeCompare(b, 'es'));
  return nombres.length > 0 ? [...opc(nombres), { id: 'Otro banco', label: 'Otro banco' }] : [];
}

const inicio = (etiqueta = '¿Desde cuándo?'): CampoDef => ({
  id: 'inicio', etiqueta, tipo: 'fecha', obligatorio: true,
  ayuda: 'La fecha en que lo hiciste. Si fue hoy, dejá la de hoy.',
});

export const FORMULARIOS: Record<TipoPosicion, FormDef> = {
  cuenta_remunerada: {
    tipo: 'cuenta_remunerada',
    titulo: 'Cuenta remunerada',
    campos: [
      { id: 'proveedor', etiqueta: '¿En qué billetera?', tipo: 'opcion', obligatorio: true, ayuda: 'La app donde tenés la plata.', opciones: BILLETERAS },
      { id: 'monto', etiqueta: '¿Cuánto tenés en la cuenta?', tipo: 'monto', obligatorio: true, ayuda: 'En pesos. Es el saldo de hoy en la sección donde se muestra lo que rinde. Cambia cada vez que cobrás o pagás algo, así que anotá el de hoy y actualizalo de vez en cuando.' },
      { id: 'tna', etiqueta: 'Tasa que te muestra la app (TNA)', tipo: 'porcentaje', obligatorio: true, ayuda: 'La TNA (tasa nominal anual) es cuánto rinde en un año. La ves en la sección de tu cuenta donde se muestra lo que rinde. Con ese número calculamos cuánto crece tu plata. Si solo ves la TEA (la tasa efectiva anual, parecida a la TNA), anotá ese número.', placeholder: 'Ej: 19' },
      inicio(),
    ],
  },
  fci: {
    tipo: 'fci',
    titulo: 'Fondo común de inversión',
    campos: [
      { id: 'proveedor', etiqueta: '¿Dónde lo compraste?', tipo: 'opcion', obligatorio: true, ayuda: 'La app o broker (la plataforma donde comprás inversiones) desde donde invertiste.', opciones: PARA_FONDOS },
      {
        id: 'fondo', etiqueta: 'Nombre del fondo', tipo: 'opcion', obligatorio: true,
        ayuda: 'Está arriba, en la pantalla del fondo. Hay cientos de fondos: si no figura en la lista, escribilo tal cual aparece.',
        opciones: (v) => (FONDOS_DE[v.proveedor] ? opc([FONDOS_DE[v.proveedor]]) : []),
      },
      { id: 'tipoFondo', etiqueta: '¿Qué tipo de fondo es?', tipo: 'opcion', obligatorio: true, ayuda: 'Money market: presta a muy corto plazo y casi no baja. Renta fija: invierte en bonos y puede bajar según el plazo. Renta variable: invierte en acciones y puede bajar bastante. Figura en la descripción del fondo.', opciones: TIPOS_DE_FONDO },
      { id: 'clase', etiqueta: 'Clase', tipo: 'opcion', obligatorio: false, ayuda: 'Una letra (A, B, C…) que figura junto al nombre. Cambia las comisiones, no lo que rinde. Si no la ves, dejala vacía.', opciones: opc(['A', 'B', 'C', 'Otra']) },
      { id: 'monto', etiqueta: '¿Cuánto pusiste?', tipo: 'monto', obligatorio: true, ayuda: 'En pesos. El monto que compraste.' },
      { id: 'tna', etiqueta: 'Rendimiento que te muestra la app (TNA)', tipo: 'porcentaje', obligatorio: true, obligatorioSi: ES_MONEY_MARKET, ayuda: 'La TNA (tasa nominal anual) es cuánto rinde en un año. La ves en la pantalla del fondo. Con ese número calculamos cuánto crece tu plata, y ayuda a que las alternativas sean más precisas para todos. En los fondos de renta fija o variable no se pide: su valor sube y baja, y no hay una tasa fija para anotar.', placeholder: 'Ej: 19' },
      { id: 'cantidad', etiqueta: 'Cuotapartes que recibiste', tipo: 'numero', obligatorio: true, ayuda: 'Las cuotapartes son los pedacitos del fondo que te tocaron. Las ves en la pantalla donde se muestra lo que tenés invertido. Con esto calculamos cuánto vale hoy tu inversión.', placeholder: 'Ej: 41,17' },
      { id: 'precio', etiqueta: 'Valor de cada cuotaparte al comprar', tipo: 'numero', obligatorio: true, ayuda: 'En pesos. Figura en el comprobante de la compra. Con esto calculamos cuánto ganaste.', placeholder: 'Ej: 2.428,729' },
      { id: 'rescate', etiqueta: '¿En cuánto tiempo podés sacar tu plata?', tipo: 'opcion', obligatorio: false, ayuda: 'Figura en la pantalla del fondo como “plazo de rescate” (rescatar es pedir que te devuelvan la plata).', opciones: [{ id: 'mismo-dia', label: 'El mismo día' }, { id: '24hs', label: '24 hs' }, { id: '48hs', label: '48 hs' }, { id: 'otro', label: 'Otro' }] },
      inicio('¿Cuándo lo compraste?'),
    ],
  },
  plazo_fijo: {
    tipo: 'plazo_fijo',
    titulo: 'Plazo fijo',
    campos: [
      { id: 'proveedor', etiqueta: '¿En qué banco?', tipo: 'opcion', obligatorio: true, ayuda: 'El banco donde lo hiciste.', opciones: bancosDe, placeholder: 'Ej: Banco Nación' },
      { id: 'monto', etiqueta: '¿Cuánto pusiste?', tipo: 'monto', obligatorio: true, ayuda: 'En pesos. Es el capital que figura en el comprobante.' },
      { id: 'tna', etiqueta: 'Tasa (TNA)', tipo: 'porcentaje', obligatorio: true, ayuda: 'En el comprobante figura como “TNA” o “tasa nominal anual”: cuánto rinde en un año.', placeholder: 'Ej: 20' },
      { id: 'plazo', etiqueta: 'Plazo en días', tipo: 'numero', obligatorio: true, ayuda: 'Por cuántos días lo hiciste. Figura en el comprobante: 30, 60, 90…', placeholder: 'Ej: 30' },
      inicio('¿Cuándo lo hiciste?'),
      { id: 'renueva', etiqueta: '¿Se renueva solo al vencer?', tipo: 'opcion', obligatorio: true, ayuda: 'Vencer es cuando termina el plazo. En el comprobante dice “renovación automática”. Lo usamos para avisarte qué pasa el día que vence.', opciones: SI_NO },
      { id: 'precancelable', etiqueta: '¿Es precancelable?', tipo: 'opcion', obligatorio: true, ayuda: 'Precancelable quiere decir que lo podés retirar antes del vencimiento, cobrando menos interés.', opciones: SI_NO },
    ],
  },
  plazo_fijo_uva: {
    tipo: 'plazo_fijo_uva',
    titulo: 'Plazo fijo UVA',
    campos: [
      { id: 'proveedor', etiqueta: '¿En qué banco?', tipo: 'opcion', obligatorio: true, ayuda: 'El banco donde lo hiciste.', opciones: bancosDe, placeholder: 'Ej: Banco Galicia' },
      { id: 'monto', etiqueta: '¿Cuánto pusiste?', tipo: 'monto', obligatorio: true, ayuda: 'En pesos. Es el capital que figura en el comprobante.' },
      { id: 'plazo', etiqueta: 'Plazo en días', tipo: 'numero', obligatorio: true, ayuda: 'Por cuántos días lo hiciste. En los plazos fijos UVA (los que se actualizan con la inflación) el mínimo es 90.', placeholder: 'Ej: 90' },
      { id: 'tna', etiqueta: 'Interés extra sobre la UVA', tipo: 'porcentaje', obligatorio: true, ayuda: 'Algunos bancos suman un interés chico además de la inflación (lo que suben los precios). Si no figura o no suma ninguno, poné 0. Con esto calculamos cuánto crece tu plata.', placeholder: 'Ej: 1' },
      inicio('¿Cuándo lo hiciste?'),
      { id: 'renueva', etiqueta: '¿Se renueva solo al vencer?', tipo: 'opcion', obligatorio: true, ayuda: 'Vencer es cuando termina el plazo. En el comprobante dice “renovación automática”. Lo usamos para avisarte qué pasa el día que vence.', opciones: SI_NO },
    ],
  },
  letra: {
    tipo: 'letra',
    titulo: 'Letra del Tesoro',
    campos: [
      { id: 'proveedor', etiqueta: '¿En qué broker?', tipo: 'opcion', obligatorio: true, ayuda: 'La app o plataforma desde donde la compraste.', opciones: BROKERS_OPC },
      { id: 'ticker', etiqueta: 'Nombre de la letra (ticker)', tipo: 'texto', obligatorio: true, ayuda: `${explicarTicker} En las letras, el nombre ya indica el vencimiento. Ej: S13N6.`, placeholder: 'Ej: S13N6' },
      { id: 'monto', etiqueta: '¿Cuánto pagaste en total?', tipo: 'monto', obligatorio: true, ayuda: 'En pesos, con la comisión si la hubo.' },
      { id: 'cantidad', etiqueta: 'Cantidad comprada', tipo: 'numero', obligatorio: true, ayuda: 'Figura en el comprobante o en lo que tenés invertido. Con esto calculamos cuánto cobrás al vencimiento.', placeholder: 'Ej: 1.000' },
      { id: 'vencimiento', etiqueta: 'Fecha de vencimiento', tipo: 'fecha', obligatorio: true, ayuda: 'El día en que el Estado te devuelve la plata.' },
      inicio('¿Cuándo la compraste?'),
    ],
  },
  dolar: {
    tipo: 'dolar',
    titulo: 'Dólares',
    campos: [
      { id: 'proveedor', etiqueta: '¿Dónde los compraste?', tipo: 'opcion', obligatorio: true, ayuda: 'En qué broker, o sea la plataforma donde comprás inversiones.', opciones: BROKERS_OPC },
      { id: 'cantidad', etiqueta: '¿Cuántos dólares compraste?', tipo: 'numero', obligatorio: true, ayuda: 'En dólares (US$). Es el saldo en dólares que recibiste.', placeholder: 'Ej: 100' },
      { id: 'precio', etiqueta: '¿A cuánto compraste cada dólar?', tipo: 'monto', obligatorio: true, ayuda: 'En pesos por cada dólar. Figura en el comprobante.' },
      { id: 'tipo', etiqueta: 'Tipo de dólar', tipo: 'opcion', obligatorio: false, ayuda: 'El comprobante dice si fue MEP (la forma legal de comprar desde un broker), oficial u otro.', opciones: [{ id: 'mep', label: 'MEP' }, { id: 'oficial', label: 'Oficial' }, { id: 'otro', label: 'Otro' }] },
      inicio('¿Cuándo los compraste?'),
    ],
  },
  cedear: {
    tipo: 'cedear',
    titulo: 'CEDEAR',
    campos: [
      { id: 'proveedor', etiqueta: '¿En qué broker (la plataforma donde comprás inversiones)?', tipo: 'opcion', obligatorio: true, ayuda: 'La app desde donde lo compraste.', opciones: BROKERS_OPC },
      {
        id: 'ticker', etiqueta: '¿Cuál compraste? (ticker)', tipo: 'texto', obligatorio: true,
        ayuda: `${explicarTicker} Escribilo o elegilo de la lista. También podés anotar una acción argentina (por ejemplo GGAL).`,
        placeholder: 'Ej: SPY',
        sugerencias: (_v, m) => listaDeCedears(m).map((c) => ({ id: c.ticker, label: `${c.ticker}${c.nombre ? ` · ${c.nombre}` : ''}` })),
      },
      { id: 'cantidad', etiqueta: '¿Cuántos compraste?', tipo: 'numero', obligatorio: true, ayuda: 'Se compran de a uno entero. Figura en el comprobante.', placeholder: 'Ej: 2' },
      { id: 'precio', etiqueta: 'Precio de cada uno', tipo: 'monto', obligatorio: true, ayuda: 'En pesos. El precio por unidad al que se hizo la compra.' },
      { id: 'comision', etiqueta: 'Comisión que te cobraron (%)', tipo: 'porcentaje', obligatorio: true, ayuda: 'Es un porcentaje de lo que operaste, no un monto en pesos. Es lo que cobra el broker (la plataforma) por comprar; figura en el comprobante o en sus tarifas. Si no cobraron, poné 0. Cuenta para saber cuánto ganaste de verdad.', placeholder: 'Ej: 0,6' },
      inicio('¿Cuándo lo compraste?'),
    ],
  },
};

/** Las opciones de un campo, ya resueltas. Una lista vacía significa "que lo escriba a mano". */
export function opcionesDe(c: CampoDef, v: Valores, m: Mercado | null): Opcion[] {
  if (!c.opciones) return [];
  return typeof c.opciones === 'function' ? c.opciones(v, m) : c.opciones;
}

/** Deja pasar sólo lo que cabe en un campo numérico: nada de letras. */
export function soloNumeros(texto: string): string {
  return texto.replace(/[^\d.,]/g, '');
}

// ── lectura de números ───────────────────────────────────────────────────
/** Convención argentina: '.' separa miles y ',' los decimales. Admite "21.5" como 21,5. */
export function leerNumero(texto: string): number | null {
  const t = texto.trim().replace(/[^\d.,-]/g, '');
  if (!t) return null;
  let normal: string;
  if (t.includes(',')) normal = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+\.\d{1,2}$/.test(t)) normal = t; // un solo punto con 1-2 decimales: decimal
  else normal = t.replace(/\./g, '');
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

const MS_DIA = 24 * 60 * 60 * 1000;

function sumarDias(fecha: string, dias: number): string {
  return new Date(new Date(`${fecha}T12:00:00Z`).getTime() + dias * MS_DIA).toISOString().slice(0, 10);
}

export function hoyISO(ahora: number = Date.now()): string {
  return new Date(ahora).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
}

const fechaValida = (f: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(new Date(`${f}T12:00:00Z`).getTime());

// ── validar y armar ──────────────────────────────────────────────────────
export type Borrador = Omit<PosicionInversion, 'id' | 'ts' | 'estado'>;

export type ResultadoRegistro = {
  errores: Record<string, string>;
  avisos: string[];
  /** Lo que se va a guardar, o null si hay errores. */
  borrador: Borrador | null;
  /** Lo que se deduce de lo cargado, para mostrar antes de guardar. */
  resumen: string[];
};

export function procesarRegistro(
  tipo: TipoPosicion, v: Valores, mercado: Mercado | null, origen: 'manual' | 'captura' = 'manual', ahora: number = Date.now(),
): ResultadoRegistro {
  const def = FORMULARIOS[tipo];
  const errores: Record<string, string> = {};
  const avisos: string[] = [];
  const resumen: string[] = [];
  const hoy = hoyISO(ahora);

  // Una letra que el mercado conoce trae su propio vencimiento: no se lo pedimos.
  const tickerLetra = (v.ticker ?? '').trim().toUpperCase();
  const letraConocida = tipo === 'letra' ? mercado?.letras?.valor.find((l) => l.ticker === tickerLetra) : undefined;

  for (const c of def.campos) {
    const valor = (v[c.id] ?? '').trim();
    if (c.id === 'vencimiento' && letraConocida && !valor) continue;
    if (esObligatorio(c, v) && !valor) errores[c.id] = 'Completá este dato.';
    else if (valor && (c.tipo === 'monto' || c.tipo === 'numero' || c.tipo === 'porcentaje') && leerNumero(valor) === null) {
      errores[c.id] = 'Escribilo con números.';
    } else if (valor && c.tipo === 'fecha' && !fechaValida(valor)) errores[c.id] = 'La fecha no es válida.';
  }

  const num = (id: string): number | null => (v[id]?.trim() ? leerNumero(v[id]) : null);
  const iniciof = v.inicio ?? hoy;
  if (fechaValida(iniciof) && iniciof > hoy) errores.inicio = 'La fecha no puede ser futura: esto es para anotar lo que ya hiciste.';

  let monto = num('monto');
  let tna = num('tna');
  let plazo = num('plazo');
  const cantidad = num('cantidad');
  const precio = num('precio');
  let vencimiento: string | null = fechaValida(v.vencimiento ?? '') ? v.vencimiento : null;
  const detalle: Borrador['detalle'] = {};
  // Si la plata es para un objetivo, queda anotado: así se ve en Mis inversiones para qué es.
  if (v.objetivo) detalle.objetivoId = v.objetivo;
  let proveedor = (v.proveedor ?? '').trim();

  // Tipos que se arman distinto
  if (tipo === 'dolar') {
    if (cantidad !== null && precio !== null) monto = Math.round(cantidad * precio);
  }
  if (tipo === 'cedear') {
    // La comisión es un % de lo operado: se pasa a pesos para saber el costo total.
    const comisionPct = num('comision') ?? 0;
    if (comisionPct < 0 || comisionPct > 100) errores.comision = 'Revisá el porcentaje.';
    else if (comisionPct > 5) avisos.push(`Una comisión de ${pct(comisionPct, 1)} es mucho más alta que la habitual en los brokers. Revisá que sea un porcentaje y no pesos.`);
    const comision = cantidad !== null && precio !== null ? Math.round(cantidad * precio * (comisionPct / 100)) : 0;
    if (cantidad !== null && precio !== null) monto = Math.round(cantidad * precio + comision);
    if (comisionPct) { detalle.comisionPct = comisionPct; detalle.comision = comision; }
  }

  if (monto !== null && monto <= 0) errores[tipo === 'dolar' || tipo === 'cedear' ? 'cantidad' : 'monto'] = 'Tiene que ser mayor a cero.';
  if (cantidad !== null && cantidad <= 0) errores.cantidad = 'Tiene que ser mayor a cero.';
  if (precio !== null && precio <= 0) errores.precio = 'Tiene que ser mayor a cero.';

  if (tna !== null) {
    if (tna < 0 || tna > 1000) errores.tna = 'Revisá el porcentaje.';
    else tna = tna / 100;
  }
  if (plazo !== null && (plazo <= 0 || !Number.isInteger(plazo))) errores.plazo = 'Poné la cantidad de días, en número entero.';

  // ── reglas por tipo ──
  if (tipo === 'plazo_fijo' || tipo === 'plazo_fijo_uva') {
    if (plazo !== null && Number.isInteger(plazo) && plazo > 0 && fechaValida(iniciof)) {
      vencimiento = sumarDias(iniciof, plazo);
      resumen.push(`Vence el ${diaMes(vencimiento)}.`);
    }
    if (tipo === 'plazo_fijo' && plazo !== null && plazo < 30) avisos.push('Los plazos fijos en bancos suelen empezar en 30 días. Revisá si anotaste bien los días.');
    if (tipo === 'plazo_fijo_uva' && plazo !== null && plazo < 90) avisos.push('Los plazos fijos UVA suelen pedir al menos 90 días. Revisá el comprobante.');
    if (tipo === 'plazo_fijo' && tna !== null && monto !== null && plazo !== null && plazo > 0) {
      const interes = monto * tna * (plazo / 365);
      resumen.push(`Al vencimiento cobrás ${fmtPesos(monto)} + ${fmtPesos(interes)} de interés (${fmtPesos(monto + interes)} en total).`);
    }
    if (tipo === 'plazo_fijo' && tna !== null && mercado) {
      const lista = bancosOrdenados(mercado);
      if (lista.length > 0) {
        const mejor = lista[0].tna;
        const mediana = lista[Math.floor(lista.length / 2)].tna;
        if (tna > mejor + 0.05) avisos.push(`Esa tasa es mucho más alta que la mejor que pagan los bancos hoy (${pct(mejor * 100, 1)}). Revisá si es TNA y no TEA.`);
        else if (tna < mediana - 0.08) avisos.push(`Esa tasa es bastante más baja que la típica de hoy (${pct(mediana * 100, 1)}). Puede ser un plazo fijo viejo o una tasa baja de tu banco.`);
      }
    }
    if (v.renueva) detalle.renuevaSolo = v.renueva === 'si';
    if (v.precancelable) detalle.precancelable = v.precancelable === 'si';
  }

  if (tipo === 'cuenta_remunerada') {
    if (tna !== null && mercado?.cuentas) {
      const mx = Math.max(...mercado.cuentas.valor.map((c) => c.tna));
      if (tna > mx + 0.05) avisos.push(`Esa tasa es más alta que cualquiera que veamos hoy en billeteras (${pct(mx * 100, 0)}). Revisá si es TNA.`);
    }
    const pid = ALIAS_PROVEEDOR[proveedor];
    const aviso = pid ? avisoDeMonto(limitesDe('cuenta_remunerada', pid, mercado), monto) : null;
    if (aviso) avisos.push(aviso.texto);
  }

  if (tipo === 'letra') {
    const ticker = (v.ticker ?? '').trim().toUpperCase();
    if (ticker) detalle.ticker = ticker;
    const hoyLetra = mercado?.letras?.valor.find((l) => l.ticker === ticker);
    if (hoyLetra && !vencimiento) vencimiento = hoyLetra.vencimiento;
    if (mercado?.letras && ticker && !hoyLetra) avisos.push('No encontramos esa letra entre las que hay hoy en el mercado. Puede haber vencido o estar mal escrito el nombre.');
    if (hoyLetra && vencimiento && hoyLetra.vencimiento !== vencimiento) avisos.push(`Esa letra vence el ${diaMes(hoyLetra.vencimiento)} según el mercado; vos anotaste el ${diaMes(vencimiento)}.`);
    if (vencimiento && fechaValida(iniciof) && vencimiento <= iniciof) errores.vencimiento = 'El vencimiento tiene que ser posterior a la compra.';
    if (vencimiento) resumen.push(`Vence el ${diaMes(vencimiento)}.`);
  }

  if (tipo === 'fci') {
    const fondo = (v.fondo ?? '').trim();
    if (fondo) detalle.fondo = fondo;
    if (v.clase?.trim()) detalle.clase = v.clase.trim().toUpperCase();
    if (v.tipoFondo) detalle.tipoFondo = v.tipoFondo;
    if (v.tipoFondo && v.tipoFondo !== 'money_market') resumen.push('Este tipo de fondo puede bajar de valor: no es plata que quede quieta. Mirá su valor de vez en cuando, pero sin vender con miedo por una caída.');
    if (v.rescate) detalle.rescate = v.rescate;
    if (cantidad !== null && precio !== null && monto !== null) {
      const calculado = cantidad * precio;
      if (Math.abs(calculado - monto) / monto > 0.05) avisos.push(`Cuotapartes × valor da ${fmtPesos(calculado)}, y vos pusiste ${fmtPesos(monto)}. Revisá que los números sean del mismo día.`);
    }
  }

  if (tipo === 'dolar') {
    if (v.tipo) detalle.tipoDolar = v.tipo;
    if (monto !== null) resumen.push(`Pagaste ${fmtPesos(monto)} por ${cantidad?.toLocaleString('es-AR')} dólares.`);
    const mep = mercado?.dolar.mep?.valor;
    if (precio !== null && mep && Math.abs(precio - mep) / mep > 0.25) avisos.push(`Ese precio está lejos del MEP de hoy (${fmtPesos(mep)}). Si compraste hace tiempo es normal; si no, revisalo.`);
  }

  if (tipo === 'cedear') {
    const ticker = (v.ticker ?? '').trim().toUpperCase();
    if (ticker) detalle.ticker = ticker;
    if (cantidad !== null && !Number.isInteger(cantidad)) errores.cantidad = 'Los CEDEARs se compran de a uno entero.';
    if (ticker && mercado?.cedears && !mercado.cedears.valor.some((c) => c.simbolo === ticker)) {
      avisos.push(`No encontramos ${ticker} entre los CEDEARs que operan hoy. Si es una acción argentina o una que cotiza de otra forma, está bien.`);
    }
    const actual = ticker ? { precio: precioCedear(mercado, ticker) } : null;
    if (actual?.precio && precio !== null && Math.abs(precio - actual.precio) / actual.precio > 0.5) avisos.push(`El precio de hoy de ${ticker} es ${fmtPesos(actual.precio ?? 0)}. Si compraste hace tiempo puede ser distinto; si no, revisalo.`);
    if (monto !== null) resumen.push(`El costo total fue ${fmtPesos(monto)}${detalle.comisionPct ? ` (con la comisión de ${pct(Number(detalle.comisionPct), 1)})` : ''}.`);
  }

  if (tipo === 'plazo_fijo' || tipo === 'plazo_fijo_uva') proveedor = proveedor || '';

  if (Object.keys(errores).length > 0 || monto === null) {
    return { errores, avisos, borrador: null, resumen };
  }

  const borrador: Borrador = {
    tipo,
    proveedor,
    monto,
    inicio: iniciof,
    vencimiento,
    plazoDias: plazo !== null && Number.isInteger(plazo) ? plazo : null,
    tna: tipo === 'plazo_fijo_uva' || tipo === 'plazo_fijo' || tipo === 'cuenta_remunerada' || tipo === 'fci' ? tna : null,
    cantidad,
    precioUnitario: precio,
    detalle,
    origen,
  };
  return { errores, avisos, borrador, resumen };
}

/** Valores del formulario con los que arranca, según lo que ya se sabe (la guía, la captura…). */
export function valoresIniciales(tipo: TipoPosicion, previos: Partial<Valores> = {}, ahora: number = Date.now()): Valores {
  const base: Valores = {};
  for (const c of FORMULARIOS[tipo].campos) base[c.id] = '';
  base.inicio = hoyISO(ahora);
  for (const [k, val] of Object.entries(previos)) {
    if (typeof val === 'string') base[k] = val;
  }
  return base;
}

// ── Desde una captura ────────────────────────────────────────────────────
const formatearEntero = (n: number): string => Math.round(n).toLocaleString('es-AR');
const formatearDecimal = (n: number): string => n.toLocaleString('es-AR', { maximumFractionDigits: 4 });

/** Hace coincidir el nombre que se ve en la captura con una de las opciones del formulario. */
function proveedorDeOpciones(visto: string | null, opciones: { id: string; label: string }[] | undefined): string {
  if (!visto) return '';
  if (!opciones) return visto.trim();
  const bajo = visto.toLowerCase();
  const hit = opciones.find((o) => o.id !== 'Otra' && o.id !== 'Otro' && (bajo.includes(o.id.toLowerCase().split(' ')[0]) || o.id.toLowerCase().includes(bajo)));
  if (hit) return hit.id;
  return opciones.find((o) => o.id === 'Otra' || o.id === 'Otro')?.id ?? '';
}

/**
 * Pasa lo que se leyó de una captura a los valores del formulario. Devuelve
 * también qué campos vinieron de la captura, para marcarlos en pantalla: la
 * persona tiene que ver qué leímos nosotros y qué puso ella.
 */
export function lecturaAValores(l: LecturaCaptura, ahora: number = Date.now()): { tipo: TipoPosicion | null; valores: Valores; leidos: string[] } {
  if (!l.tipo) return { tipo: null, valores: {}, leidos: [] };
  const def = FORMULARIOS[l.tipo];
  const valores = valoresIniciales(l.tipo, {}, ahora);
  const leidos: string[] = [];
  const poner = (id: string, val: string | null) => {
    if (val && def.campos.some((c) => c.id === id)) { valores[id] = val; leidos.push(id); }
  };

  const campoProv = def.campos.find((c) => c.id === 'proveedor');
  poner('proveedor', proveedorDeOpciones(l.proveedor, campoProv ? opcionesDe(campoProv, {}, null) : undefined));
  if (l.monto !== null) poner('monto', formatearEntero(l.monto));
  if (l.tnaPorcentaje !== null) poner('tna', formatearDecimal(l.tnaPorcentaje));
  if (l.plazoDias !== null) poner('plazo', String(Math.round(l.plazoDias)));
  poner('inicio', l.fechaInicio && /^\d{4}-\d{2}-\d{2}$/.test(l.fechaInicio) ? l.fechaInicio : null);
  poner('vencimiento', l.fechaVencimiento && /^\d{4}-\d{2}-\d{2}$/.test(l.fechaVencimiento) ? l.fechaVencimiento : null);
  poner('ticker', l.ticker ? l.ticker.toUpperCase() : null);
  poner('fondo', l.fondo);
  poner('clase', l.clase ? l.clase.toUpperCase() : null);
  if (l.cantidad !== null) poner('cantidad', formatearDecimal(l.cantidad));
  if (l.precioUnitario !== null) poner('precio', l.tipo === 'fci' ? formatearDecimal(l.precioUnitario) : formatearEntero(l.precioUnitario));

  // Los campos con lista cerrada (el fondo, el ticker) sólo aceptan lo que la lista tiene:
  // si lo que se leyó no está, se deja vacío para que lo elija la persona.
  for (const c of def.campos) {
    const lista = opcionesDe(c, valores, null);
    if (c.tipo === 'opcion' && lista.length > 0 && valores[c.id] && !lista.some((o) => o.id === valores[c.id])) {
      valores[c.id] = '';
      const i = leidos.indexOf(c.id);
      if (i >= 0) leidos.splice(i, 1);
    }
  }
  return { tipo: l.tipo, valores, leidos };
}
