// Lo que sale de leer un archivo, unas notas o una captura con gastos de antes.

export type GastoImportado = {
  /** 'YYYY-MM-DD', o null si el archivo no la trae. */
  fecha: string | null;
  descripcion: string;
  /** Siempre positivo. */
  monto: number;
  moneda: 'ARS' | 'USD';
  /** El nombre de la categoría que traía el archivo, si lo traía. */
  categoria: string | null;
};

export type LecturaImportacion =
  | { estado: 'ok'; gastos: GastoImportado[]; omitidos: number }
  | { estado: 'vacio' }
  | { estado: 'no_se_pudo' }
  | { estado: 'no_configurado' };

/** Una celda ya leída: texto, número (de Excel) o null. Las fechas de Excel llegan como 'YYYY-MM-DD'. */
export type Celda = string | number | null;
export type Tabla = Celda[][];

/** Cuántos gastos entran en una importación. */
export const MAX_IMPORTADOS = 500;
