// Los pasos para llegar de "quiero invertir" a "ya lo hice", uno por cada
// combinación de proveedor y producto.
//
// Cada paso responde cuatro cosas, en este orden, porque son las que de verdad
// frenan a alguien que nunca lo hizo:
//   · haces    — qué tenés que hacer, en una frase.
//   · loVes    — cómo se ve en la pantalla (nombres de secciones y botones).
//   · lograras — para qué sirve este paso, qué cambia en tu plata.
//   · chequeo  — cómo sabés que salió bien antes de pasar al siguiente.
//
// Reglas de redacción (FINA explica sin conocimiento previo):
//   · Toda palabra técnica lleva su aclaración entre paréntesis la primera vez.
//   · Lo que la persona eligió (monto, plazo, cuántos) va en filas de datos, no
//     metido dentro de las frases.
//   · Lo que se decide acá es lo mismo que después se pregunta al registrar
//     (ver `previosParaRegistro`): si para comprar un CEDEAR se eligió cuántos,
//     el registro ya trae cuántos y a qué precio.
//
// Los nombres de pantallas y botones salen de información pública y de cómo
// funcionan estas apps en general; no se pudieron verificar abriendo cada una.
// `porVerificar` lista lo que hay que confirmar en la app real.

import { PROVEEDORES, type BrokerId, type ProductoId, type ProveedorId } from './catalogo.js';
import { diaMes, fmtPesos, nombrePropio, pct } from './formato.js';
import { CEDEARS_DISPONIBLES, FONDOS_POR_PROVEEDOR, origenDeclarable, precioCedear } from './limites.js';
import { bancosOrdenados, type Evaluacion } from './motor.js';
import type { Mercado } from './mercadoTipos.js';
import type { Valores } from './registro.js';

export type PasoGuia = {
  id: string;
  titulo: string;
  haces: string;
  loVes: string;
  lograras: string;
  chequeo: string;
  /** Datos de hoy o lo que la persona eligió, listos para mostrar. */
  datos?: { etiqueta: string; valor: string }[];
  /** true en el último paso: lleva a registrar la inversión en FINA. */
  registra?: boolean;
  /** Si el paso mira una tasa en la app, se le pide a la persona que la anote: es un dato real para todos. */
  declara?: { tipo: 'cuenta_remunerada' | 'fci'; lugar: string; fondo: string };
};

export type Guia = {
  proveedor: ProveedorId;
  producto: ProductoId;
  titulo: string;
  /** Qué vas a tener al terminar, sin meter el monto adentro de la frase. */
  alTerminar: string;
  /** Cuánto lleva, en criollo. */
  tiempo: string;
  pasos: PasoGuia[];
  /** Cosas que hay que confirmar abriendo la app real (para quien mantiene FINA). */
  porVerificar: string[];
};

/** Lo que la persona decidió antes de empezar los pasos. */
export type ContextoGuia = {
  /** Pesos que va a invertir. En un CEDEAR sale de cantidad × precio; en dólares, de lo que eligió. */
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
  /** Banco elegido, si el producto es un plazo fijo. */
  banco: string | null;
};

export const CONTEXTO_VACIO: ContextoGuia = {
  monto: null, plazoDias: null, ticker: null, cantidad: null, dolares: null, mercado: null, evaluacion: null, banco: null,
};

const filaMonto = (m: number | null): { etiqueta: string; valor: string }[] => (m && m > 0 ? [{ etiqueta: 'Tu monto', valor: fmtPesos(m) }] : []);

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
function pasoCuentaBilletera(nombre: string): PasoGuia {
  return {
    id: 'cuenta',
    titulo: `Entrá a tu cuenta de ${nombre}`,
    haces: `Descargá la app de ${nombre} y entrá. Si no tenés cuenta, creala con tu DNI y una selfie.`,
    loVes: 'La app te pide tu número de celular, el frente y el dorso del DNI y una selfie para comprobar que sos vos. Lleva unos minutos.',
    lograras: 'Tener una cuenta a tu nombre. Es lo único que necesitás para poder ingresar plata y hacerla rendir.',
    chequeo: 'Ves tu pantalla de inicio con tu saldo.',
  };
}

