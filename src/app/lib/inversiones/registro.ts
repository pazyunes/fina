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

import type { LecturaCaptura } from '../../api/v2/capturas';
import type { PosicionInversion, TipoPosicion } from '../../api/v2/tipos';
import { diaMes, fmtPesos, pct } from './formato';
import { bancosOrdenados } from './motor';
import type { Mercado } from './mercadoTipos';

export type TipoCampo = 'texto' | 'monto' | 'numero' | 'porcentaje' | 'fecha' | 'opcion';

export type CampoDef = {
  id: string;
  etiqueta: string;
  tipo: TipoCampo;
  obligatorio: boolean;
  /** Dónde se encuentra este dato en la app. */
  ayuda: string;
  opciones?: { id: string; label: string }[];
  placeholder?: string;
};

export type FormDef = {
  tipo: TipoPosicion;
  titulo: string;
  campos: CampoDef[];
};

export type Valores = Record<string, string>;

const SI_NO = [{ id: 'si', label: 'Sí' }, { id: 'no', label: 'No' }];

const PROVEEDORES_BILLETERA = ['Mercado Pago', 'Ualá', 'Naranja X', 'Brubank', 'Otra'].map((x) => ({ id: x, label: x }));
const PROVEEDORES_BROKER = ['Cocos Capital', 'Balanz', 'Mercado Pago', 'Ualá', 'Otro'].map((x) => ({ id: x, label: x }));
const BROKERS = ['Cocos Capital', 'Balanz', 'Otro'].map((x) => ({ id: x, label: x }));

const inicio = (etiqueta = '¿Desde cuándo?'): CampoDef => ({
  id: 'inicio', etiqueta, tipo: 'fecha', obligatorio: true,
  ayuda: 'La fecha en que lo hiciste. Si fue hoy, dejá la de hoy.',
});

