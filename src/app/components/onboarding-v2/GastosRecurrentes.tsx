import { useState } from 'react';
import { COLORS, SegmentedTab, TituloSeccion, fmtMoney } from './shared';
import { IconBasura } from './FinaIcons';
import { Hoja } from './Hoja';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { diaArgentina } from '../../api/v2/pasos';
import {
  ORDEN_SEMANA, actualizarRecurrente, borrarRecurrente, enumerar, pendientesHoy, registradasHoy, textoRepeticion, useRecurrentes, vecesHoy,
  type FrecuenciaRecurrente, type GastoRecurrente,
} from '../../api/v2/recurrentes';
import { colorDeSeccion, type Categoria } from './datosGasto';

// Gastos recurrentes: lo que se gasta seguido (el colectivo, el café). Se marcan
// al registrar un gasto y después se registran con un toque, desde Gastos o
// desde Inicio cuando llega su horario. A diferencia de un gasto fijo, no
// tienen vencimiento ni monto que se pague sí o sí: cada vez se elige registrarlo.
//
// Por día se elige cuántas veces y a qué hora cada una; por semana, qué días;
// por mes, se repite el día del mes del gasto.

const DIAS_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_INICIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const VECES_NOMBRE = ['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta'];
const MAX_VECES = VECES_NOMBRE.length;

/** Lo que va a pasar, en una frase: cuándo aparece listo para registrar. */
function cuandoAparece(o: OpcionRecurrente, fecha: Date): string {
  const aparece = 'aparece en Inicio para registrarlo sin completar nada.';
  if (o.frecuencia === 'diaria') {
    return o.horas.length > 1 ? `Todos los días, en cada horario, ${aparece}` : `Todos los días desde las ${o.horas[0]} ${aparece}`;
  }
  if (o.frecuencia === 'semanal') {
    return `Los ${enumerar(ORDEN_SEMANA.filter((d) => o.dias.includes(d)).map((d) => DIAS_PLURAL[d]))} desde las ${o.horas[0]} ${aparece}`;
  }
  return `El ${fecha.getDate()} de cada mes desde las ${o.horas[0]} ${aparece}`;
}

export type OpcionRecurrente = { activo: boolean; frecuencia: FrecuenciaRecurrente; horas: string[]; dias: number[] };

const hh = (h: number) => `${String(Math.max(0, Math.min(23, h))).padStart(2, '0')}:00`;

export function opcionRecurrenteInicial(): OpcionRecurrente {
  return { activo: false, frecuencia: 'diaria', horas: [hh(new Date().getHours())], dias: [] };
}

