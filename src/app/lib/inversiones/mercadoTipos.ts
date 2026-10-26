// Forma de los datos de mercado que FINA usa para recomendar inversiones.
//
// Los arma el servidor (api/mercado.ts) y los lee la app (api/v2/mercado.ts).
// Viven acá, y no en api/, porque los dos lados tienen que estar de acuerdo en
// la forma y porque la lógica de frescura (¿este dato sirve todavía?) es pura.
//
// REGLA DE ORO: ningún número entra acá sin su fecha y su fuente. Un dato sin
// fecha no se puede declarar vigente ni vencido, y entonces tampoco se puede
// recomendar en base a él.

/** Un valor con la fecha a la que corresponde y de dónde salió. */
export type Dato<T> = {
  valor: T;
  /** 'YYYY-MM-DD' a la que corresponde el valor (no cuándo lo bajamos). */
  fecha: string;
  fuente: string;
};

/** Un fondo común de inversión, con su rendimiento calculado del valor de cuotaparte. */
export type FondoMercado = {
  /** Nombre tal cual figura en CAFCI. */
  id: string;
  fecha: string;
  vcp: number;
  /** Rendimiento anualizado (fracción: 0.21 = 21%) del último día, de la última semana y del último mes. null = no hay historia para calcularlo. */
  tna1: number | null;
  tna7: number | null;
  tna30: number | null;
};

/** Una cuenta remunerada de billetera o banco, con tasa publicada, tope y condiciones. */
export type CuentaMercado = {
  id: string;
  /** Fracción. */
  tna: number;
  tea: number | null;
  /** Hasta cuánto saldo rinde esa tasa. null = sin tope informado. */
  tope: number | null;
  condiciones: string;
  fecha: string;
};

export type TasaPlazo = { plazoMinDias: number; plazoMaxDias: number; tna: number };

export type PlazoFijoBanco = {
  entidad: string;
  /** Fracción. Tasa para clientes del banco. */
  tnaClientes: number;
  tasas: TasaPlazo[];
};

export type LetraMercado = {
  ticker: string;
  /** Fracciones. */
  tna: number;
  tem: number;
  vencimiento: string;
  dias: number;
  precio: number;
};

/** El plazo fijo UVA de un banco: lo que suma sobre la UVA (TNA, fracción) según el plazo. Sólo lo publican algunos bancos. */
export type PlazoFijoUvaBanco = { entidad: string; tasas: TasaPlazo[] };

/** Un bono que se ajusta por CER (la inflación): lo que rinde POR ENCIMA de la inflación si se espera al vencimiento. */
export type BonoCerMercado = {
  ticker: string;
  precio: number;
  /** TIR real (fracción anual): lo que rinde sobre el CER. */
  tir: number;
  vencimiento: string;
  dias: number;
  /** Lo operado, en pesos: un bono que casi no se opera no es fácil de vender. */
  volumen: number;
};

export type CedearMercado = {
  simbolo: string;
  precio: number;
  /** Variación del día, en porcentaje (1.2 = +1,2%). */
  variacionDia: number;
};

/** La mediana de lo que declaran varias personas para un mismo lugar. */
export type TasaDeclarada = { tna: number; n: number; fecha: string };

/** Un chequeo que no cerró: dos fuentes que no coinciden, un valor que no es verosímil. */
export type Alerta = {
  /** Qué dato: 'dolar', 'inflacion', 'cedears'… */
  clave: string;
  /** 'grave' saca de las recomendaciones lo que depende de ese dato; 'aviso' sólo avisa. */
  gravedad: 'aviso' | 'grave';
  mensaje: string;
};

/** Los índices mensuales del INDEC por rubro, para calcular la inflación de cada persona. */
export type IpcRegion = Record<string, { fecha: string; valor: number }[]>;
export type IpcRubros = { nacional: IpcRegion; gba: IpcRegion };

/** Lo que se sabe del S&P 500 (el índice que sigue SPY), en dólares. */
export type SpyEstadisticas = {
  precioUsd: number;
  /** Rendimiento anualizado de los últimos 10 años, en porcentaje. */
  anualizado10a: number | null;
  /** El peor período de 12 meses de esos 10 años, en porcentaje. */
  peorAnio: number | null;
};

