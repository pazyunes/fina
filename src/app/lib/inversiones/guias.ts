// Los pasos para llegar de "quiero invertir" a "ya lo hice", uno por cada combinación de proveedor y producto.
//
// La explicación de QUÉ es la inversión va ANTES (las pantallas de "Aprendé en 2 minutos"). Acá sólo se dice
// CÓMO se hace, corto y con cosas para tocar:
//   · haces    — qué hacés, en una frase.
//   · puntos   — lo importante, en puntos cortos.
//   · atencion — una advertencia, si hay una.
//   · chequeo  — "sabés que salió bien cuando…": SÓLO en el paso donde termina la operación.
//   · widget   — lo que la persona elige o escribe ahí mismo (el banco, el plazo, cuál CEDEAR, la tasa, el registro).
//
// Lo que se decide acá es lo mismo que después se pregunta al registrar (ver `previosParaRegistro`): si para comprar
// un CEDEAR se eligió cuántos, el registro ya trae cuántos, y no se vuelve a pedir.
//
// Los nombres de pantallas y botones salen de información pública y de cómo funcionan estas apps en general; no se
// pudieron verificar abriendo cada una. `porVerificar` lista lo que hay que confirmar en la app real.

import { PROVEEDORES, type BrokerId, type ProductoId, type ProveedorId } from './catalogo.js';
import { ventanaDeVencimiento } from './cartera.js';
import { extraUva } from './entidades.js';
import { diaMes, fmtPesos, nombreCuenta, nombrePropio, pct } from './formato.js';
import { FONDOS_POR_PROVEEDOR, origenDeclarable, precioCedear } from './limites.js';
import type { Evaluacion } from './motor.js';
import type { Mercado } from './mercadoTipos.js';
import type { Valores } from './registro.js';

/** Lo que la persona elige o escribe dentro de un paso. */
export type Widget = 'donde' | 'plazo' | 'cedear' | 'dolares' | 'tasa' | 'registro';

export type PasoGuia = {
  id: string;
  titulo: string;
  /** Qué hacés, en una frase. */
  haces: string;
  /** Lo importante, en puntos cortos. */
  puntos?: string[];
  /** Una advertencia ("Atención: …"). */
  atencion?: string;
  /** Datos de hoy o lo que la persona eligió, listos para mostrar. */
  datos?: { etiqueta: string; valor: string }[];
  /** "Sabés que salió bien cuando…": sólo en el paso donde termina la operación. */
  chequeo?: string;
  widget?: Widget;
  /** Algo para quien quiere más: queda cerrado y se puede dejar "para más adelante". */
  avanzado?: { titulo: string; texto: string };
  /** Si el paso mira una tasa en la app, se le pide a la persona que la anote: es un dato real para todos. */
  declara?: { tipo: 'cuenta_remunerada' | 'fci'; lugar: string; fondo: string };
  /** true en el último paso: el registro. */
  registra?: boolean;
};

export type Guia = {
  proveedor: ProveedorId;
  producto: ProductoId;
  titulo: string;
  pasos: PasoGuia[];
  /** Cosas que hay que confirmar abriendo la app real (para quien mantiene FINA). */
  porVerificar: string[];
};

/** Lo que la persona decidió antes y durante los pasos. */
export type ContextoGuia = {
  /** Pesos que va a invertir, si lo dijo. */
  monto: number | null;
  /** Para plazos fijos. */
  plazoDias: number | null;
  /** Para CEDEARs. */
  ticker: string | null;
  cantidad: number | null;
  /** Para dólares: cuántos dólares compra, si eligió por dólares. */
  dolares: number | null;
  mercado: Mercado | null;
  evaluacion: Evaluacion | null;
  /** Banco (plazo fijo) o cuenta (cuenta remunerada) elegido. */
  banco: string | null;
  /** Para cuándo es la plata, en meses: sirve para mostrar sólo las letras y los bonos que vencen dentro de ese plazo. */
  horizonteMeses: number | null;
  /** ¿Ya tiene cuenta en ese lugar? null = todavía no contestó. */
  tieneCuenta: boolean | null;
};

