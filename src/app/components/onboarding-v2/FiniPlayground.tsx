import { useState } from 'react';
import { Fini, type FiniState } from './Fini';
import { COLORS, FONTS, Titulo, TituloSeccion } from './shared';

// PRUEBA — banco de pruebas de Fini. Port del FiniPlayground.svelte, para poder
// recorrer los once estados sin tener que provocarlos en la app.
// Vive en /onboarding-v2/fini. Rama descartable.

// La tercera columna es lo que dice la guía (§6) sobre usar ese estado en la
// app. No es una opinión de diseño: son las reglas que ya están escritas.
const ESTADOS: { id: FiniState; nombre: string; veredicto: 'ok' | 'ojo' | 'no'; nota: string }[] = [
  { id: 'idle', nombre: 'Respiración (base)', veredicto: 'ojo', nota: 'Solo si está en una pantalla sin datos. Quieta y permanente es decoración.' },
  { id: 'saludo', nombre: 'Saludo', veredicto: 'ok', nota: 'Intro del onboarding: primera pantalla, ningún número.' },
  { id: 'pensando', nombre: 'Procesando', veredicto: 'ok', nota: 'Esperas reales. Hoy el sandbox no tiene ninguna (todo es local).' },
  { id: 'progreso', nombre: 'Un paso más', veredicto: 'ok', nota: 'Aporte sumado a un objetivo. Es un logro chico y transitorio.' },
  { id: 'logro', nombre: 'Objetivo cumplido', veredicto: 'ok', nota: 'El mejor lugar de la app. §6 lo habilita por nombre y §5.3 dice que es el momento de mayor valor.' },
  { id: 'insight', nombre: 'Idea o sugerencia', veredicto: 'ojo', nota: 'Servía para los tips de Home, que sacamos por repetidos. Quedaría para la pantalla intermedia del onboarding.' },
  { id: 'alerta', nombre: 'Atención', veredicto: 'no', nota: '§6: «Fini no reacciona a un gasto. No hay Fini preocupada — eso es moralizar con otra cara».' },
  { id: 'vacio', nombre: 'Todavía no hay nada', veredicto: 'ok', nota: 'Vidriera vacía. §10 dice explícitamente que acá sí va.' },
  { id: 'error', nombre: 'Se cayó la conexión', veredicto: 'no', nota: 'Se tropieza. Hace que la app parezca torpe justo cuando necesita que le crean.' },
  { id: 'registro', nombre: 'Dato recibido', veredicto: 'ojo', nota: 'Entra desde el costado: fuerte para algo que pasa muchas veces por día.' },
  { id: 'cierre', nombre: 'Cierre del día', veredicto: 'ok', nota: 'Resumen de fin de mes. Todavía no existe en el sandbox.' },
];

const VEREDICTO: Record<'ok' | 'ojo' | 'no', { label: string; bg: string; fg: string }> = {
  ok: { label: 'Va', bg: COLORS.limaSoft, fg: COLORS.limaText },
  ojo: { label: 'Ojo', bg: COLORS.starSoft, fg: COLORS.starText },
  no: { label: 'No', bg: COLORS.naranjaSoft, fg: COLORS.naranjaText },
};

