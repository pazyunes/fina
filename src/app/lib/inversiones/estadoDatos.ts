import type { Mercado } from './mercadoTipos';

// Cuándo un problema con los datos es motivo para decirle a la persona "hubo un error".
//
// La regla de FINA es no mostrarle a la persona detalles de qué fuente falló, ni
// recomendarle con datos a medias: si algo esencial falla, ve un error corto y reintenta
// más tarde. El detalle (qué fuente, por qué) le llega a quien mantiene FINA por otro lado:
// notificación, la tabla data_alerts y /api/estado-datos.

/** Fuentes que, si fallan, no impiden recomendar: se usan para algo extra, no para decidir. */
const OPCIONALES = ['letras', 'riesgo país', 'índices del INDEC', 'S&P 500', 'BADLAR'];

export function hayFallaEsencial(m: Mercado): boolean {
  return (
    m.desactualizado
    || m.fallas.some((f) => !OPCIONALES.some((o) => f.startsWith(o)))
    || m.alertas.some((a) => a.gravedad === 'grave')
  );
}

export const MENSAJE_DE_ERROR = {
  titulo: 'Hubo un error al traer los datos',
  texto: 'Probá de nuevo más tarde.',
} as const;
