// Mini lecciones para aprender mirando dos cosas lado a lado ("la diferencia entre A y B").
// Contenido fijo y corto, siempre con la misma forma: la idea en una línea, cada cosa por
// separado y qué quedarse. Sin números que cambien con el mercado: los ejemplos son de
// juguete y lo dicen. Nada de "tenés que": se explica, la decisión es de la persona.

import type { ProductoId } from './catalogo.js';

export type Lado = { nombre: string; texto: string };

export type Tarjeta = {
  id: string;
  titulo: string;
  /** La idea en una línea. */
  idea: string;
  izq: Lado;
  der: Lado;
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
    izq: { nombre: 'TNA (tasa nominal anual)', texto: 'Lo que rinde en un año sin contar que lo que vas ganando también rinde. Es la que suelen mostrar las apps.' },
    der: { nombre: 'TEA (tasa efectiva anual)', texto: 'Lo que rinde en un año contando que lo ganado cada mes se suma y también rinde. Siempre es un poco más alta que la TNA.' },
    retener: 'Para comparar dos inversiones, usá siempre la misma de las dos.',
    ejemplo: 'Ejemplo de juguete: una TNA de 20% con intereses que se suman cada mes equivale a una TEA de cerca de 21,9%.',
    productos: ['cuenta_remunerada', 'fci', 'plazo_fijo'],
  },
  {
    id: 'rinde-vs-real',
    titulo: 'Diferencia entre lo que rinde y lo que realmente ganás',
    idea: 'Que tu plata crezca no alcanza: tiene que crecer más que los precios.',
    izq: { nombre: 'Lo que rinde', texto: 'Cuánta plata más tenés al final, en pesos.' },
    der: { nombre: 'Lo que ganás de verdad (rendimiento real)', texto: 'Cuánto más podés comprar con esa plata, después de que subieron los precios (la inflación).' },
    retener: 'Si rinde menos que la inflación, tenés más pesos pero comprás menos.',
    ejemplo: 'Ejemplo de juguete: $100.000 que rinden 2% en un mes pasan a $102.000. Si en ese mes los precios subieron 2,5%, lo que costaba $100.000 ahora cuesta $102.500: tenés más pesos, pero comprás menos.',
    productos: ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva'],
  },
  {
    id: 'plazo-fijo-uva',
    titulo: 'Diferencia entre plazo fijo y plazo fijo UVA',
    idea: 'Los dos son un depósito en un banco por un plazo, pero cambia qué te aseguran.',
    izq: { nombre: 'Plazo fijo común', texto: 'Sabés desde el primer día cuántos pesos vas a cobrar. Si los precios suben más que tu interés, con esa plata comprás menos.' },
    der: { nombre: 'Plazo fijo UVA', texto: 'Tu capital sube con la inflación (la UVA, con unos meses de atraso) y a veces el banco suma un extra. No sabés cuántos pesos vas a cobrar hasta el final. Pide dejarlo al menos 90 días.' },
    retener: 'El común te da certeza en pesos; el UVA busca que no pierdas contra la inflación.',
    productos: ['plazo_fijo', 'plazo_fijo_uva'],
  },
  {
    id: 'cuenta-vs-plazo',
    titulo: 'Diferencia entre cuenta remunerada y plazo fijo',
    idea: 'Las dos te pagan interés. Lo que cambia es cuándo podés sacar la plata y cuánto dura la tasa.',
    izq: { nombre: 'Cuenta remunerada', texto: 'Sacás la plata cuando quieras. La tasa puede cambiar cualquier día y suele tener un tope: lo que pasa de cierto saldo rinde menos o nada.' },
    der: { nombre: 'Plazo fijo', texto: 'La tasa queda fija hasta el vencimiento (el día en que termina el plazo). La plata queda bloqueada hasta entonces, salvo que sea precancelable (se puede retirar antes, con menos interés).' },
    retener: 'La cuenta es para tener la plata a mano; el plazo fijo, para fijar una tasa.',
    productos: ['cuenta_remunerada', 'plazo_fijo'],
  },
  {
    id: 'cuenta-vs-fondo',
    titulo: 'Diferencia entre una cuenta y un fondo común de inversión',
    idea: 'Se parecen en la pantalla (ves tu saldo crecer), pero la plata no está en el mismo lugar.',
    izq: { nombre: 'Cuenta de un banco o billetera', texto: 'La plata queda en la cuenta, con una tasa que te informan. Las de bancos tienen seguro de depósitos (si el banco quiebra, el Estado devuelve hasta un tope).' },
    der: { nombre: 'Fondo común de inversión (FCI)', texto: 'Tu plata se junta con la de muchas personas y un profesional la invierte. Tu parte son cuotapartes (pedacitos del fondo) y su valor sube o baja un poco. No tiene seguro de depósitos, pero lo controla la CNV.' },
    retener: 'Algunas billeteras guardan tu plata en un fondo: fijate cuál es tu caso, porque cambia la protección.',
    productos: ['cuenta_remunerada', 'fci'],
  },
  {
    id: 'accion-cedear-etf',
    titulo: 'Diferencia entre acción, CEDEAR y ETF',
    idea: 'Son tres formas de invertir en empresas, y cambia cuántas y desde dónde.',
    izq: { nombre: 'Acción y CEDEAR', texto: 'Una acción es un pedacito de una empresa. Un CEDEAR es un papel en pesos que representa un pedacito de una empresa del exterior (como Apple), y se compra desde un broker de acá.' },
    der: { nombre: 'ETF', texto: 'Un paquete que reúne muchas empresas en una sola compra. SPY, por ejemplo, reúne a las 500 más grandes de EE.UU. Si una cae, las otras la compensan en parte.' },
    retener: 'Elegir una sola empresa concentra el riesgo; un ETF lo reparte.',
    productos: ['cedear'],
  },
  {
    id: 'oficial-mep',
    titulo: 'Diferencia entre dólar oficial y dólar MEP',
    idea: 'Los dos son dólares, pero se consiguen por caminos distintos y cuestan distinto.',
    izq: { nombre: 'Dólar oficial', texto: 'El que se compra en un banco, con las reglas y los límites que ponga el Estado.' },
    der: { nombre: 'Dólar MEP', texto: 'La forma legal de comprar dólares desde un broker, sin pasar por el cupo del banco. Su precio suele ser distinto al del oficial.' },
    retener: 'La diferencia de precio entre los dos se llama brecha.',
    productos: ['dolar'],
  },
  {
    id: 'ahorrar-vs-invertir',
    titulo: 'Diferencia entre ahorrar e invertir',
    idea: 'Cada una sirve para algo distinto, y no hace falta elegir una sola.',
    izq: { nombre: 'Ahorrar', texto: 'Guardar plata para tenerla cuando la necesites, sin sobresaltos. Importa poder sacarla rápido.' },
    der: { nombre: 'Invertir', texto: 'Aceptar que el valor suba y baje a cambio de que, con tiempo, pueda crecer más. Importa poder esperar.' },
    retener: 'Lo que vas a necesitar pronto es para ahorrar; lo que podés dejar años, para invertir.',
    productos: ['cuenta_remunerada', 'cedear'],
  },
];

/**
 * Las que tienen que ver con lo que hoy se recomienda van primero; el resto, en su orden.
 * Es estable: dentro de cada grupo no se cambia el orden.
 */
export function ordenarTarjetas(tarjetas: Tarjeta[], recomendados: ProductoId[]): Tarjeta[] {
  const relevante = (t: Tarjeta) => t.productos.some((p) => recomendados.includes(p));
  return [...tarjetas.filter(relevante), ...tarjetas.filter((t) => !relevante(t))];
}
