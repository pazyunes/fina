import { useState } from 'react';
import { useNavigate } from 'react-router';
import { COLORS, SegmentedTab, TituloSeccion, fmtMoney } from './shared';
import { IconBasura, IconCalendario, IconChevron } from './FinaIcons';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { diaArgentina } from '../../api/v2/pasos';
import { FRECUENCIAS, cuandoVence, diasHasta, siguienteVencimiento, type FrecuenciaFija } from '../../api/v2/fechasFijos';
import type { GastoFijo } from '../../api/v2/tipos';

// Gastos fijos: lo que se paga siempre (alquiler, gimnasio, el celular).
//
// Se eligió "recordar y confirmar": FINA no registra el gasto sola cuando
// vence, porque no sabe si se pagó, cuánto (el alquiler sube) ni con qué. Avisa
// el día antes y el mismo día, y con "Ya lo pagué" se registra como un gasto más
// y pasa al próximo vencimiento.
//
// Tono (regla 3): un pago que venció no se pinta en color de alerta ni se reta;
// se dice cuándo venció y se ofrece marcarlo.

const MONTO = (g: { monto: number; moneda: 'ARS' | 'USD' }) =>
  g.moneda === 'USD' ? `US$${g.monto.toLocaleString('es-AR')}` : fmtMoney(g.monto);

// Corto, para que entre en el renglón junto a la fecha.
const FRECUENCIA_CORTA: Record<FrecuenciaFija, string> = { mensual: 'Mensual', semanal: 'Semanal', quincenal: 'Quincenal', anual: 'Anual' };
const etiquetaFrecuencia = (f: FrecuenciaFija) => FRECUENCIA_CORTA[f];

/** Desde cuántos días antes se ofrece "Ya lo pagué". */
const DIAS_PARA_PAGAR = 7;

function textoVencimiento(hoy: string, dia: string): string {
  const n = diasHasta(hoy, dia);
  if (n < 0) return n === -1 ? 'Venció ayer' : `Venció hace ${-n} días`;
  return `Vence ${cuandoVence(hoy, dia)}`;
}

// ── En el formulario de "Agregar gasto" ──────────────────────────────────

export type OpcionFijo = {
  activo: boolean;
  /** true: lo acaba de pagar (se registra el gasto). false: todavía no. */
  yaPagado: boolean;
  frecuencia: FrecuenciaFija;
  /** 'YYYY-MM-DD'. */
  proximo: string;
  /** Si la persona eligió la fecha a mano (entonces no se recalcula sola). */
  fechaElegida: boolean;
};

export function opcionFijoInicial(): OpcionFijo {
  return { activo: false, yaPagado: true, frecuencia: 'mensual', proximo: siguienteVencimiento(diaArgentina(), 'mensual', null), fechaElegida: false };
}

/** Si la fecha del gasto fijo sirve para guardarlo. */
export function opcionFijoValida(o: OpcionFijo): boolean {
  if (!o.activo) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.proximo)) return false;
  const n = diasHasta(diaArgentina(), o.proximo);
  return o.yaPagado ? n > 0 : n >= 0;
}

