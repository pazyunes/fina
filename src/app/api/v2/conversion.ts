import type { Moneda } from './tipos';

// Pasar un registro a la moneda del objetivo.
//
// Un objetivo en dólares puede tener registros en pesos y al revés: se separan
// 80.000 pesos para un viaje que cuesta USD 1.500. Sumar los números sueltos
// daba "USD 80.000" y el objetivo se mostraba cumplido sin estarlo.
//
// Qué cotización se usa:
// · De dólares a pesos, la CONGELADA del día en que se registró (`montoArs`):
//   lo que se separó ese día valía eso, y no cambia cuando cambia el dólar.
// · De pesos a dólares, la de HOY: no hay otra: lo que se guardó fue un monto
//   en pesos. Por eso el total queda ESTIMADO y así se muestra (regla 4).

export type RegistroConvertible = { monto: number; moneda: Moneda; montoArs?: number | null };

/** El registro en `destino`, o null si no hay cotización para convertirlo. */
export function enMoneda(c: RegistroConvertible, destino: Moneda, dolar: number | null): number | null {
  if (c.moneda === destino) return c.monto;
  if (destino === 'ARS') {
    if (c.montoArs != null) return c.montoArs;
    return c.moneda === 'USD' && dolar ? c.monto * dolar : null;
  }
  if (destino === 'USD') {
    const enPesos = c.moneda === 'ARS' ? c.monto : c.montoArs;
    return enPesos != null && dolar ? enPesos / dolar : null;
  }
  // Otra moneda (no tiene cotización en FINA): sólo suma lo que ya está en ella.
  return null;
}

export type Total = {
  /** Suma de lo que se pudo convertir, en la moneda pedida. */
  total: number;
  /** Cuántos registros necesitaron el dólar de hoy: el total es estimado. */
  convertidos: number;
  /** Cuántos no se pudieron convertir (sin cotización). */
  sinConvertir: number;
};

export function sumarEn(cs: RegistroConvertible[], destino: Moneda, dolar: number | null): Total {
  let total = 0, convertidos = 0, sinConvertir = 0;
  for (const c of cs) {
    const v = enMoneda(c, destino, dolar);
    if (v === null) { sinConvertir++; continue; }
    if (c.moneda !== destino) convertidos++;
    total += v;
  }
  return { total, convertidos, sinConvertir };
}