function pasoCuentaBroker(nombre: string): PasoGuia {
  return {
    id: 'cuenta',
    titulo: `Abrí tu cuenta en ${nombre}`,
    haces: `Descargá la app de ${nombre} (un broker: una plataforma donde se compran y venden inversiones) y creá tu cuenta con tus datos, tu DNI y una selfie.`,
    loVes: 'Además de los datos, te hacen un test de perfil de inversor: unas preguntas para saber cuánto riesgo aceptás. No hay respuestas buenas ni malas; contestá lo que de verdad sentirías si tu plata bajara.',
    lograras: 'Una cuenta comitente: la cuenta, a tu nombre, donde se guardan tus inversiones. Es un trámite que se hace una sola vez.',
    chequeo: 'La app te dice que tu cuenta está aprobada. Puede tardar desde unos minutos hasta uno o dos días hábiles (días de semana sin feriados).',
  };
}

function pasoIngresar(nombre: string, monto: number | null, broker: boolean): PasoGuia {
  return {
    id: 'ingresar',
    titulo: `Pasá la plata a tu cuenta de ${nombre}`,
    haces: `Desde la app de tu banco, hacé una transferencia a tu cuenta de ${nombre}. La cuenta de origen tiene que estar a tu nombre.`,
    loVes: `En ${nombre} buscá “Ingresar dinero” (o “Depositar”). Te muestra un alias y un CVU o CBU (son como la “dirección” de tu cuenta para recibir transferencias): copialos, pegalos en la transferencia de tu banco y poné el monto.`,
    lograras: 'Tener la plata disponible para invertir. Todavía no está invertida: es plata tuya pasando de una cuenta tuya a otra.',
    chequeo: broker
      ? `Tu saldo en ${nombre} muestra el monto. Las transferencias suelen llegar al instante, pero a veces tardan hasta un día hábil (día de semana sin feriado).`
      : `Tu saldo en ${nombre} muestra el monto. Las transferencias llegan, por lo general, al instante.`,
    datos: filaMonto(monto),
  };
}

function pasoRegistrar(): PasoGuia {
  return {
    id: 'registrar',
    titulo: 'Anotala en FINA',
    haces: 'Cargá en FINA lo que acabás de hacer, con los datos que te muestra la app.',
    loVes: 'Te vamos a pedir lo mismo que acabás de hacer: el monto, la tasa y, si corresponde, la fecha de vencimiento (el día en que termina). También podés subir una captura y la leemos por vos.',
    lograras: 'Que FINA te cuente cuándo vence, cuánto vas ganando de verdad y qué alternativas tenés después. FINA no mueve ni toca tu plata: anotar es solo anotar.',
    chequeo: 'La inversión aparece en “Mis inversiones”.',
    registra: true,
  };
}

function pasoRescate(nombre: string, texto: string): PasoGuia {
  return {
    id: 'rescate',
    titulo: 'Sabé cómo sacarla antes de necesitarla',
    haces: texto,
    loVes: `Está en la misma sección de ${nombre} donde invertiste.`,
    lograras: 'Tranquilidad: saber de antemano cómo recuperar tu plata y cuánto tarda hace que no tengas que sacarla por miedo.',
    chequeo: 'Sabés cuál es el botón y cuántos días tarda.',
  };
}

