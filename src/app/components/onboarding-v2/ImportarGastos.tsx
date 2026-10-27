import { useMemo, useRef, useState } from 'react';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { leerGastosDeArchivo, leerGastosDeNotas, type ErrorDeLectura, type SalidaLectura } from '../../api/v2/importacion';
import { categoriaQueCoincide, esRepetido } from '../../lib/importacion/repetidos';
import type { GastoImportado } from '../../lib/importacion/tipos';
import { diaArgentina } from '../../api/v2/pasos';
import { Hoja } from './Hoja';
import { BORDE_FALTA, COLORS, CheckIcon, TextoFalta, fechaDisplay, fmtMoney } from './shared';
import { INPUT_STYLE } from './FormularioGasto';
import { gastosDeLaBase, seccionesDeLaBase } from './datosGasto';

// Traer gastos de antes: lo que la persona anotaba en un Excel, en el
// bloc de notas o en un banco, para empezar en FINA sin cargar todo de cero.
// Se sube el archivo o se pegan las notas, se revisa lo que se encontró (se
// puede sacar lo que no sirva y elegir la categoría) y recién ahí se importa.

type Fila = {
  id: number;
  gasto: GastoImportado;
  incluir: boolean;
  repetido: boolean;
  /** '' = sin categoría · el id de una que ya existe · 'nueva:Nombre' = crearla al importar. */
  categoria: string;
};

const MENSAJES: Record<ErrorDeLectura, string> = {
  xls: 'Los .xls viejos no se pueden leer. Guardalo como .xlsx o .csv y probá de nuevo.',
  formato: 'Ese formato no se puede leer. Probá con un Excel, un CSV, un PDF o una captura.',
  pesado: 'El archivo es muy pesado. Probá con uno más chico.',
  falla: 'No pudimos leerlo. Probá de nuevo o pegá las notas.',
};

const ACEPTA = '.xlsx,.xlsm,.csv,.tsv,.txt,.pdf,image/*';

