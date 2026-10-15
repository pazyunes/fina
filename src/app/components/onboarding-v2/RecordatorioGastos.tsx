import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { diaArgentina } from '../../api/v2/pasos';
import { COLORS } from './shared';
import { LinkWhatsApp } from './LinkWhatsApp';

// Registrar lo del día es un recordatorio fijo, no un paso (DEBT I2): un paso
// que se repite todos los días no enseña nada nuevo, pero el registro es lo que
// sostiene todo lo demás. Una fila chica debajo del saludo, sólo mientras hoy
// no hay ningún gasto anotado. Sin gastos de ningún día no aparece: ahí el paso
// de hoy ya es registrar el primero.
export function RecordatorioGastos() {
  const navigate = useNavigate();
  const { estado, listo, recargar } = useAlmacen();
  const fueAWhatsApp = useRef(false);

  // Al volver de WhatsApp se traen los datos: el bot escribe del otro lado, y
  // si no, la fila seguiría preguntando justo después de haberlo contado.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== 'visible' || !fueAWhatsApp.current) return;
      fueAWhatsApp.current = false;
      void recargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [recargar]);

  const hoy = diaArgentina();
  const hayGastoHoy = estado.gastos.some((g) => diaArgentina(g.ts) === hoy);
  if (!listo || estado.gastos.length === 0 || hayGastoHoy) return null;

  return (
    <section
      aria-label="Registro de hoy"
      className="-mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-2.5"
      style={{ background: COLORS.tint }}
    >
      <p className="flex-1 min-w-[140px] text-[15px] font-semibold" style={{ color: COLORS.ink }}>
        ¿Anotaste lo de hoy?
      </p>
      <div className="flex items-center gap-1">
        <LinkWhatsApp
          onClick={() => { fueAWhatsApp.current = true; }}
          className="v2-focus inline-flex items-center min-h-[44px] px-4 rounded-full text-[15px] font-semibold"
          style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
        >
          Por WhatsApp
        </LinkWhatsApp>
        <button
          type="button"
          onClick={() => navigate('/onboarding-v2/gastos', { state: { abrir: 'gasto', from: '/onboarding-v2/home' } })}
          className="v2-focus min-h-[44px] px-3 rounded-full text-[15px] font-semibold"
          style={{ color: COLORS.brand }}
        >
          Acá
        </button>
      </div>
    </section>
  );
}