export const FORMULARIOS: Record<TipoPosicion, FormDef> = {
  cuenta_remunerada: {
    tipo: 'cuenta_remunerada',
    titulo: 'Cuenta remunerada',
    campos: [
      { id: 'proveedor', etiqueta: '¿En qué billetera?', tipo: 'opcion', obligatorio: true, ayuda: 'La app donde tenés la plata.', opciones: PROVEEDORES_BILLETERA },
      { id: 'monto', etiqueta: '¿Cuánto tenés en la cuenta?', tipo: 'monto', obligatorio: true, ayuda: 'Es el saldo que ves en la sección de rendimientos.' },
      { id: 'tna', etiqueta: 'Tasa que te muestra la app', tipo: 'porcentaje', obligatorio: false, ayuda: 'Aparece junto a “Rinde”, en porcentaje anual (TNA). Si solo ves TEA, anotá ese número.', placeholder: 'Ej: 19' },
      inicio(),
    ],
  },
  fci: {
    tipo: 'fci',
    titulo: 'Fondo común de inversión',
    campos: [
      { id: 'proveedor', etiqueta: '¿Dónde lo compraste?', tipo: 'opcion', obligatorio: true, ayuda: 'La app o broker desde donde invertiste.', opciones: PROVEEDORES_BROKER },
      { id: 'fondo', etiqueta: 'Nombre del fondo', tipo: 'texto', obligatorio: true, ayuda: 'Arriba en la ficha del fondo. Ej: Cocos Ahorro.', placeholder: 'Ej: Cocos Ahorro' },
      { id: 'clase', etiqueta: 'Clase', tipo: 'texto', obligatorio: false, ayuda: 'Una letra (A, B, C…) que figura junto al nombre.', placeholder: 'Ej: A' },
      { id: 'monto', etiqueta: '¿Cuánto pusiste?', tipo: 'monto', obligatorio: true, ayuda: 'El monto que suscribiste, en pesos.' },
      { id: 'cantidad', etiqueta: 'Cuotapartes que recibiste', tipo: 'numero', obligatorio: false, ayuda: 'En “Mi cartera” o “Tenencias”, dentro del fondo.', placeholder: 'Ej: 1.250,35' },
      { id: 'precio', etiqueta: 'Valor de la cuotaparte al comprar', tipo: 'numero', obligatorio: false, ayuda: 'Figura en el comprobante de la suscripción.', placeholder: 'Ej: 2.428,729' },
      { id: 'rescate', etiqueta: '¿En cuánto tiempo podés rescatarlo?', tipo: 'opcion', obligatorio: false, ayuda: 'Figura en la ficha del fondo como “plazo de rescate”.', opciones: [{ id: 'mismo-dia', label: 'El mismo día' }, { id: '24hs', label: '24 hs' }, { id: '48hs', label: '48 hs' }, { id: 'otro', label: 'Otro' }] },
      inicio('¿Cuándo lo compraste?'),
    ],
  },
  plazo_fijo: {
    tipo: 'plazo_fijo',
    titulo: 'Plazo fijo',
    campos: [
      { id: 'proveedor', etiqueta: '¿En qué banco?', tipo: 'texto', obligatorio: true, ayuda: 'El banco donde lo constituiste.', placeholder: 'Ej: Banco Nación' },
      { id: 'monto', etiqueta: '¿Cuánto pusiste?', tipo: 'monto', obligatorio: true, ayuda: 'El capital que figura en el comprobante.' },
      { id: 'tna', etiqueta: 'Tasa (TNA)', tipo: 'porcentaje', obligatorio: true, ayuda: 'En el comprobante, como “TNA” o “tasa nominal anual”.', placeholder: 'Ej: 20' },
      { id: 'plazo', etiqueta: 'Plazo en días', tipo: 'numero', obligatorio: true, ayuda: 'En el comprobante: 30, 60, 90…', placeholder: 'Ej: 30' },
      inicio('¿Cuándo lo constituiste?'),
      { id: 'renueva', etiqueta: '¿Se renueva solo al vencer?', tipo: 'opcion', obligatorio: false, ayuda: 'En el comprobante: “renovación automática”.', opciones: SI_NO },
      { id: 'precancelable', etiqueta: '¿Es precancelable?', tipo: 'opcion', obligatorio: false, ayuda: 'Si lo podés retirar antes del vencimiento (con tasa menor).', opciones: SI_NO },
    ],
  },
  plazo_fijo_uva: {
    tipo: 'plazo_fijo_uva',
    titulo: 'Plazo fijo UVA',
    campos: [
      { id: 'proveedor', etiqueta: '¿En qué banco?', tipo: 'texto', obligatorio: true, ayuda: 'El banco donde lo constituiste.', placeholder: 'Ej: Banco Galicia' },
      { id: 'monto', etiqueta: '¿Cuánto pusiste?', tipo: 'monto', obligatorio: true, ayuda: 'El capital que figura en el comprobante.' },
      { id: 'plazo', etiqueta: 'Plazo en días', tipo: 'numero', obligatorio: true, ayuda: 'En el comprobante. Suelen pedir al menos 90.', placeholder: 'Ej: 90' },
      { id: 'tna', etiqueta: 'Adicional sobre la UVA', tipo: 'porcentaje', obligatorio: false, ayuda: 'Si el banco te informa un interés extra sobre la UVA. Si no figura, dejalo vacío.', placeholder: 'Ej: 1' },
      inicio('¿Cuándo lo constituiste?'),
    ],
  },
  letra: {
    tipo: 'letra',
    titulo: 'Letra del Tesoro',
    campos: [
      { id: 'proveedor', etiqueta: '¿En qué broker?', tipo: 'opcion', obligatorio: true, ayuda: 'La app desde donde la compraste.', opciones: BROKERS },
      { id: 'ticker', etiqueta: 'Nombre de la letra (ticker)', tipo: 'texto', obligatorio: true, ayuda: 'En “Mi cartera”. Ej: S13N6. El nombre ya indica el vencimiento.', placeholder: 'Ej: S13N6' },
      { id: 'monto', etiqueta: '¿Cuánto pagaste en total?', tipo: 'monto', obligatorio: true, ayuda: 'El costo total de la compra, con comisión si la hubo.' },
      { id: 'cantidad', etiqueta: 'Cantidad comprada', tipo: 'numero', obligatorio: false, ayuda: 'En el comprobante o en “Mi cartera”.', placeholder: 'Ej: 1.000' },
      { id: 'vencimiento', etiqueta: 'Fecha de vencimiento', tipo: 'fecha', obligatorio: true, ayuda: 'La fecha en que el Estado te devuelve la plata. Figura en la ficha de la letra.' },
      inicio('¿Cuándo la compraste?'),
    ],
  },
  dolar: {
    tipo: 'dolar',
    titulo: 'Dólares',
    campos: [
      { id: 'proveedor', etiqueta: '¿Dónde los compraste?', tipo: 'opcion', obligatorio: true, ayuda: 'La app o broker.', opciones: BROKERS },
      { id: 'cantidad', etiqueta: '¿Cuántos dólares?', tipo: 'numero', obligatorio: true, ayuda: 'El saldo en dólares que recibiste.', placeholder: 'Ej: 100' },
      { id: 'precio', etiqueta: '¿A cuánto compraste cada dólar?', tipo: 'monto', obligatorio: true, ayuda: 'Figura en el comprobante de la operación, en pesos por dólar.' },
      { id: 'tipo', etiqueta: 'Tipo de dólar', tipo: 'opcion', obligatorio: false, ayuda: 'El comprobante dice si fue MEP, oficial u otro.', opciones: [{ id: 'mep', label: 'MEP' }, { id: 'oficial', label: 'Oficial' }, { id: 'otro', label: 'Otro' }] },
      inicio('¿Cuándo los compraste?'),
    ],
  },
  cedear: {
    tipo: 'cedear',
    titulo: 'CEDEAR',
    campos: [
      { id: 'proveedor', etiqueta: '¿En qué broker?', tipo: 'opcion', obligatorio: true, ayuda: 'La app desde donde lo compraste.', opciones: BROKERS },
      { id: 'ticker', etiqueta: 'Ticker', tipo: 'texto', obligatorio: true, ayuda: 'El código del CEDEAR. Ej: SPY, AAPL.', placeholder: 'Ej: SPY' },
      { id: 'cantidad', etiqueta: '¿Cuántos compraste?', tipo: 'numero', obligatorio: true, ayuda: 'Figura en el comprobante.', placeholder: 'Ej: 2' },
      { id: 'precio', etiqueta: 'Precio de cada uno', tipo: 'monto', obligatorio: true, ayuda: 'El precio por unidad al que se ejecutó la compra, en pesos.' },
      { id: 'comision', etiqueta: 'Comisión que te cobraron', tipo: 'monto', obligatorio: false, ayuda: 'Figura en el comprobante. Si no la ves, dejalo vacío.' },
      inicio('¿Cuándo lo compraste?'),
    ],
  },
};

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
    if (c.obligatorio && !valor) errores[c.id] = 'Completá este dato.';
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
  let proveedor = (v.proveedor ?? '').trim();

  // Tipos que se arman distinto
  if (tipo === 'dolar') {
    if (cantidad !== null && precio !== null) monto = Math.round(cantidad * precio);
  }
  if (tipo === 'cedear') {
    const comision = num('comision') ?? 0;
    if (cantidad !== null && precio !== null) monto = Math.round(cantidad * precio + comision);
    if (comision) detalle.comision = comision;
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
    const tope = mercado?.cuentas?.valor.find((c) => c.id.toLowerCase() === proveedor.toLowerCase().replace('ualá', 'uala'))?.tope;
    if (tope && monto !== null && monto > tope) avisos.push(`Muchas cuentas pagan la tasa sólo hasta ${fmtPesos(tope)} de saldo. Lo que pasa de ahí puede rendir menos.`);
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
    const actual = mercado?.cedears?.valor.find((c) => c.simbolo === ticker);
    if (actual && precio !== null && Math.abs(precio - actual.precio) / actual.precio > 0.5) avisos.push(`El precio de hoy de ${ticker} es ${fmtPesos(actual.precio)}. Si compraste hace tiempo puede ser distinto; si no, revisalo.`);
    if (monto !== null) resumen.push(`El costo total fue ${fmtPesos(monto)}${detalle.comision ? ' (con comisión)' : ''}.`);
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
    tna: tipo === 'plazo_fijo_uva' || tipo === 'plazo_fijo' || tipo === 'cuenta_remunerada' ? tna : null,
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
  poner('proveedor', proveedorDeOpciones(l.proveedor, campoProv?.opciones));
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
  return { tipo: l.tipo, valores, leidos };
}
