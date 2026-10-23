// Mini lecciones para aprender mirando dos cosas lado a lado ("la diferencia entre A y B").
// Contenido fijo y corto, siempre con la misma forma: la idea en una línea, cada cosa por
// separado y qué quedarse. Sin números que cambien con el mercado: los ejemplos son de
// juguete y lo dicen. Nada de "tenés que": se explica, la decisión es de la persona.

import { TOPE_SEGURO_DEPOSITOS, type ProductoId } from './catalogo.js';

export type Lado = { nombre: string; texto: string };

export type Tarjeta = {
  id: string;
  /** Qué clase de lección es, para la etiqueta de arriba. */
  clase: 'diferencia' | 'concepto' | 'mito' | 'error';
  titulo: string;
  /** La idea en una línea. */
  idea: string;
  /** Una o dos cosas explicadas por separado (en una diferencia, las dos que se comparan). */
  bloques: Lado[];
  /** Qué quedarse, en una línea. */
  retener: string;
  /** Un ejemplo con plata, marcado como de juguete. */
  ejemplo?: string;
  /** Con qué inversiones se relaciona: las que se recomiendan hoy suben primero. */
  productos: ProductoId[];
};

export const TARJETAS: Tarjeta[] = [
  {
    id: 'tna-tea',
    titulo: 'Diferencia entre TNA y TEA',
    idea: 'Las dos dicen cuánto rinde una inversión en un año, pero no cuentan lo mismo.',
    clase: 'diferencia',
    bloques: [
      { nombre: 'TNA (tasa nominal anual)', texto: 'Lo que rinde en un año sin contar que lo que vas ganando también rinde. Es la que suelen mostrar las apps.' },
      { nombre: 'TEA (tasa efectiva anual)', texto: 'Lo que rinde en un año contando que lo ganado cada mes se suma y también rinde. Siempre es un poco más alta que la TNA.' },
    ],
    retener: 'Para comparar dos inversiones, usá siempre la misma de las dos.',
    ejemplo: 'Ejemplo de juguete: una TNA de 20% con intereses que se suman cada mes equivale a una TEA de cerca de 21,9%.',
    productos: ['cuenta_remunerada', 'fci', 'plazo_fijo'],
  },
  {
    id: 'rinde-vs-real',
    titulo: 'Diferencia entre lo que rinde y lo que realmente ganás',
    idea: 'Que tu plata crezca no alcanza: tiene que crecer más que los precios.',
    clase: 'diferencia',
    bloques: [
      { nombre: 'Lo que rinde', texto: 'Cuánta plata más tenés al final, en pesos.' },
      { nombre: 'Lo que ganás de verdad (rendimiento real)', texto: 'Cuánto más podés comprar con esa plata, después de que subieron los precios (la inflación).' },
    ],
    retener: 'Si rinde menos que la inflación, tenés más pesos pero comprás menos.',
    ejemplo: 'Ejemplo de juguete: $100.000 que rinden 2% en un mes pasan a $102.000. Si en ese mes los precios subieron 2,5%, lo que costaba $100.000 ahora cuesta $102.500: tenés más pesos, pero comprás menos.',
    productos: ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva'],
  },
  {
    id: 'plazo-fijo-uva',
    titulo: 'Diferencia entre plazo fijo y plazo fijo UVA',
    idea: 'Los dos son un depósito en un banco por un plazo, pero cambia qué te aseguran.',
    clase: 'diferencia',
    bloques: [
      { nombre: 'Plazo fijo común', texto: 'Sabés desde el primer día cuántos pesos vas a cobrar. Si los precios suben más que tu interés, con esa plata comprás menos.' },
      { nombre: 'Plazo fijo UVA', texto: 'Tu capital sube con la inflación (la UVA, con unos meses de atraso) y a veces el banco suma un extra. No sabés cuántos pesos vas a cobrar hasta el final. Pide dejarlo al menos 90 días.' },
    ],
    retener: 'El común te da certeza en pesos; el UVA busca que no pierdas contra la inflación.',
    productos: ['plazo_fijo', 'plazo_fijo_uva'],
  },
  {
    id: 'cuenta-vs-plazo',
    titulo: 'Diferencia entre cuenta remunerada y plazo fijo',
    idea: 'Las dos te pagan interés. Lo que cambia es cuándo podés sacar la plata y cuánto dura la tasa.',
    clase: 'diferencia',
    bloques: [
      { nombre: 'Cuenta remunerada', texto: 'Sacás la plata cuando quieras. La tasa puede cambiar cualquier día y suele tener un tope: lo que pasa de cierto saldo rinde menos o nada.' },
      { nombre: 'Plazo fijo', texto: 'La tasa queda fija hasta el vencimiento (el día en que termina el plazo). La plata queda bloqueada hasta entonces, salvo que sea precancelable (se puede retirar antes, con menos interés).' },
    ],
    retener: 'La cuenta es para tener la plata a mano; el plazo fijo, para fijar una tasa.',
    productos: ['cuenta_remunerada', 'plazo_fijo'],
  },
  {
    id: 'cuenta-vs-fondo',
    titulo: 'Diferencia entre una cuenta y un fondo común de inversión',
    idea: 'Se parecen en la pantalla (ves tu saldo crecer), pero la plata no está en el mismo lugar.',
    clase: 'diferencia',
    bloques: [
      { nombre: 'Cuenta de un banco o billetera', texto: 'La plata queda en la cuenta, con una tasa que te informan. Las de bancos tienen seguro de depósitos (si el banco quiebra, el Estado devuelve hasta un tope).' },
      { nombre: 'Fondo común de inversión (FCI)', texto: 'Tu plata se junta con la de muchas personas y un profesional la invierte. Tu parte son cuotapartes (pedacitos del fondo) y su valor sube o baja un poco. No tiene seguro de depósitos, pero lo controla la CNV.' },
    ],
    retener: 'Algunas billeteras guardan tu plata en un fondo: fijate cuál es tu caso, porque cambia la protección.',
    productos: ['cuenta_remunerada', 'fci'],
  },
  {
    id: 'accion-cedear-etf',
    titulo: 'Diferencia entre acción, CEDEAR y ETF',
    idea: 'Son tres formas de invertir en empresas, y cambia cuántas y desde dónde.',
    clase: 'diferencia',
    bloques: [
      { nombre: 'Acción y CEDEAR', texto: 'Una acción es un pedacito de una empresa. Un CEDEAR es un papel en pesos que representa un pedacito de una empresa del exterior (como Apple), y se compra desde un broker de acá.' },
      { nombre: 'ETF', texto: 'Un paquete que reúne muchas empresas en una sola compra. SPY, por ejemplo, reúne a las 500 más grandes de EE.UU. Si una cae, las otras la compensan en parte.' },
    ],
    retener: 'Elegir una sola empresa concentra el riesgo; un ETF lo reparte.',
    productos: ['cedear'],
  },
  {
    id: 'oficial-mep',
    titulo: 'Diferencia entre dólar oficial y dólar MEP',
    idea: 'Los dos son dólares, pero se consiguen por caminos distintos y cuestan distinto.',
    clase: 'diferencia',
    bloques: [
      { nombre: 'Dólar oficial', texto: 'El que se compra en un banco, con las reglas y los límites que ponga el Estado.' },
      { nombre: 'Dólar MEP', texto: 'La forma legal de comprar dólares desde un broker, sin pasar por el cupo del banco. Su precio suele ser distinto al del oficial.' },
    ],
    retener: 'La diferencia de precio entre los dos se llama brecha.',
    productos: ['dolar'],
  },
  {
    id: 'ahorrar-vs-invertir',
    titulo: 'Diferencia entre ahorrar e invertir',
    idea: 'Cada una sirve para algo distinto, y no hace falta elegir una sola.',
    clase: 'diferencia',
    bloques: [
      { nombre: 'Ahorrar', texto: 'Guardar plata para tenerla cuando la necesites, sin sobresaltos. Importa poder sacarla rápido.' },
      { nombre: 'Invertir', texto: 'Aceptar que el valor suba y baje a cambio de que, con tiempo, pueda crecer más. Importa poder esperar.' },
    ],
    retener: 'Lo que vas a necesitar pronto es para ahorrar; lo que podés dejar años, para invertir.',
    productos: ['cuenta_remunerada', 'cedear'],
  },
  {
    id: 'inflacion',
    clase: 'concepto',
    titulo: '¿Qué es la inflación?',
    idea: 'Es cuánto suben los precios con el tiempo.',
    bloques: [
      { nombre: 'Qué pasa con tu plata', texto: 'Con los mismos pesos comprás cada vez menos. Por eso tener la plata quieta, sin que rinda, es perder poder de compra de a poco.' },
      { nombre: 'Cómo se mide', texto: 'Cada mes, el INDEC (el organismo oficial de estadísticas) publica cuánto subieron los precios.' },
    ],
    retener: 'Una inversión cumple si rinde más que la inflación.',
    ejemplo: 'Ejemplo de juguete: si un paquete de yerba cuesta $1.000 y los precios suben 2,5%, el mes siguiente cuesta $1.025.',
    productos: ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva'],
  },
  {
    id: 'interes-compuesto',
    clase: 'concepto',
    titulo: '¿Qué es el interés compuesto?',
    idea: 'Es ganar intereses sobre los intereses que ya ganaste.',
    bloques: [
      { nombre: 'Cómo funciona', texto: 'Cada vez que se suma el interés a tu plata, el siguiente interés se calcula sobre un monto un poco más grande.' },
      { nombre: 'Cuándo se nota', texto: 'Cuanto más tiempo dejás la plata, más se nota la diferencia.' },
    ],
    retener: 'El tiempo es la parte más importante: dejar la plata trabajando hace que crezca más que la suma de sus partes.',
    ejemplo: 'Ejemplo de juguete: $100.000 que rinden 2% por mes pasan a $102.000, después a $104.040 y después a $106.121 en tres meses.',
    productos: ['cuenta_remunerada', 'fci', 'plazo_fijo'],
  },
  {
    id: 'diversificar',
    clase: 'concepto',
    titulo: '¿Qué es diversificar?',
    idea: 'Es no poner toda la plata en el mismo lugar.',
    bloques: [
      { nombre: 'Por qué', texto: 'Si algo sale mal en un lugar, no se pierde todo. Una inversión puede bajar mientras otra sube.' },
      { nombre: 'Cómo se hace', texto: 'Se reparte entre cosas distintas: una parte para tener a mano, otra a un plazo y otra a largo plazo.' },
    ],
    retener: 'Repartir no asegura ganar, pero reduce el golpe si algo sale mal.',
    productos: ['cedear', 'fci', 'plazo_fijo_uva'],
  },
  {
    id: 'colchon',
    clase: 'concepto',
    titulo: '¿Hace falta una reserva antes de invertir?',
    idea: 'No hace falta apartar plata "por las dudas": lo que te sobra se puede invertir.',
    bloques: [
      { nombre: 'La regla general', texto: 'Si todos los meses tus ingresos cubren tus gastos, lo que te sobra se puede invertir. Si necesitás la plata, la sacás: por eso importa elegir algo que puedas retirar rápido.' },
      { nombre: 'La excepción', texto: 'Si viene un gasto cercano que tus ingresos no alcanzan a cubrir (un viaje, un arreglo grande), ahí sí conviene tener esa plata disponible, en algo que puedas sacar rápido, como un fondo de garantía.' },
    ],
    retener: 'Reserva sólo cuando vas a tener más gastos que ingresos; el resto, a trabajar.',
    productos: ['cuenta_remunerada', 'fci'],
  },
  {
    id: 'riesgo-plazo',
    clase: 'concepto',
    titulo: '¿Qué tiene que ver el riesgo con el plazo?',
    idea: 'Cuanto más tiempo podés dejar la plata, más altibajos podés aguantar.',
    bloques: [
      { nombre: 'Plazo corto', texto: 'Si vas a necesitar la plata pronto, una baja del precio te agarra sin tiempo para esperar que se recupere.' },
      { nombre: 'Plazo largo', texto: 'Con años por delante, los altibajos pesan menos y se puede aceptar más variación a cambio de que crezca más.' },
    ],
    retener: 'Para qué momento vas a necesitar la plata define qué te conviene.',
    productos: ['cedear', 'dolar'],
  },
  {
    id: 'broker',
    clase: 'concepto',
    titulo: '¿Qué es un broker?',
    idea: 'Una app o empresa autorizada donde comprás y vendés inversiones.',
    bloques: [
      { nombre: 'Qué hace', texto: 'Es el intermediario: vos le pedís comprar y él lo hace en el mercado. Lo que comprás queda a tu nombre.' },
      { nombre: 'Cuenta comitente', texto: 'Es tu cuenta en el broker, donde se guardan tus inversiones. Cocos y Balanz son ejemplos.' },
    ],
    retener: 'Un broker no es un banco: lo que guardás ahí no tiene seguro de depósitos y lo controla la CNV.',
    productos: ['fci', 'cedear', 'dolar'],
  },
  {
    id: 'mito-rinde-mas',
    clase: 'mito',
    titulo: 'Mito: «si rinde más, es mejor»',
    idea: 'Un rendimiento alto suele venir con una contra.',
    bloques: [
      { nombre: 'El mito', texto: 'Elegir siempre lo que más rinde.' },
      { nombre: 'La realidad', texto: 'Rendir bastante más que el resto suele significar más riesgo, un plazo más largo o condiciones, como un tope o requisitos. Conviene preguntar cuál es la contra.' },
    ],
    retener: 'Antes de mirar cuánto rinde, mirá qué riesgo toma y cuándo podés sacar la plata.',
    productos: ['fci', 'cuenta_remunerada'],
  },
  {
    id: 'cedear-es-accion',
    clase: 'concepto',
    titulo: 'Un CEDEAR es una acción, y un ETF también se compra como CEDEAR',
    idea: 'Todo esto es renta variable: su precio sube y baja.',
    bloques: [
      { nombre: 'CEDEAR', texto: 'Empresas del exterior que cotizan en la bolsa argentina. Es como comprar una acción, pero desde acá y en pesos. También hay acciones de empresas argentinas, según el ticker.' },
      { nombre: 'ETF', texto: 'Un paquete de muchas empresas. Podés tener un CEDEAR de un ETF, como SPY: así comprás las 500 más grandes de EE.UU. de una vez.' },
    ],
    retener: 'Si no la vas a usar por mucho tiempo, es un lugar posible; si la necesitás pronto, no.',
    productos: ['cedear'],
  },
  {
    id: 'tipos-de-fondos',
    clase: 'concepto',
    titulo: '¿Qué tipos de fondos comunes hay?',
    idea: 'Hay cientos de fondos, pero casi todos son de tres clases.',
    bloques: [
      { nombre: 'Money market', texto: 'Presta a muy corto plazo. Es el más estable y sirve para tener la plata a mano: rinde mucho mejor que nada y casi nunca baja.' },
      { nombre: 'Renta fija y renta variable', texto: 'Renta fija invierte en bonos y renta variable en acciones. Pueden dar más, pero su valor sube y baja, y pueden perder.' },
    ],
    retener: 'Antes de elegir un fondo, fijate de qué clase es.',
    productos: ['fci'],
  },
  {
    id: 'baja-o-no',
    clase: 'concepto',
    titulo: '¿Qué inversiones pueden bajar y cuáles no?',
    idea: 'Algunas nunca bajan en pesos; otras sí, y conviene saber cuáles.',
    bloques: [
      { nombre: 'Casi nunca bajan', texto: 'Plazo fijo, cuenta remunerada y money market. Sirven para quien no quiere tener pérdida de capital: su riesgo tiende a cero.' },
      { nombre: 'Sí pueden bajar', texto: 'La renta fija (bonos, según el plazo) y la renta variable (acciones y CEDEARs). Cuanto más tiempo podés esperar, mejor se aguantan los altibajos.' },
    ],
    retener: 'Que una inversión pueda bajar no la hace mala: hay que ponerla en el plazo que corresponde.',
    productos: ['cuenta_remunerada', 'fci', 'plazo_fijo', 'cedear'],
  },
  {
    id: 'uva-mas-dos',
    clase: 'concepto',
    titulo: '¿Qué quiere decir “UVA + 2”?',
    idea: 'Es el extra que un banco suma a la inflación en un plazo fijo UVA.',
    bloques: [
      { nombre: 'El margen', texto: 'Tu plata sube con la UVA (que sigue la inflación) y el banco suma un margen. En “UVA + 2”, ese 2 son los puntos extra por encima de la inflación.' },
      { nombre: 'Un límite', texto: 'A veces los bancos limitan este producto (montos, plazos o cupos), por eso no se usa tanto: conviene preguntar antes.' },
    ],
    retener: 'Cuanto más alto el margen, mejor, pero preguntá siempre si hay límites.',
    productos: ['plazo_fijo_uva'],
  },
  {
    id: 'mejor-que-nada',
    clase: 'concepto',
    titulo: '¿Sirve algo que rinde menos que la inflación?',
    idea: 'Depende del plazo: a muy corto plazo, todo es mejor que dejar la plata quieta.',
    bloques: [
      { nombre: 'Menos de 3 meses', texto: 'Si vas a usar la plata pronto, plazo fijo, cuenta remunerada o money market son parecidos y mucho mejor que nada, aunque rindan menos que la inflación.' },
      { nombre: 'Más de 3 meses', texto: 'Cuanto más tiempo, más pesa la inflación: ahí hay que mirar que la inversión le gane o, al menos, no pierda.' },
    ],
    retener: 'Lo que rinde menos que la inflación sirve para plazos cortos, no para largos.',
    productos: ['cuenta_remunerada', 'fci', 'plazo_fijo'],
  },
  {
    id: 'garantia-tesoro',
    clase: 'concepto',
    titulo: '¿Quién garantiza cada inversión?',
    idea: 'No todas tienen el mismo respaldo.',
    bloques: [
      { nombre: 'Con respaldo', texto: `Plazo fijo: el seguro de depósitos, hasta $${TOPE_SEGURO_DEPOSITOS.toLocaleString('es-AR')} por persona y por banco (lo fija el BCRA). Letras del Tesoro y bonos: el Tesoro de la Nación, o sea el Estado.` },
      { nombre: 'Sin respaldo de nadie', texto: 'Bonos corporativos, CEDEARs y acciones: nadie te garantiza que no pierdas. Los fondos los controla la CNV, pero tampoco garantiza el rendimiento.' },
    ],
    retener: 'Que algo esté garantizado no significa que rinda más, sólo que tiene un respaldo si algo sale mal.',
    productos: ['plazo_fijo', 'letra', 'bono_cer', 'cedear', 'fci'],
  },
  {
    id: 'bono-cer',
    clase: 'concepto',
    titulo: '¿Qué es un bono CER?',
    idea: 'Un préstamo al Estado que sigue a la inflación y paga un extra.',
    bloques: [
      { nombre: 'Cómo funciona', texto: 'Tu capital se ajusta con el CER (un índice que sigue a la inflación) y encima cobrás un extra por año. Si esperás hasta el vencimiento, cobrás la inflación más ese extra.' },
      { nombre: 'Qué cuidar', texto: 'En el medio el precio sube y baja. Si lo vendés antes del vencimiento, podés perder. Elegí uno que venza cuando vas a necesitar la plata.' },
    ],
    retener: 'Es renta fija: sirve para plazos de meses o años, y conviene esperar al vencimiento.',
    productos: ['bono_cer', 'letra'],
  },
  {
    id: 'error-comprar-vender',
    clase: 'error',
    titulo: 'Error: comprar y vender todo el tiempo',
    idea: 'Mover la plata seguido suele salir caro y rara vez mejora el resultado.',
    bloques: [
      { nombre: 'Qué pasa', texto: 'Cada compra y cada venta puede traer comisiones, y decidir con apuro suele llevar a decisiones peores.' },
      { nombre: 'Qué conviene', texto: 'Elegir con calma, con el plazo en mente, y dejar que el tiempo trabaje. Mirar el precio todos los días da más ansiedad que información.' },
    ],
    retener: 'Una inversión pensada para años se mira de vez en cuando, no todos los días.',
    productos: ['cedear', 'fci'],
  },
  {
    id: 'error-subir-bajar',
    clase: 'error',
    titulo: 'Error: comprar cuando sube y vender cuando cae',
    idea: 'Es la forma más común de perder: se hace al revés de lo que conviene.',
    bloques: [
      { nombre: 'El error', texto: 'Entusiasmarte y comprar cuando todo sube (ya está caro), y asustarte y vender cuando todo cae (se concreta la pérdida).' },
      { nombre: 'Qué conviene', texto: 'Antes de vender algo que cayó, analizar si cambió la razón por la que lo compraste. Una baja no es, por sí sola, un motivo para vender.' },
    ],
    retener: 'Si bajó y no cambió nada importante, venderlo con miedo es lo que convierte una baja en una pérdida.',
    productos: ['cedear'],
  },
  {
    id: 'error-riesgo',
    clase: 'error',
    titulo: 'Error: no entender cuánto riesgo aceptás',
    idea: 'Si no sabés cuánta baja aguantarías, conviene saberlo antes de invertir.',
    bloques: [
      { nombre: 'El error', texto: 'Poner plata en algo que puede bajar 20% o 30% sin haber pensado cómo te sentirías si pasa.' },
      { nombre: 'Qué conviene', texto: 'Preguntarte cuánto podés perder sin que te cambie la vida, y elegir en base a eso. Por eso existen los perfiles: conservador, moderado y arriesgado.' },
    ],
    retener: 'Invertí en lo que entendés y en lo que aguantarías ver bajar.',
    productos: ['cedear', 'fci'],
  },
  {
    id: 'error-plazo',
    clase: 'error',
    titulo: 'Error: no hacer coincidir el plazo con la inversión',
    idea: 'La plata y la inversión tienen que tener el mismo plazo.',
    bloques: [
      { nombre: 'Dos ejemplos del error', texto: 'Invertir en acciones algo que vas a necesitar en 3 meses, o dejar en un plazo fijo plata que no vas a necesitar en 10 años.' },
      { nombre: 'Qué conviene', texto: 'Primero preguntarte para cuándo es la plata, y recién después elegir. El plazo define en qué invertir; tu perfil define cuánto.' },
    ],
    retener: 'Plata para pronto, en algo que no baje; plata para dentro de muchos años, en algo que pueda crecer.',
    productos: ['cuenta_remunerada', 'plazo_fijo', 'cedear'],
  },
];

