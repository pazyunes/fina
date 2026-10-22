// Los chequeos del paquete de datos de mercado: lo que se compara contra una
// segunda fuente, lo que tiene que ser verosímil y lo que no puede estar viejo.
//
// Un dato incorrecto que nadie nota es peor que uno que falta: la app recomienda
// con total seguridad algo armado sobre un número malo. Por eso cada dato crítico
// se mira desde dos lados cuando se puede, y lo que no cierra se registra como
// alerta (y le llega a quien mantiene FINA, ver alertas.ts).
//
// Qué hace cada gravedad:
//   · 'aviso': se registra. Las recomendaciones siguen.
//   · 'grave': además, lo que depende de ese dato deja de recomendarse hasta que
//     se resuelva (ver `sospechosos` en el motor). Se reserva para cuando una
//     segunda fuente discrepa MUCHO o el valor es imposible.

import { edadEnDias, estaVigente, fechaLarga, type Alerta, type Dato, type Mercado } from '../../src/app/lib/inversiones/mercadoTipos.js';

export type Controles = {
  /** Bluelytics: el dólar por otro camino. */
  dolar: { oficial: number | null; blue: number | null } | null;
  /** Tasa promedio de depósitos a 30 días del BCRA, en porcentaje. */
  plazoFijo30: Dato<number> | null;
  /** Precios de CEDEARs de la fuente comunitaria. */
  cedears: Record<string, number> | null;
};

const dif = (a: number, b: number): number => (Math.abs(a - b) / Math.max(Math.abs(b), 1e-9)) * 100;

