// Cómo se reparte la plata según el PLAZO y el PERFIL. Es la tabla que completó el asesor:
//   · el plazo decide EN QUÉ (qué tipo de inversión tiene sentido);
//   · el perfil decide CUÁNTO (qué parte de la plata va a lo que sube y baja);
//   · el monto no decide nada: lo mismo para $50.000 que para $5.000.000.
//
// Cada tramo de plazo arma "grupos": un porcentaje de la plata y las inversiones que sirven para esa
// parte (la persona elige una; el motor las ordena por rendimiento).
//
//   Menos de 3 meses   todo lo mismo para cualquier perfil: plata a mano (plazo fijo, cuenta, fondo,
//                      letras). Aunque rinda menos que la inflación, a tan poco tiempo es mejor que nada.
//   3 a 12 meses       conservador: todo a mano. Moderado: la mitad a mano y la mitad en renta fija
//                      (letras, bonos CER, UVA: "suele rendir positivo en ese tiempo"). Arriesgado: la mitad
//                      en renta fija y la mitad en CEDEARs.
//   1 a 3 años         plazo fijo UVA y cuenta remunerada, para cualquier perfil.
//   Más de 3 años      conservador 10% CEDEARs, moderado 50%, arriesgado 100% (y la cuenta para tener
//                      plata a mano); el resto, en plazo fijo UVA o cuenta.
//
// Función pura, sin red ni React.

import type { PerfilRiesgo, ProductoId } from './catalogo.js';

export type Tramo = 'corto' | 'medio' | 'largo' | 'mlargo';

export const TRAMOS: Record<Tramo, string> = {
  corto: 'menos de 3 meses',
  medio: 'entre 3 y 12 meses',
  largo: 'entre 1 y 3 años',
  mlargo: 'más de 3 años',
};

/** En qué tramo cae un plazo en meses. Sin plazo dicho, se asume el del medio (el más prudente que no regala la plata). */
export function tramoDe(meses: number | null): Tramo {
  if (meses === null) return 'medio';
  if (meses < 3) return 'corto';
  if (meses < 12) return 'medio';
  if (meses < 36) return 'largo';
  return 'mlargo';
}

export type GrupoId = 'liquidez' | 'renta_fija' | 'ahorro' | 'crecimiento';

export type Grupo = {
  id: GrupoId;
  /** Qué parte de la plata, fracción (0,5 = la mitad). */
  peso: number;
  /** Las inversiones que sirven para esta parte. */
  productos: ProductoId[];
};

/** Qué sirve para cada parte. */
export const PRODUCTOS_DEL_GRUPO: Record<GrupoId, ProductoId[]> = {
  liquidez: ['plazo_fijo', 'cuenta_remunerada', 'fci', 'letra'],
  renta_fija: ['letra', 'bono_cer', 'plazo_fijo_uva'],
  ahorro: ['plazo_fijo_uva', 'cuenta_remunerada'],
  crecimiento: ['cedear'],
};

/** Qué parte de la plata va a CEDEARs a más de 3 años, según el perfil (criterio del asesor). */
export const PESO_CEDEAR_A_LARGO_PLAZO: Record<PerfilRiesgo, number> = {
  conservador: 0.1,
  moderado: 0.5,
  arriesgado: 1,
};

const g = (id: GrupoId, peso: number, productos: ProductoId[] = PRODUCTOS_DEL_GRUPO[id]): Grupo => ({ id, peso, productos });

export function armarCartera(perfil: PerfilRiesgo, meses: number | null): Grupo[] {
  switch (tramoDe(meses)) {
    case 'corto':
      return [g('liquidez', 1)];
    case 'medio': {
      if (perfil === 'conservador') return [g('liquidez', 1)];
      // Con dos partes, las letras van en la de renta fija: la de plata a mano queda para plazo fijo, cuenta y fondo.
      // Sin saber para cuándo es la plata, al arriesgado no se le sugieren CEDEARs: se lo trata como moderado.
      if (perfil === 'moderado' || meses === null) return [g('liquidez', 0.5, PRODUCTOS_DEL_GRUPO.liquidez.filter((id) => id !== 'letra')), g('renta_fija', 0.5)];
      return [g('renta_fija', 0.5), g('crecimiento', 0.5)];
    }
    case 'largo':
      return [g('ahorro', 1)];
    case 'mlargo': {
      const cedear = PESO_CEDEAR_A_LARGO_PLAZO[perfil];
      // El arriesgado va todo a CEDEARs; igual se le muestra la cuenta, sin porcentaje, para tener plata a mano.
      if (cedear >= 1) return [g('crecimiento', 1), g('liquidez', 0, ['cuenta_remunerada'])];
      return [g('ahorro', 1 - cedear), g('crecimiento', cedear)].sort((a, b) => b.peso - a.peso);
    }
  }
}
