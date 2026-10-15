// Control de lo que el modelo NO puede decir, revisado en código.
//
// El prompt ya lo pide, pero un prompt es una instrucción, no una garantía. Si
// una recomendación que reta o que nombra un instrumento de inversión llega a
// la pantalla, el costo es alto: rompe la regla de identidad de FINA (la app no
// reta ni moraliza) o, en el segundo caso, se parece a un asesoramiento de
// inversión que en Argentina requiere registro en la CNV.
//
// Se compara sin tildes y en minúsculas, así "Deberías" y "deberias" caen igual.

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Tono: retar, ordenar, moralizar, o tratar un gasto como un error.
const PROHIBIDO_TONO: { patron: RegExp; porque: string }[] = [
  { patron: /\bte pasaste\b/, porque: 'reta' },
  { patron: /\bte excediste\b|\bexcediste\b/, porque: 'reta' },
  { patron: /\bsuperaste tu (presupuesto|tope|limite)\b/, porque: 'reta' },
  { patron: /\bgastaste de mas\b|\bgastas de mas\b|\bgastar de mas\b/, porque: 'moraliza el consumo' },
  { patron: /\bderroch/, porque: 'moraliza el consumo' },
  { patron: /\bdespilfarr/, porque: 'moraliza el consumo' },
  { patron: /\birresponsab/, porque: 'juzga a la persona' },
  { patron: /\bno deberias\b|\bdeberias dejar\b|\btenes que dejar\b|\btendrias que dejar\b/, porque: 'ordena' },
  // "Dejá de pedir delivery" ordena; "tu ahorro no deja de crecer" no.
  { patron: /(?<!no )\bdeja de\b|\bdejar de gastar\b/, porque: 'ordena' },
  { patron: /\bmal gasto\b|\bgasto innecesario\b|\bgastos innecesarios\b/, porque: 'trata un gasto como un error' },
  // "Cuidado" alarma; "Belleza y cuidado personal" es el nombre de una sección.
  { patron: /\bcuidado\b(?! personal)|\bojo con\b|\balerta\b/, porque: 'alarma' },
  { patron: /\bcapricho/, porque: 'juzga el consumo' },
];

// Instrumentos y productos de inversión puntuales. Hablar de "invertir" en
// general está bien; nombrar en qué, no.
const PROHIBIDO_INVERSION: RegExp[] = [
  // "acciones" sola no: "tus acciones de hoy" es castellano común. Sí comprar
  // o invertir en acciones.
  /\bcedear/, /\b(comprar|invertir en|compra de) acciones\b/, /\bbono(s)? (del tesoro|soberano|corporativ|ley)/, /\bobligaciones negociables\b/,
  /\bplazo fijo\b/, /\bfci\b|\bfondo(s)? comun(es)? de inversion\b/, /\bcaucion/, /\bletras?\b(?= del tesoro)|\blecap\b|\blede\b|\bboncap\b/,
  /\bbitcoin\b|\bbtc\b|\bethereum\b|\bcripto/, /\busdt\b|\busdc\b|\bstablecoin/, /\bdolar mep\b|\bmep\b/,
  /\bbalanz\b|\binvertironline\b|\biol\b|\bcocos\b|\bppi\b|\bbull market\b/,
  /\bspy\b|\bs&p 500\b|\bnasdaq\b/,
  /\brendimiento (del|de un) \d/, /\bvas a ganar\b|\bganancia asegurada\b|\brinde asegurado\b/,
];

export type Problema = { campo: string; porque: string; fragmento: string };

export function revisarTexto(campo: string, texto: string): Problema[] {
  const t = normalizar(texto);
  const problemas: Problema[] = [];
  for (const { patron, porque } of PROHIBIDO_TONO) {
    const m = t.match(patron);
    if (m) problemas.push({ campo, porque, fragmento: m[0] });
  }
  for (const patron of PROHIBIDO_INVERSION) {
    const m = t.match(patron);
    if (m) problemas.push({ campo, porque: 'nombra un instrumento o producto de inversión puntual', fragmento: m[0] });
  }
  return problemas;
}

// ── Formato (frontend.md §5.5) ───────────────────────────────────────────
// Esto no se rechaza: se arregla. Un guion largo no hace mala a una
// recomendación, y volver a pedirla costaría otra generación.
//
// · "algo — aclaración — sigue" pasa a "algo, aclaración, sigue": el guion
//   largo casi siempre marca una pausa, y la coma es la pausa que corresponde.
// · Un guion entre números ("10–20") es un rango: "10 a 20".
// · Un guion al principio de una línea es una viñeta: se saca.
// · Comillas rizadas y angulares pasan a rectas; el apóstrofo rizado, a recto.
// · Emojis y viñetas Unicode decorativas se sacan.
// Las rayas van como rango de U+2012 a U+2015: guion de cifras, guion medio,
// raya y barra horizontal.
export function limpiarTexto(texto: string): string {
  let t = texto;
  if (/[‒-―]/.test(t)) {
    t = t
      // Rango de números, con o sin signo de pesos: "entre 10–20" pasa a
      // "entre 10 y 20"; "10–20" suelto, a "10 a 20".
      .replace(/(\bentre\s+(?:US)?\$?\s?[\d.,]*\d)\s*[‒-―]\s*((?:US)?\$?\s?\d)/gi, '$1 y $2')
      .replace(/(\d)\s*[‒-―]\s*((?:US)?\$?\s?\d)/g, '$1 a $2')
      .replace(/^[ \t]*[‒-―][ \t]*/gm, '')
      // Antes de un signo de puntuación, la raya sobra.
      .replace(/\s*[‒-―]\s*(?=[.,;:!?)])/g, '')
      .replace(/\s*[‒-―]\s*/g, ', ');
  }
  t = t
    // Comillas dobles rizadas, bajas, angulares y el signo de segundos.
    .replace(/[“-‟«»″]/g, '"')
    // Comillas simples rizadas y el signo de minutos.
    .replace(/[‘-‛′]/g, "'")
    // Viñetas: punto, cuadrado, círculos y triángulo.
    .replace(/[•▪●◦‣⁃]\s*/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    // Lo que queda de un emoji compuesto: el unidor y el selector de variante.
    .replace(/[‍️]/g, '')
    // Lo que pudo quedar de los reemplazos: comas dobles, espacio antes de coma.
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return t;
}

export type RecomendacionTexto = { titulo: string; texto: string; dato: { valor: string; referencia: string } };

export function revisarRecomendacion(r: RecomendacionTexto): Problema[] {
  return [
    ...revisarTexto('titulo', r.titulo),
    ...revisarTexto('texto', r.texto),
    ...revisarTexto('dato', `${r.dato.valor} ${r.dato.referencia}`),
  ];
}