export function chequear(m: Mercado, c: Controles, ahora: number = Date.now()): Alerta[] {
  const alertas: Alerta[] = [];
  const hay = (clave: string, gravedad: Alerta['gravedad'], mensaje: string) => alertas.push({ clave, gravedad, mensaje });

  // ── 1. Dólar contra Bluelytics ──
  if (c.dolar) {
    const pares: [string, number | undefined, number | null][] = [
      ['oficial', m.dolar.oficial?.valor, c.dolar.oficial],
      ['blue', m.dolar.blue?.valor, c.dolar.blue],
    ];
    for (const [nombre, a, b] of pares) {
      if (a === undefined || b === null) continue;
      const d = dif(a, b);
      if (d > 5) hay('dolar', 'grave', `El dólar ${nombre} no coincide entre fuentes: ${Math.round(a)} contra ${Math.round(b)} (${d.toFixed(1)}% de diferencia).`);
      else if (d > 1.5) hay('dolar', 'aviso', `El dólar ${nombre} difiere ${d.toFixed(1)}% entre fuentes: ${Math.round(a)} contra ${Math.round(b)}.`);
    }
  }
  const { oficial, mep } = m.dolar;
  if (oficial && mep && (mep.valor <= 0 || oficial.valor <= 0 || mep.valor / oficial.valor > 2 || mep.valor / oficial.valor < 0.8)) {
    hay('dolar', 'grave', `La relación entre el dólar MEP (${Math.round(mep.valor)}) y el oficial (${Math.round(oficial.valor)}) no es verosímil.`);
  }

  // ── 2. Inflación contra el INDEC publicado en datos.gob.ar ──
  const control = m.inflacion.control ?? [];
  for (const k of control) {
    const mes = k.fecha.slice(0, 7);
    const propio = m.inflacion.meses.find((x) => x.fecha.slice(0, 7) === mes);
    if (!propio) continue;
    const d = Math.abs(propio.valor - k.valor);
    if (d > 0.15) hay('inflacion', 'aviso', `La inflación de ${mes} difiere entre fuentes: ${propio.valor.toFixed(1)}% contra ${k.valor.toFixed(1)}% del INDEC. Se usa la más alta para no subestimarla.`);
  }
  if (m.inflacion.meses.some((x) => x.valor < -3 || x.valor > 50)) {
    hay('inflacion', 'aviso', 'Hay un mes de inflación con un valor fuera de lo verosímil.');
  }

  // ── 3. Tasas de plazo fijo contra el promedio del BCRA ──
  if (c.plazoFijo30 && m.plazoFijo) {
    const tnas = m.plazoFijo.valor.map((b) => b.tnaClientes * 100).sort((a, b) => a - b);
    const mediana = tnas[Math.floor(tnas.length / 2)];
    if (tnas.length > 0 && Math.abs(mediana - c.plazoFijo30.valor) > 8) {
      hay('plazoFijo', 'aviso', `La tasa típica de plazo fijo (${mediana.toFixed(1)}%) está lejos del promedio del BCRA (${c.plazoFijo30.valor.toFixed(1)}%).`);
    }
  }

  // ── 4. CEDEARs contra la fuente comunitaria ──
  if (c.cedears && m.cedears) {
    const lejos: string[] = [];
    let grave = false;
    for (const x of m.cedears.valor) {
      const otro = c.cedears[x.simbolo];
      if (!otro) continue;
      const d = dif(x.precio, otro);
      if (d > 3) lejos.push(`${x.simbolo} ${d.toFixed(1)}%`);
      if (d > 10) grave = true;
    }
    if (lejos.length > 0) hay('cedears', grave ? 'grave' : 'aviso', `Los precios de CEDEARs difieren entre fuentes: ${lejos.join(', ')}.`);
  }

  // ── 5. Que lo que parece una tasa lo sea ──
  const tamar = m.tasas.tamar?.valor;
  if (tamar) {
    for (const f of m.fondos?.valor ?? []) {
      if (f.tna1 !== null && (f.tna1 < 0 || f.tna1 * 100 > tamar * 2)) {
        hay('fondos', 'aviso', `El fondo ${f.id} muestra un rendimiento fuera de lo esperable (${(f.tna1 * 100).toFixed(1)}% anual con una TAMAR de ${tamar.toFixed(1)}%).`);
      }
    }
    for (const cu of m.cuentas?.valor ?? []) {
      if (cu.tna * 100 > tamar * 2 && /UALA|NARANJA|BRUBANK|BNA/.test(cu.id)) {
        hay('cuentas', 'aviso', `La cuenta ${cu.id} muestra una tasa fuera de lo esperable (${(cu.tna * 100).toFixed(1)}% con una TAMAR de ${tamar.toFixed(1)}%).`);
      }
    }
  }

  // ── 6. Que no esté viejo ──
  const viejo = (nombre: string, clave: Parameters<typeof estaVigente>[0], fecha: string | undefined | null) => {
    if (fecha && !estaVigente(clave, fecha, ahora)) hay(`viejo:${nombre}`, 'aviso', `${nombre} está desactualizado: el último dato es del ${fechaLarga(fecha)} (hace ${edadEnDias(fecha, ahora)} días).`);
  };
  viejo('La inflación', 'inflacion', m.inflacion.meses[m.inflacion.meses.length - 1]?.fecha);
  viejo('La inflación esperada', 'rem', m.inflacion.esperada12m?.fecha);
  viejo('La UVA', 'uva', m.inflacion.uva30d?.fecha);
  viejo('Los fondos comunes', 'fondo', m.fondos?.fecha);
  viejo('Los plazos fijos', 'plazoFijo', m.plazoFijo?.fecha);
  viejo('La TAMAR', 'tasaBcra', m.tasas.tamar?.fecha);
  viejo('El dólar', 'dolar', m.dolar.oficial?.fecha);
  viejo('Los CEDEARs', 'cedears', m.cedears?.fecha);
  viejo('Los índices del INDEC por rubro', 'ipcRubros', m.ipc?.fecha);

  // ── 7. Fuentes que no respondieron ──
  for (const f of m.fallas) hay(`falla:${f.split(':')[0]}`, 'aviso', `No respondió una fuente: ${f}`);

  return alertas;
}