const ESTILO_HORA: React.CSSProperties = { background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}`, color: COLORS.ink };

/** En el formulario de un gasto nuevo: el interruptor y, si está prendido, cada cuánto, cuántas veces o qué días, y a qué hora. */
export function CamposRecurrente({ valor, onChange, fecha }: { valor: OpcionRecurrente; onChange: (o: OpcionRecurrente) => void; fecha: Date }) {
  const cambiarHora = (i: number, h: string) => onChange({ ...valor, horas: valor.horas.map((x, j) => (j === i ? h || x : x)) });
  // La vez que se suma arranca cuatro horas después de la última.
  const cambiarVeces = (n: number) => {
    if (n < 1 || n > MAX_VECES) return;
    const horas = n < valor.horas.length
      ? valor.horas.slice(0, n)
      : [...valor.horas, hh(Number(valor.horas[valor.horas.length - 1].slice(0, 2)) + 4)];
    onChange({ ...valor, horas });
  };
  // Por semana arranca con el día del gasto. El último día elegido no se
  // puede sacar: sin días no se repetiría nunca.
  const cambiarFrecuencia = (f: FrecuenciaRecurrente) => onChange({
    ...valor,
    frecuencia: f,
    horas: f === 'diaria' ? valor.horas : valor.horas.slice(0, 1),
    dias: f === 'semanal' && valor.dias.length === 0 ? [fecha.getDay()] : valor.dias,
  });
  const alternarDia = (d: number) => {
    const dias = valor.dias.includes(d) ? valor.dias.filter((x) => x !== d) : [...valor.dias, d];
    if (dias.length > 0) onChange({ ...valor, dias });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <p id="recurrente-titulo" className="flex-1 min-w-0 text-[14px] font-bold" style={{ color: COLORS.ink }}>Es un gasto recurrente</p>
        <button
          type="button"
          role="switch"
          aria-checked={valor.activo}
          aria-labelledby="recurrente-titulo"
          onClick={() => onChange({ ...valor, activo: !valor.activo })}
          className="v2-focus relative w-[52px] h-[32px] rounded-full shrink-0 transition-colors"
          style={{ background: valor.activo ? COLORS.brand : COLORS.lineStrong }}
        >
          <span className="absolute top-[3px] w-[26px] h-[26px] rounded-full transition-all" style={{ left: valor.activo ? 23 : 3, background: COLORS.surface }} />
        </button>
      </div>

      {valor.activo && (
        <div className="rounded-xl p-3.5 flex flex-col gap-3" style={{ background: COLORS.tint }}>
          <div className="flex flex-col gap-1.5">
            <p className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>¿Cada cuánto se repite?</p>
            <SegmentedTab
              options={[
                { id: 'diaria' as const, label: 'Por día' },
                { id: 'semanal' as const, label: 'Por semana' },
                { id: 'mensual' as const, label: 'Por mes' },
              ]}
              value={valor.frecuencia}
              onChange={cambiarFrecuencia}
              trackColor={COLORS.surface}
            />
          </div>

          {valor.frecuencia === 'diaria' && (
            <div className="flex items-center justify-between gap-3">
              <p id="recurrente-veces" className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>¿Cuántas veces por día?</p>
              <div className="flex items-center gap-1" role="group" aria-labelledby="recurrente-veces">
                <button
                  type="button"
                  onClick={() => cambiarVeces(valor.horas.length - 1)}
                  disabled={valor.horas.length <= 1}
                  aria-label="Una vez menos"
                  className="v2-focus w-11 h-11 rounded-full text-[18px] font-bold v2-disabled"
                  style={{ background: COLORS.surface, color: COLORS.brand }}
                >
                  −
                </button>
                <span className="w-8 text-center text-[15px] font-bold tabular-nums" style={{ color: COLORS.ink }} aria-live="polite">{valor.horas.length}</span>
                <button
                  type="button"
                  onClick={() => cambiarVeces(valor.horas.length + 1)}
                  disabled={valor.horas.length >= MAX_VECES}
                  aria-label="Una vez más"
                  className="v2-focus w-11 h-11 rounded-full text-[18px] font-bold v2-disabled"
                  style={{ background: COLORS.surface, color: COLORS.brand }}
                >
                  +
                </button>
              </div>
            </div>
          )}

          {valor.frecuencia === 'semanal' && (
            <div className="flex flex-col gap-1.5">
              <p id="recurrente-dias" className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>¿Qué días?</p>
              <div className="grid grid-cols-7 gap-1" role="group" aria-labelledby="recurrente-dias">
                {ORDEN_SEMANA.map((d) => {
                  const sel = valor.dias.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={sel}
                      aria-label={DIAS_NOMBRE[d]}
                      onClick={() => alternarDia(d)}
                      className="v2-focus min-h-[44px] rounded-xl text-[13px] font-bold transition-all duration-100 active:scale-95"
                      style={sel ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                    >
                      {DIAS_INICIAL[d]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className={valor.horas.length > 1 ? 'grid grid-cols-2 gap-2' : 'flex flex-col'}>
            {valor.horas.map((h, i) => (
              <div key={i} className="flex flex-col gap-1.5 min-w-0">
                <label htmlFor={`recurrente-hora-${i}`} className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>
                  {valor.horas.length > 1 ? VECES_NOMBRE[i] : 'Horario'}
                </label>
                <input
                  id={`recurrente-hora-${i}`}
                  type="time"
                  value={h}
                  onChange={(e) => cambiarHora(i, e.target.value)}
                  className="v2-focus w-full min-w-0 rounded-xl px-3.5 min-h-[48px] text-[14px]"
                  style={ESTILO_HORA}
                />
              </div>
            ))}
          </div>
          <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>{cuandoAparece(valor, fecha)}</p>
        </div>
      )}
    </div>
  );
}

/** Cómo se llama: lo que escribió al registrarlo o, si no escribió nada, su categoría. */
function nombreDe(r: GastoRecurrente, categorias: Categoria[]): string {
  return r.descripcion?.trim() || categorias.find((c) => c.id === r.seccionId)?.nombre || 'Gasto recurrente';
}

/** Registra un recurrente hoy, con un toque. Devuelve el error si no se pudo. */
export async function registrarRecurrente(r: GastoRecurrente, categorias: Categoria[]): Promise<string | null> {
  const res = await acciones.registrarGasto({
    monto: r.monto, moneda: r.moneda, descripcion: nombreDe(r, categorias), seccionId: r.seccionId,
    tipo: r.tipo, metodoPago: r.metodoPago, confirmacion: 'Gasto registrado.',
  });
  if (res.error !== null) return res.error;
  const hoy = diaArgentina();
  const antes = r.registros?.dia === hoy ? r.registros.gastoIds : [];
  actualizarRecurrente(r.id, { registros: { dia: hoy, gastoIds: [...antes, res.gasto?.id ?? ''] } });
  return null;
}

/** Deshace el último registro de hoy (borra ese gasto). */
function deshacer(r: GastoRecurrente) {
  const ids = r.registros?.dia === diaArgentina() ? r.registros.gastoIds : [];
  const ultimo = ids[ids.length - 1];
  if (ultimo) acciones.borrarGasto(ultimo);
  actualizarRecurrente(r.id, { registros: ids.length > 1 ? { dia: diaArgentina(), gastoIds: ids.slice(0, -1) } : null });
}

/** En Gastos: los recurrentes, del último que se marcó al primero, cada uno con "Registrar". */
export function ListaRecurrentes({ categorias, onAgregar }: { categorias: Categoria[]; onAgregar: () => void }) {
  const recurrentes = useRecurrentes();
  const [registrando, setRegistrando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<GastoRecurrente | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function registrar(r: GastoRecurrente) {
    setRegistrando(r.id);
    setError(null);
    const e = await registrarRecurrente(r, categorias);
    setRegistrando(null);
    if (e) setError(e);
  }

  return (
    <section className="flex flex-col gap-1" aria-label="Gastos recurrentes">
      <TituloSeccion>Gastos recurrentes</TituloSeccion>
      {recurrentes.length === 0 && (
        <>
          <p className="py-2 text-[13px]" style={{ color: COLORS.inkSoft }}>Todavía no tenés gastos recurrentes.</p>
          <button type="button" onClick={onAgregar} className="v2-focus self-start min-h-[44px] text-[13px] font-semibold underline" style={{ color: COLORS.brand }}>
            Anotar un gasto recurrente
          </button>
        </>
      )}
      <div className="flex flex-col">
        {[...recurrentes].reverse().map((r) => {
          // Un día que no le toca se puede registrar igual, una vez.
          const veces = Math.max(vecesHoy(r), 1);
          const hechas = registradasHoy(r);
          return (
            <div key={r.id} className="py-3 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorDeSeccion(r.seccionId ?? '', categorias) }} aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] truncate" style={{ color: COLORS.ink }}>{nombreDe(r, categorias)}</p>
                  <p className="text-[13px] truncate" style={{ color: COLORS.inkSoft }}>{textoRepeticion(r)}</p>
                </div>
                <span className="font-mono tabular-nums text-[14px] shrink-0" style={{ color: COLORS.ink }}>{fmtMoney(r.monto)}</span>
                <button
                  type="button"
                  onClick={() => setBorrando(r)}
                  aria-label={`Borrar gasto recurrente ${nombreDe(r, categorias)}`}
                  aria-haspopup="dialog"
                  className="v2-focus w-11 h-11 -my-2 -mr-2 rounded-full flex items-center justify-center shrink-0"
                  style={{ color: COLORS.inkFaint }}
                >
                  <IconBasura size={18} />
                </button>
              </div>

              <div className="mt-2 ml-5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {hechas < veces && (
                  <button
                    type="button"
                    onClick={() => void registrar(r)}
                    disabled={registrando === r.id}
                    className="v2-focus min-h-[40px] px-4 rounded-full text-[13px] font-bold v2-disabled transition-transform active:scale-95"
                    style={{ background: COLORS.brand, color: COLORS.surface }}
                  >
                    {registrando === r.id ? 'Registrando…' : 'Registrar'}
                  </button>
                )}
                {hechas > 0 && (
                  <>
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: COLORS.limaText }}>
                      {veces > 1 ? `Hoy, ${hechas} de ${veces}` : 'Registrado hoy'}
                    </span>
                    <button type="button" onClick={() => deshacer(r)} className="v2-focus min-h-[44px] text-[13px] font-semibold underline" style={{ color: COLORS.brand }}>
                      Deshacer
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>{error}</p>}

      {borrando && (
        <Hoja titulo="¿Borrar este gasto recurrente?" onCerrar={() => setBorrando(null)}>
          <div className="pt-1 flex flex-col gap-3">
            <p className="text-[13px] leading-snug" style={{ color: COLORS.ink }}>
              Deja de aparecer en Inicio. Los que ya registraste quedan en tus gastos.
            </p>
            <div className="flex gap-2">
              <button type="button" autoFocus onClick={() => setBorrando(null)} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
                Cancelar
              </button>
              <button type="button" onClick={() => { borrarRecurrente(borrando.id); setBorrando(null); }} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-bold" style={{ background: COLORS.ink, color: COLORS.paper }}>
                Sí, borrar
              </button>
            </div>
          </div>
        </Hoja>
      )}
    </section>
  );
}

/**
 * En Inicio: los que hoy ya pasaron un horario y todavía no se registraron, a
 * un toque. Uno que se repite varias veces por día sigue a mano hasta que se
 * registran todas las que ya pasaron.
 */
export function RecurrentesDeHoy() {
  const { estado } = useAlmacen();
  const recurrentes = useRecurrentes();
  const [registrando, setRegistrando] = useState<string | null>(null);
  const pendientes = recurrentes.filter((r) => pendientesHoy(r) > 0);
  if (pendientes.length === 0) return null;
  const categorias: Categoria[] = estado.secciones.map((s) => ({ id: s.id, nombre: s.nombre }));

  return (
    <div className="w-full flex flex-wrap gap-2" role="group" aria-label="Gastos recurrentes de hoy">
      {pendientes.map((r) => (
        <button
          key={r.id}
          type="button"
          disabled={registrando === r.id}
          onClick={async () => { setRegistrando(r.id); await registrarRecurrente(r, categorias); setRegistrando(null); }}
          aria-label={`Registrar ${nombreDe(r, categorias)} ${fmtMoney(r.monto)}`}
          className="v2-focus inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full text-[13px] font-semibold v2-disabled"
          style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.brandSoft}` }}
        >
          + {nombreDe(r, categorias)} <span className="font-mono tabular-nums">{fmtMoney(r.monto)}</span>
        </button>
      ))}
    </div>
  );
}