export const CONTEXTO_VACIO: ContextoGuia = {
  monto: null, plazoDias: null, ticker: null, cantidad: null, dolares: null, mercado: null, evaluacion: null, banco: null,
  horizonteMeses: null, tieneCuenta: null,
};

// ── datos de mercado que usan los pasos ──────────────────────────────────
/** La tasa (fracción) que paga un banco a un plazo; si no hay una para ese plazo, la general. */
export function tasaDeBanco(m: Mercado | null, banco: string | null, plazo: number | null): number | null {
  if (!m?.plazoFijo || !banco) return null;
  const b = m.plazoFijo.valor.find((x) => x.entidad === banco);
  if (!b) return null;
  const t = plazo ? b.tasas.find((x) => x.plazoMinDias <= plazo && x.plazoMaxDias >= plazo) : undefined;
  return t ? t.tna : b.tnaClientes;
}

// ── pasos comunes ────────────────────────────────────────────────────────
type TipoLugar = 'billetera' | 'broker' | 'banco';

const TITULO_DONDE: Record<TipoLugar, string> = { banco: 'Elegí en qué banco', broker: '¿En qué broker?', billetera: '¿En qué cuenta?' };

const PUNTOS_CREAR: Record<TipoLugar, string[]> = {
  billetera: ['Descargá la app y empezá el registro', 'Tené el DNI a mano', 'Te piden una selfie para validar que sos vos'],
  broker: ['Descargá la app o entrá a su web', 'Tené el DNI a mano y sacate una selfie', 'Te hacen un test de perfil de inversor'],
  banco: ['Buscá “Hacete cliente” o “Abrí tu cuenta” en su app o web', 'Tené el DNI a mano: piden una selfie y, a veces, una videollamada', 'Después entrás a su app con tu usuario'],
};

const TIEMPO_CREAR: Record<TipoLugar, string> = {
  billetera: 'Lleva unos 10 minutos.',
  broker: 'Lleva unos minutos, y la aprobación puede tardar hasta 2 días hábiles.',
  banco: 'Suele llevar unos minutos y es gratis.',
};

/** Un texto que termina en punto una sola vez (los nombres de bancos pueden terminar en “S.A.”). */
const conPunto = (t: string): string => (t.endsWith('.') ? t : `${t}.`);

/** Paso 1: dónde se hace, y si ya tiene cuenta o tiene que crearla (con cuánto lleva y por qué vale la pena). */
function pasoDonde(nombre: string, tipo: TipoLugar, tieneCuenta: boolean | null): PasoGuia {
  const base = { id: 'donde', titulo: TITULO_DONDE[tipo], widget: 'donde' as const };
  if (tieneCuenta === null) return { ...base, haces: 'Elegí uno de la lista.' };
  if (tieneCuenta) return { ...base, haces: conPunto(`Entrá a la app de ${nombre} con tu usuario`) };
  return {
    ...base,
    haces: conPunto(`Creá tu cuenta en ${nombre}`),
    puntos: PUNTOS_CREAR[tipo],
    atencion: `${TIEMPO_CREAR[tipo]} Es la única vez que lo hacés: después queda lista para siempre.`,
  };
}

/** Paso 2: tener la plata en la cuenta, y cómo pasarla si no está. */
function pasoPlata(nombre: string, tipo: TipoLugar): PasoGuia {
  const banco = tipo === 'banco';
  return {
    id: 'plata',
    titulo: 'Tu plata en tu cuenta',
    haces: banco
      ? `Tené el monto en tu cuenta de ${conPunto(nombre)} Si está en otro banco o billetera, transferilo.`
      : `Tené el monto en tu cuenta de ${conPunto(nombre)} Si no lo tenés, transferilo desde tu banco.`,
    puntos: banco
      ? ['El alias o el CBU de tu cuenta lo ves en “Mi cuenta”', 'La cuenta de origen tiene que estar a tu nombre']
      : ['En “Ingresar dinero” (o “Depositar”) copiá el alias o el CVU/CBU de tu cuenta', 'La cuenta de origen tiene que estar a tu nombre'],
    atencion: tipo === 'broker' ? 'Atención: ya tenés el dinero, pero todavía no lo invertiste. Eso es en el próximo paso.' : undefined,
  };
}

