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
// Los pasos usan datos de mercado de HOY (tasa, precio, tope, mejor banco) y el
// monto que la persona eligió, así que no son un texto genérico: cambian con el
// mercado y con ella.
//
// IMPORTANTE: los nombres de pantallas y botones salen de información pública y
// de cómo funcionan estas apps en general, pero las apps cambian su interfaz
// seguido y NO se pudieron verificar abriendo cada una. Por eso cada guía lleva
// `porVerificar` (lo que hay que confirmar en la app real) y la pantalla ofrece
// un botón "no lo encuentro" en cada paso.

import { PROVEEDORES, PRODUCTOS, type ProductoId, type ProveedorId } from './catalogo';
import { diaMes, fmtPesos, nombrePropio, pct } from './formato';
import { bancosOrdenados, type Evaluacion } from './motor';
import type { Mercado } from './mercadoTipos';

export type PasoGuia = {
  id: string;
  titulo: string;
  haces: string;
  loVes: string;
  lograras: string;
  chequeo: string;
  /** Datos de hoy que acompañan al paso, listos para mostrar. */
  datos?: { etiqueta: string; valor: string }[];
  /** true en el último paso: lleva a registrar la inversión en FINA. */
  registra?: boolean;
};

export type Guia = {
  proveedor: ProveedorId;
  producto: ProductoId;
  titulo: string;
  /** Qué vas a tener al terminar, con tu monto. */
  alTerminar: string;
  /** Cuánto lleva, en criollo. */
  tiempo: string;
  pasos: PasoGuia[];
  /** Cosas que hay que confirmar abriendo la app real. */
  porVerificar: string[];
};

export type ContextoGuia = {
  monto: number | null;
  mercado: Mercado | null;
  evaluacion: Evaluacion | null;
  /** Banco elegido, si el producto es un plazo fijo. */
  banco?: string | null;
};

const montoTxt = (m: number | null): string => (m && m > 0 ? fmtPesos(m) : 'el monto que elegiste');

// ── pasos comunes ────────────────────────────────────────────────────────
function pasoCuentaBilletera(nombre: string): PasoGuia {
  return {
    id: 'cuenta',
    titulo: `Entrá a tu cuenta de ${nombre}`,
    haces: `Descargá la app de ${nombre} y entrá. Si no tenés cuenta, creala con tu DNI y una selfie.`,
    loVes: 'La app te pide tu número de celular, el frente y el dorso de tu DNI y una selfie para comprobar que sos vos. Lleva unos minutos.',
    lograras: 'Tener una cuenta a tu nombre. Es lo único que necesitás para poder ingresar plata e invertirla.',
    chequeo: 'Ves tu pantalla de inicio con tu saldo.',
  };
}

function pasoCuentaBroker(nombre: string): PasoGuia {
  return {
    id: 'cuenta',
    titulo: `Abrí tu cuenta de inversión en ${nombre}`,
    haces: `Descargá la app de ${nombre} y creá tu cuenta con tus datos, tu DNI y una selfie.`,
    loVes: 'Además de los datos, te hacen un test de perfil de inversor: unas preguntas sobre cuánto riesgo aceptás. No hay respuestas buenas ni malas; contestá lo que de verdad sentirías si tu plata bajara.',
    lograras: 'Una cuenta comitente: es la cuenta, a tu nombre, donde se guardan tus inversiones. Es un trámite que se hace una sola vez.',
    chequeo: `La app te dice que tu cuenta está aprobada. Puede tardar desde unos minutos hasta uno o dos días hábiles.`,
  };
}

function pasoIngresar(nombre: string, monto: number | null, broker: boolean): PasoGuia {
  return {
    id: 'ingresar',
    titulo: `Pasá ${montoTxt(monto)} a tu cuenta de ${nombre}`,
    haces: `Desde la app de tu banco, hacé una transferencia a tu cuenta de ${nombre}. La cuenta de origen tiene que estar a tu nombre.`,
    loVes: `En ${nombre} buscá “Ingresar dinero” (o “Depositar”). Te muestra un alias y un CVU/CBU: copialos, pegalos en la transferencia de tu banco y confirmá el monto.`,
    lograras: 'Tener la plata disponible para invertir. Todavía no está invertida: es solo plata tuya en otra cuenta tuya.',
    chequeo: broker
      ? `Tu saldo en ${nombre} muestra el monto. Las transferencias suelen llegar al instante, pero a veces tardan hasta un día hábil.`
      : `Tu saldo en ${nombre} muestra el monto. Las transferencias llegan, por lo general, al instante.`,
  };
}

