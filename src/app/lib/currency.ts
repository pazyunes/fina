// Conversión USD → ARS usando la cotización del blue (venta).
export function arsFromUsd(usd: number, rate: number): number {
  return Math.round(usd * rate);
}

// "600000" -> "600.000"
export function formatArs(value: number): string {
  return `$${value.toLocaleString('es-AR').replace(/,/g, '.')}`;
}

// "500" -> "USD 500"
export function formatUsd(value: number): string {
  return `USD ${value.toLocaleString('es-AR').replace(/,/g, '.')}`;
}