const pasoRegistrar = (): PasoGuia => ({
  id: 'registrar',
  titulo: 'Anotala en FINA',
  haces: 'Completá lo que falta con los datos que te muestra tu app.',
  widget: 'registro',
  registra: true,
});

/** "Antes de finalizar": cómo se sale de la inversión y qué tener presente. Sin repetir lo que ya se explicó. */
const pasoCierre = (titulo: string, haces: string, puntos: string[]): PasoGuia => ({ id: 'cierre', titulo, haces, puntos });

const filaMonto = (m: number | null): { etiqueta: string; valor: string }[] => (m && m > 0 ? [{ etiqueta: 'Tu monto', valor: fmtPesos(m) }] : []);

// ── cuenta remunerada ────────────────────────────────────────────────────
function guiaCuenta(prov: ProveedorId, ctx: ContextoGuia): Guia {
  const nombre = prov === 'otra_cuenta' ? nombreCuenta(ctx.banco ?? 'otra cuenta') : PROVEEDORES[prov].nombre;
  const esMp = prov === 'mercado_pago';
  const condiciones = (ctx.mercado?.cuentas?.valor ?? [])
    .filter((c) => ctx.banco && (c.id === ctx.banco || c.id.startsWith(`${ctx.banco} `)))
    .map((c) => c.condiciones)
    .filter(Boolean);
  const notas = ctx.evaluacion?.notas ?? condiciones;
  const declara = origenDeclarable('cuenta_remunerada', prov, nombre) ?? { tipo: 'cuenta_remunerada' as const, lugar: nombre, fondo: '' };
  const pasos: PasoGuia[] = [pasoDonde(nombre, 'billetera', ctx.tieneCuenta), pasoPlata(nombre, 'billetera')];
  if (esMp) {
    pasos.push({
      id: 'inversiones',
      titulo: 'Ponela en Mercado Fondo',
      haces: 'En el inicio tocá “Inversiones”, buscá “Mercado Fondo” y tocá “Invertir”.',
      puntos: ['Poné el monto y confirmá', 'Ojo: “Reservas” es otra cosa: guarda tu plata, pero no genera intereses'],
    });
  }
  pasos.push({
    id: 'tasa',
    titulo: 'Mirá cuánto rinde',
    haces: esMp
      ? 'Mirá el porcentaje anual que te muestra Mercado Fondo y anotalo acá.'
      : 'Entrá a la sección de rendimientos de tu cuenta, buscá la tasa y anotala acá.',
    puntos: notas.length > 0 ? notas.slice(0, 3) : undefined,
    widget: 'tasa',
    declara,
    avanzado: prov === 'uala'
      ? { titulo: 'Avanzado: los niveles de Ualá', texto: 'Ualá paga más si hacés determinadas operaciones al mes (Ualá Plus). Fijate si te conviene llegar a ese nivel o si con el básico alcanza.' }
      : undefined,
  });
  pasos.push(pasoCierre('Sabé cómo sacarla', esMp
    ? 'Entrá a Mercado Fondo desde “Inversiones” y tocá “Rescatar”. Vuelve a tu saldo en el momento o en el día.'
    : 'Tu plata sigue disponible como saldo: la usás o la transferís a tu banco cuando quieras.', [
    'No hay plazo ni vencimiento',
    'La tasa puede cambiar: mirala de vez en cuando',
  ]));
  pasos.push(pasoRegistrar());
  return {
    proveedor: prov,
    producto: 'cuenta_remunerada',
    titulo: `Cuenta remunerada en ${nombre}`,
    pasos,
    porVerificar: [
      'Dónde se ve la tasa dentro de la app.',
      'Si el rendimiento es automático o hay que activarlo.',
      ...(esMp ? ['Cómo se llama el botón para invertir en Mercado Fondo.', 'Cuánto tarda el rescate.'] : []),
      ...(prov === 'uala' ? ['Cómo se llaman hoy los niveles (Plus 1, Plus 2).'] : []),
    ],
  };
}

