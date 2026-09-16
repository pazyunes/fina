import { NOMBRE_DIA, diaAR, diaDeSemana, diasDelMes, diasEntre, lunesDe, mismoDiaMesAnterior, sumarDias } from './fechas.js';

// ─────────────────────────────────────────────────────────────────────────
// El resumen que se le pasa al modelo.
//
// Se mandan AGREGADOS, nunca los gastos uno por uno. Dos razones:
//
// · Privacidad. La descripción de un gasto la escribe la persona ("farmacia,
//   test de embarazo") y no hace falta para recomendar: alcanza con saber
//   cuánto va por sección. Tampoco se manda nombre, mail, teléfono ni zona.
// · Calidad. Un modelo sumando 300 filas se equivoca en la cuenta; recibiendo
//   la cuenta hecha, se dedica a lo que sí hace bien, que es interpretarla.
//
// Las comparaciones son siempre contra el MISMO tramo: el mes en curso contra
// los mismos días del mes pasado, no contra el mes pasado entero. Comparar 14
// días contra 30 haría parecer que este mes se gasta la mitad.
// ─────────────────────────────────────────────────────────────────────────

export type FilaGasto = {
  amount_ars: number; occurred_at: string; created_at: string;
  section_id: string | null; expense_type: string | null; payment_method: string | null; source: string;
};
export type FilaSeccion = { id: string; name: string; cap_amount: number | null; cap_period: string | null };
export type FilaMedio = { name: string; balance_ars: number };
export type FilaObjetivo = {
  id: string; title: string; amount_ars: number | null; currency: string; amount_mode: string | null;
  horizon_label: string | null; status: string;
  goal_contributions: { amount: number; occurred_at: string }[] | null;
};
export type FilaPerfil = { main_goal: string | null; income_stability: string | null; financial_level: string | null; income_sources: string[] | null };
export type FilaRecomendacion = { id: string; periodo: string; clave: string; contenido: { titulo?: string }; foco_tipo: string | null; foco_ref: string | null; util: boolean | null; created_at: string };
export type Racha = { dias: number; hoyCumplido: boolean };
export type Observacion = { texto: string; evidencia: string };
export type FilaPasoDelDia = { day: string; step_key: string; completed_at: string | null };

export type Entrada = {
  ahora: number;
  gastos: FilaGasto[];
  secciones: FilaSeccion[];
  medios: FilaMedio[];
  objetivos: FilaObjetivo[];
  perfil: FilaPerfil | null;
  perfilInversorCompleto: boolean;
  aportesUltimos30: number;
  racha: Racha | null;
  memoria: Observacion[];
  historial: FilaRecomendacion[];
  /** Los pasos del día de las últimas semanas, para aprender cuáles cumple. */
  pasosDelDia: FilaPasoDelDia[];
  /**
   * Los pasos que eligió el modelo, como 'día:clave'. Si ese día quedó otro
   * paso (el elegido ya no se podía cumplir), lo eligió la regla fija.
   */
  pasosElegidosPorIA: string[];
  /** Ids de recomendaciones que la persona tachó como hechas (migración 0032). */
  recomendacionesHechas: string[];
};

const redondo = (n: number) => Math.round(n);
const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Qué le falta a cada período para poder recomendar algo que no sea genérico. */
export type Suficiencia = { dia: string | null; semana: string | null; mes: string | null };

export function suficiencia(e: Entrada): Suficiencia {
  const hoy = diaAR(e.ahora);
  const dias = e.gastos.map((g) => diaAR(g.occurred_at));
  const ultimos7 = dias.filter((d) => diasEntre(d, hoy) <= 6).length;
  const ult14 = dias.filter((d) => diasEntre(d, hoy) <= 13);
  const primero = dias.length ? dias.reduce((a, b) => (a < b ? a : b)) : null;
  const historia = primero ? diasEntre(primero, hoy) + 1 : 0;

  return {
    dia: e.gastos.length < 3
      ? `Con ${3 - e.gastos.length === 1 ? 'un gasto más registrado' : `${3 - e.gastos.length} gastos más registrados`} ya puedo mirar cómo te manejás.`
      : ultimos7 === 0 ? 'No registraste gastos esta semana: con uno de hoy te puedo decir algo sobre tu día.' : null,
    semana: ult14.length < 5 || new Set(ult14).size < 3
      ? 'Para ver un patrón de la semana necesito gastos de al menos tres días distintos.'
      : null,
    mes: historia < 14 || e.gastos.length < 10
      ? `Para mirar el mes necesito dos semanas de gastos registrados${historia > 0 ? ` (llevás ${historia} ${historia === 1 ? 'día' : 'días'})` : ''}.`
      : null,
  };
}

