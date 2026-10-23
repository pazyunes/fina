// Cómo se reparte la plata según el PLAZO y el PERFIL. Es la tabla que armamos con el criterio del asesor:
//   · el plazo decide EN QUÉ (qué tipo de inversión tiene sentido);
//   · el perfil decide CUÁNTO (qué parte de la plata va a lo que sube y baja);
//   · el monto no decide nada: lo mismo para $50.000 que para $5.000.000.
//
// Cada tramo de plazo arma "partes": un porcentaje de la plata y las inversiones que sirven para esa
// parte (la persona elige una; el motor las ordena por rendimiento).
//
//   "A mano" = plazo fijo, cuenta remunerada y money market (casi nunca bajan) y, a menos de 3 meses, letras cortas.
//   "Renta fija" = letras, bonos CER y plazo fijo UVA, siempre con un vencimiento que coincida con el plazo.
//
//                 Menos de 3 meses | 3 a 12 meses              | 1 a 3 años                    | Más de 3 años
//   Conservador   100% a mano      | 70% a mano, 30% r. fija   | 70% UVA, 30% bonos CER        | 80% r. fija, 20% CEDEARs
//   Moderado      100% a mano      | 50% a mano, 50% r. fija   | 70% r. fija, 30% CEDEARs      | 50% r. fija, 50% CEDEARs
//   Arriesgado    100% a mano      | 30% a mano, 70% r. fija   | 50% r. fija, 50% CEDEARs      | 100% CEDEARs (+ la cuenta, sin %)
//
// Nunca CEDEARs a menos de 1 año: el plazo manda sobre el perfil (el perfil dice cuánto riesgo querés
// tomar; el plazo, cuánto podés).
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

export type GrupoId = 'liquidez' | 'renta_fija' | 'crecimiento';

/** Cómo se llama cada parte de la plata, para decírselo a la persona. */
export const NOMBRE_DE_PARTE: Record<GrupoId, string> = {
  liquidez: 'a mano',
  renta_fija: 'renta fija',
  crecimiento: 'CEDEARs',
};

export type Grupo = {
  id: GrupoId;
  /** Qué parte de la plata, fracción (0,5 = la mitad). */
  peso: number;
  /** Las inversiones que sirven para esta parte. */
  productos: ProductoId[];
};

const A_MANO: ProductoId[] = ['plazo_fijo', 'cuenta_remunerada', 'fci'];

/** La renta fija de cada plazo: a menos de 3 meses sólo letras cortas (están entre las de a mano). */
export function rentaFijaDe(tramo: Tramo): ProductoId[] {
  switch (tramo) {
    case 'corto': return ['letra'];
    case 'medio': return ['letra', 'bono_cer', 'plazo_fijo_uva'];
    case 'largo': return ['plazo_fijo_uva', 'bono_cer'];
    case 'mlargo': return ['bono_cer', 'plazo_fijo_uva'];
  }
}

/** Qué parte de la plata va a CEDEARs de 1 a 3 años y a más de 3 años, según el perfil. */
export const PESO_CEDEAR: Record<'largo' | 'mlargo', Record<PerfilRiesgo, number>> = {
  largo: { conservador: 0, moderado: 0.3, arriesgado: 0.5 },
  mlargo: { conservador: 0.2, moderado: 0.5, arriesgado: 1 },
};

/** Qué parte de la plata va a lo que está a mano de 3 a 12 meses; el resto es renta fija. */
export const PESO_A_MANO_DE_3_A_12: Record<PerfilRiesgo, number> = { conservador: 0.7, moderado: 0.5, arriesgado: 0.3 };

const g = (id: GrupoId, peso: number, productos: ProductoId[]): Grupo => ({ id, peso, productos });

export function armarCartera(perfil: PerfilRiesgo, meses: number | null): Grupo[] {
  const tramo = tramoDe(meses);
  switch (tramo) {
    case 'corto':
      // Todo lo mismo para cualquier perfil. Aunque rinda menos que la inflación, a tan poco tiempo es mejor que nada.
      return [g('liquidez', 1, [...A_MANO, 'letra'])];
    case 'medio': {
      // Sin saber para cuándo es la plata, al arriesgado se lo trata como moderado.
      const mano = PESO_A_MANO_DE_3_A_12[meses === null && perfil === 'arriesgado' ? 'moderado' : perfil];
      return [g('liquidez', mano, A_MANO), g('renta_fija', 1 - mano, rentaFijaDe(tramo))];
    }
    case 'largo': {
      const cedear = PESO_CEDEAR.largo[perfil];
      // El conservador reparte su renta fija entre el plazo fijo UVA (70%) y los bonos CER (30%).
      if (perfil === 'conservador') return [g('renta_fija', 0.7, ['plazo_fijo_uva']), g('renta_fija', 0.3, ['bono_cer'])];
      return [g('renta_fija', 1 - cedear, rentaFijaDe(tramo)), g('crecimiento', cedear, ['cedear'])];
    }
    case 'mlargo': {
      const cedear = PESO_CEDEAR.mlargo[perfil];
      // El arriesgado va todo a CEDEARs; igual se le muestra la cuenta, sin porcentaje, como reserva opcional.
      if (cedear >= 1) return [g('crecimiento', 1, ['cedear']), g('liquidez', 0, ['cuenta_remunerada'])];
      return [g('renta_fija', 1 - cedear, rentaFijaDe(tramo)), g('crecimiento', cedear, ['cedear'])].sort((a, b) => b.peso - a.peso);
    }
  }
}

/**
 * Los vencimientos que sirven para este plazo, en días: el vencimiento tiene que coincidir con cuándo se
 * necesita la plata (si no, hay que vender antes y el precio puede ser menor). Sin plazo dicho, la ventana es amplia.
 */
export function ventanaDeVencimiento(producto: 'letra' | 'bono_cer', meses: number | null): { min: number; max: number } {
  const tramo = tramoDe(meses);
  if (meses === null) return producto === 'letra' ? { min: 15, max: 200 } : { min: 90, max: 730 };
  const dias = meses * 30;
  if (producto === 'letra') {
    // Letras cortas a menos de 3 meses; si no, las que vencen antes del plazo.
    return { min: 15, max: tramo === 'corto' ? Math.min(90, Math.max(dias, 30)) : Math.max(dias, 30) };
  }
  switch (tramo) {
    case 'corto': return { min: 90, max: 90 };
    case 'medio': return { min: 90, max: Math.max(dias, 90) };
    case 'largo': return { min: 365, max: 1095 };
    case 'mlargo': return { min: 1095, max: 2000 };
  }
}
