import { useState } from 'react';
import { COLORS, SegmentedTab, TituloSeccion, fmtMoney } from './shared';
import { IconBasura } from './FinaIcons';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { diaArgentina } from '../../api/v2/pasos';
import {
  actualizarRecurrente, borrarRecurrente, pendienteHoy, textoRepeticion, useRecurrentes,
  type FrecuenciaRecurrente, type GastoRecurrente,
} from '../../api/v2/recurrentes';
import { colorDeSeccion, type Categoria } from './datosGasto';

// Gastos recurrentes: lo que se gasta seguido (el colectivo, el café). Se marcan
// al registrar un gasto diario y después se registran con un toque, desde Gastos
// o desde Inicio cuando llega su horario. A diferencia de un gasto fijo, no
// tienen vencimiento ni monto que se pague sí o sí: cada vez se elige registrarlo.

const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

/** Lo que va a pasar, en una frase: cuándo aparece listo para registrar. */
function cuandoAparece(frecuencia: FrecuenciaRecurrente, fecha: Date, hora: string): string {
  const desde = `desde las ${hora}`;
  if (frecuencia === 'diaria') return `Todos los días ${desde} aparece en Inicio para registrarlo sin completar nada.`;
  if (frecuencia === 'semanal') return `Los ${DIAS[fecha.getDay()]} ${desde} aparece en Inicio para registrarlo sin completar nada.`;
  return `El ${fecha.getDate()} de cada mes ${desde} aparece en Inicio para registrarlo sin completar nada.`;
}

export type OpcionRecurrente = { activo: boolean; frecuencia: FrecuenciaRecurrente; hora: string };

export function opcionRecurrenteInicial(): OpcionRecurrente {
  const h = new Date().getHours();
  return { activo: false, frecuencia: 'diaria', hora: `${String(h).padStart(2, '0')}:00` };
}