// ── fondo común (money market) ───────────────────────────────────────────
function guiaFondoBroker(prov: 'cocos' | 'balanz', ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const fondo = FONDOS_POR_PROVEEDOR[prov]?.nombre ?? 'el fondo';
  return {
    proveedor: prov,
    producto: 'fci',
    titulo: `Fondo común en ${nombre}`,
    pasos: [
      pasoDonde(nombre, 'broker', ctx.tieneCuenta),
      pasoPlata(nombre, 'broker'),
      {
        id: 'buscar',
        titulo: `Buscá ${fondo}`,
        haces: `Entrá a “Fondos” y buscá “${fondo}”, la versión en pesos.`,
        puntos: ['Fijate el plazo de rescate', 'Si hay varias clases (A, B…), para una persona común suele ser la A', 'Anotá acá el rendimiento que te muestra'],
        datos: ctx.evaluacion ? [{ etiqueta: 'Lo que rindió', valor: ctx.evaluacion.detalle }] : undefined,
        widget: 'tasa',
        declara: origenDeclarable('fci', prov, nombre) ?? undefined,
      },
      {
        id: 'suscribir',
        titulo: 'Comprá cuotapartes',
        haces: 'Tocá “Suscribir” (o “Comprar”), poné el monto y confirmá.',
        puntos: ['Ves el valor de cada cuotaparte y cuántas recibís', 'El valor exacto se fija al cierre del día'],
        datos: filaMonto(ctx.monto),
        chequeo: 'En “Mi cartera” (o “Tenencias”) aparece el fondo con tu monto. Desde el día siguiente empieza a rendir.',
      },
      pasoCierre('Antes de finalizar', 'Para sacar la plata, tocá “Rescatar” en la pantalla del fondo, elegí cuánto y confirmá.', [
        'Vuelve a tu cuenta en 0 a 2 días hábiles',
        'Sabé dónde está ese botón antes de necesitarlo',
      ]),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Que el menú se llame “Fondos” y cómo se llama el botón de compra.',
      `Que el fondo figure como ${fondo} y qué clase se ofrece a una persona común.`,
      'El plazo de rescate real del fondo.',
    ],
  };
}