export function CamposGastoFijo({ valor, onChange }: { valor: OpcionFijo; onChange: (o: OpcionFijo) => void }) {
  const hoy = diaArgentina();
  const manana = sumarUnDia(hoy);

  // Mientras no elija la fecha a mano, se propone la que sigue según la
  // frecuencia (si ya lo pagó) o queda vacía para que diga cuándo vence.
  const cambiar = (parcial: Partial<OpcionFijo>) => {
    const nuevo = { ...valor, ...parcial };
    if (!nuevo.fechaElegida) nuevo.proximo = nuevo.yaPagado ? siguienteVencimiento(hoy, nuevo.frecuencia, null) : '';
    onChange(nuevo);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p id="fijo-titulo" className="text-[16px] font-bold" style={{ color: COLORS.ink }}>Es un gasto fijo</p>
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>Se repite, como el alquiler o el gimnasio. Te avisamos cuando se acerca.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={valor.activo}
          aria-labelledby="fijo-titulo"
          onClick={() => onChange({ ...opcionFijoInicial(), activo: !valor.activo })}
          className="v2-focus relative w-[52px] h-[32px] rounded-full shrink-0 transition-colors"
          style={{ background: valor.activo ? COLORS.brand : COLORS.lineStrong }}
        >
          <span className="absolute top-[3px] w-[26px] h-[26px] rounded-full transition-all" style={{ left: valor.activo ? 23 : 3, background: COLORS.surface }} />
        </button>
      </div>

      {valor.activo && (
        <div className="rounded-xl p-3.5 flex flex-col gap-3" style={{ background: COLORS.tint }}>
          <div className="flex flex-col gap-1.5">
            <p className="text-[14px] font-bold" style={{ color: COLORS.inkSoft }}>¿Ya lo pagaste esta vez?</p>
            <SegmentedTab
              options={[{ id: 'si' as const, label: 'Sí, ya lo pagué' }, { id: 'no' as const, label: 'Todavía no' }]}
              value={valor.yaPagado ? 'si' : 'no'}
              onChange={(v) => cambiar({ yaPagado: v === 'si', fechaElegida: false })}
              trackColor={COLORS.surface}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fijo-frecuencia" className="text-[14px] font-bold" style={{ color: COLORS.inkSoft }}>¿Cada cuánto se paga?</label>
            <div className="relative">
              <select
                id="fijo-frecuencia"
                value={valor.frecuencia}
                onChange={(e) => cambiar({ frecuencia: e.target.value as FrecuenciaFija })}
                className="v2-focus w-full appearance-none rounded-xl pl-3.5 pr-10 min-h-[48px] text-[16px]"
                style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
              >
                {FRECUENCIAS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} aria-hidden>
                <IconChevron size={16} style={{ transform: 'rotate(90deg)' }} />
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fijo-fecha" className="text-[14px] font-bold" style={{ color: COLORS.inkSoft }}>
              {valor.yaPagado ? '¿Cuándo es el próximo pago?' : '¿Cuándo vence?'}
            </label>
            <input
              id="fijo-fecha"
              type="date"
              min={valor.yaPagado ? manana : hoy}
              value={valor.proximo}
              onChange={(e) => onChange({ ...valor, proximo: e.target.value, fechaElegida: true })}
              className="v2-focus w-full rounded-xl px-3.5 min-h-[48px] text-[16px]"
              style={{ background: COLORS.surface, color: valor.proximo ? COLORS.ink : COLORS.inkFaint, border: `1.5px solid ${COLORS.lineStrong}` }}
            />
            {valor.proximo && !opcionFijoValida(valor) && (
              <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>
                {valor.yaPagado ? 'Elegí una fecha a partir de mañana.' : 'Elegí una fecha a partir de hoy.'}
              </p>
            )}
          </div>

          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            {valor.yaPagado
              ? 'Lo registramos hoy como un gasto y te avisamos antes del próximo pago.'
              : 'No cuenta como gasto hasta que lo pagues. Te avisamos antes de que venza.'}
          </p>
        </div>
      )}
    </div>
  );
}

