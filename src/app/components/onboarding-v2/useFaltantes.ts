import { useEffect, useRef, useState } from 'react';
import { llevarA } from './alLlegar';

// Lo que falta completar en un formulario.
//
// El botón de guardar no se apaga: con un botón gris no se sabía qué faltaba.
// Al tocarlo con algo sin completar, se marca cada campo que falta (borde y una
// línea abajo, con BORDE_FALTA y TextoFalta de shared.tsx) y la vista va al
// primero, con el foco adentro. La marca se va sola cuando el campo se completa.
//
// `faltan` va en el orden en que los campos aparecen en pantalla: el primero
// que falta es al que se lleva la vista. Cada campo lleva `data-campo="<clave>"`
// dentro del contenedor que recibe `ref`, así dos formularios abiertos en la
// misma pantalla (uno nuevo y otro editándose en su renglón) no se pisan.
//
// `abierto`: para los formularios que no se desmontan al cerrarse (una hoja o
// un bloque que se muestra y se esconde). Al cerrarse se borra la marca, así no
// aparecen ya marcados la próxima vez que se abren.

const ENFOCABLE = 'input, select, textarea, button';

export function useFaltantes<K extends string>(faltan: Record<K, boolean>, abierto = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [intento, setIntento] = useState(false);

  useEffect(() => { if (!abierto) setIntento(false); }, [abierto]);

  const marcado = (campo: K): boolean => intento && faltan[campo];

  function intentar(guardar: () => void) {
    const primero = (Object.keys(faltan) as K[]).find((k) => faltan[k]);
    if (!primero) { guardar(); return; }
    setIntento(true);
    const campo = () => ref.current?.querySelector<HTMLElement>(`[data-campo="${primero}"]`);
    llevarA(campo, () => {
      const el = campo();
      return el?.matches(ENFOCABLE) ? el : el?.querySelector<HTMLElement>(ENFOCABLE);
    });
  }

  return { ref, marcado, intentar };
}