// ── letras y bonos CER ───────────────────────────────────────────────────
function guiaLetras(prov: BrokerId, ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const v = ventanaDeVencimiento('letra', ctx.horizonteMeses);
  const letras = (ctx.mercado?.letras?.valor ?? []).filter((l) => l.dias >= v.min && l.dias <= v.max).slice(0, 3);
  return {
    proveedor: prov,
    producto: 'letra',
    titulo: `Letras del Tesoro en ${nombre}`,
    pasos: [
      pasoDonde(nombre, 'broker', ctx.tieneCuenta),
      pasoPlata(nombre, 'broker'),
      {
        id: 'elegir',
        titulo: 'Elegí la letra',
        haces: 'Entrá a “Renta fija” (o “Letras”) y elegí una.',
        puntos: ['Cada una tiene un vencimiento: elegí uno cercano a cuando vas a usar la plata', 'El nombre ya dice la fecha: S13N6 vence el 13/11/2026', 'Se puede vender antes, pero el precio puede ser menor', 'Mirá que se opere seguido'],
        datos: letras.map((l) => ({ etiqueta: `${l.ticker} (vence ${diaMes(l.vencimiento)})`, valor: `${pct(l.tem * 100, 2)} por mes` })),
      },
      {
        id: 'comprar',
        titulo: 'Comprala',
        haces: 'Tocá “Comprar”, poné el monto y confirmá. Si te pregunta el tipo de orden, elegí “a precio de mercado”.',
        puntos: ['Antes de confirmar ves cuántas comprás y el precio', 'Tu ganancia es la diferencia entre lo que pagás hoy y lo que cobrás al vencimiento'],
        datos: filaMonto(ctx.monto),
        chequeo: 'La letra aparece en “Mi cartera” con su fecha de vencimiento.',
      },
      pasoCierre('Antes de finalizar', 'Podés esperar al vencimiento (el Estado paga solo y la plata entra a tu cuenta) o venderla antes con “Vender”.', [
        'Si vendés antes, el precio puede ser menor',
        'Conviene esperar al vencimiento si no necesitás la plata',
      ]),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Dónde están las letras en el menú de la app.',
      'Qué tipos de orden ofrece y cuál es el predeterminado.',
      'Si cobra comisión por comprar o por mantener.',
    ],
  };
}

function guiaBonoCer(prov: BrokerId, ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const v = ventanaDeVencimiento('bono_cer', ctx.horizonteMeses);
  const bonos = [...(ctx.mercado?.bonosCer?.valor ?? [])].filter((b) => b.volumen > 0 && b.dias >= v.min && b.dias <= v.max).sort((a, b) => a.dias - b.dias).slice(0, 4);
  return {
    proveedor: prov,
    producto: 'bono_cer',
    titulo: `Bonos CER en ${nombre}`,
    pasos: [
      pasoDonde(nombre, 'broker', ctx.tieneCuenta),
      pasoPlata(nombre, 'broker'),
      {
        id: 'elegir',
        titulo: 'Elegí el bono',
        haces: 'Entrá a “Renta fija” (o “Bonos”) y buscá los bonos “CER” (o “ajustables por CER”).',
        puntos: ['Cada uno tiene un vencimiento: elegí uno cercano a cuando vas a usar la plata', 'La TIR es lo que rinde por encima de la inflación', 'Si lo vendés antes, el precio puede ser menor', 'Mirá cuánto se opera: si casi no se opera, cuesta venderlo'],
        datos: bonos.map((b) => ({ etiqueta: `${b.ticker} (vence ${diaMes(b.vencimiento)})`, valor: `inflación + ${pct(b.tir * 100, 1)} por año` })),
      },
      {
        id: 'comprar',
        titulo: 'Comprá',
        haces: 'Tocá “Comprar”, poné el monto o la cantidad y confirmá. Si te pregunta el tipo de orden, elegí “a precio de mercado”.',
        puntos: ['Antes de confirmar ves cuántos nominales recibís y el costo total, con la comisión'],
        datos: filaMonto(ctx.monto),
        chequeo: 'El bono aparece en “Mi cartera” con su vencimiento.',
      },
      pasoCierre('Antes de finalizar', 'Podés esperar al vencimiento (el Estado paga solo) o venderlo antes con “Vender”.', [
        'Si vendés antes, el precio puede ser menor al que pagaste',
        'Elegí un vencimiento que coincida con cuándo necesitás la plata',
      ]),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Dónde están los bonos CER en el menú de la app.',
      'Si se compra por monto o por cantidad de nominales.',
      'Qué comisión cobra por comprar y por mantener.',
    ],
  };
}