// ── guías por combinación ────────────────────────────────────────────────
function guiaMercadoPago(ctx: ContextoGuia): Guia {
  const tasa = ctx.evaluacion?.detalle;
  return {
    proveedor: 'mercado_pago',
    producto: 'cuenta_remunerada',
    titulo: 'Rendimientos en Mercado Pago',
    alTerminar: 'Tu plata generando intereses todos los días en Mercado Pago, disponible cuando la necesites.',
    tiempo: 'Unos 10 minutos si ya tenés la cuenta; media hora si hay que crearla.',
    pasos: [
      pasoCuentaBilletera('Mercado Pago'),
      pasoIngresar('Mercado Pago', ctx.monto, false),
      {
        id: 'inversiones',
        titulo: 'Entrá a “Inversiones” y buscá Mercado Fondo',
        haces: 'En la pantalla de inicio de Mercado Pago tocá “Inversiones” y buscá “Mercado Fondo”.',
        loVes: 'La pantalla del fondo, con lo que rindió y un botón para invertir. Ojo: “Reservas” es otra cosa. Guarda tu plata, pero no genera intereses.',
        lograras: 'Mercado Fondo es un fondo de inversión de dinero (una bolsa de plata de muchas personas que se presta a muy corto plazo). Tu plata queda ahí, rinde todos los días y la podés retirar cuando quieras.',
        chequeo: 'Estás en la pantalla de Mercado Fondo.',
      },
      {
        id: 'invertir',
        titulo: 'Invertí tu plata',
        haces: 'Tocá “Invertir” (puede decir “Suscribir”, que es comprar cuotapartes: los pedacitos del fondo), poné el monto y confirmá.',
        loVes: 'La app te muestra cuánto vas a invertir y de qué saldo sale.',
        lograras: 'Tu plata pasa a ser cuotapartes del fondo y empieza a rendir desde el día siguiente.',
        chequeo: 'En “Inversiones” ves tu monto invertido.',
        datos: filaMonto(ctx.monto),
      },
      {
        id: 'tasa',
        titulo: 'Mirá cuánto rinde',
        haces: 'En la pantalla del fondo fijate el porcentaje anual que te muestran (puede llamarse TNA o TEA: es cuánto rinde en un año).',
        loVes: 'Un porcentaje junto a “Rinde” o “Rendimiento”. Cambia de un día para el otro.',
        lograras: 'Saber con qué número arrancás, y poder compararlo con otras opciones.',
        chequeo: 'Anotaste el porcentaje: lo vas a cargar en FINA.',
        datos: tasa ? [{ etiqueta: 'Lo que vemos hoy', valor: tasa }] : undefined,
        declara: origenDeclarable('cuenta_remunerada', 'mercado_pago', 'Mercado Pago') ?? undefined,
      },
      pasoRescate('Mercado Pago', 'Cuando la necesites: entrá a Mercado Fondo desde “Inversiones” y tocá “Rescatar” (o “Retirar”: pedir que te devuelvan la plata). Vuelve a tu saldo en el momento o en el día.'),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Cómo se llama el botón para invertir en Mercado Fondo.',
      'Si el saldo de “Pesos” rinde solo o hay que pasarlo a Mercado Fondo.',
      'Cuánto tarda el rescate.',
    ],
  };
}

function guiaCuentaAutomatica(prov: 'uala' | 'naranja_x', ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const notas = ctx.evaluacion?.notas ?? [];
  const pasos: PasoGuia[] = [
    pasoCuentaBilletera(nombre),
    pasoIngresar(nombre, ctx.monto, false),
    {
      id: 'saldo',
      titulo: 'Dejá el saldo en la cuenta',
      haces: 'No hay que activar nada: el saldo que tenés en la cuenta rinde solo.',
      loVes: 'Entrá a la sección de rendimientos o de tu saldo y buscá la tasa (el interés que te pagan) y las condiciones.',
      lograras: 'Que tu plata genere intereses mientras la tenés quieta, sin comprar ningún producto. Ojo: tu saldo cambia con lo que cobrás y pagás, y la tasa se aplica sobre el saldo de cada día; la tasa también puede cambiar y depende de las condiciones de cada billetera.',
      chequeo: 'Ves el rendimiento diario en tu cuenta.',
      datos: notas.map((n) => ({ etiqueta: 'Condiciones de hoy', valor: n })),
      declara: origenDeclarable('cuenta_remunerada', prov, nombre) ?? undefined,
    },
  ];
  if (prov === 'uala') {
    pasos.push({
      id: 'niveles',
      titulo: 'Entendé los niveles de tasa',
      haces: 'Ualá paga más si hacés determinadas operaciones al mes. Fijate si te conviene llegar a ese nivel o si con el básico alcanza.',
      loVes: 'En la sección de rendimientos (o “Ualá Plus”) figura qué tenés que hacer para subir de nivel.',
      lograras: 'No resignar tasa sin darte cuenta, ni cambiar tus hábitos solo por subir un escalón.',
      chequeo: 'Sabés en qué nivel estás y qué te pide el siguiente.',
    });
  }
  pasos.push(pasoRescate(nombre, 'Tu plata sigue disponible como saldo: la usás normal o la transferís a tu banco.'), pasoRegistrar());
  return {
    proveedor: prov,
    producto: 'cuenta_remunerada',
    titulo: `Cuenta remunerada en ${nombre}`,
    alTerminar: `Tu plata rindiendo todos los días en tu cuenta de ${nombre}, disponible cuando la necesites.`,
    tiempo: 'Unos 10 minutos si ya tenés la cuenta; media hora si hay que crearla.',
    pasos,
    porVerificar: [
      'Dónde se ve la tasa dentro de la app.',
      'Si el rendimiento es automático o hay que activarlo.',
      ...(prov === 'uala' ? ['Cómo se llaman hoy los niveles (Plus 1, Plus 2).'] : []),
    ],
  };
}