/**
 * Primero lo que todavía no aprendió y tiene que ver con lo que hoy se recomienda, después el
 * resto de lo que falta, y al final lo que ya aprendió. Estable: dentro de cada grupo no se
 * cambia el orden.
 */
export function ordenarTarjetas(tarjetas: Tarjeta[], recomendados: ProductoId[], aprendidas: string[] = []): Tarjeta[] {
  const falta = tarjetas.filter((t) => !aprendidas.includes(t.id));
  const relevante = (t: Tarjeta) => t.productos.some((p) => recomendados.includes(p));
  return [
    ...falta.filter(relevante),
    ...falta.filter((t) => !relevante(t)),
    ...tarjetas.filter((t) => aprendidas.includes(t.id)),
  ];
}

/** Cada cuántas lecciones aprendidas se completa una racha. */
export const META_DE_RACHA = 5;

export type Racha = {
  aprendidas: number;
  /** Rachas de 5 completadas. */
  completas: number;
  /** Casillas llenas de la racha en curso (1 a 5); 5 cuando se acaba de completar una. */
  enCurso: number;
  /** Cuántas faltan para completar la próxima racha. 0 si se acaba de completar. */
  faltan: number;
};

/** Cuenta las lecciones aprendidas en rachas de 5. Sólo cuenta ids que existen. */
export function rachaDeAprendizaje(aprendidas: string[], tarjetas: Tarjeta[] = TARJETAS): Racha {
  const n = new Set(aprendidas.filter((id) => tarjetas.some((t) => t.id === id))).size;
  const resto = n % META_DE_RACHA;
  const completada = n > 0 && resto === 0;
  return {
    aprendidas: n,
    completas: Math.floor(n / META_DE_RACHA),
    enCurso: completada ? META_DE_RACHA : resto,
    faltan: completada ? 0 : META_DE_RACHA - resto,
  };
}

// ── Un ritmo por día ─────────────────────────────────────────────────────
/** Cuántas lecciones se pueden marcar como aprendidas por día: poco y bien, no todo de golpe. */
export const LIMITE_DIARIO = 5;

/** Una lección aprendida y el día (en Argentina, 'YYYY-MM-DD') en que se marcó. '' = no se sabe (datos viejos). */
export type Aprendida = { id: string; dia: string };

/** El día en Argentina de un momento: el día de las lecciones no cambia a las 21 hs de UTC. */
export const diaAR = (ts: number = Date.now()): string =>
  new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

/** Cuántas marcó hoy. */
export function aprendidasHoy(aprendidas: Aprendida[], hoy: string): number {
  return new Set(aprendidas.filter((a) => a.dia === hoy).map((a) => a.id)).size;
}

/** Se puede marcar otra si hoy no llegó al límite. */
export const puedeMarcarHoy = (aprendidas: Aprendida[], hoy: string): boolean => aprendidasHoy(aprendidas, hoy) < LIMITE_DIARIO;
