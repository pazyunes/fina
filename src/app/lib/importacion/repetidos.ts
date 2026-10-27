import type { GastoImportado } from './tipos';

// Para no importar dos veces lo mismo: un gasto del archivo es "el mismo" que
// uno ya anotado si coincide el día, el monto y (más o menos) la descripción.

type Existente = { fecha: string; descripcion: string; monto: number };

const normal = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function esRepetido(g: GastoImportado, existentes: Existente[]): boolean {
  if (!g.fecha) return false;
  const d = normal(g.descripcion);
  return existentes.some((e) => e.fecha === g.fecha && Math.abs(e.monto - g.monto) < 0.01 && (normal(e.descripcion) === d || d === '' || normal(e.descripcion) === ''));
}

/** A qué categoría ya creada corresponde el nombre que traía el archivo; null si ninguna. */
export function categoriaQueCoincide(nombre: string | null, existentes: { id: string; nombre: string }[]): string | null {
  if (!nombre) return null;
  const n = normal(nombre);
  return existentes.find((c) => normal(c.nombre) === n)?.id ?? null;
}
