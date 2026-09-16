import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Fini } from './Fini';
import { COLOR_VARS, COLORS, FONT_VARS, FONTS } from './shared';
import { IconFuego } from './FinaIcons';
import { useAuth } from '../../lib/auth';
import { usePasoDelDia } from '../../api/v2/PasoDelDiaProvider';
import { RACHA_VACIA } from '../../api/v2/tipos';

// Cuando la racha sube, se festeja: en el medio de la pantalla aparece el número
// de la racha con el fueguito y Fini saltando al lado; el número pasa del
// anterior al nuevo, y después todo viaja hasta el contador de racha de arriba a
// la derecha en Home y se acomoda ahí.
//
// Pasa tanto al entrar a FINA (si la racha subió desde la última vez que la vio,
// por ejemplo con un gasto contado por WhatsApp) como estando adentro (al
// cumplir el paso del día).
//
// "La última que vio" se guarda en este dispositivo, por cuenta. Si la racha
// bajó (se cortó), se actualiza sin festejar nada: no hay nada que festejar y
// la app no reta.
//
// Si no está Home abierta (no hay contador a la vista), vuela hacia la esquina
// de arriba a la derecha y se desvanece.

type Fase = 'entra' | 'muestra' | 'vuela' | 'fin';

const llave = (uid: string) => `fina_racha_vista_${uid}`;

function leerVista(uid: string): number | null {
  try {
    const v = localStorage.getItem(llave(uid));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function guardarVista(uid: string, dias: number) {
  try { localStorage.setItem(llave(uid), String(dias)); } catch { /* sin storage: se festeja de nuevo, no pasa nada */ }
}

export function CelebracionRacha() {
  const { racha } = usePasoDelDia();
  const { user } = useAuth();
  const reducir = useReducedMotion();
  const [festejo, setFestejo] = useState<{ desde: number; hasta: number } | null>(null);

  // ¿Subió desde la última que vio?
  useEffect(() => {
    // Todavía no se cargó la racha de la base: no se decide nada.
    if (racha === RACHA_VACIA || !user) return;
    const vista = leerVista(user.id);
    if (vista !== null && racha.dias > vista && racha.dias > 0) {
      setFestejo({ desde: vista, hasta: racha.dias });
    }
    // Se guarda enseguida (y no al terminar la animación): si la persona cierra
    // la app a mitad del festejo, no se repite la próxima vez.
    if (vista !== racha.dias) guardarVista(user.id, racha.dias);
  }, [racha, user]);

  if (!festejo) return null;
  return <Animacion key={`${festejo.desde}-${festejo.hasta}`} desde={festejo.desde} hasta={festejo.hasta} reducir={!!reducir} onFin={() => setFestejo(null)} />;
}

function Animacion({ desde, hasta, reducir, onFin }: { desde: number; hasta: number; reducir: boolean; onFin: () => void }) {
  const [fase, setFase] = useState<Fase>('entra');
  const [numero, setNumero] = useState(desde);
  const [vuelo, setVuelo] = useState<{ dx: number; dy: number; escala: number; origen: string } | null>(null);
  const grupoRef = useRef<HTMLDivElement>(null);
  const numeroRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Mientras se festeja, el contador de Home se esconde: el número "llega"
    // volando y recién ahí aparece.
    document.documentElement.dataset.rachaAnimando = '1';
    const t: number[] = [];
    const despues = (ms: number, fn: () => void) => t.push(window.setTimeout(fn, ms));

    if (reducir) {
      // Sin movimiento: se muestra el número nuevo un momento y se va.
      setNumero(hasta);
      setFase('muestra');
      despues(1600, () => setFase('fin'));
      despues(1900, onFin);
    } else {
      despues(50, () => setFase('muestra'));
      despues(650, () => setNumero(hasta));
      despues(1900, () => {
        // Lo que llega al contador es el fueguito con el número (Fini se queda y
        // desaparece). Por eso se mide ESE bloque, y se escala alrededor de su
        // centro: así cae justo encima del contador de Home.
        const grupo = grupoRef.current?.getBoundingClientRect();
        const num = numeroRef.current?.getBoundingClientRect();
        // Al contador se llega sobre su fueguito con el número ([data-racha-numero]),
        // no sobre todo el contador (que incluye "días" abajo): si no, la escala
        // se calcula contra un alto que no es el del número y llega grande.
        const destino = (document.querySelector('[data-racha-destino] [data-racha-numero]')
          ?? document.querySelector('[data-racha-destino]'))?.getBoundingClientRect();
        if (grupo && num) {
          const cx = num.left + num.width / 2;
          const cy = num.top + num.height / 2;
          const tx = destino ? destino.left + destino.width / 2 : window.innerWidth - 40;
          const ty = destino ? destino.top + destino.height / 2 : 40;
          setVuelo({
            dx: tx - cx,
            dy: ty - cy,
            escala: destino ? Math.max(0.2, destino.height / num.height) : 0.2,
            origen: `${cx - grupo.left}px ${cy - grupo.top}px`,
          });
        }
        setFase('vuela');
      });
      despues(2650, () => setFase('fin'));
      despues(2750, onFin);
    }
    return () => {
      t.forEach((x) => window.clearTimeout(x));
      delete document.documentElement.dataset.rachaAnimando;
    };
  }, []);

  const visible = fase === 'muestra' || fase === 'vuela';
  const volando = fase === 'vuela' && vuelo;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
      style={{ ...FONT_VARS, ...COLOR_VARS }}
      role="status"
      aria-live="polite"
    >
      {/* Velo claro: saca protagonismo a la pantalla sin taparla. */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{ background: COLORS.paper, opacity: fase === 'muestra' ? 0.85 : 0 }}
      />

      <div
        ref={grupoRef}
        className="relative flex items-center gap-2"
        style={{
          opacity: fase === 'fin' ? 0 : visible ? 1 : 0,
          transform: volando
            ? `translate(${vuelo.dx}px, ${vuelo.dy}px) scale(${vuelo.escala})`
            : `scale(${visible ? 1 : 0.6})`,
          transformOrigin: volando ? vuelo.origen : '50% 50%',
          transition: volando
            ? 'transform 700ms cubic-bezier(.5,0,.3,1), opacity 150ms ease 650ms'
            : 'transform 350ms cubic-bezier(.3,1.4,.5,1), opacity 250ms ease',
        }}
      >
        <div className="flex flex-col items-center">
          <span ref={numeroRef} className="flex items-center gap-2" style={{ color: COLORS.brand }}>
            <IconFuego size={56} />
            <span
              key={numero}
              className="text-[72px] font-bold leading-none tabular-nums v2-racha-pop"
              style={{ fontFamily: FONTS.mono }}
            >
              {numero}
            </span>
          </span>
          {/* Se va antes del vuelo: al contador de arriba llega sólo el número. */}
          <span
            className="text-[18px] font-bold mt-1 transition-opacity duration-200"
            style={{ color: COLORS.ink, fontFamily: FONTS.display, opacity: volando ? 0 : 1 }}
          >
            {hasta === 1 ? '¡Arrancaste tu racha!' : `¡${hasta} días de racha!`}
          </span>
        </div>
        {/* Fini salta al lado, y no viaja: se queda y desaparece. */}
        <div className="transition-opacity duration-200" style={{ opacity: volando ? 0 : 1 }}>
          <Fini state="logro" size={120} />
        </div>
      </div>
    </div>
  );
}
