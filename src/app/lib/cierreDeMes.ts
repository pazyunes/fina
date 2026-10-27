// El cierre de mes: cómo terminó el mes, qué hacer el que viene y qué ya se
// sabe que se va a pagar. Todo sale de lo que la persona ya anotó; no se
// inventa ni se estima nada. Sin juicios: se dicen los números y qué significan.

import { siguienteVencimiento, type FrecuenciaFija } from '../api/v2/fechasFijos';

const NOMBRES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export type MesACerrar = {
  /** 'YYYY-MM' */
  clave: string;
  nombre: string;
  /** 'YYYY-MM-01' */
  desde: string;
  /** Último día del mes, 'YYYY-MM-DD'. */
  hasta: string;
  anterior: { clave: string; nombre: string };
  siguiente: { clave: string; nombre: string; desde: string; hasta: string };
  /** false mientras todavía faltan días: son los últimos de ese mes. */
  terminado: boolean;
};

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const ultimoDia = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();
function mesDe(anio: number, mes: number) {
  const a = mes < 1 ? anio - 1 : mes > 12 ? anio + 1 : anio;
  const m = mes < 1 ? 12 : mes > 12 ? 1 : mes;
  return { anio: a, mes: m, clave: `${a}-${dosDigitos(m)}`, nombre: NOMBRES[m - 1], desde: `${a}-${dosDigitos(m)}-01`, hasta: `${a}-${dosDigitos(m)}-${dosDigitos(ultimoDia(a, m))}` };
}

/** Los últimos 3 días de un mes se mira ese mes; los primeros 5 del siguiente, el que acaba de terminar. Si no, no toca. */
export function mesACerrar(hoy: string): MesACerrar | null {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  const dia = Number(hoy.slice(8, 10));
  let objetivo: ReturnType<typeof mesDe>;
  let terminado: boolean;
  if (dia >= ultimoDia(anio, mes) - 2) { objetivo = mesDe(anio, mes); terminado = false; }
  else if (dia <= 5) { objetivo = mesDe(anio, mes - 1); terminado = true; }
  else return null;
  const antes = mesDe(objetivo.anio, objetivo.mes - 1);
  const despues = mesDe(objetivo.anio, objetivo.mes + 1);
  return {
    clave: objetivo.clave, nombre: objetivo.nombre, desde: objetivo.desde, hasta: objetivo.hasta,
    anterior: { clave: antes.clave, nombre: antes.nombre },
    siguiente: { clave: despues.clave, nombre: despues.nombre, desde: despues.desde, hasta: despues.hasta },
    terminado,
  };
}

export type DatosDelMes = {
  /** Fechas 'YYYY-MM-DD' en Argentina; montos en pesos. */
  gastos: { fecha: string; montoArs: number; seccionId: string | null }[];
  ingresos: { fecha: string; montoArs: number }[];
  /** Lo que apartó para objetivos de ahorro. */
  aportes: { fecha: string; montoArs: number }[];
  secciones: { id: string; nombre: string; tieneTope: boolean }[];
  /** Objetivos de ahorro en curso. */
  objetivos: { id: string; nombre: string }[];
  fijos: { descripcion: string; monto: number; moneda: 'ARS' | 'USD'; proximoPago: string; frecuencia: FrecuenciaFija; diaAncla: number | null }[];
  dolar: number | null;
};

export type Resumen = {
  ingresos: number;
  gastado: number;
  /** Ingresos menos gastos: puede ser negativo. */
  quedo: number;
  diasConGastos: number;
  diasDelMes: number;
  gastadoMesAnterior: number | null;
  mayor: { seccionId: string | null; nombre: string; monto: number } | null;
  aportado: number;
  hayDatos: boolean;
};

const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const enMes = (fecha: string, desde: string, hasta: string) => fecha >= desde && fecha <= hasta;