function pasoRegistrar(): PasoGuia {
  return {
    id: 'registrar',
    titulo: 'Anotala en FINA',
    haces: 'Cargá en FINA lo que acabás de hacer, con los datos que te muestra la app.',
    loVes: 'Te vamos a pedir sólo lo que ves en tu app: el monto, la tasa y, si corresponde, la fecha de vencimiento. También podés subir una captura y la leemos por vos.',
    lograras: 'Que FINA te avise cuándo vence, te diga cuánto vas ganando de verdad contra la inflación y te avise si aparece algo mejor. FINA no mueve ni toca tu plata: anotar es solo anotar.',
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
    lograras: 'Tranquilidad: saber de antemano cómo recuperar tu plata y cuánto tarda hace que no se te ocurra sacarla por miedo.',
    chequeo: 'Sabés cuál es el botón y cuántos días tarda.',
  };
}

// ── guías por combinación ────────────────────────────────────────────────
function guiaMercadoPago(ctx: ContextoGuia): Guia {
  const tasa = ctx.evaluacion?.detalle;
  return {
    proveedor: 'mercado_pago',
    producto: 'cuenta_remunerada',
    titulo: 'Cuenta remunerada en Mercado Pago',
    alTerminar: `${montoTxt(ctx.monto)} generando intereses todos los días en tu cuenta de Mercado Pago, disponibles cuando los necesites.`,
    tiempo: 'Unos 10 minutos si ya tenés la cuenta; media hora si hay que crearla.',
    pasos: [
      pasoCuentaBilletera('Mercado Pago'),
      pasoIngresar('Mercado Pago', ctx.monto, false),
      {
        id: 'activar',
        titulo: 'Activá los rendimientos',
        haces: 'Entrá a la sección “Rendimientos” (puede aparecer como “Tu plata rinde”) desde la pantalla de inicio.',
        loVes: 'Vas a ver tu saldo, cuánto rindió hoy y un botón para activar. Si ya aparece activado, no hay nada más que tocar.',
        lograras: 'Que el saldo empiece a generar intereses solo, todos los días. Detrás de esa función hay un fondo común de dinero (Mercado Fondo): tu plata queda invertida ahí, y la podés usar igual que siempre.',
        chequeo: 'Ves un monto de “rendimiento de hoy” aunque sea de centavos.',
      },
      {
        id: 'tasa',
        titulo: 'Mirá la tasa que te muestran',
        haces: 'Fijate qué porcentaje anual te muestra la app junto a “Rinde” (puede llamarse TNA o TEA).',
        loVes: 'Un porcentaje, a veces con la leyenda “anual”. Es el que va a variar de un día para el otro.',
        lograras: 'Comparar lo que te prometen con lo que muestra el mercado hoy, y entender si le está ganando a la inflación.',
        chequeo: 'Anotaste el porcentaje: lo vas a cargar en FINA.',
        datos: tasa ? [{ etiqueta: 'Lo que vemos hoy en el mercado', valor: tasa }] : undefined,
      },
      pasoRescate('Mercado Pago', 'Tu plata sigue disponible: la usás como saldo normal, o la transferís a tu banco cuando quieras.'),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Que la sección se llame “Rendimientos” y esté en la pantalla de inicio.',
      'Que el rendimiento de la cuenta venga del fondo Mercado Fondo.',
      'Si hay un tope de saldo que rinde.',
    ],
  };
}

