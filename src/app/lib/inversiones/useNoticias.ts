import { useEffect, useState } from 'react';
import { traerNoticias, type NoticiaInversion } from '../../api/v2/noticias.js';
import type { ProductoId } from './catalogo.js';

/** Las noticias de hoy para un tipo de inversión. Mientras cargan, o si no hay, la lista está vacía: no se muestra nada. */
export function useNoticias(tipo: ProductoId): NoticiaInversion[] {
  const [noticias, setNoticias] = useState<NoticiaInversion[]>([]);
  useEffect(() => {
    let vivo = true;
    setNoticias([]);
    traerNoticias(tipo).then((n) => { if (vivo) setNoticias(n); });
    return () => { vivo = false; };
  }, [tipo]);
  return noticias;
}
