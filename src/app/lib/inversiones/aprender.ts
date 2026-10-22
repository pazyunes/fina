// Mini lecciones para aprender mirando dos cosas lado a lado ("la diferencia entre A y B").
// Contenido fijo y corto, siempre con la misma forma: la idea en una línea, cada cosa por
// separado y qué quedarse. Sin números que cambien con el mercado: los ejemplos son de
// juguete y lo dicen. Nada de "tenés que": se explica, la decisión es de la persona.

import type { ProductoId } from './catalogo.js';

export type Lado = { nombre: string; texto: string };

export type Tarjeta = {
  id: string;
  /** Qué clase de lección es, para la etiqueta de arriba. */
  clase: 'diferencia' | 'concepto' | 'mito';
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
    titulo: '¿Qué es el colchón de emergencia?',
    idea: 'Es plata separada para imprevistos, antes de invertir en cosas a largo plazo.',
    bloques: [
      { nombre: 'De cuánto', texto: 'Una regla común es tener el equivalente a 3 meses de gastos. FINA lo calcula con lo que gastás por mes.' },
      { nombre: 'Dónde va', texto: 'En algo que puedas sacar rápido, como una cuenta remunerada, y no bloqueado por meses.' },
    ],
    retener: 'Primero el colchón; después, lo demás.',
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
