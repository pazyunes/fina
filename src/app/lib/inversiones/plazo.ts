// Uno de los errores más comunes: no hacer coincidir el plazo de la inversión con el del dinero
// (acciones para algo que se necesita en 3 meses, o un plazo fijo con plata que no hace falta en
// 10 años). Cuando la persona elige algo que no encaja con el plazo que dijo, se lo contamos antes
// de empezar. Sin retar ni bloquear: la decisión es suya.

import { enMeses } from './formato.js';
import type { Producto } from './catalogo.js';

export function avisoDePlazo(producto: Producto, horizonteMeses: number | null): string | null {
  if (horizonteMeses === null) return null;
  if (horizonteMeses < producto.horizonteMinimoMeses) {
    return producto.id === 'cedear'
      ? `Dijiste que vas a necesitar la plata en ${enMeses(horizonteMeses)}, y esto se piensa para ${enMeses(producto.horizonteMinimoMeses)} o más. Si el precio baja justo cuando la necesitás, vendés con pérdida. Para plazos más cortos suelen encajar mejor otras opciones.`
      : `Dijiste que vas a necesitar la plata en ${enMeses(horizonteMeses)}, y esto pide dejarla al menos ${enMeses(producto.horizonteMinimoMeses)}. Fijate que el plazo coincida con cuándo la vas a usar.`;
  }
  if ((producto.rol === 'caja' || producto.id === 'plazo_fijo') && horizonteMeses >= 36) {
    return 'Dijiste que podés dejar la plata más de 3 años. Para plazos tan largos suele convenir algo que pueda crecer más que una cuenta para tener a mano: fijate que el plazo de la inversión coincida con el de tu plata.';
  }
  return null;
}