function guiaUala(ctx: ContextoGuia): Guia {
  const notas = ctx.evaluacion?.notas ?? [];
  return {
    proveedor: 'uala',
    producto: 'cuenta_remunerada',
    titulo: 'Cuenta remunerada en Ualá',
    alTerminar: `${montoTxt(ctx.monto)} rindiendo todos los días en tu cuenta de Ualá, disponibles cuando los necesites.`,
    tiempo: 'Unos 10 minutos si ya tenés la cuenta; media hora si hay que crearla.',
    pasos: [
      pasoCuentaBilletera('Ualá'),
      pasoIngresar('Ualá', ctx.monto, false),
      {
        id: 'saldo',
        titulo: 'Dejá el saldo en la cuenta',
        haces: 'No hay que activar nada: el saldo que tenés en la cuenta rinde solo.',
        loVes: 'Entrá a la sección de rendimientos o de tu saldo y buscá la tasa y las condiciones.',
        lograras: 'Que tu plata genere intereses mientras la tenés quieta, sin comprar ningún producto.',
        chequeo: 'Ves el rendimiento diario en tu cuenta.',
        datos: notas.map((n) => ({ etiqueta: 'Condiciones de hoy', valor: n })),
      },
      {
        id: 'niveles',
        titulo: 'Entendé los niveles de tasa',
        haces: 'Ualá paga más si hacés determinadas operaciones al mes. Fijate si te conviene llegar a ese nivel o con el básico alcanza.',
        loVes: 'En la sección de rendimientos (o “Ualá Plus”) figura qué tenés que hacer para subir de nivel.',
        lograras: 'No resignar tasa sin darte cuenta, ni cambiar tus hábitos de gasto sólo por subir un escalón. Un gasto no es un error: no gastes de más para ganar un punto.',
        chequeo: 'Sabés en qué nivel estás y qué te pide el siguiente.',
      },
      pasoRescate('Ualá', 'Tu plata sigue disponible como saldo: la usás normal o la transferís a tu banco.'),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Dónde se ve la tasa y los niveles dentro de la app.',
      'Si el rendimiento es automático o hay que activarlo.',
      'Cómo se llaman los niveles hoy (Plus 1, Plus 2).',
    ],
  };
}

function guiaFondoBroker(prov: 'cocos' | 'balanz', ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const fondo = prov === 'cocos' ? 'Cocos Ahorro' : 'Balanz Capital Money Market';
  return {
    proveedor: prov,
    producto: 'fci',
    titulo: `Fondo común de dinero en ${nombre}`,
    alTerminar: `${montoTxt(ctx.monto)} invertidos en el fondo ${fondo}: un fondo que presta a muy corto plazo y que podés rescatar en pocos días.`,
    tiempo: 'Un día o dos para que aprueben la cuenta; después, 10 minutos.',
    pasos: [
      pasoCuentaBroker(nombre),
      pasoIngresar(nombre, ctx.monto, true),
      {
        id: 'buscar',
        titulo: `Buscá el fondo ${fondo}`,
        haces: `Entrá a “Fondos” (o “Fondos comunes”) y buscá “${fondo}”. Elegí la versión en pesos.`,
        loVes: 'Una ficha con el nombre del fondo, su rendimiento reciente, el plazo de rescate y el riesgo. Si hay varias “clases” (A, B, C…), la clase cambia sólo quién puede entrar y las comisiones: para una persona común suele ser la A.',
        lograras: 'Elegir con los ojos abiertos: ya sabés dónde queda tu plata (en un fondo que presta a muy corto plazo) y cuánto tarda en volver.',
        chequeo: 'Estás en la ficha del fondo y viste el plazo de rescate.',
        datos: ctx.evaluacion ? [{ etiqueta: 'Lo que rindió', valor: ctx.evaluacion.detalle }] : undefined,
      },
      {
        id: 'suscribir',
        titulo: 'Suscribí con tu monto',
        haces: `Tocá “Suscribir” (o “Comprar”), poné ${montoTxt(ctx.monto)} y confirmá.`,
        loVes: 'La app te muestra el valor de la cuotaparte y cuántas vas a recibir. Es sólo informativo: el valor exacto se fija al cierre del día.',
        lograras: 'Tu plata pasa a ser cuotapartes del fondo. Desde el día siguiente empieza a rendir.',
        chequeo: 'En “Mi cartera” (o “Tenencias”) aparece el fondo con tu monto.',
      },
      pasoRescate(nombre, 'Cuando necesites la plata: tocá “Rescatar” en la ficha del fondo, elegí cuánto y confirmá. Vuelve a tu cuenta en 0 a 2 días hábiles.'),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Que el menú se llame “Fondos” y cómo se llama el botón de compra.',
      `Que el fondo figure como ${fondo} y qué clase se ofrece a una persona común.`,
      'El plazo de rescate real del fondo.',
    ],
  };
}