export function armarResumen(e: Entrada) {
  const hoy = diaAR(e.ahora);
  const ayer = sumarDias(hoy, -1);
  const seccionPorId = new Map(e.secciones.map((s) => [s.id, s.name]));
  const gastos = e.gastos.map((g) => ({
    ...g,
    dia: diaAR(g.occurred_at),
    diaRegistro: diaAR(g.created_at),
    seccion: g.section_id ? seccionPorId.get(g.section_id) ?? 'Sin sección' : 'Sin sección',
    monto: Number(g.amount_ars),
  }));
  const entre = (desde: string, hasta: string) => gastos.filter((g) => g.dia >= desde && g.dia <= hasta);
  const total = (gs: typeof gastos) => redondo(suma(gs.map((g) => g.monto)));

  // ── Hoy y ayer, contra lo habitual de ese día de la semana ─────────────
  const promedioDelDia = (dia: string) => {
    const mismos = Array.from({ length: 8 }, (_, i) => sumarDias(dia, -7 * (i + 1)));
    return redondo(suma(mismos.map((d) => total(entre(d, d)))) / mismos.length);
  };

  // ── Mes en curso contra los mismos días del mes pasado ─────────────────
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const hastaMesPasado = mismoDiaMesAnterior(hoy);
  const inicioMesPasado = `${hastaMesPasado.slice(0, 7)}-01`;

  const porSeccion = (desde: string, hasta: string) => {
    const m = new Map<string, number>();
    for (const g of entre(desde, hasta)) m.set(g.seccion, (m.get(g.seccion) ?? 0) + g.monto);
    return m;
  };
  const seccionesMes = porSeccion(inicioMes, hoy);
  const seccionesMesPasado = porSeccion(inicioMesPasado, hastaMesPasado);

  // ── Topes: cada uno contra SU período ──────────────────────────────────
  const topes = e.secciones
    .filter((s) => s.cap_amount !== null && s.cap_period)
    .map((s) => {
      const desde = s.cap_period === 'semana' ? lunesDe(hoy) : inicioMes;
      const gastado = total(gastos.filter((g) => g.section_id === s.id && g.dia >= desde && g.dia <= hoy));
      const transcurrido = s.cap_period === 'semana'
        ? (diaDeSemana(hoy) + 1) / 7
        : Number(hoy.slice(8, 10)) / diasDelMes(hoy);
      return {
        seccion: s.name, tope: Number(s.cap_amount), periodo: s.cap_period,
        gastadoEnElPeriodo: gastado,
        porcentajeUsado: redondo((gastado / Number(s.cap_amount)) * 100),
        porcentajeDelPeriodoTranscurrido: redondo(transcurrido * 100),
      };
    });

  // ── Semanas y días de la semana ────────────────────────────────────────
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const lunes = sumarDias(lunesDe(hoy), -7 * (7 - i));
    const domingo = sumarDias(lunes, 6);
    return { desde: lunes, total: total(entre(lunes, domingo < hoy ? domingo : hoy)), enCurso: domingo >= hoy };
  });
  const diasSemana = NOMBRE_DIA.map((nombre, i) => {
    const ocurrencias = Array.from({ length: 8 }, (_, k) => sumarDias(lunesDe(hoy), -7 * (k + 1) + i));
    return { dia: nombre, promedio: redondo(suma(ocurrencias.map((d) => total(entre(d, d)))) / ocurrencias.length) };
  });

  // ── Hábito de registro ─────────────────────────────────────────────────
  const ult30 = gastos.filter((g) => diasEntre(g.diaRegistro, hoy) <= 29);
  const porTipo = new Map<string, number>();
  for (const g of gastos.filter((x) => diasEntre(x.dia, hoy) <= 29)) {
    porTipo.set(g.expense_type ?? 'sin clasificar', (porTipo.get(g.expense_type ?? 'sin clasificar') ?? 0) + g.monto);
  }
  const primerGasto = gastos.length ? gastos.map((g) => g.dia).reduce((a, b) => (a < b ? a : b)) : null;

  // ── Objetivos ──────────────────────────────────────────────────────────
  const objetivos = e.objetivos.filter((o) => o.status === 'active').map((o) => {
    const aportes = o.goal_contributions ?? [];
    const juntado = redondo(suma(aportes.map((a) => Number(a.amount))));
    const ult30o = redondo(suma(aportes.filter((a) => diasEntre(diaAR(a.occurred_at), hoy) <= 29).map((a) => Number(a.amount))));
    return {
      id: o.id,
      nombre: o.title, moneda: o.currency, horizonte: o.horizon_label,
      montoObjetivo: o.amount_ars === null ? null : Number(o.amount_ars),
      comoSeSabeElMonto: o.amount_mode,
      juntado,
      porcentaje: o.amount_ars ? redondo((juntado / Number(o.amount_ars)) * 100) : null,
      aportadoUltimos30Dias: ult30o,
      ultimoAporte: aportes.length ? aportes.map((a) => diaAR(a.occurred_at)).reduce((a, b) => (a > b ? a : b)) : null,
    };
  });

  return {
    hoy: { fecha: hoy, dia: NOMBRE_DIA[diaDeSemana(hoy)] },
    persona: {
      queQuiereLograr: e.perfil?.main_goal ?? null,
      estabilidadDeIngresos: e.perfil?.income_stability ?? null,
      fuentesDeIngreso: e.perfil?.income_sources ?? [],
      nivelFinanciero: e.perfil?.financial_level ?? null,
    },
    historia: { primerGasto, diasDeHistoria: primerGasto ? diasEntre(primerGasto, hoy) + 1 : 0, gastosRegistrados: gastos.length },
    habito: {
      diasConRegistroUltimos14: new Set(gastos.filter((g) => diasEntre(g.diaRegistro, hoy) <= 13).map((g) => g.diaRegistro)).size,
      porcentajeRegistradoPorWhatsappUltimos30: ult30.length ? redondo((ult30.filter((g) => g.source === 'whatsapp').length / ult30.length) * 100) : null,
      racha: e.racha,
    },
    hoyYAyer: {
      hoy: { total: total(entre(hoy, hoy)), promedioDeLos8DiasIgualesAnteriores: promedioDelDia(hoy) },
      ayer: { dia: NOMBRE_DIA[diaDeSemana(ayer)], total: total(entre(ayer, ayer)), promedioDeLos8DiasIgualesAnteriores: promedioDelDia(ayer) },
    },
    mes: {
      diaDelMes: Number(hoy.slice(8, 10)),
      diasDelMes: diasDelMes(hoy),
      gastadoHastaHoy: total(entre(inicioMes, hoy)),
      mismosDiasDelMesPasado: total(entre(inicioMesPasado, hastaMesPasado)),
      porSeccion: [...seccionesMes.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([seccion, monto]) => ({ seccion, esteMes: redondo(monto), mismosDiasMesPasado: redondo(seccionesMesPasado.get(seccion) ?? 0) })),
    },
    ultimas8Semanas: semanas,
    promedioPorDiaDeLaSemana: diasSemana,
    porTipoUltimos30: [...porTipo.entries()].map(([tipo, monto]) => ({ tipo, monto: redondo(monto) })),
    topes,
    dineroDisponiblePorMedio: e.medios.map((m) => ({ medio: m.name, saldo: redondo(Number(m.balance_ars)) })),
    objetivos,
    inversiones: { perfilCompleto: e.perfilInversorCompleto, aportesUltimos30Dias: e.aportesUltimos30 },
  };
}

