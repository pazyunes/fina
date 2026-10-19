import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { diaArgentina } from '../../api/v2/pasos';
import { COLORS } from './shared';
import { LinkWhatsApp } from './LinkWhatsApp';

// Registrar lo del día: el recordatorio fijo de arriba de Inicio. Es lo que
// sostiene la racha (cuenta cada día con un gasto anotado) y todo lo demás.
// Se queda siempre en su lugar y cambia de texto: el primer gasto, lo de hoy,
// o ya anotado (con la opción de sumar otro). Así no se mueve todo Inicio
// cuando se anota algo.
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

  if (!listo) return null;
  const hoy = diaArgentina();
  const hayGastoHoy = estado.gastos.some((g) => diaArgentina(g.ts) === hoy);
  const primero = estado.gastos.length === 0;
  const irAGastos = () => navigate('/onboarding-v2/gastos', { state: { abrir: 'gasto', from: '/onboarding-v2/home' } });

  return (
    <section
      aria-label="Registro de hoy"
      className="-mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-2.5"
      // Un recuadro apenas tintado: está siempre, así que no puede pesar más
      // que el próximo paso. WhatsApp va en verde claro: es el canal que más
      // queremos que use.
      style={{ background: COLORS.brandFaint }}
    >
      <p className="flex-1 min-w-[140px] text-[14px] font-semibold" style={{ color: hayGastoHoy ? COLORS.limaText : COLORS.ink }}>
        {hayGastoHoy ? 'Ya anotaste lo de hoy' : primero ? 'Anotá tu primer gasto' : '¿Anotaste lo de hoy?'}
      </p>
      {hayGastoHoy ? (
        <button
          type="button"
          onClick={irAGastos}
          className="v2-focus min-h-[44px] px-3 rounded-full text-[14px] font-semibold"
          style={{ color: COLORS.brand }}
        >
          Sumar otro
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <LinkWhatsApp
            onClick={() => { fueAWhatsApp.current = true; }}
            className="v2-focus inline-flex items-center min-h-[44px] px-4 rounded-full text-[14px] font-semibold"
            style={{ background: COLORS.limaSoft, color: COLORS.limaText }}
          >
            Por WhatsApp
          </LinkWhatsApp>
          <button
            type="button"
            onClick={irAGastos}
            className="v2-focus min-h-[44px] px-3 rounded-full text-[14px] font-semibold"
            style={{ color: COLORS.brand }}
          >
            Acá
          </button>
        </div>
      )}
    </section>
  );
}