function guiaLetras(prov: 'cocos' | 'balanz', ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const letras = (ctx.mercado?.letras?.valor ?? []).filter((l) => l.dias >= 15 && l.dias <= 200).slice(0, 3);
  return {
    proveedor: prov,
    producto: 'letra',
    titulo: `Letras del Tesoro en ${nombre}`,
    alTerminar: `${montoTxt(ctx.monto)} prestados al Estado hasta una fecha que elegís, con un rendimiento que ya conocés al comprar.`,
    tiempo: 'Un día o dos para la cuenta; después, 15 minutos.',
    pasos: [
      pasoCuentaBroker(nombre),
      pasoIngresar(nombre, ctx.monto, true),
      {
        id: 'elegir',
        titulo: 'Elegí hasta cuándo dejás la plata',
        haces: 'Entrá a “Renta fija” (o “Letras”) y fijate las letras disponibles. Cada una tiene una fecha de vencimiento.',
        loVes: 'Una lista con el nombre de cada letra (ticker), cuánto rinde por mes y cuándo vence. El nombre ya indica la fecha: S13N6 es una letra que vence el 13 de noviembre de 2026.',
        lograras: 'Elegir un plazo que coincida con cuándo pensás usar la plata, así no necesitás venderla antes.',
        chequeo: 'Elegiste una letra que vence después de cuando podrías necesitar la plata.',
        datos: letras.map((l) => ({ etiqueta: `${l.ticker} (vence ${diaMes(l.vencimiento)})`, valor: `${pct(l.tem * 100, 2)} por mes` })),
      },
      {
        id: 'comprar',
        titulo: 'Comprala',
        haces: `Tocá “Comprar”, poné ${montoTxt(ctx.monto)} y confirmá. Si te pregunta el tipo de orden, elegí “a precio de mercado”.`,
        loVes: 'Antes de confirmar la app muestra cuántas letras comprás y el precio. La ganancia es la diferencia entre lo que pagás hoy y lo que cobrás al vencimiento.',
        lograras: 'Le prestás tu plata al Estado hasta el vencimiento y ya sabés cuánto vas a cobrar, siempre que esperes hasta esa fecha.',
        chequeo: 'La letra aparece en “Mi cartera” con su fecha de vencimiento.',
      },
      pasoRescate(nombre, 'Podés esperar al vencimiento (el Estado paga solo y la plata entra a tu cuenta) o venderla antes en el mercado: tocá “Vender” en la letra. Si vendés antes, el precio puede ser menor al esperado.'),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Dónde están las letras en el menú de la app.',
      'Qué tipos de orden ofrece y cuál es el predeterminado.',
      'Si cobra comisión por comprar o por mantener.',
    ],
  };
}