export function ImportarGastos({ onCerrar }: { onCerrar: () => void }) {
  const { estado: db } = useAlmacen();
  const { categorias } = useMemo(() => seccionesDeLaBase(db), [db]);
  const existentes = useMemo(
    () => gastosDeLaBase(db).map((g) => ({ fecha: diaArgentina(g.ts), descripcion: g.descripcion, monto: g.monto })),
    [db],
  );
  const selector = useRef<HTMLInputElement>(null);
  const [notas, setNotas] = useState('');
  const [faltaNotas, setFaltaNotas] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [omitidos, setOmitidos] = useState(0);
  const [importando, setImportando] = useState(false);

  function recibir(s: SalidaLectura) {
    setLeyendo(false);
    if (s.tipo === 'error') { setError(MENSAJES[s.motivo]); return; }
    const l = s.lectura;
    if (l.estado === 'no_configurado') { setError('Por ahora no podemos leer capturas ni PDF. Probá con un Excel, un CSV o pegá las notas.'); return; }
    if (l.estado === 'no_se_pudo') { setError(MENSAJES.falla); return; }
    if (l.estado === 'vacio') { setError('No encontramos gastos ahí. Probá con otro archivo o pegá las notas.'); return; }
    setOmitidos(l.omitidos);
    setFilas(l.gastos.map((gasto, id) => {
      const repetido = esRepetido(gasto, existentes);
      const coincide = categoriaQueCoincide(gasto.categoria, categorias);
      return { id, gasto, repetido, incluir: !repetido, categoria: coincide ?? (gasto.categoria ? `nueva:${gasto.categoria}` : '') };
    }));
  }

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    setError(null); setLeyendo(true);
    recibir(await leerGastosDeArchivo(archivo));
  }

  async function leerNotas() {
    if (!notas.trim()) { setFaltaNotas(true); return; }
    setError(null); setLeyendo(true);
    recibir(await leerGastosDeNotas(notas));
  }

  const elegidas = (filas ?? []).filter((f) => f.incluir);
  const hayDolares = elegidas.some((f) => f.gasto.moneda === 'USD');
  const total = elegidas.filter((f) => f.gasto.moneda === 'ARS').reduce((s, f) => s + f.gasto.monto, 0);

  const cambiar = (id: number, parche: Partial<Fila>) => setFilas((fs) => (fs ?? []).map((f) => (f.id === id ? { ...f, ...parche } : f)));

  async function importar() {
    if (importando || elegidas.length === 0) return;
    setImportando(true);
    const r = await acciones.importarGastos(elegidas.map((f) => ({
      fecha: f.gasto.fecha,
      descripcion: f.gasto.descripcion,
      monto: f.gasto.monto,
      moneda: f.gasto.moneda,
      seccionId: f.categoria && !f.categoria.startsWith('nueva:') ? f.categoria : null,
      seccionNueva: f.categoria.startsWith('nueva:') ? f.categoria.slice(6) : null,
    })));
    setImportando(false);
    if (r.error) { setError(r.error); return; }
    onCerrar();
  }

  return (
    <Hoja titulo="Importar gastos" onCerrar={onCerrar}>
      {filas === null ? (
        <div className="flex flex-col gap-3 pt-1">
          <input
            ref={selector}
            type="file"
            accept={ACEPTA}
            className="hidden"
            onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; void subir(a); }}
          />
          <button
            type="button"
            disabled={leyendo}
            onClick={() => selector.current?.click()}
            className="v2-focus w-full rounded-2xl py-3 min-h-[48px] text-[14px] font-bold select-none transition-all duration-100 active:scale-[0.98]"
            style={{ background: COLORS.brand, color: COLORS.surface }}
          >
            {leyendo ? 'Leyendo…' : 'Subir un archivo'}
          </button>
          <p className="text-[13px] -mt-1" style={{ color: COLORS.inkSoft }}>Excel, CSV, PDF o una captura.</p>

          <p className="text-[13px] font-bold mt-1" style={{ color: COLORS.inkSoft }}>O pegá tus notas</p>
          <textarea
            aria-label="Tus notas con gastos"
            rows={5}
            maxLength={40_000}
            className="v2-focus w-full rounded-xl px-3.5 py-2.5 text-[14px] transition-colors resize-none"
            style={{ ...INPUT_STYLE, ...(faltaNotas && !notas.trim() ? { border: BORDE_FALTA } : {}) }}
            placeholder={'12/10 súper 31.000\n13/10 SUBE 3.000'}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
          {faltaNotas && !notas.trim() && <TextoFalta>Pegá tus notas o subí un archivo.</TextoFalta>}
          <button
            type="button"
            disabled={leyendo}
            onClick={() => void leerNotas()}
            className="v2-focus w-full rounded-2xl py-3 min-h-[48px] text-[14px] font-bold select-none transition-all duration-100 active:scale-[0.98]"
            style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}
          >
            Leer las notas
          </button>
          {error && <p role="alert" className="text-[13px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-bold" style={{ color: COLORS.ink }}>
              {elegidas.length} de {filas.length} {filas.length === 1 ? 'gasto' : 'gastos'}
            </p>
            <button
              type="button"
              onClick={() => setFilas((fs) => (fs ?? []).map((f) => ({ ...f, incluir: elegidas.length < filas.length })))}
              className="v2-focus min-h-[44px] text-[13px] font-semibold underline"
              style={{ color: COLORS.brand }}
            >
              {elegidas.length < filas.length ? 'Elegir todos' : 'Sacar todos'}
            </button>
          </div>
          {omitidos > 0 && <p className="text-[13px] -mt-2" style={{ color: COLORS.inkSoft }}>Dejamos afuera {omitidos} {omitidos === 1 ? 'línea' : 'líneas'} que no tenían un monto claro.</p>}

          <ul className="flex flex-col">
            {filas.map((f) => (
              <li key={f.id} className="flex items-start gap-2.5 py-2.5 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={f.incluir}
                  aria-label={`Importar ${f.gasto.descripcion}`}
                  onClick={() => cambiar(f.id, { incluir: !f.incluir })}
                  className="v2-focus w-11 h-11 -m-1.5 rounded-xl flex items-center justify-center shrink-0"
                >
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: f.incluir ? COLORS.brand : 'transparent', border: f.incluir ? 'none' : `2px solid ${COLORS.lineStrong}` }}
                  >
                    {f.incluir && <CheckIcon />}
                  </span>
                </button>
                <div className="flex-1 min-w-0 flex flex-col gap-1" style={{ opacity: f.incluir ? 1 : 0.55 }}>
                  <p className="text-[14px] truncate" style={{ color: COLORS.ink }}>{f.gasto.descripcion}</p>
                  <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>
                    {f.gasto.fecha ? fechaDisplay(Date.parse(`${f.gasto.fecha}T12:00:00-03:00`)).toLowerCase() : 'Sin fecha, queda con la de hoy'}
                    {f.repetido && ', ya lo tenés'}
                  </p>
                  <select
                    aria-label={`Categoría de ${f.gasto.descripcion}`}
                    value={f.categoria}
                    onChange={(e) => cambiar(f.id, { categoria: e.target.value })}
                    className="v2-focus rounded-lg px-2.5 min-h-[36px] text-[13px] w-full"
                    style={{ ...INPUT_STYLE, color: f.categoria ? COLORS.ink : COLORS.inkFaint }}
                  >
                    <option value="" style={{ color: COLORS.ink }}>Sin categoría</option>
                    {categorias.map((c) => <option key={c.id} value={c.id} style={{ color: COLORS.ink }}>{c.nombre}</option>)}
                    {f.categoria.startsWith('nueva:') && <option value={f.categoria} style={{ color: COLORS.ink }}>{f.categoria.slice(6)} (nueva)</option>}
                  </select>
                </div>
                <span className="font-mono tabular-nums text-[14px] shrink-0 pt-0.5" style={{ color: COLORS.ink, opacity: f.incluir ? 1 : 0.55 }}>
                  {f.gasto.moneda === 'USD' ? `US$${f.gasto.monto.toLocaleString('es-AR')}` : fmtMoney(f.gasto.monto)}
                </span>
              </li>
            ))}
          </ul>

          {hayDolares && <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Los gastos en dólares se pasan a pesos con el dólar de hoy.</p>}
          {total > 0 && <p className="text-[13px] tabular-nums" style={{ color: COLORS.inkSoft }}>En pesos suman {fmtMoney(total)}.</p>}
          {error && <p role="alert" className="text-[13px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => { setFilas(null); setError(null); }}
              className="v2-focus flex-1 rounded-xl py-2.5 min-h-[44px] text-[13px] font-semibold"
              style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
            >
              Volver
            </button>
            <button
              type="button"
              disabled={importando || elegidas.length === 0}
              onClick={() => void importar()}
              className="v2-focus flex-[2] rounded-xl py-2.5 min-h-[44px] text-[13px] font-bold transition-all duration-100 active:scale-95"
              style={elegidas.length === 0 ? { background: COLORS.tint, color: COLORS.inkSoft } : { background: COLORS.brand, color: COLORS.surface }}
            >
              {importando ? 'Importando…' : elegidas.length === 0 ? 'Elegí al menos uno' : `Importar ${elegidas.length} ${elegidas.length === 1 ? 'gasto' : 'gastos'}`}
            </button>
          </div>
        </div>
      )}
    </Hoja>
  );
}