// ── dólar MEP ────────────────────────────────────────────────────────────
function guiaDolar(prov: BrokerId, ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const mep = ctx.mercado?.dolar.mep?.valor ?? null;
  const datos = [
    ...(mep ? [{ etiqueta: 'Dólar MEP hoy', valor: fmtPesos(mep) }] : []),
    ...(ctx.monto && mep ? [{ etiqueta: `Con ${fmtPesos(ctx.monto)} comprás aproximadamente`, valor: `US$ ${(ctx.monto / mep).toLocaleString('es-AR', { maximumFractionDigits: 2 })}` }] : []),
  ];
  return {
    proveedor: prov,
    producto: 'dolar',
    titulo: `Dólar MEP en ${nombre}`,
    pasos: [
      pasoDonde(nombre, 'broker', ctx.tieneCuenta),
      pasoPlata(nombre, 'broker'),
      {
        id: 'comprar',
        titulo: 'Comprá dólar MEP',
        haces: 'Buscá “Dólar MEP” (suele ser un botón directo), poné cuánto querés comprar y confirmá.',
        puntos: ['Ves el precio por dólar y cuántos recibís'],
        datos,
        widget: 'dolares',
        chequeo: 'Tu cuenta muestra un saldo en dólares. A veces tarda hasta un día hábil.',
      },
      pasoCierre('Antes de finalizar', 'Para volver a pesos, vendé los dólares desde la misma opción. También podés transferirlos a una cuenta en dólares de tu banco.', [
        'Su precio en pesos sube y baja',
      ]),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Si “Dólar MEP” es un botón directo o hay que comprar un bono.',
      'Cuánto tarda en acreditarse y si hay un tiempo mínimo antes de poder vender.',
    ],
  };
}

// ── CEDEARs ──────────────────────────────────────────────────────────────
function guiaCedear(prov: BrokerId, ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const ticker = ctx.ticker;
  const precio = ticker ? precioCedear(ctx.mercado, ticker) : null;
  const cantidad = ctx.cantidad;
  return {
    proveedor: prov,
    producto: 'cedear',
    titulo: `CEDEARs en ${nombre}`,
    pasos: [
      pasoDonde(nombre, 'broker', ctx.tieneCuenta),
      pasoPlata(nombre, 'broker'),
      {
        id: 'elegir',
        titulo: 'Elegí cuál comprar',
        haces: 'Elegí el CEDEAR y cuántos querés. Se compran de a uno entero.',
        puntos: ['Un ETF como SPY o QQQ reparte el riesgo entre muchas empresas', 'Después lo buscás en “Mercado” → “CEDEARs”'],
        widget: 'cedear',
      },
      {
        id: 'comprar',
        titulo: ticker ? `Comprá ${ticker}` : 'Comprá',
        haces: `Tocá “Comprar”${cantidad ? ` y poné ${cantidad} ${cantidad === 1 ? 'unidad' : 'unidades'}` : ' y poné cuántos'}.`,
        puntos: ['Fijate la comisión: es un % de lo que operás', 'Solo se ejecuta con el mercado abierto (lunes a viernes, de 11 a 17 hs): fuera de horario la orden espera'],
        datos: [
          ...(cantidad ? [{ etiqueta: 'Cantidad', valor: String(cantidad) }] : []),
          ...(cantidad && precio ? [{ etiqueta: 'Costo aproximado', valor: fmtPesos(cantidad * precio) }] : []),
        ],
        chequeo: 'El CEDEAR aparece en “Mi cartera” con la cantidad que compraste.',
      },
      pasoCierre('Antes de finalizar', 'Podés vender cuando quieras, con el mercado abierto. Los pesos llegan en 1 o 2 días hábiles.', [
        'Conviene vender si necesitás la plata, si llegaste a tu objetivo o si cambió lo que te hizo comprar',
        'No conviene vender solo porque bajó: se concreta la pérdida',
        'Mover seguido suma comisiones',
      ]),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Cómo se llama la sección de CEDEARs.',
      'La comisión de compra y de mantenimiento.',
      'Si permite comprar por monto o solo por cantidad entera.',
    ],
  };
}