function guiaFondoBroker(prov: 'cocos' | 'balanz', ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const fondo = FONDOS_POR_PROVEEDOR[prov]?.nombre ?? 'el fondo';
  return {
    proveedor: prov,
    producto: 'fci',
    titulo: `Fondo común de inversión en ${nombre}`,
    alTerminar: `Tu plata invertida en el fondo ${fondo}: un fondo que presta a muy corto plazo y del que podés retirar tu plata en pocos días.`,
    tiempo: 'Uno o dos días para que aprueben la cuenta; después, 10 minutos.',
    pasos: [
      pasoCuentaBroker(nombre),
      pasoIngresar(nombre, ctx.monto, true),
      {
        id: 'buscar',
        titulo: `Buscá el fondo ${fondo}`,
        haces: `Entrá a “Fondos” (o “Fondos comunes”) y buscá “${fondo}”. Elegí la versión en pesos.`,
        loVes: 'Una pantalla con el nombre del fondo, lo que rindió, en cuánto tiempo podés sacar tu plata (plazo de rescate) y el riesgo. Si hay varias “clases” (A, B, C…), la clase cambia las comisiones y quién puede entrar; para una persona común suele ser la A.',
        lograras: 'Elegir con los ojos abiertos: ya sabés dónde queda tu plata (en un fondo que presta a muy corto plazo) y cuánto tarda en volver.',
        chequeo: 'Estás en la pantalla del fondo y viste en cuánto tiempo podés sacar tu plata (el plazo de rescate).',
        datos: ctx.evaluacion ? [{ etiqueta: 'Lo que rindió', valor: ctx.evaluacion.detalle }] : undefined,
        declara: origenDeclarable('fci', prov, nombre) ?? undefined,
      },
      {
        id: 'suscribir',
        titulo: 'Comprá cuotapartes (pedacitos del fondo)',
        haces: 'Tocá “Suscribir” (o “Comprar”: así se compran las cuotapartes, los pedacitos del fondo), poné el monto y confirmá.',
        loVes: 'La app te muestra el valor de cada cuotaparte (cada pedacito del fondo) y cuántas vas a recibir. Es solo informativo: el valor exacto se fija al cierre del día.',
        lograras: 'Tu plata pasa a ser cuotapartes del fondo. Desde el día siguiente empieza a rendir.',
        chequeo: 'En la pantalla donde ves lo que tenés invertido (“Mi cartera” o “Tenencias”) aparece el fondo con tu monto.',
        datos: filaMonto(ctx.monto),
      },
      pasoRescate(nombre, 'Cuando necesites la plata: tocá “Rescatar” (pedir que te devuelvan la plata) en la pantalla del fondo, elegí cuánto y confirmá. Vuelve a tu cuenta en 0 a 2 días hábiles (de lunes a viernes, sin feriados).'),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Que el menú se llame “Fondos” y cómo se llama el botón de compra.',
      `Que el fondo figure como ${fondo} y qué clase se ofrece a una persona común.`,
      'El plazo de rescate real del fondo.',
    ],
  };
}

