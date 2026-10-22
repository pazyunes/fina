import { useCallback, useEffect, useState } from 'react';
import { mercadoEnMemoria, traerMercado, type EstadoMercado } from '../../api/v2/mercado';

/**
 * Los datos de mercado, con las cuatro caras de todo dato remoto (guía §10):
 * cargando, error, listo. "Vacío" no existe acá: sin datos es un error, y el
 * error se dice (la recomendación no se arma sobre aire).
 */
export function useMercado(): { estado: EstadoMercado; reintentar: () => void } {
  const [estado, setEstado] = useState<EstadoMercado>(() => {
    const m = mercadoEnMemoria();
    return m ? { tipo: 'listo', mercado: m } : { tipo: 'cargando' };
  });

  const cargar = useCallback((forzar: boolean) => {
    let vivo = true;
    traerMercado(forzar).then((m) => {
      if (!vivo) return;
      setEstado(m ? { tipo: 'listo', mercado: m } : { tipo: 'error' });
    });
    return () => { vivo = false; };
  }, []);

  useEffect(() => cargar(false), [cargar]);

  return {
    estado,
    reintentar: () => {
      setEstado({ tipo: 'cargando' });
      cargar(true);
    },
  };
}