/** En el formulario de un gasto diario: el interruptor y, si está prendido, cada cuánto y a qué hora. */
export function CamposRecurrente({ valor, onChange, fecha }: { valor: OpcionRecurrente; onChange: (o: OpcionRecurrente) => void; fecha: Date }) {
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
                { id: 'diaria' as const, label: 'Cada día' },
                { id: 'semanal' as const, label: 'Cada semana' },
                { id: 'mensual' as const, label: 'Cada mes' },
              ]}
              value={valor.frecuencia}
              onChange={(f) => onChange({ ...valor, frecuencia: f })}
              trackColor={COLORS.surface}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recurrente-hora" className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>Horario</label>
            <input
              id="recurrente-hora"
              type="time"
              value={valor.hora}
              onChange={(e) => onChange({ ...valor, hora: e.target.value || valor.hora })}
              className="v2-focus w-full min-w-0 rounded-xl px-3.5 min-h-[48px] text-[14px]"
              style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}`, color: COLORS.ink }}
            />
          </div>
          <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>{cuandoAparece(valor.frecuencia, fecha, valor.hora)}</p>
        </div>
      )}
    </div>
  );
}

/** Registra un recurrente hoy, con un toque. Devuelve el error si no se pudo. */
export async function registrarRecurrente(r: GastoRecurrente, categorias: Categoria[]): Promise<string | null> {
  const nombre = categorias.find((c) => c.id === r.seccionId)?.nombre ?? 'Gasto recurrente';
  const res = await acciones.registrarGasto({
    monto: r.monto, moneda: r.moneda, descripcion: nombre, seccionId: r.seccionId,
    tipo: r.tipo, metodoPago: r.metodoPago, confirmacion: 'Gasto registrado.',
  });
  if (res.error !== null) return res.error;
  actualizarRecurrente(r.id, { ultimoDia: diaArgentina(), ultimoGastoId: res.gasto?.id ?? null });
  return null;
}

function deshacer(r: GastoRecurrente) {
  if (r.ultimoGastoId) acciones.borrarGasto(r.ultimoGastoId);
  actualizarRecurrente(r.id, { ultimoDia: null, ultimoGastoId: null });
}

/** En Gastos: los recurrentes, cada uno con "Registrar". No aparece si no hay ninguno. */
export function ListaRecurrentes({ categorias }: { categorias: Categoria[] }) {
  const recurrentes = useRecurrentes();
  const hoy = diaArgentina();
  const [registrando, setRegistrando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (recurrentes.length === 0) return null;
  const nombre = (r: GastoRecurrente) => categorias.find((c) => c.id === r.seccionId)?.nombre ?? 'Sin categoría';

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
      <div className="flex flex-col">
        {recurrentes.map((r) => {
          const registradoHoy = r.ultimoDia === hoy;
          return (
            <div key={r.id} className="py-3 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorDeSeccion(r.seccionId ?? '', categorias) }} aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] truncate" style={{ color: COLORS.ink }}>{nombre(r)}</p>
                  <p className="text-[13px] truncate" style={{ color: COLORS.inkSoft }}>{textoRepeticion(r)}</p>
                </div>
                <span className="font-mono tabular-nums text-[14px] shrink-0" style={{ color: COLORS.ink }}>{fmtMoney(r.monto)}</span>
                <button
                  type="button"
                  onClick={() => setBorrando(borrando === r.id ? null : r.id)}
                  aria-label={`Borrar gasto recurrente ${nombre(r)}`}
                  aria-expanded={borrando === r.id}
                  className="v2-focus w-11 h-11 -my-2 -mr-2 rounded-full flex items-center justify-center shrink-0"
                  style={{ color: borrando === r.id ? COLORS.ink : COLORS.inkFaint }}
                >
                  <IconBasura size={18} />
                </button>
              </div>

              {borrando !== r.id && (registradoHoy ? (
                <div className="mt-2 ml-5 flex items-center gap-3">
                  <span className="text-[13px] font-semibold" style={{ color: COLORS.limaText }}>Registrado hoy</span>
                  <button type="button" onClick={() => deshacer(r)} className="v2-focus min-h-[44px] text-[13px] font-semibold underline" style={{ color: COLORS.brand }}>
                    Deshacer
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void registrar(r)}
                  disabled={registrando === r.id}
                  className="v2-focus mt-2 ml-5 min-h-[40px] px-4 rounded-full text-[13px] font-bold v2-disabled transition-transform active:scale-95"
                  style={{ background: COLORS.brand, color: COLORS.surface }}
                >
                  {registrando === r.id ? 'Registrando…' : 'Registrar'}
                </button>
              ))}

              {borrando === r.id && (
                <div className="mt-2 rounded-xl px-3.5 py-3 flex flex-col gap-2.5" style={{ background: COLORS.tint }} role="group" aria-label="Confirmar borrado">
                  <p className="text-[13px] leading-snug" style={{ color: COLORS.ink }}>
                    ¿Borrar este gasto recurrente? Deja de aparecer en Inicio. Los que ya registraste quedan en tus gastos.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" autoFocus onClick={() => setBorrando(null)} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
                      Cancelar
                    </button>
                    <button type="button" onClick={() => { setBorrando(null); borrarRecurrente(r.id); }} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-bold" style={{ background: COLORS.ink, color: COLORS.paper }}>
                      Sí, borrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>{error}</p>}
    </section>
  );
}

/** En Inicio: los que hoy ya pasaron su horario y todavía no se registraron, a un toque. */
export function RecurrentesDeHoy() {
  const { estado } = useAlmacen();
  const recurrentes = useRecurrentes();
  const [registrando, setRegistrando] = useState<string | null>(null);
  const pendientes = recurrentes.filter((r) => pendienteHoy(r));
  if (pendientes.length === 0) return null;
  const categorias: Categoria[] = estado.secciones.map((s) => ({ id: s.id, nombre: s.nombre }));
  const nombre = (r: GastoRecurrente) => categorias.find((c) => c.id === r.seccionId)?.nombre ?? 'Gasto';

  return (
    <div className="w-full flex flex-wrap gap-2" role="group" aria-label="Gastos recurrentes de hoy">
      {pendientes.map((r) => (
        <button
          key={r.id}
          type="button"
          disabled={registrando === r.id}
          onClick={async () => { setRegistrando(r.id); await registrarRecurrente(r, categorias); setRegistrando(null); }}
          aria-label={`Registrar ${nombre(r)} ${fmtMoney(r.monto)}`}
          className="v2-focus inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full text-[13px] font-semibold v2-disabled"
          style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.brandSoft}` }}
        >
          + {nombre(r)} <span className="font-mono tabular-nums">{fmtMoney(r.monto)}</span>
        </button>
      ))}
    </div>
  );
}