export function resumenDelMes(d: DatosDelMes, mes: MesACerrar): Resumen {
  const gastos = d.gastos.filter((g) => enMes(g.fecha, mes.desde, mes.hasta));
  const gastado = suma(gastos.map((g) => g.montoArs));
  const ingresos = suma(d.ingresos.filter((i) => enMes(i.fecha, mes.desde, mes.hasta)).map((i) => i.montoArs));
  const antes = d.gastos.filter((g) => g.fecha.slice(0, 7) === mes.anterior.clave);

  const porSeccion = new Map<string | null, number>();
  for (const g of gastos) porSeccion.set(g.seccionId, (porSeccion.get(g.seccionId) ?? 0) + g.montoArs);
  const [seccionId, monto] = [...porSeccion.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

  return {
    ingresos,
    gastado,
    quedo: ingresos - gastado,
    diasConGastos: new Set(gastos.map((g) => g.fecha)).size,
    diasDelMes: Number(mes.hasta.slice(8, 10)),
    gastadoMesAnterior: antes.length > 0 ? suma(antes.map((g) => g.montoArs)) : null,
    mayor: monto > 0 ? { seccionId, nombre: d.secciones.find((s) => s.id === seccionId)?.nombre ?? 'Sin categoría', monto } : null,
    aportado: suma(d.aportes.filter((a) => enMes(a.fecha, mes.desde, mes.hasta)).map((a) => a.montoArs)),
    hayDatos: gastos.length > 0 || ingresos > 0,
  };
}

export const pesos = (n: number): string => `$${Math.round(Math.abs(n)).toLocaleString('es-AR')}`;

/** Una frase para el mes: de lo que de verdad pasó, sin juzgar. Una sola. */
export function fraseDelMes(r: Resumen, mes: MesACerrar): string {
  if (!r.hayDatos) return `Todavía no hay datos de ${mes.nombre}. Lo que anotes desde hoy cuenta para ${mes.siguiente.nombre}.`;
  if (r.aportado > 0) return `Le sumaste ${pesos(r.aportado)} a tus objetivos. Eso es avanzar.`;
  if (r.diasConGastos >= 15) return `Anotaste gastos ${r.diasConGastos} días de ${mes.nombre}. Eso es conocer tu plata.`;
  if (r.gastadoMesAnterior !== null && r.gastado < r.gastadoMesAnterior) return `Gastaste ${pesos(r.gastadoMesAnterior - r.gastado)} menos que en ${mes.anterior.nombre}.`;
  return 'Un mes más mirando en qué se va tu plata.';
}

export type Recomendacion =
  | { texto: string; accion: { tipo: 'tope'; seccionId: string } }
  | { texto: string; accion: { tipo: 'objetivo'; objetivoId: string } }
  | { texto: string; accion: { tipo: 'nuevo-objetivo' } }
  | { texto: string; accion: { tipo: 'ingreso' } };

/** Hasta tres cosas para hacer el mes que viene, de lo que pasó en éste. */
export function recomendaciones(r: Resumen, d: DatosDelMes, mes: MesACerrar): Recomendacion[] {
  const salida: Recomendacion[] = [];
  const tope = r.mayor?.seccionId ? d.secciones.find((s) => s.id === r.mayor?.seccionId && !s.tieneTope) : undefined;
  if (r.mayor && tope) salida.push({ texto: `${r.mayor.nombre} fue lo que más se llevó en ${mes.nombre}: ${pesos(r.mayor.monto)}. Ponele un tope para ${mes.siguiente.nombre}.`, accion: { tipo: 'tope', seccionId: tope.id } });
  if (r.ingresos === 0 && r.gastado > 0) salida.push({ texto: `No anotaste ingresos en ${mes.nombre}. Anotalos para ver cuánto te queda.`, accion: { tipo: 'ingreso' } });

  if (d.objetivos.length > 0 && r.aportado === 0) {
    salida.push({ texto: `Separá para ${d.objetivos[0].nombre} apenas cobres en ${mes.siguiente.nombre}.`, accion: { tipo: 'objetivo', objetivoId: d.objetivos[0].id } });
  } else if (d.objetivos.length === 0) {
    salida.push({ texto: `Sumá un objetivo de ahorro para ${mes.siguiente.nombre}.`, accion: { tipo: 'nuevo-objetivo' } });
  }
  return salida.slice(0, 3);
}

export type FijoDelMes = { descripcion: string; fecha: string; montoArs: number };

/** Los gastos fijos que caen en el mes que viene, con cada fecha (uno semanal cae varias veces). */
export function fijosDelMes(d: DatosDelMes, mes: MesACerrar): FijoDelMes[] {
  const salida: FijoDelMes[] = [];
  for (const f of d.fijos) {
    const aPesos = f.moneda === 'USD' ? (d.dolar ? Math.round(f.monto * d.dolar) : null) : f.monto;
    if (aPesos === null) continue;
    let fecha = f.proximoPago;
    // Se avanza hasta el mes que viene, sin pasarse.
    for (let i = 0; i < 120 && fecha <= mes.siguiente.hasta; i++) {
      if (fecha >= mes.siguiente.desde) salida.push({ descripcion: f.descripcion, fecha, montoArs: aPesos });
      const sigue = siguienteVencimiento(fecha, f.frecuencia, f.diaAncla);
      if (sigue <= fecha) break;
      fecha = sigue;
    }
  }
  return salida.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}