export type Mercado = {
  /** Cuándo armó el servidor este paquete (ISO). */
  generadoEn: string;
  /** true si el servidor no pudo traer datos nuevos y devolvió el último que tenía guardado. */
  desactualizado: boolean;
  inflacion: {
    /** Últimos meses publicados por el INDEC, del más viejo al más nuevo. `valor` en porcentaje (1.9 = 1,9%). */
    meses: { fecha: string; valor: number }[];
    /** Inflación esperada a 12 meses (REM del BCRA), en porcentaje anual. */
    esperada12m: Dato<number> | null;
    /** Cuánto subió la UVA en los últimos ~30 días, en porcentaje: el termómetro diario de la inflación. */
    uva30d: Dato<number> | null;
    /** Inflación interanual calculada con los últimos 12 meses, en porcentaje. */
    interanual: number | null;
    /** Los mismos meses según la segunda fuente (INDEC publicado en datos.gob.ar), para chequear. null si no respondió. */
    control: { fecha: string; valor: number }[] | null;
  };
  tasas: {
    /** TNA en porcentaje (24 = 24%). */
    tamar: Dato<number> | null;
    badlar: Dato<number> | null;
  };
  plazoFijo: Dato<PlazoFijoBanco[]> | null;
  cuentas: Dato<CuentaMercado[]> | null;
  fondos: Dato<FondoMercado[]> | null;
  letras: Dato<LetraMercado[]> | null;
  /** Bonos CER (renta fija que sigue a la inflación). Opcional: los paquetes guardados antes no lo traen. */
  bonosCer?: Dato<BonoCerMercado[]> | null;
  /** Lo que suma sobre la UVA cada banco que lo publica. Opcional: los paquetes guardados antes no lo traen. */
  plazoFijoUva?: Dato<PlazoFijoUvaBanco[]> | null;
  cedears: Dato<CedearMercado[]> | null;
  dolar: {
    oficial: Dato<number> | null;
    mep: Dato<number> | null;
    ccl: Dato<number> | null;
    blue: Dato<number> | null;
    /** Brecha MEP contra oficial, en porcentaje. */
    brechaMep: number | null;
    /** Variación del MEP en los últimos ~30 días, en porcentaje. */
    mep30d: number | null;
  };
  riesgoPais: Dato<number> | null;
  /** El S&P 500 en dólares: sirve para decir qué rindió a largo plazo en lugar de repetir un número escrito a mano. */
  spy: Dato<SpyEstadisticas> | null;
  /** Índices del INDEC por rubro, para la inflación personal. */
  ipc: Dato<IpcRubros> | null;
  /**
   * Lo que declaran las personas que ven la tasa en su propia app (billeteras y fondos no tienen
   * API pública). La mediana de los últimos 7 días, sólo si declararon al menos 3 personas.
   * Clave: 'cuenta_remunerada|Ualá|' o 'fci|Mercado Pago|Mercado Fondo'.
   */
  declaradas: Record<string, TasaDeclarada>;
  /** Chequeos que no cerraron. Vacío = todo coincide. */
  alertas: Alerta[];
  /** Fuentes que fallaron al armar este paquete, para decirlo en vez de ocultarlo. */
  fallas: string[];
};

// ── Frescura ─────────────────────────────────────────────────────────────
// Cada dato envejece a su ritmo. Estos son los días máximos que tiene sentido
// usarlo para recomendar. Pasados esos días el dato se marca desactualizado y
// la recomendación que depende de él deja de mostrarse (no se usa un número
// viejo como si fuera de hoy).
export const LIMITE_DIAS = {
  ipcRubros: 70,
  dolar: 2,
  fondo: 5,       // cubre fin de semana largo
  cuenta: 5,
  plazoFijo: 10,
  tasaBcra: 6,
  riesgoPais: 5,
  letras: 5,
  bonosCer: 5,
  plazoFijoUva: 10,
  cedears: 5,
  inflacion: 55,  // el INDEC publica una vez por mes
  uva: 5,
  rem: 45,
} as const;

export type ClaveFrescura = keyof typeof LIMITE_DIAS;

const MS_DIA = 24 * 60 * 60 * 1000;

/** Días entre una fecha 'YYYY-MM-DD' y hoy. Nunca negativo. */
export function edadEnDias(fecha: string, ahora: number = Date.now()): number {
  const t = new Date(`${fecha}T12:00:00-03:00`).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((ahora - t) / MS_DIA));
}

export function estaVigente(clave: ClaveFrescura, fecha: string | null | undefined, ahora: number = Date.now()): boolean {
  if (!fecha) return false;
  return edadEnDias(fecha, ahora) <= LIMITE_DIAS[clave];
}

/** "21/10" para mostrar al lado de un dato. */
export function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split('-');
  return d && m ? `${d}/${m}` : fecha;
}

/** "21/10/2026" */
export function fechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return y && m && d ? `${d}/${m}/${y}` : fecha;
}