function guiaLetras(prov: BrokerId, ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const letras = (ctx.mercado?.letras?.valor ?? []).filter((l) => l.dias >= 15 && l.dias <= 200).slice(0, 3);
  return {
    proveedor: prov,
    producto: 'letra',
    titulo: `Letras del Tesoro en ${nombre}`,
    alTerminar: 'Tu plata prestada al Estado hasta una fecha que elegís, con un rendimiento que ya conocés al comprar.',
    tiempo: 'Uno o dos días para la cuenta; después, 15 minutos.',
    pasos: [
      pasoCuentaBroker(nombre),
      pasoIngresar(nombre, ctx.monto, true),
      {
        id: 'elegir',
        titulo: 'Elegí hasta cuándo dejás la plata',
        haces: 'Entrá a “Renta fija” (o “Letras”) y fijate las letras disponibles. Cada una tiene una fecha de vencimiento (el día en que el Estado te devuelve la plata).',
        loVes: 'Una lista con el nombre de cada letra (ticker, su código), cuánto rinde por mes y cuándo vence. El nombre ya indica la fecha: S13N6 vence el 13 de noviembre de 2026.',
        lograras: 'Elegir un plazo que coincida con cuándo pensás usar la plata, así no necesitás venderla antes.',
        chequeo: 'Elegiste una letra que vence después de cuando podrías necesitar la plata.',
        datos: letras.map((l) => ({ etiqueta: `${l.ticker} (vence ${diaMes(l.vencimiento)})`, valor: `${pct(l.tem * 100, 2)} por mes` })),
      },
      {
        id: 'comprar',
        titulo: 'Comprala',
        haces: 'Tocá “Comprar”, poné el monto y confirmá. Si te pregunta el tipo de orden, elegí “a precio de mercado” (se compra al precio del momento).',
        loVes: 'Antes de confirmar la app muestra cuántas letras comprás y el precio. La ganancia es la diferencia entre lo que pagás hoy y lo que cobrás al vencimiento.',
        lograras: 'Le prestás tu plata al Estado hasta el vencimiento y ya sabés cuánto vas a cobrar, siempre que esperes hasta esa fecha. Está garantizada por el Tesoro de la Nación (no por un seguro de depósitos) y la podés vender antes si necesitás la plata.',
        chequeo: 'La letra aparece en “Mi cartera” (lo que tenés invertido) con su fecha de vencimiento.',
        datos: filaMonto(ctx.monto),
      },
      pasoRescate(nombre, 'Podés esperar al vencimiento (el Estado paga solo y la plata entra a tu cuenta) o venderla antes: tocá “Vender” en la letra. Si vendés antes, el precio puede ser menor al esperado.'),
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
  const bonos = [...(ctx.mercado?.bonosCer?.valor ?? [])].filter((b) => b.volumen > 0).sort((a, b) => a.dias - b.dias).slice(0, 4);
  return {
    proveedor: prov,
    producto: 'bono_cer',
    titulo: `Bonos CER en ${nombre}`,
    alTerminar: 'Tu plata prestada al Estado hasta un vencimiento, ajustada por la inflación más un extra que ya conocés al comprar.',
    tiempo: 'Uno o dos días para la cuenta; después, 15 minutos.',
    pasos: [
      pasoCuentaBroker(nombre),
      pasoIngresar(nombre, ctx.monto, true),
      {
        id: 'elegir',
        titulo: 'Elegí hasta cuándo dejás la plata',
        haces: 'Entrá a “Renta fija” (o “Bonos”) y buscá los bonos “CER” (o “ajustables por CER”). Cada uno tiene un vencimiento.',
        loVes: 'Una lista con el nombre de cada bono (ticker, su código), su precio, lo que rinde por encima de la inflación (TIR) y cuándo vence. Fijate también cuánto se opera: si casi no se opera, cuesta venderlo antes.',
        lograras: 'Elegir un bono que venza cuando pensás usar la plata, así no necesitás venderlo antes. Si lo vendés antes, el precio puede ser menor.',
        chequeo: 'Elegiste un bono que vence después de cuando podrías necesitar la plata y que se opera todos los días.',
        datos: bonos.map((b) => ({ etiqueta: `${b.ticker} (vence ${diaMes(b.vencimiento)})`, valor: `inflación + ${pct(b.tir * 100, 1)} por año` })),
      },
      {
        id: 'comprar',
        titulo: 'Comprá',
        haces: 'Tocá “Comprar”, poné el monto o la cantidad y confirmá. Si te pregunta el tipo de orden, elegí “a precio de mercado” (se compra al precio del momento).',
        loVes: 'Antes de confirmar la app muestra cuántos nominales (la unidad en que se compran) recibís y el costo total, con la comisión.',
        lograras: 'Le prestás tu plata al Estado: tu capital se ajusta con la inflación y cobrás un extra, siempre que esperes hasta el vencimiento. Lo respalda el Tesoro de la Nación.',
        chequeo: 'El bono aparece en “Mi cartera” (lo que tenés invertido) con su vencimiento.',
        datos: filaMonto(ctx.monto),
      },
      pasoRescate(nombre, 'Podés esperar al vencimiento (el Estado paga solo) o venderlo antes: tocá “Vender”. Si vendés antes, el precio puede ser menor al que pagaste: por eso conviene elegir un vencimiento que coincida con cuándo necesitás la plata.'),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Dónde están los bonos CER en el menú de la app.',
      'Si se compra por monto o por cantidad de nominales.',
      'Qué comisión cobra por comprar y por mantener.',
    ],
  };
}

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
    alTerminar: `Tus pesos pasados a dólares y guardados a tu nombre en ${nombre}.`,
    tiempo: 'Uno o dos días para la cuenta; después, 10 minutos.',
    pasos: [
      pasoCuentaBroker(nombre),
      pasoIngresar(nombre, ctx.monto, true),
      {
        id: 'comprar',
        titulo: 'Comprá dólar MEP',
        haces: 'Buscá la opción “Dólar MEP” (en estos brokers suele ser un botón directo), poné cuánto querés comprar y confirmá.',
        loVes: 'La app te muestra el precio en pesos por cada dólar y cuántos dólares vas a recibir.',
        lograras: 'Cambiás pesos por dólares de forma legal. Eso cuida tus ahorros si el dólar sube, pero no genera ningún interés.',
        chequeo: 'Tu cuenta muestra un saldo en dólares. A veces tarda hasta un día hábil (día de semana sin feriado).',
        datos,
      },
      pasoRescate(nombre, 'Para volver a pesos, vendé los dólares desde la misma opción. También podés transferirlos a una cuenta en dólares de tu banco.'),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Si “Dólar MEP” es un botón directo o hay que comprar un bono.',
      'Cuánto tarda en acreditarse y si hay un tiempo mínimo antes de poder vender.',
    ],
  };
}

