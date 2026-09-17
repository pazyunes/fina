import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { COLORS, COLOR_VARS, FONT_VARS } from './shared';
import { IconClose } from './FinaIcons';
import { useAuth } from '../../lib/auth';
import { activarNotificaciones, notificacionesActivas, soporteNotificaciones } from '../../api/v2/notificaciones';

// Invitación a activar los avisos, en dos momentos:
//
//   1. Al terminar el onboarding ("¡Llegaste a FINA!").
//   2. En Home, una vez que registró su primer gasto, si todavía no los activó.
//      Ahí ya sabe para qué sirve FINA y el aviso tiene sentido. Si dice "Ahora
//      no", vuelve a aparecer a la semana, y después de tres veces no insiste.
//
// En iPhone desde Safari los avisos no existen: primero hay que agregar FINA a
// la pantalla de inicio. En vez de un botón que no hace nada, se ofrece el
// tutorial, con un video que se puede ver en miniatura (picture in picture)
// mientras se siguen los pasos en Safari.

/** El video lo graba el equipo. Si todavía no está, el tutorial muestra sólo los pasos. */
const VIDEO_TUTORIAL = '/tutorial/agregar-a-inicio.mp4';

const ESPERA_ENTRE_INVITACIONES = 7 * 86_400_000;
const MAXIMO_DE_INVITACIONES = 3;

type Descartes = { veces: number; ultima: number };
const llave = (uid: string) => `fina_invitacion_avisos_${uid}`;

function leerDescartes(uid: string): Descartes {
  try {
    const v = JSON.parse(localStorage.getItem(llave(uid)) ?? 'null') as Descartes | null;
    return v && typeof v.veces === 'number' ? v : { veces: 0, ultima: 0 };
  } catch {
    return { veces: 0, ultima: 0 };
  }
}
function guardarDescarte(uid: string) {
  const d = leerDescartes(uid);
  try { localStorage.setItem(llave(uid), JSON.stringify({ veces: d.veces + 1, ultima: Date.now() })); } catch { /* sin storage: vuelve a aparecer, no pasa nada */ }
}

/** Con `momento="home"`, pasar cuántos gastos registró: antes del primero no se invita. */
export function InvitacionAvisos({ momento, gastosRegistrados = 0 }: { momento: 'onboarding' | 'home'; gastosRegistrados?: number }) {
  const soporte = soporteNotificaciones();
  const { user } = useAuth();
  const [activas, setActivas] = useState<boolean | null>(null);
  const [descartada, setDescartada] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [tutorial, setTutorial] = useState(false);

  useEffect(() => {
    let vivo = true;
    void notificacionesActivas().then((a) => { if (vivo) setActivas(a); });
    return () => { vivo = false; };
  }, []);

  if (soporte !== 'si' && soporte !== 'iphone-sin-instalar') return null;
  if (activas !== false || descartada) return null;
  if (momento === 'home') {
    if (!user || gastosRegistrados === 0) return null;
    const d = leerDescartes(user.id);
    if (d.veces >= MAXIMO_DE_INVITACIONES || Date.now() - d.ultima < ESPERA_ENTRE_INVITACIONES) return null;
  }

  const ahoraNo = () => {
    if (momento === 'home' && user) guardarDescarte(user.id);
    setDescartada(true);
  };

  async function activar() {
    setTrabajando(true);
    setMensaje(null);
    const r = await activarNotificaciones();
    setTrabajando(false);
    if (r.resultado === 'activadas') { setActivas(true); return; }
    setMensaje(r.resultado === 'permiso-denegado'
      ? 'Quedaron bloqueados para FINA. Podés permitirlos desde los ajustes del navegador y activarlos en Perfil.'
      : 'No pudimos activarlos. Probá de nuevo desde Perfil.');
  }

  const iphone = soporte === 'iphone-sin-instalar';
  const titulo = iphone ? 'Sumá FINA a tu pantalla de inicio' : '¿Te avisamos?';
  const texto = iphone
    ? 'En iPhone, los avisos llegan sólo con FINA en tu inicio. Son tres toques y te mostramos cómo.'
    : 'Cuando vence un gasto fijo, el día que cobrás y si tu paso del día quedó pendiente. Como mucho, dos por día.';

  const centrado = momento === 'onboarding';

  return (
    <>
      <section
        className={`rounded-2xl p-4 flex flex-col gap-3 w-full ${centrado ? 'text-left mt-2' : ''}`}
        style={{ background: COLORS.brandSoft }}
        aria-label="Activar avisos"
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold leading-snug" style={{ color: COLORS.ink }}>{titulo}</p>
            <p className="text-[15px] leading-snug mt-0.5" style={{ color: COLORS.ink }}>{texto}</p>
          </div>
          {momento === 'home' && (
            <button type="button" onClick={ahoraNo} aria-label="Cerrar" className="v2-focus w-11 h-11 -mt-2 -mr-2 rounded-full flex items-center justify-center shrink-0" style={{ color: COLORS.inkSoft }}>
              <IconClose size={18} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => (iphone ? setTutorial(true) : void activar())}
            disabled={trabajando}
            className="v2-focus min-h-[44px] px-5 rounded-full text-[15px] font-bold v2-disabled transition-transform active:scale-95"
            style={{ background: COLORS.brand, color: COLORS.surface }}
          >
            {iphone ? 'Ver cómo' : trabajando ? 'Activando…' : 'Activar avisos'}
          </button>
          <button type="button" onClick={ahoraNo} className="v2-focus min-h-[44px] px-3 text-[15px] font-semibold" style={{ color: COLORS.inkSoft }}>
            Ahora no
          </button>
        </div>
        {mensaje && <p role="status" className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>{mensaje}</p>}
      </section>
      {tutorial && <TutorialAgregarAInicio onCerrar={() => setTutorial(false)} />}
    </>
  );
}

// ── Tutorial: agregar FINA a la pantalla de inicio (iPhone) ──────────────

type VideoConPip = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (modo: string) => boolean;
  webkitSetPresentationMode?: (modo: string) => void;
};