// ── plazo fijo ───────────────────────────────────────────────────────────
function guiaPlazoFijo(uva: boolean, ctx: ContextoGuia): Guia {
  const nombreBanco = ctx.banco ? nombrePropio(ctx.banco) : 'tu banco';
  const tna = tasaDeBanco(ctx.mercado, ctx.banco, ctx.plazoDias);
  const extra = uva ? extraUva(ctx.mercado, ctx.banco, ctx.plazoDias) : null;
  const interes = ctx.monto && tna && ctx.plazoDias ? ctx.monto * tna * (ctx.plazoDias / 365) : null;
  const donde = pasoDonde(nombreBanco, 'banco', ctx.tieneCuenta);
  return {
    proveedor: 'banco',
    producto: uva ? 'plazo_fijo_uva' : 'plazo_fijo',
    titulo: uva ? 'Plazo fijo UVA' : 'Plazo fijo',
    pasos: [
      // Entre los bancos la regla es una sola: a mayor tasa, mejor.
      { ...donde, puntos: donde.puntos ?? (!uva && ctx.tieneCuenta === null ? ['A mayor tasa, mejor'] : undefined) },
      pasoPlata(nombreBanco, 'banco'),
      {
        id: 'constituir',
        titulo: uva ? 'Hacé el plazo fijo UVA' : 'Hacé el plazo fijo',
        haces: uva
          ? 'En la app o la web buscá “Inversiones” → “Plazo fijo” → “UVA”.'
          : 'En la app o la web buscá “Inversiones” → “Plazo fijo” → “Constituir”.',
        puntos: uva
          ? ['Elegí el plazo (mínimo 90 días) y poné el monto', 'Decidí si se renueva solo al vencer', 'Antes de confirmar ves la fecha de vencimiento']
          : ['Elegí el plazo y poné el monto', 'Decidí si se renueva solo al vencer', 'Antes de confirmar ves cuánto vas a cobrar y cuándo'],
        datos: [
          ...(ctx.plazoDias ? [{ etiqueta: 'Plazo', valor: `${ctx.plazoDias} días` }] : []),
          ...(!uva && tna ? [{ etiqueta: 'Tasa de hoy', valor: `${pct(tna * 100, 1)} anual (TNA)` }] : []),
          ...(uva && extra !== null ? [{ etiqueta: 'Extra sobre la UVA', valor: `${pct(extra * 100, 2)} anual` }] : []),
          ...(!uva && interes ? [{ etiqueta: 'Interés aproximado', valor: fmtPesos(interes) }] : []),
        ],
        widget: 'plazo',
        chequeo: 'Tenés el comprobante con el monto, la tasa y el vencimiento (el día en que termina el plazo).',
      },
      pasoRegistrar(),
    ],
    porVerificar: [
      'Dónde está “Plazo fijo” en la app del banco y cómo se llama la opción UVA.',
      'El monto mínimo para hacerlo.',
      uva ? 'Qué adicional sobre la UVA paga el banco.' : 'Si ofrece la opción precancelable y con qué tasa.',
    ],
  };
}

/** La guía para este producto en este proveedor, con los datos de hoy. null si esa combinación no existe. */
export function armarGuia(proveedor: ProveedorId, producto: ProductoId, ctx: ContextoGuia): Guia | null {
  if (producto === 'cuenta_remunerada' && (proveedor === 'otra_cuenta' || PROVEEDORES[proveedor].productos[producto])) return guiaCuenta(proveedor, ctx);
  if (!PROVEEDORES[proveedor].productos[producto]) return null;
  switch (`${proveedor}:${producto}`) {
    case 'cocos:fci': return guiaFondoBroker('cocos', ctx);
    case 'balanz:fci': return guiaFondoBroker('balanz', ctx);
    case 'banco:plazo_fijo': return guiaPlazoFijo(false, ctx);
    case 'banco:plazo_fijo_uva': return guiaPlazoFijo(true, ctx);
    default: break;
  }
  // Los demás brokers comparten los mismos pasos: cambia el nombre de la app y dónde está cada botón.
  if (PROVEEDORES[proveedor].tipo === 'broker') {
    const broker = proveedor as BrokerId;
    if (producto === 'letra') return guiaLetras(broker, ctx);
    if (producto === 'bono_cer') return guiaBonoCer(broker, ctx);
    if (producto === 'dolar') return guiaDolar(broker, ctx);
    if (producto === 'cedear') return guiaCedear(broker, ctx);
  }
  return null;
}

