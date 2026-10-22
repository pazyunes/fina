// Las tasas que declaran las personas cuando ven su rendimiento en la app de su billetera
// o de su fondo. Esas plataformas no tienen una API pública con su tasa: lo que cada
// persona VE en su pantalla es, por ahora, el dato real.
//
// Para que no pese una sola persona (ni un error de tipeo), sólo se usa la MEDIANA de lo
// declarado en los últimos 7 días, y únicamente si lo declararon al menos 3 personas
// distintas. Cada persona cuenta una vez por lugar, con su declaración más reciente.

import type { TasaDeclarada } from './mercadoTipos';

export const MIN_PERSONAS = 3;
export const DIAS_DE_VIGENCIA = 7;

export type FilaDeclarada = { user_id: string; kind: string; provider: string; fund: string; tna: number; declared_on: string };

const mediana = (xs: number[]): number => {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** Agrupa por lugar y se queda con la mediana de los lugares con suficientes personas. */
export function agregarDeclaradas(filas: FilaDeclarada[]): Record<string, TasaDeclarada> {
  // Una declaración por persona y lugar: la más reciente.
  const ultimas = new Map<string, FilaDeclarada>();
  for (const f of filas) {
    if (!(f.tna > 0 && f.tna < 5)) continue;
    const k = `${f.user_id}|${f.kind}|${f.provider}|${f.fund}`;
    const previa = ultimas.get(k);
    if (!previa || f.declared_on > previa.declared_on) ultimas.set(k, f);
  }
  const porLugar = new Map<string, FilaDeclarada[]>();
  for (const f of ultimas.values()) {
    const clave = `${f.kind}|${f.provider}|${f.fund}`;
    porLugar.set(clave, [...(porLugar.get(clave) ?? []), f]);
  }
  const salida: Record<string, TasaDeclarada> = {};
  for (const [clave, lista] of porLugar) {
    if (lista.length < MIN_PERSONAS) continue;
    salida[clave] = { tna: mediana(lista.map((x) => x.tna)), n: lista.length, fecha: lista.map((x) => x.declared_on).sort().pop() ?? '' };
  }
  return salida;
}