const PASOS_IPHONE: { texto: React.ReactNode }[] = [
  { texto: <>En Safari, tocá los tres puntitos <strong>(•••)</strong> abajo a la derecha y después <strong>Compartir</strong>. En iPhones más viejos, el botón Compartir está directo abajo.</> },
  { texto: <>Tocá <strong>Ver más</strong> y después <strong>Agregar a pantalla de inicio</strong>.</> },
  { texto: <>Dejá prendido <strong>Abrir como app web</strong> y tocá <strong>Agregar</strong>.</> },
  { texto: <>Abrí FINA desde el ícono nuevo y activá los avisos.</> },
];

export function TutorialAgregarAInicio({ onCerrar }: { onCerrar: () => void }) {
  const videoRef = useRef<VideoConPip>(null);
  const [hayVideo, setHayVideo] = useState(true);
  const [pipPosible, setPipPosible] = useState(false);
  const [enMiniatura, setEnMiniatura] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setPipPosible(
      (typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled)
      || !!v.webkitSupportsPresentationMode?.('picture-in-picture'),
    );
    const entra = () => setEnMiniatura(true);
    const sale = () => setEnMiniatura(false);
    // En iPhone la miniatura avisa con su propio evento.
    const cambiaModo = () => setEnMiniatura((v as VideoConPip & { webkitPresentationMode?: string }).webkitPresentationMode === 'picture-in-picture');
    v.addEventListener('enterpictureinpicture', entra);
    v.addEventListener('leavepictureinpicture', sale);
    v.addEventListener('webkitpresentationmodechanged', cambiaModo);
    return () => {
      v.removeEventListener('enterpictureinpicture', entra);
      v.removeEventListener('leavepictureinpicture', sale);
      v.removeEventListener('webkitpresentationmodechanged', cambiaModo);
    };
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  async function verEnMiniatura() {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.play();
      if (v.requestPictureInPicture) await v.requestPictureInPicture();
      else v.webkitSetPresentationMode?.('picture-in-picture');
    } catch (e) {
      console.error('[tutorial] miniatura:', e);
      setPipPosible(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3"
      style={{ ...FONT_VARS, ...COLOR_VARS, background: 'rgba(43,33,24,0.45)' }}
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-titulo"
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: COLORS.surface, boxShadow: '0 12px 40px -8px rgba(43,33,24,0.35)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <p id="tutorial-titulo" className="flex-1 text-[20px] font-bold leading-snug" style={{ color: COLORS.ink }}>Agregá FINA a tu inicio</p>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="v2-focus w-11 h-11 -mt-2 -mr-2 rounded-full flex items-center justify-center shrink-0" style={{ color: COLORS.inkSoft }}>
            <IconClose size={20} />
          </button>
        </div>

        {hayVideo && (
          <div className="flex flex-col gap-2.5">
            <video
              ref={videoRef}
              src={VIDEO_TUTORIAL}
              muted
              playsInline
              autoPlay
              loop
              preload="auto"
              onError={() => setHayVideo(false)}
              className="w-full max-h-[46vh] rounded-xl object-contain"
              style={{ background: COLORS.tint }}
              aria-label="Video: cómo agregar FINA a la pantalla de inicio"
            />
            {pipPosible && (
              <button
                type="button"
                onClick={() => void verEnMiniatura()}
                className="v2-focus min-h-[48px] rounded-xl text-[16px] font-bold transition-transform active:scale-[0.98]"
                style={{ background: COLORS.brand, color: COLORS.surface }}
              >
                {enMiniatura ? 'Ya está en miniatura' : 'Verlo en miniatura mientras lo hacés'}
              </button>
            )}
            {pipPosible && (
              <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
                El video queda chiquito en una esquina y podés seguir los pasos en Safari al mismo tiempo.
              </p>
            )}
          </div>
        )}

        <ol className="flex flex-col gap-2.5">
          {PASOS_IPHONE.map((p, i) => (
            <li key={i} className="flex gap-2.5 items-start">
              <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[14px] font-bold" style={{ background: COLORS.brandSoft, color: COLORS.ink }}>{i + 1}</span>
              <span className="flex-1 text-[16px] leading-snug pt-0.5" style={{ color: COLORS.ink }}>{p.texto}</span>
            </li>
          ))}
        </ol>

        <button type="button" onClick={onCerrar} className="v2-focus min-h-[48px] rounded-xl text-[16px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}>
          Listo
        </button>
      </div>
    </div>,
    document.body,
  );
}