// ── Seguimiento: qué pasó después de cada recomendación ─────────────────
// Es la parte de "aprender de los resultados". Para cada recomendación previa
// se mide lo que esa recomendación quería mover, en la semana siguiente contra
// la anterior. No prueba causalidad —el delivery pudo bajar por otra razón—, y
// así se le dice al modelo: es una pista para no insistir con lo que claramente
// no cambió nada, no una nota.
export function armarSeguimiento(e: Entrada) {
  const hoy = diaAR(e.ahora);
  const seccionPorNombre = new Map(e.secciones.map((s) => [s.name.toLowerCase(), s.id]));
  const total = (filtro: (g: FilaGasto) => boolean, desde: string, hasta: string) =>
    redondo(suma(e.gastos.filter((g) => filtro(g) && diaAR(g.occurred_at) >= desde && diaAR(g.occurred_at) <= hasta).map((g) => Number(g.amount_ars))));

  return e.historial.slice(0, 10).map((r) => {
    const fecha = diaAR(r.created_at);
    const antesDesde = sumarDias(fecha, -7);
    const despuesHasta = sumarDias(fecha, 7) < hoy ? sumarDias(fecha, 7) : hoy;
    const diasDespues = diasEntre(fecha, despuesHasta);

    let queSeMidio: string | null = null;
    let antes: number | null = null;
    let despues: number | null = null;

    if (r.foco_tipo === 'seccion' && r.foco_ref) {
      const id = seccionPorNombre.get(r.foco_ref.toLowerCase()) ?? r.foco_ref;
      queSeMidio = `gasto en ${r.foco_ref}`;
      antes = total((g) => g.section_id === id, antesDesde, sumarDias(fecha, -1));
      despues = total((g) => g.section_id === id, fecha, despuesHasta);
    } else if (r.foco_tipo === 'registro') {
      queSeMidio = 'días con gastos registrados';
      const dias = (desde: string, hasta: string) => new Set(e.gastos.map((g) => diaAR(g.created_at)).filter((d) => d >= desde && d <= hasta)).size;
      antes = dias(antesDesde, sumarDias(fecha, -1));
      despues = dias(fecha, despuesHasta);
    } else if (r.foco_tipo === 'whatsapp') {
      queSeMidio = 'gastos registrados por WhatsApp';
      antes = e.gastos.filter((g) => g.source === 'whatsapp' && diaAR(g.created_at) >= antesDesde && diaAR(g.created_at) < fecha).length;
      despues = e.gastos.filter((g) => g.source === 'whatsapp' && diaAR(g.created_at) >= fecha && diaAR(g.created_at) <= despuesHasta).length;
    }

    return {
      fecha, periodo: r.periodo, titulo: r.contenido?.titulo ?? null,
      foco: r.foco_tipo, sobre: r.foco_ref,
      leSirvio: r.util,
      laMarcoComoHecha: e.recomendacionesHechas.includes(r.id),
      ...(queSeMidio ? { queSeMidio, semanaAnterior: antes, desdeEntonces: despues, diasTranscurridos: diasDespues } : {}),
    };
  });
}

// ── Los pasos del día de las últimas semanas ────────────────────────────
// Para que el modelo aprenda qué pasos cumple esta persona y cuáles no, y si
// los que eligió él funcionaron mejor que los de la regla fija. El título sale
// del catálogo que le pasa quien llama.
export function armarPasosRecientes(e: Entrada, titulos: Map<string, string>) {
  const hoy = diaAR(e.ahora);
  const elegidos = new Set(e.pasosElegidosPorIA);
  return e.pasosDelDia
    .filter((p) => p.day < hoy)
    .map((p) => ({
      dia: p.day,
      paso: titulos.get(p.step_key) ?? p.step_key,
      loCumplio: !!p.completed_at,
      loElegisteVos: elegidos.has(`${p.day}:${p.step_key}`),
    }));
}