function sumarUnDia(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── La lista, en Mis gastos ──────────────────────────────────────────────

export function ListaGastosFijos() {
  const { estado } = useAlmacen();
  const hoy = diaArgentina();
  const [borrando, setBorrando] = useState<string | null>(null);
  const [pagando, setPagando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (estado.gastosFijos.length === 0) return null;

  const nombreSeccion = (id: string | null) => estado.secciones.find((s) => s.id === id)?.nombre;

  async function pagar(id: string) {
    setPagando(id);
    setError(null);
    const e = await acciones.pagarGastoFijo(id);
    setPagando(null);
    if (e) setError(e);
  }

  return (
    <section data-gastos-fijos className="flex flex-col gap-2 lg:col-span-3 scroll-mt-6">
      <TituloSeccion>Gastos fijos</TituloSeccion>
      <div className="flex flex-col">
        {estado.gastosFijos.map((g) => {
          const n = diasHasta(hoy, g.proximoPago);
          const sePuedePagar = n <= DIAS_PARA_PAGAR;
          return (
            <div key={g.id} data-fijo={g.id} className="py-3 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
              <div className="flex items-center gap-2.5">
                <span className="shrink-0" style={{ color: COLORS.brand }} aria-hidden><IconCalendario size={18} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] truncate" style={{ color: COLORS.ink }}>{g.descripcion}</p>
                  <p className="text-[14px] truncate" style={{ color: COLORS.inkSoft }}>
                    {[textoVencimiento(hoy, g.proximoPago), etiquetaFrecuencia(g.frecuencia), nombreSeccion(g.seccionId)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="font-mono tabular-nums text-[15px] shrink-0" style={{ color: COLORS.ink }}>{MONTO(g)}</span>
                <button
                  type="button"
                  onClick={() => setBorrando(borrando === g.id ? null : g.id)}
                  aria-label={`Borrar gasto fijo ${g.descripcion}`}
                  aria-expanded={borrando === g.id}
                  className="v2-focus w-11 h-11 -my-2 -mr-2 rounded-full flex items-center justify-center shrink-0"
                  style={{ color: borrando === g.id ? COLORS.ink : COLORS.inkFaint }}
                >
                  <IconBasura size={18} />
                </button>
              </div>

              {sePuedePagar && borrando !== g.id && (
                <button
                  type="button"
                  onClick={() => void pagar(g.id)}
                  disabled={pagando === g.id}
                  className="v2-focus mt-2 ml-7 min-h-[40px] px-4 rounded-full text-[14px] font-bold v2-disabled transition-transform active:scale-95"
                  style={{ background: COLORS.brand, color: COLORS.surface }}
                >
                  {pagando === g.id ? 'Registrando…' : 'Ya lo pagué'}
                </button>
              )}

              {borrando === g.id && (
                <div className="mt-2 rounded-xl px-3.5 py-3 flex flex-col gap-2.5" style={{ background: COLORS.tint }} role="group" aria-label="Confirmar borrado">
                  <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>
                    ¿Borrar este gasto fijo? Dejamos de avisarte. Los pagos que ya registraste quedan en tus gastos.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" autoFocus onClick={() => setBorrando(null)} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[15px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
                      Cancelar
                    </button>
                    <button type="button" onClick={() => { setBorrando(null); acciones.borrarGastoFijo(g.id); }} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[15px] font-bold" style={{ background: COLORS.ink, color: COLORS.paper }}>
                      Sí, borrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>{error}</p>}
    </section>
  );
}

// ── En Home, cuando algo vence ───────────────────────────────────────────

/** Los gastos fijos que vencen en los próximos 2 días o ya vencieron. */
export function fijosPorVencer(fijos: GastoFijo[], hoy = diaArgentina()): GastoFijo[] {
  return fijos.filter((g) => diasHasta(hoy, g.proximoPago) <= 2);
}

export function AvisoVencimientoHome() {
  const { estado } = useAlmacen();
  const navigate = useNavigate();
  const hoy = diaArgentina();
  const [pagando, setPagando] = useState(false);
  const proximos = fijosPorVencer(estado.gastosFijos, hoy);
  if (proximos.length === 0) return null;
  const g = proximos[0];

  async function pagar() {
    setPagando(true);
    await acciones.pagarGastoFijo(g.id);
    setPagando(false);
  }

  return (
    <section className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}` }} aria-label="Gasto fijo por vencer">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }} aria-hidden>
          <IconCalendario size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: COLORS.inkSoft }}>
            {proximos.length === 1 ? 'Gasto fijo' : `${proximos.length} gastos fijos`}
          </p>
          <p className="text-[17px] font-bold leading-snug" style={{ color: COLORS.ink }}>
            {g.descripcion} · <span className="font-mono tabular-nums">{MONTO(g)}</span>
          </p>
          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>{textoVencimiento(hoy, g.proximoPago)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void pagar()}
          disabled={pagando}
          className="v2-focus flex-1 min-h-[44px] rounded-xl text-[15px] font-bold v2-disabled transition-transform active:scale-95"
          style={{ background: COLORS.brand, color: COLORS.surface }}
        >
          {pagando ? 'Registrando…' : 'Ya lo pagué'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/onboarding-v2/gastos', { state: { abrir: 'fijos' } })}
          className="v2-focus flex-1 min-h-[44px] rounded-xl text-[15px] font-semibold"
          style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
        >
          {proximos.length === 1 ? 'Ver' : 'Ver todos'}
        </button>
      </div>
    </section>
  );
}