function guiaDolar(prov: 'cocos' | 'balanz', ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  return {
    proveedor: prov,
    producto: 'dolar',
    titulo: `Dólar MEP en ${nombre}`,
    alTerminar: `${montoTxt(ctx.monto)} pasados a dólares y guardados a tu nombre en ${nombre}.`,
    tiempo: 'Un día o dos para la cuenta; después, 10 minutos.',
    pasos: [
      pasoCuentaBroker(nombre),
      pasoIngresar(nombre, ctx.monto, true),
      {
        id: 'comprar',
        titulo: 'Comprá dólar MEP',
        haces: 'Buscá la opción “Dólar MEP” (en estos brokers suele ser un botón directo), poné el monto en pesos y confirmá.',
        loVes: 'La app te muestra el precio en pesos por cada dólar y cuántos dólares vas a recibir.',
        lograras: 'Cambiás pesos por dólares de forma legal. Eso protege tu plata si el dólar sube, pero no genera ningún interés.',
        chequeo: 'Tu cuenta muestra un saldo en dólares. A veces tarda hasta un día hábil.',
        datos: ctx.evaluacion ? [{ etiqueta: 'Hoy', valor: ctx.evaluacion.detalle }] : undefined,
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

function guiaCedear(prov: 'cocos' | 'balanz', ctx: ContextoGuia): Guia {
  const nombre = PROVEEDORES[prov].nombre;
  const spy = ctx.mercado?.cedears?.valor.find((c) => c.simbolo === 'SPY');
  const alcanza = spy && ctx.monto ? Math.floor(ctx.monto / spy.precio) : null;
  const datos = spy
    ? [
        { etiqueta: 'Un CEDEAR de SPY cuesta hoy', valor: fmtPesos(spy.precio) },
        ...(ctx.monto
          ? [{
              etiqueta: `Con ${fmtPesos(ctx.monto)}`,
              valor: alcanza && alcanza >= 1 ? `comprás ${alcanza} (más la comisión)` : `no alcanza para uno entero: necesitás al menos ${fmtPesos(spy.precio)}`,
            }]
          : []),
      ]
    : undefined;
  return {
    proveedor: prov,
    producto: 'cedear',
    titulo: `CEDEARs en ${nombre}`,
    alTerminar: `${montoTxt(ctx.monto)} en un pedacito de las 500 empresas más grandes de EE.UU., para dejar varios años.`,
    tiempo: 'Un día o dos para la cuenta; después, 15 minutos.',
    pasos: [
      pasoCuentaBroker(nombre),
      pasoIngresar(nombre, ctx.monto, true),
      {
        id: 'buscar',
        titulo: 'Buscá SPY',
        haces: 'En “Mercado” → “CEDEARs” buscá “SPY”.',
        loVes: 'SPY sigue a las 500 empresas más grandes de EE.UU. Al comprar uno comprás un pedacito de todas a la vez, en vez de apostar a una sola.',
        lograras: 'Una inversión diversificada sin tener que elegir empresas. Es para plata que no vas a necesitar en varios años.',
        chequeo: 'Estás en la ficha de SPY y ves su precio en pesos.',
        datos,
      },
      {
        id: 'comprar',
        titulo: 'Comprá',
        haces: 'Tocá “Comprar”, elegí la cantidad y confirmá. Fijate la comisión del broker antes de confirmar.',
        loVes: 'La app te muestra el costo total, incluida la comisión. Una vez ejecutada la orden, el CEDEAR queda en tu cartera.',
        lograras: 'Empezar a participar del crecimiento de esas empresas. El precio va a subir y bajar todos los días: lo que importa es el largo plazo.',
        chequeo: 'El CEDEAR aparece en “Mi cartera” con la cantidad que compraste.',
      },
      pasoRescate(nombre, 'Podés vender cuando quieras en horario de mercado y los pesos llegan en uno o dos días hábiles. Pero si vendés cuando está más bajo que cuando compraste, esa pérdida queda concretada.'),
      pasoRegistrar(),
    ],
    porVerificar: [
      'Cómo se llama la sección de CEDEARs.',
      'La comisión de compra y de mantenimiento.',
      'Si permite comprar por monto o sólo por cantidad entera.',
    ],
  };
}

function guiaPlazoFijo(uva: boolean, ctx: ContextoGuia): Guia {
  const lista = ctx.mercado ? bancosOrdenados(ctx.mercado) : [];
  const elegido = ctx.banco ? lista.find((b) => b.entidad === ctx.banco) : undefined;
  // Para quien nunca lo hizo, primero los bancos: una compañía financiera es válida pero menos conocida.
  const tops = [...lista].sort((a, b) => Number(/FINANCIERA/i.test(a.entidad)) - Number(/FINANCIERA/i.test(b.entidad))).slice(0, 3).map((b) => ({ etiqueta: nombrePropio(b.entidad), valor: `${pct(b.tna * 100, 1)} anual a 30 días` }));
  const nombreBanco = ctx.banco ? nombrePropio(ctx.banco) : 'tu banco';
  return {
    proveedor: 'banco',
    producto: uva ? 'plazo_fijo_uva' : 'plazo_fijo',
    titulo: uva ? 'Plazo fijo UVA' : 'Plazo fijo',
    alTerminar: uva
      ? `${montoTxt(ctx.monto)} prestados al banco por 90 días o más, con tu capital ajustado por la inflación.`
      : `${montoTxt(ctx.monto)} prestados al banco por un plazo, con una ganancia que ya conocés al confirmar.`,
    tiempo: '10 minutos desde la app de tu banco.',
    pasos: [
      {
        id: 'banco',
        titulo: 'Elegí en qué banco',
        haces: 'Lo más simple es usar el banco donde ya tenés cuenta. Comparalo con los de abajo: a veces la diferencia es de uno o dos puntos.',
        loVes: 'Las tasas son para clientes del banco. Si te conviene más otro, abrir cuenta en ese banco suele ser gratis y online.',
        lograras: 'No dejar plata de más sin ganar. Una diferencia de 3 puntos de tasa en $100.000 son unos $250 por mes.',
        chequeo: 'Sabés qué banco vas a usar y qué tasa te da.',
        datos: elegido ? [{ etiqueta: nombreBanco, valor: `${pct(elegido.tna * 100, 1)} anual a 30 días` }] : tops,
      },
      {
        id: 'plata',
        titulo: `Tené ${montoTxt(ctx.monto)} disponibles en tu cuenta`,
        haces: 'Fijate que ese monto esté en la cuenta del banco desde donde vas a constituirlo. Si está en otro banco o en una billetera, pasalo con una transferencia: la cuenta de origen tiene que estar a tu nombre.',
        loVes: 'En la app del banco ves tu saldo disponible. Las transferencias entre cuentas tuyas suelen llegar al instante.',
        lograras: 'Poder constituir el plazo fijo sin trabas: el banco sólo toma plata que ya está en tu cuenta.',
        chequeo: 'Tu saldo en el banco alcanza para el monto que elegiste.',
      },
      {
        id: 'constituir',
        titulo: uva ? 'Constituí el plazo fijo UVA' : 'Constituí el plazo fijo',
        haces: uva
          ? 'En el home banking o la app buscá “Inversiones” → “Plazo fijo” → “UVA” y elegí un plazo de 90 días o más.'
          : 'En el home banking o la app buscá “Inversiones” → “Plazo fijo” → “Constituir” y elegí el plazo en días.',
        loVes: 'Te pide el monto, el plazo y si querés que se renueve solo al vencer. Antes de confirmar te muestra cuánto vas a cobrar y en qué fecha.',
        lograras: uva
          ? 'Tu capital se actualiza con la inflación durante el plazo. Protege el poder de compra, no está pensado para ganarle por mucho.'
          : 'Bloquear tu plata hasta la fecha a una tasa que ya conocés. Si elegís que NO se renueve solo, decidís de nuevo cada vez con la tasa del momento.',
        chequeo: 'Tenés el comprobante con el monto, la tasa y el vencimiento.',
      },
      pasoRegistrar(),
    ],
    porVerificar: [
      'Dónde está “Plazo fijo” en el home banking y cómo se llama la opción UVA.',
      'El monto mínimo para constituirlo.',
      uva ? 'Qué adicional sobre la UVA paga el banco.' : 'Si ofrece la opción precancelable y con qué tasa.',
    ],
  };
}

/** La guía para este producto en este proveedor, con los datos de hoy. null si esa combinación no existe. */
export function armarGuia(proveedor: ProveedorId, producto: ProductoId, ctx: ContextoGuia): Guia | null {
  if (!PROVEEDORES[proveedor].productos[producto]) return null;
  switch (`${proveedor}:${producto}`) {
    case 'mercado_pago:cuenta_remunerada': return guiaMercadoPago(ctx);
    case 'uala:cuenta_remunerada': return guiaUala(ctx);
    case 'cocos:fci': return guiaFondoBroker('cocos', ctx);
    case 'balanz:fci': return guiaFondoBroker('balanz', ctx);
    case 'cocos:letra': return guiaLetras('cocos', ctx);
    case 'balanz:letra': return guiaLetras('balanz', ctx);
    case 'cocos:dolar': return guiaDolar('cocos', ctx);
    case 'balanz:dolar': return guiaDolar('balanz', ctx);
    case 'cocos:cedear': return guiaCedear('cocos', ctx);
    case 'balanz:cedear': return guiaCedear('balanz', ctx);
    case 'banco:plazo_fijo': return guiaPlazoFijo(false, ctx);
    case 'banco:plazo_fijo_uva': return guiaPlazoFijo(true, ctx);
    default: return null;
  }
}

export function nombreGuia(producto: ProductoId): string {
  return PRODUCTOS[producto].nombre;
}