/**
 * Lo que el registro trae ya completado a partir de lo que se decidió en los pasos. Así lo que se pregunta al
 * registrar es consistente con lo que se hizo: la persona sólo completa lo que no se puede saber de afuera.
 */
export function previosParaRegistro(proveedor: ProveedorId, producto: ProductoId, ctx: ContextoGuia): Partial<Valores> {
  const prov = PROVEEDORES[proveedor];
  const base: Partial<Valores> = {};
  const entero = (n: number) => Math.round(n).toLocaleString('es-AR');
  const decimal = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 4 });

  switch (producto) {
    case 'cuenta_remunerada':
      base.proveedor = proveedor === 'otra_cuenta' ? nombreCuenta(ctx.banco ?? '') : prov.nombre;
      if (ctx.monto) base.monto = entero(ctx.monto);
      break;
    case 'fci':
      base.proveedor = prov.nombre;
      base.fondo = FONDOS_POR_PROVEEDOR[proveedor]?.nombre ?? '';
      base.tipoFondo = 'money_market';
      base.clase = 'A';
      if (ctx.monto) base.monto = entero(ctx.monto);
      break;
    case 'plazo_fijo':
    case 'plazo_fijo_uva': {
      base.proveedor = ctx.banco ? nombrePropio(ctx.banco) : '';
      if (ctx.monto) base.monto = entero(ctx.monto);
      if (ctx.plazoDias) base.plazo = String(ctx.plazoDias);
      // La tasa (o, en el UVA, el extra) se trae sola cuando el banco la publica: no se le pide a la persona.
      const tna = producto === 'plazo_fijo' ? tasaDeBanco(ctx.mercado, ctx.banco, ctx.plazoDias) : extraUva(ctx.mercado, ctx.banco, ctx.plazoDias);
      if (tna !== null) base.tna = decimal(tna * 100);
      break;
    }
    case 'dolar': {
      base.proveedor = prov.nombre;
      const mep = ctx.mercado?.dolar.mep?.valor;
      const usd = ctx.dolares ?? (ctx.monto && mep ? ctx.monto / mep : null);
      if (usd) base.cantidad = decimal(Math.round(usd * 100) / 100);
      if (mep) base.precio = entero(mep);
      base.tipo = 'mep';
      break;
    }
    case 'cedear': {
      base.proveedor = prov.nombre;
      if (ctx.ticker) base.ticker = ctx.ticker;
      if (ctx.cantidad) base.cantidad = String(ctx.cantidad);
      const precio = ctx.ticker ? precioCedear(ctx.mercado, ctx.ticker) : null;
      if (precio) base.precio = entero(precio);
      break;
    }
    case 'bono_cer':
    case 'letra':
      base.proveedor = prov.nombre;
      if (ctx.monto) base.monto = entero(ctx.monto);
      if (producto === 'bono_cer' && ctx.ticker) base.ticker = ctx.ticker;
      break;
  }
  return base;
}

/**
 * Los datos del registro que ya se eligieron en los pasos: se muestran bloqueados, no se vuelven a pedir.
 * El monto, el precio y la fecha NO se bloquean: son de la persona.
 */
export function camposBloqueados(producto: ProductoId, previos: Partial<Valores>): string[] {
  const candidatos = ['proveedor', 'plazo', 'ticker', 'fondo', 'clase', 'tipoFondo', 'tipo', 'tna', ...(producto === 'cedear' ? ['cantidad'] : [])];
  return candidatos.filter((c) => !!previos[c]);
}