function guiaCedear(prov: BrokerId, ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const ticker = ctx.ticker ?? 'SPY';
  const info = CEDEARS_DISPONIBLES.find((c) => c.ticker === ticker);
  const precio = precioCedear(ctx.mercado, ticker);
  const cantidad = ctx.cantidad;
  const datosBuscar = [
    ...(info ? [{ etiqueta: `${ticker} es`, valor: info.explicacion }] : []),
    ...(precio ? [{ etiqueta: 'Precio de uno hoy', valor: fmtPesos(precio) }] : []),
  ];
  return {
    proveedor: prov,
    producto: 'cedear',
    titulo: `CEDEARs en ${nombre}`,
    alTerminar: `Un pedacito de ${info ? info.nombre : 'una empresa grande del exterior'} (un CEDEAR) guardado a tu nombre en ${nombre}, para dejar varios años.`,
    tiempo: 'Uno o dos días para la cuenta; después, 15 minutos.',
    pasos: [
      pasoCuentaBroker(nombre),
      pasoIngresar(nombre, ctx.monto, true),
      {
        id: 'buscar',
        titulo: `Buscá ${ticker}`,
        haces: `En “Mercado” → “CEDEARs” buscá “${ticker}”. El ticker (el código corto de cada inversión) es como un apodo.`,
        loVes: 'La pantalla con el precio en pesos de uno solo. Los CEDEARs se compran de a uno entero: no se pueden comprar pedacitos.',
        lograras: info ? `Encontrar ${info.explicacion}.` : 'Encontrar la inversión que elegiste.',
        chequeo: `Estás en la pantalla de ${ticker} y ves su precio.`,
        datos: datosBuscar,
      },
      {
        id: 'comprar',
        titulo: 'Comprá',
        haces: `Tocá “Comprar”${cantidad ? ` y poné ${cantidad} ${cantidad === 1 ? 'unidad' : 'unidades'}` : ' y elegí cuántos'}. Fijate la comisión (lo que cobra el broker) antes de confirmar.`,
        loVes: 'La app te muestra el costo total, con la comisión incluida. Solo se ejecuta cuando el mercado está abierto (de lunes a viernes, más o menos de 11 a 17 hs): si lo hacés fuera de ese horario, la orden queda esperando hasta que abra.',
        lograras: 'Empezar a participar del crecimiento de esa empresa. El precio va a subir y bajar todos los días: lo que importa es el largo plazo. No es para comprar cuando sube ni para vender asustándote cuando cae.',
        chequeo: 'El CEDEAR aparece en “Mi cartera” (lo que tenés invertido) con la cantidad que compraste.',
        datos: [
          ...(cantidad ? [{ etiqueta: 'Cantidad', valor: String(cantidad) }] : []),
          ...(cantidad && precio ? [{ etiqueta: 'Costo aproximado', valor: fmtPesos(cantidad * precio) }] : []),
        ],
      },
      pasoRescate(nombre, 'Podés vender cuando quieras, pero solo cuando el mercado está abierto, y los pesos llegan en uno o dos días hábiles (de lunes a viernes, sin feriados). Si vendés cuando está más bajo que cuando compraste, esa pérdida queda concretada: por eso es para plata que no vas a necesitar pronto.'),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Cómo se llama la sección de CEDEARs.',
      'La comisión de compra y de mantenimiento.',
      'Si permite comprar por monto o solo por cantidad entera.',
    ],
  };
}

