// Backtest: ¿qué tan bien habría funcionado la regla "recomendar sólo lo que rinde más que
// la inflación" mirando hacia atrás? Para cada fin de mes se reconstruye lo que se sabía
// ESE día (sin mirar el futuro), se decide, y después se compara con lo que realmente pasó.
//
//   npm run backtest:inversiones
//
// Qué mide y qué no:
//   · Mide la regla del plazo fijo y de la UVA (hay historia de tasas e inflación) y da
//     contexto sobre el dólar. NO puede medir los fondos comunes ni las billeteras: no hay
//     historia pública por fondo (CAFCI bloquea y las billeteras no publican serie).
//   · Es una prueba de la REGLA, no una promesa: el pasado no asegura lo que viene.

const AD = 'https://api.argentinadatos.com/v1';
const get = async <T,>(u: string): Promise<T> => {
  const r = await fetch(u, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${u} → ${r.status}`);
  return (await r.json()) as T;
};

type Punto = { fecha: string; valor: number };
const inflRaw = await get<Punto[]>(`${AD}/finanzas/indices/inflacion`);
const tasas30 = await get<Punto[]>(`${AD}/finanzas/tasas/depositos30Dias`);
const uvaRaw = await get<Punto[]>(`${AD}/finanzas/indices/uva`);
const mep = await get<{ fecha: string; venta: number }[]>(`${AD}/cotizaciones/dolares/bolsa`);
const ofi = await get<{ fecha: string; venta: number }[]>(`${AD}/cotizaciones/dolares/oficial`);
const indec = await get<{ data: [string, number][] }>('https://apis.datos.gob.ar/series/api/series?ids=148.3_INIVELNAL_DICI_M_26&format=json&start_date=2023-06-01&limit=200');

const inflMes = new Map(inflRaw.map((x) => [x.fecha.slice(0, 7), x.valor / 100]));
const mesesOrden = [...inflMes.keys()].sort();
const mesMas = (ym: string, n: number): string => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const ultimoAntes = <T extends { fecha: string }>(serie: T[], fecha: string): T | undefined => {
  let r: T | undefined;
  for (const x of serie) { if (x.fecha <= fecha) r = x; else break; }
  return r;
};
const finDeMes = (ym: string): string => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const EPS = 0.001;
const pc = (x: number, d = 1) => `${(x * 100).toFixed(d).replace('.', ',')}%`;
const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

// Los meses que se pueden evaluar: se decide a fin del mes t y se mide con la inflación de t+1.
const desde = process.env.BACKTEST_DESDE ?? '2024-02';
const evaluables = mesesOrden.filter((ym) => ym >= desde && inflMes.has(mesMas(ym, 1)) && inflMes.has(mesMas(ym, -3)));

type Fila = { mes: string; ref: Record<string, number>; tem: number; realizada: number; realReal: number };
const filas: Fila[] = [];
for (const t of evaluables) {
  const fecha = finDeMes(t);
  // Lo que se sabe el último día del mes t: la inflación publicada llega hasta t-1 (el INDEC publica a mediados del mes siguiente).
  const pub = [1, 2, 3].map((k) => inflMes.get(mesMas(t, -k))!);
  const ultimoPublicado = pub[0];
  const ref3 = prom(pub);
  const u = ultimoAntes(uvaRaw, fecha);
  const u0 = ultimoAntes(uvaRaw, new Date(new Date(`${fecha}T12:00:00Z`).getTime() - 30 * 86400000).toISOString().slice(0, 10));
  const uva30 = u && u0 ? u.valor / u0.valor - 1 : 0;
  const tna = ultimoAntes(tasas30, fecha)?.valor;
  if (tna === undefined) continue;
  const tem = (tna * 30) / 365;
  const realizada = inflMes.get(mesMas(t, 1))!;
  filas.push({
    mes: t,
    ref: { 'último mes publicado': ultimoPublicado, 'promedio 3 meses': ref3, 'la más alta (3 meses, UVA)': Math.max(ref3, uva30) },
    tem, realizada, realReal: (1 + tem) / (1 + realizada) - 1,
  });
}

console.log(`\nBACKTEST del plazo fijo a 30 días — ${filas.length} meses (${filas[0].mes} a ${filas[filas.length - 1].mes})\n`);
console.log('Se decide a fin de mes con lo que se sabía; se mide con la inflación real del mes siguiente.');
console.log('"Perdió" = el plazo fijo rindió menos que la inflación de ese mes en más de 0,25 puntos.\n');

const PERDIO = -0.0025;
const reglas = Object.keys(filas[0].ref);
const ancho = (s: string, n: number) => s.padEnd(n);
console.log(ancho('Regla para decidir', 30), ancho('Dijo "no pierde"', 18), ancho('…y perdió igual', 18), ancho('Dijo "pierde"', 15), ancho('…y en realidad no', 20));
for (const regla of reglas) {
  const dijoBien = filas.filter((f) => (1 + f.tem) / (1 + f.ref[regla]) - 1 >= -EPS);
  const dijoMal = filas.filter((f) => (1 + f.tem) / (1 + f.ref[regla]) - 1 < -EPS);
  const falsosBien = dijoBien.filter((f) => f.realReal < PERDIO).length;
  const falsosMal = dijoMal.filter((f) => f.realReal >= PERDIO).length;
  console.log(
    ancho(regla, 30),
    ancho(`${dijoBien.length} meses`, 18), ancho(dijoBien.length ? `${falsosBien} (${pc(falsosBien / dijoBien.length, 0)})` : '—', 18),
    ancho(`${dijoMal.length} meses`, 15), ancho(dijoMal.length ? `${falsosMal} (${pc(falsosMal / dijoMal.length, 0)})` : '—', 20),
  );
}
const base = filas.filter((f) => f.realReal < PERDIO).length;
console.log(`\nSin regla alguna (siempre recomendar el plazo fijo): perdió ${base} de ${filas.length} meses (${pc(base / filas.length, 0)}).`);

console.log('\nLos peores meses para la regla "la más alta" (dijo que no pierde, pero perdió):');
const regla = 'la más alta (3 meses, UVA)';
for (const f of filas.filter((x) => (1 + x.tem) / (1 + x.ref[regla]) - 1 >= -EPS && x.realReal < PERDIO).sort((a, b) => a.realReal - b.realReal).slice(0, 5)) {
  console.log(`  ${f.mes}: referencia ${pc(f.ref[regla])}, el plazo fijo rindió ${pc(f.tem, 2)} y la inflación real fue ${pc(f.realizada)} → ${pc(f.realReal, 2)} real`);
}

// ── UVA: ¿qué tan bien anticipa la inflación del mes que viene? ──
const errores = filas.map((f) => ({ f, uva: f.ref['la más alta (3 meses, UVA)'] }));
console.log('\nLa inflación de referencia contra la que realmente vino (error en puntos por mes):');
for (const r of reglas) {
  const e = filas.map((f) => f.ref[r] - f.realizada);
  console.log(`  ${ancho(r, 30)} sesgo ${pc(prom(e), 2)} (positivo = sobrestima, es lo prudente) · error absoluto promedio ${pc(prom(e.map(Math.abs)), 2)}`);
}
void errores;

// ── Dólar: contexto, no recomendación ──
let dolarGana = 0, dolarN = 0;
for (const t of evaluables) {
  const a = ultimoAntes(mep, finDeMes(t)); const b = ultimoAntes(mep, finDeMes(mesMas(t, 1)));
  if (!a || !b) continue;
  dolarN++;
  if (b.venta / a.venta - 1 > inflMes.get(mesMas(t, 1))!) dolarGana++;
}
console.log(`\nDólar MEP (contexto): en ${dolarGana} de ${dolarN} meses subió más que la inflación (${pc(dolarGana / dolarN, 0)}). Por eso FINA no promete rendimiento en dólares: depende del momento.`);

// ── ¿La inflación que usamos coincide con la oficial publicada por el INDEC? ──
const idx = new Map(indec.data.map(([f, v]) => [f.slice(0, 7), v]));
const difs: number[] = [];
for (const ym of mesesOrden.filter((x) => x >= '2024-01')) {
  const a = idx.get(ym), b = idx.get(mesMas(ym, -1));
  if (a && b && inflMes.has(ym)) difs.push(Math.abs((a / b - 1) - inflMes.get(ym)!));
}
console.log(`\nInflación de ArgentinaDatos vs INDEC (datos.gob.ar), ${difs.length} meses: diferencia promedio ${pc(prom(difs), 3)}, máxima ${pc(Math.max(...difs), 3)}.`);
console.log('\nQué mide y qué no: esto prueba la regla con tasas e inflación reales. No puede probar fondos comunes ni billeteras (no hay historia pública).');

export {};