export function FiniPlayground() {
  const [state, setState] = useState<FiniState>('idle');
  const [size, setSize] = useState(180);
  const [once, setOnce] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [key, setKey] = useState(0);
  const [ultimo, setUltimo] = useState('');

  // Remonta el componente para volver a disparar una animación de una pasada.
  const repetir = () => setKey((k) => k + 1);
  const actual = ESTADOS.find((e) => e.id === state);

  return (
    <div className="min-h-screen px-6 py-8 flex flex-col gap-6 lg:max-w-3xl lg:mx-auto" style={{ background: COLORS.paper }}>
      <header>
        <Titulo>Fini — prueba</Titulo>
        <p className="text-[15px] mt-2" style={{ color: COLORS.inkSoft }}>
          Rama descartable. Para volver a como está hoy: <span className="font-mono" style={{ color: COLORS.ink }}>git checkout dev</span>
        </p>
      </header>

      <div
        className="grid place-items-center rounded-[24px] py-8"
        style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}`, minHeight: 340 }}
      >
        <Fini key={key} state={state} size={size} once={once} speed={speed} onDone={(s) => setUltimo(s)} />
      </div>

      <div className="flex flex-col gap-2">
        <TituloSeccion>Estados</TituloSeccion>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map((e) => {
            const on = state === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => { setState(e.id); repetir(); }}
                aria-pressed={on}
                className="v2-focus min-h-[44px] rounded-full px-4 text-[14.5px] font-semibold transition-all duration-100 active:scale-[0.97]"
                style={on
                  ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
                  : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
              >
                {e.nombre}
              </button>
            );
          })}
        </div>
      </div>

      {actual && (
        <div className="flex flex-col gap-2 pl-3.5 border-l-2" style={{ borderColor: VEREDICTO[actual.veredicto].bg }}>
          <span
            className="self-start rounded-full px-2.5 py-0.5 text-[13px] font-bold"
            style={{ background: VEREDICTO[actual.veredicto].bg, color: VEREDICTO[actual.veredicto].fg }}
          >
            {VEREDICTO[actual.veredicto].label} en la app
          </span>
          <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{actual.nota}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <TituloSeccion>Controles</TituloSeccion>
        <label className="flex items-center gap-3 text-[15px] min-h-[44px]" style={{ color: COLORS.ink }}>
          <input type="checkbox" checked={once} onChange={(e) => { setOnce(e.target.checked); repetir(); }} className="v2-focus w-5 h-5" />
          Una sola pasada
        </label>
        <label className="flex items-center gap-3 text-[15px]" style={{ color: COLORS.ink }}>
          <span className="w-20 shrink-0">Tamaño</span>
          <input type="range" min={40} max={320} value={size} onChange={(e) => setSize(Number(e.target.value))} className="v2-focus flex-1" />
          <span className="w-16 text-right font-mono tabular-nums" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }}>{size}px</span>
        </label>
        <label className="flex items-center gap-3 text-[15px]" style={{ color: COLORS.ink }}>
          <span className="w-20 shrink-0">Ritmo</span>
          <input type="range" min={0.6} max={2} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="v2-focus flex-1" />
          <span className="w-16 text-right font-mono tabular-nums" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }}>{speed}×</span>
        </label>
        <button
          type="button"
          onClick={repetir}
          className="v2-focus self-start min-h-[44px] rounded-2xl px-5 text-[15px] font-bold transition-all duration-100 active:scale-[0.98]"
          style={{ background: COLORS.brand, color: COLORS.surface }}
        >
          Volver a reproducir
        </button>
        {ultimo && <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Terminó: {ultimo}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <TituloSeccion>Dónde está puesta en esta prueba</TituloSeccion>
        <ul className="flex flex-col gap-1.5 list-none p-0 m-0 text-[15px]" style={{ color: COLORS.inkSoft }}>
          <li>· Onboarding, primera pantalla — <span style={{ color: COLORS.ink }}>saludo</span></li>
          <li>· Onboarding, pantalla final — <span style={{ color: COLORS.ink }}>logro</span></li>
          <li>· Onboarding, «esto vas a poder hacer» — <span style={{ color: COLORS.ink }}>insight</span></li>
          <li>· Objetivos, vidriera vacía — <span style={{ color: COLORS.ink }}>vacio</span></li>
          <li>· Objetivos, objetivo cumplido — <span style={{ color: COLORS.ink }}>logro</span></li>
          <li>· Gastos, vidriera vacía — <span style={{ color: COLORS.ink }}>vacio</span></li>
          <li>· Grupos, vidriera vacía — <span style={{ color: COLORS.ink }}>vacio</span></li>
        </ul>
        <p className="text-[14px] leading-snug mt-1" style={{ color: COLORS.inkFaint }}>
          Sacada de la cabecera de Objetivos, donde estaba pegada a «Vas por 3 objetivos» — el §6 dice que nunca va cerca de un dato.
          Y sacada del placeholder de foto en Perfil: ahí era tu avatar, no tu acompañante.
        </p>
      </div>
    </div>
  );
}