function guiaPlazoFijo(uva: boolean, ctx: ContextoGuia): Guia {
  const lista = ctx.mercado ? bancosOrdenados(ctx.mercado) : [];
  const elegido = ctx.banco ? lista.find((b) => b.entidad === ctx.banco) : undefined;
  // Para quien nunca lo hizo, primero los bancos: una compañía financiera es válida pero menos conocida.
  const tops = [...lista]
    .sort((a, b) => Number(/FINANCIERA/i.test(a.entidad)) - Number(/FINANCIERA/i.test(b.entidad)))
    .slice(0, 3)
    .map((b) => ({ etiqueta: nombrePropio(b.entidad), valor: `${pct(b.tna * 100, 1)} anual a 30 días` }));
  const nombreBanco = ctx.banco ? nombrePropio(ctx.banco) : 'tu banco';
  const tna = tasaDeBanco(ctx.mercado, ctx.banco, ctx.plazoDias);
  const interes = ctx.monto && tna && ctx.plazoDias ? ctx.monto * tna * (ctx.plazoDias / 365) : null;
  return {
    proveedor: 'banco',
    producto: uva ? 'plazo_fijo_uva' : 'plazo_fijo',
    titulo: uva ? 'Plazo fijo UVA' : 'Plazo fijo',
    alTerminar: uva
      ? 'Tu plata prestada al banco por 90 días o más, actualizada con la inflación (lo que suben los precios).'
      : 'Tu plata prestada al banco por un plazo, con una ganancia que ya conocés al confirmar.',
    tiempo: '10 minutos desde la app de tu banco.',
    pasos: [
      {
        id: 'banco',
        titulo: 'Elegí en qué banco',
        haces: 'Lo más simple es usar el banco donde ya tenés cuenta. Comparalo con los de abajo: a veces la diferencia es de uno o dos puntos.',
        loVes: 'Las tasas son para clientes del banco. Si te conviene más otro, abrir una cuenta suele ser gratis y online.',
        lograras: 'No dejar plata de más sin ganar. Una diferencia de 3 puntos de tasa en $100.000 son unos $250 por mes.',
        chequeo: 'Sabés qué banco vas a usar y qué tasa te da.',
        datos: elegido ? [{ etiqueta: nombreBanco, valor: `${pct(elegido.tna * 100, 1)} anual a 30 días` }] : tops,
      },
      {
        id: 'plata',
        titulo: 'Tené la plata disponible en tu cuenta',
        haces: 'Fijate que el monto esté en la cuenta del banco desde donde vas a hacer el plazo fijo. Si está en otro banco o en una billetera, pasalo con una transferencia: la cuenta de origen tiene que estar a tu nombre.',
        loVes: 'En la app del banco ves tu saldo disponible. Las transferencias entre cuentas tuyas suelen llegar al instante.',
        lograras: 'Poder hacer el plazo fijo sin trabas: el banco solo toma plata que ya está en tu cuenta.',
        chequeo: 'Tu saldo en el banco alcanza para el monto que elegiste.',
        datos: filaMonto(ctx.monto),
      },
      {
        id: 'constituir',
        titulo: uva ? 'Hacé el plazo fijo UVA' : 'Hacé el plazo fijo',
        haces: uva
          ? 'En la app o la web del banco buscá “Inversiones” → “Plazo fijo” → “UVA” y elegí un plazo de 90 días o más.'
          : 'En la app o la web del banco buscá “Inversiones” → “Plazo fijo” → “Constituir” (hacerlo) y elegí el plazo en días.',
        loVes: 'Te pide el monto, el plazo y si querés que se renueve solo al vencer (cuando termina el plazo). Antes de confirmar te muestra cuánto vas a cobrar y en qué fecha.',
        lograras: uva
          ? 'Tu plata se actualiza con la inflación (lo que suben los precios) durante el plazo. Protege lo que ahorraste, no está pensado para ganarle por mucho. Los bancos lo dicen como “UVA + 2”: ese 2 es el extra, los puntos por encima de la inflación. A veces el banco limita este producto, así que preguntalo.'
          : 'Bloquear tu plata hasta la fecha a una tasa que ya conocés. Si elegís que NO se renueve solo, decidís de nuevo cada vez con la tasa del momento.',
        chequeo: 'Tenés el comprobante con el monto, la tasa y el vencimiento (el día en que termina el plazo).',
        datos: [
          ...filaMonto(ctx.monto),
          ...(ctx.plazoDias ? [{ etiqueta: 'Plazo', valor: `${ctx.plazoDias} días` }] : []),
          ...(!uva && tna ? [{ etiqueta: 'Tasa de hoy', valor: `${pct(tna * 100, 1)} anual (TNA)` }] : []),
          ...(!uva && interes ? [{ etiqueta: 'Vas a cobrar de interés aproximadamente', valor: fmtPesos(interes) }] : []),
        ],
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
  if (!PROVEEDORES[proveedor].productos[producto]) return null;
  switch (`${proveedor}:${producto}`) {
    case 'mercado_pago:cuenta_remunerada': return guiaMercadoPago(ctx);
    case 'uala:cuenta_remunerada': return guiaCuentaAutomatica('uala', ctx);
    case 'naranja_x:cuenta_remunerada': return guiaCuentaAutomatica('naranja_x', ctx);
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
 * Lo que el registro trae ya completado a partir de lo que se decidió en el paso
 * a paso. Así lo que se pregunta al registrar es consistente con lo que se hizo:
 * la persona sólo corrige lo que en la app real salió distinto.
 */
export function previosParaRegistro(proveedor: ProveedorId, producto: ProductoId, ctx: ContextoGuia): Partial<Valores> {
  const prov = PROVEEDORES[proveedor];
  const base: Partial<Valores> = {};
  const entero = (n: number) => Math.round(n).toLocaleString('es-AR');
  const decimal = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 4 });

  switch (producto) {
    case 'cuenta_remunerada':
      base.proveedor = prov.nombre;
      if (ctx.monto) base.monto = entero(ctx.monto);
      break;
    case 'fci':
      base.proveedor = prov.nombre;
      base.fondo = FONDOS_POR_PROVEEDOR[proveedor]?.nombre ?? '';
      base.clase = 'A';
      if (ctx.monto) base.monto = entero(ctx.monto);
      break;
    case 'plazo_fijo':
    case 'plazo_fijo_uva': {
      base.proveedor = ctx.banco ? nombrePropio(ctx.banco) : '';
      if (ctx.monto) base.monto = entero(ctx.monto);
      if (ctx.plazoDias) base.plazo = String(ctx.plazoDias);
      const tna = producto === 'plazo_fijo' ? tasaDeBanco(ctx.mercado, ctx.banco, ctx.plazoDias) : null;
      if (tna) base.tna = decimal(tna * 100);
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
