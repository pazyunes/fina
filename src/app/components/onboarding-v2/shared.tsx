import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { IconChevron, IconGastos, IconGrupo, IconObjetivos, IconSparkle } from './FinaIcons';
import './onboarding-v2.css';

// REDISEÑO v2 (rama feat/rediseno-onboarding-v2) — piezas compartidas entre
// el onboarding y las pantallas post-onboarding.
//
// V2 del rediseño: se deja atrás la estética "rubber hose / mascota" —
// bordes negros gruesos, sombras duras tipo sticker, tipografía Baloo 2 —
// y se acerca a las referencias que sí sumaron (Headspace/Cleo/Nubank):
// tarjetas limpias con sombra suave, tipografía Poppins (la misma que ya
// usa el resto de la app real) y el púrpura de marca de FINA (#7626B3,
// el mismo que Login/ObjetivosPage/InversionesPage) en vez de un acento
// inventado. La energía sigue cambiando por sección (Gastos colorido,
// Inversiones serio en modo oscuro), pero ya no via sombra de cómic.

// Tokens de onboarding-v2 — fuente de verdad de color del sandbox (no tocamos
// styles/tokens.css, que es de la app real). Alineado a la guía de frontend
// (src/styles/frontend.md §3-§4). Reglas duras que respeta esta paleta:
//   · Los colores de marca (lima/star/naranja/lila) son de RELLENO, no de
//     texto: sobre ellos el texto va en `ink`, nunca en blanco. Cuando el
//     color tiene que ir en tipografía, se usa su token `-Text` (≥6:1).
//   · El púrpura queda degradado a rol ESTRUCTURAL (bordes/foco/recuadros/
//     botones); no es "la marca".
//   · El color que se recuerda es el LIMA, en el momento de valor (un objetivo
//     que avanza).
//   · Los gastos se muestran NEUTRALES (tinta), nunca en color de alerta.
// El fondo se bajó de intensidad respecto del crema del manual (#FFF4E4) a un
// casi-blanco cálido, por pedido de diseño.
export const COLORS = {
  // Neutros / superficies
  ink: '#2B2118',        // tinta — texto y montos (14:1+ sobre papel)
  inkSoft: '#5F5346',    // tinta-media — labels, fechas (6.9:1)
  inkFaint: '#7A6A58',   // tinta-suave — auxiliar (mínimo AA)
  paper: '#FAF7F1',      // fondo general — casi blanco, apenas cálido
  surface: '#FFFFFF',    // superficie elevada — tarjetas
  tint: '#F1EBDF',       // hueco — bloque tintado / hundido
  line: '#E7DFD1',       // hairline — separadores
  lineStrong: '#D6CBB8', // separador más marcado

  // Acento estructural (púrpura, NO es la marca)
  brand: '#7E5DA8',      // púrpura — botones, progreso, foco, bordes (5.2:1 con blanco)
  brandSoft: '#EEE7F6',  // lila muy suave — bandas / recuadros
  brandDark: '#3D2A55',  // noche — fondos oscuros, texto fuerte

  // Fondo del "marco" que envuelve la pantalla en desktop — ver DeviceFrame.
  frameBg: '#EFEAE0',

  // Colores de marca (RELLENO). Cada uno con su -Soft (superficie) y su -Text
  // (≥6:1) para cuando el color tiene que ir en tipografía o ícono fino.
  lima: '#B0E150', limaSoft: '#EAF5D0', limaText: '#41660F',        // valor / éxito / objetivo que avanza
  star: '#FFC457', starSoft: '#FFEECB', starText: '#7A4F00',        // Fini, medallitas, destacados
  naranja: '#FF7B4F', naranjaSoft: '#FFE3D6', naranjaText: '#A83208', // atención accionable
  lila: '#CB9EFF', lilaBorde: '#9A6BD1',

  // ── Aliases de compatibilidad: keys viejas → paleta de la guía ──
  green: '#B0E150', greenSoft: '#EAF5D0',                  // éxito/valor → lima
  coral: '#FF7B4F', coralSoft: '#FFE3D6', coralDark: '#A83208', // atención → naranja
  gold: '#FFC457', goldSoft: '#FFEECB',                    // destacado → star
  amarillo: '#FFC457', fideo: '#FF7B4F',
  sky: '#7E5DA8', skySoft: '#EEE7F6',                      // inversiones sin ruido de color → estructural
  // La guía no usa color por sección: gastos neutral, objetivos = lima (valor),
  // inversiones = estructural, grupos = star.
  gastos: '#2B2118', gastosSoft: '#F1EBDF',
  objetivos: '#41660F', objetivosSoft: '#EAF5D0',
  inversiones: '#7E5DA8', inversionesSoft: '#EEE7F6',
  grupos: '#7A4F00', gruposSoft: '#FFEECB',

  // Inversiones vive en modo oscuro — la plata seria se muestra sin ruido de
  // color, sobre la "noche" de la guía.
  dark: '#3D2A55',
  darkCard: '#4A3663',
  darkLine: 'rgba(250,247,241,0.12)',
  onDark: '#FAF7F1',
  onDarkSoft: 'rgba(250,247,241,0.6)',
};

// Tipografía de onboarding-v2 (guía §3.4): Outfit títulos, Figtree cuerpo,
// IBM Plex Mono montos. Se aplican SCOPEADAS al subárbol de v2 sobrescribiendo
// las CSS vars que ya usan los <h1..h4> y el body — así la app real sigue en
// Baloo 2 sin tocarla. Ver FONT_VARS.
export const FONTS = {
  display: "'Outfit', system-ui, sans-serif",
  body: "'Figtree', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};
// Se pega en el root de V2Layout y DeviceFrame (style={{ ...FONT_VARS }}).
export const FONT_VARS = {
  '--font-serif': FONTS.display,
  '--font-sans': FONTS.body,
  '--font-mono': FONTS.mono,
} as React.CSSProperties;

// ── plata: formateo + parseo de inputs ──
export function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`;
}
export function parseMoneyInput(v: string): number {
  return parseInt(v.replace(/\D/g, '')) || 0;
}
export function formatThousands(v: string): string {
  const digits = v.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}

// ── Capa de movimiento: emoción y celebración en el flujo ──────────────
// Números que "cuentan" (estilo Mercado Pago cuando rinden tus intereses):
// animan de un valor al siguiente (y de 0 al entrar). Devuelve el número
// que se está mostrando en cada frame.
export function useCountUp(value: number, duration = 650): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); fromRef.current = to; };
  }, [value, duration]);
  return display;
}

// Número animado listo para usar. `format` recibe el número en curso.
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const n = useCountUp(value);
  return <>{format ? format(n) : Math.round(n).toLocaleString('es-AR')}</>;
}

// Celebración: un burst de partículas de colores que sale del centro del
// contenedor (el padre tiene que ser position:relative). `big` para logros
// grandes (ej: llegar a la meta). Se dispara mostrando show=true un rato.
export function Celebracion({ show, big = false }: { show: boolean; big?: boolean }) {
  const n = big ? 22 : 12;
  const colores = [COLORS.brand, COLORS.gold, COLORS.green, COLORS.coral, COLORS.sky];
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-visible">
          {Array.from({ length: n }).map((_, i) => {
            const ang = (i / n) * Math.PI * 2;
            const dist = (big ? 92 : 56) + (i % 5) * 8;
            return (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
                animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, opacity: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: big ? 1 : 0.75, ease: 'easeOut' }}
                className="absolute w-2.5 h-2.5 rounded-full"
                style={{ background: colores[i % colores.length] }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

// id legible a partir de un texto libre (para categorías que el usuario
// escribe a mano, tanto en el onboarding como en Gastos).
export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'otro'
  );
}

// Puente Onboarding → toda la app: el nombre es lo primero que personaliza
// todo — saludo en Home, mensajes del bot, pantalla final. Sin esto la app
// se siente un formulario; con esto se siente que te habla a vos.
const LS_NOMBRE = 'fina_v2_nombre';
export function saveV2Nombre(nombre: string) {
  try {
    localStorage.setItem(LS_NOMBRE, nombre);
  } catch {
    // no crítico
  }
}
export function loadV2Nombre(): string {
  try {
    return localStorage.getItem(LS_NOMBRE) || '';
  } catch {
    return '';
  }
}

// Saludo según la hora — el mismo detalle que usan Headspace/Cleo para que
// la pantalla de entrada se sienta una persona hablándote, no un dashboard.
export function saludoDelDia(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

// Foto de perfil — se guarda como data URL (base64) en localStorage, no
// hay backend todavía para subir archivos de verdad.
const LS_FOTO = 'fina_v2_foto';
export function saveV2Foto(dataUrl: string | null) {
  try {
    if (!dataUrl) { localStorage.removeItem(LS_FOTO); return; }
    localStorage.setItem(LS_FOTO, dataUrl);
  } catch {
    // no crítico
  }
}
export function loadV2Foto(): string | null {
  try {
    return localStorage.getItem(LS_FOTO);
  } catch {
    return null;
  }
}

// Grupo — CONCEPTO/EJEMPLO todavía: no hay cuentas ni backend real para
// que dos personas compartan datos entre dispositivos, así que esto vive
// 100% en tu propio localStorage. Sirve para probar la idea (competir por
// actividad, objetivos compartidos) antes de invertir en la parte de
// cuentas reales — mostralo como demo, no como "así ya funciona".
export type Miembro = { nombre: string; actividad: number; sosVos?: boolean };
export type Grupo = { nombre: string; codigo: string; miembros: Miembro[] };
const LS_GRUPO = 'fina_v2_grupo';
export function saveV2Grupo(g: Grupo | null) {
  try {
    if (!g) { localStorage.removeItem(LS_GRUPO); return; }
    localStorage.setItem(LS_GRUPO, JSON.stringify(g));
  } catch {
    // no crítico
  }
}
export function loadV2Grupo(): Grupo | null {
  try {
    const raw = localStorage.getItem(LS_GRUPO);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Invitar de verdad (share sheet nativo, o copiar al portapapeles si no hay)
// — se usa desde Grupos y desde el flujo de crear un objetivo en conjunto.
export async function invitarAGrupo(g: Grupo): Promise<'compartido' | 'copiado' | 'nada'> {
  const texto = `Unite a "${g.nombre}" en FINA con el código ${g.codigo} 💜`;
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return 'compartido';
    } catch {
      return 'nada'; // canceló el share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    return 'copiado';
  } catch {
    return 'nada'; // sin permiso de portapapeles — no es crítico
  }
}

function codigoAlAzar(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return `FINA-${c}`;
}
// Arma un grupo con compañeras de EJEMPLO + vos (con tu nombre real) — se
// usa tanto desde el onboarding ("¿individual o con amigas?") como desde
// Grupos ("Crear un grupo"). Mismo criterio de siempre: sin backend real
// todavía, esto prueba la idea.
export function crearGrupoDemo(nombreGrupo: string): Grupo {
  const yo = loadV2Nombre() || 'Vos';
  return {
    nombre: nombreGrupo,
    codigo: codigoAlAzar(),
    miembros: [
      { nombre: 'Caro', actividad: 6 },
      { nombre: yo, actividad: 3, sosVos: true },
      { nombre: 'Male', actividad: 2 },
      { nombre: 'Juli', actividad: 1 },
    ],
  };
}

// Botón "armar grupo" reutilizable — va en TODAS las pantallas menos Home
// (en Home, en cambio, se muestra directamente el ranking del grupo). Si ya
// hay un grupo armado, lleva a verlo; si no, a la pantalla para crearlo.
export function ArmarGrupoBtn() {
  const navigate = useNavigate();
  const grupo = loadV2Grupo();
  return (
    <button
      type="button"
      onClick={() => navigate('/onboarding-v2/grupos')}
      className="v2-focus w-full flex items-center gap-3 text-left rounded-2xl px-4 py-3.5 transition-all duration-100 active:scale-[0.99]"
      style={{ background: COLORS.brandSoft }}
    >
      <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.surface, color: COLORS.brand }}><IconGrupo size={18} /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-bold" style={{ color: COLORS.brandDark }}>{grupo ? grupo.nombre : 'Armar un grupo'}</span>
        <span className="block text-[11.5px]" style={{ color: COLORS.inkSoft }}>{grupo ? 'Ver el ranking de tu grupo' : 'Competí con amigas y amigos por actividad'}</span>
      </span>
      <span className="shrink-0" style={{ color: COLORS.brand }}><IconChevron size={18} /></span>
    </button>
  );
}

// ── puente Onboarding → Gastos: las categorías de gasto que la persona
// marcó en el onboarding ("¿en qué se te suele ir la plata?") aparecen ya
// creadas como secciones cuando entra a Gastos. Sandbox 100% local (v2 no
// tiene backend todavía) — se guarda en localStorage de este navegador.
const LS_CATEGORIAS = 'fina_v2_categorias_gasto';
export function saveV2Categorias(categorias: string[]) {
  try {
    localStorage.setItem(LS_CATEGORIAS, JSON.stringify(categorias));
  } catch {
    // localStorage puede no estar disponible (modo privado, etc.) — no es crítico.
  }
}
export function loadV2Categorias(): string[] {
  try {
    const raw = localStorage.getItem(LS_CATEGORIAS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Puente Onboarding → Inversiones: si contestó el mini-perfil ("¿con qué
// objetivo querés invertir?" + la de reacción ante la volatilidad) en el
// onboarding, Inversiones arranca directo desde ahí en vez de repreguntar.
// yaInvierte es opcional: si el onboarding ya preguntó "¿invertís?" (la
// pregunta de hábitos), ese dato viaja acá también para no repetir la
// pregunta sí/no que Inversiones hacía por su cuenta.
export type InversionesPerfil = { porQue: string; reaccion: string; yaInvierte?: 'si' | 'no' };
const LS_INV_PERFIL = 'fina_v2_inversiones_perfil';
export function saveV2InversionesPerfil(p: InversionesPerfil | null) {
  try {
    if (!p) { localStorage.removeItem(LS_INV_PERFIL); return; }
    localStorage.setItem(LS_INV_PERFIL, JSON.stringify(p));
  } catch {
    // no crítico
  }
}
export function loadV2InversionesPerfil(): InversionesPerfil | null {
  try {
    const raw = localStorage.getItem(LS_INV_PERFIL);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Puente Onboarding → Objetivos: si dijo que ya tiene objetivos en mente y
// los nombró, aparecen ya creados (sin monto todavía) para completar ahí —
// ahora con el plazo y la moneda que ya contestó en el onboarding, en vez de
// solo el nombre a secas.
export type ObjetivoInicial = { nombre: string; horizonte: string | null; moneda: 'ARS' | 'USD' };
const LS_OBJETIVOS_INICIALES = 'fina_v2_objetivos_iniciales';
export function saveV2ObjetivosIniciales(objetivos: ObjetivoInicial[]) {
  try {
    localStorage.setItem(LS_OBJETIVOS_INICIALES, JSON.stringify(objetivos));
  } catch {
    // no crítico
  }
}
export function loadV2ObjetivosIniciales(): ObjetivoInicial[] {
  try {
    const raw = localStorage.getItem(LS_OBJETIVOS_INICIALES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Puente Onboarding → toda la app: perfil ampliado con las señales de
// situación/hábitos que hoy no tienen otra sección propia (Gastos/Objetivos/
// Inversiones). Es lo que en el futuro va a alimentar al asesor con IA —
// por eso se guarda entero, incluso lo que la persona escribió a mano en
// "Otro" (nunca se descarta post-onboarding, como si nunca se hubiese
// contestado).
export type PerfilOnboarding = {
  zona: string | null;
  convivencia: string[];
  ingresos: string[];
  estabilidadIngresos: string | null;
  margenPropio: string | null;
  gastosFijos: string[];
  categoriasRecortar: string[];
  ahorra: string | null;
  invierte: string | null;
  controlaGastos: string | null;
  comoConocio: string | null;
  meta?: string | null;
};
const LS_PERFIL_ONB = 'fina_v2_perfil_onboarding';
export function saveV2PerfilOnboarding(p: PerfilOnboarding) {
  try {
    localStorage.setItem(LS_PERFIL_ONB, JSON.stringify(p));
  } catch {
    // no crítico
  }
}
export function loadV2PerfilOnboarding(): PerfilOnboarding | null {
  try {
    const raw = localStorage.getItem(LS_PERFIL_ONB);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Aceptación de términos y condiciones — falta real en el onboarding (no
// existía ningún paso de esto), no una idea copiada de otra app.
const LS_TERMINOS = 'fina_v2_terminos_aceptados';
export function saveV2TerminosAceptados(v: boolean) {
  try {
    localStorage.setItem(LS_TERMINOS, v ? '1' : '0');
  } catch {
    // no crítico
  }
}
export function loadV2TerminosAceptados(): boolean {
  try {
    return localStorage.getItem(LS_TERMINOS) === '1';
  } catch {
    return false;
  }
}

// Nivel de conocimiento financiero — NO se pregunta en el onboarding: vive
// como CTA en Home ("Conocé tu nivel de conocimiento financiero") para no
// sumar un paso más ahí. Se guarda igual que el resto para que el futuro
// asesor pueda calibrar cómo explicar las cosas.
const LS_NIVEL_FIN = 'fina_v2_nivel_financiero';
export function saveV2NivelFinanciero(nivel: string) {
  try {
    localStorage.setItem(LS_NIVEL_FIN, nivel);
  } catch {
    // no crítico
  }
}
export function loadV2NivelFinanciero(): string | null {
  try {
    return localStorage.getItem(LS_NIVEL_FIN);
  } catch {
    return null;
  }
}

// Donut de progreso/distribución (conic-gradient, sin librerías de charts).
export function Donut({
  segments,
  centerLabel,
  centerValue,
  size = 132,
  dark = false,
}: {
  segments: { color: string; pct: number }[];
  centerLabel: string;
  centerValue: string;
  size?: number;
  dark?: boolean;
}) {
  let acc = 0;
  const stops = segments
    .filter((s) => s.pct > 0)
    .map((s) => {
      const start = acc;
      acc += s.pct;
      return `${s.color} ${start}% ${acc}%`;
    })
    .join(', ');
  const inset = Math.round(size * 0.13);
  return (
    <div
      className="relative rounded-full shrink-0"
      style={{ width: size, height: size, background: stops || (dark ? COLORS.darkLine : '#ECE7F2') }}
    >
      <div
        className="absolute rounded-full flex flex-col items-center justify-center"
        style={{
          inset,
          background: dark ? COLORS.darkCard : COLORS.surface,
          boxShadow: dark ? 'none' : '0 2px 10px rgba(31,27,46,0.07)',
        }}
      >
        <span className="text-[10.5px] leading-tight text-center" style={{ color: dark ? COLORS.onDarkSoft : COLORS.inkSoft }}>{centerLabel}</span>
        <span className="font-bold text-[15px] leading-tight" style={{ color: dark ? COLORS.onDark : COLORS.ink }}>{centerValue}</span>
      </div>
    </div>
  );
}

// Avatar — un "orbe de humor" en vez de la carita de mascota cómic: mismo
// mecanismo de personalización (elegís un color en el onboarding), sin
// ojos-de-muñeco ni contorno negro grueso. El trazo de la cara sale del
// propio color (negro translúcido, nunca #000 puro), así se ve integrado.
export function Face({ color, size = 150, mood = 'neutral' }: { color: string; size?: number; mood?: 'neutral' | 'happy' }) {
  const stroke = 'rgba(20,14,32,0.4)';
  return (
    <svg width={size} height={size} viewBox="0 0 150 150">
      <circle cx="75" cy="75" r="70" fill={color} />
      {mood === 'neutral' ? (
        <>
          <circle cx="58" cy="72" r="4.5" fill={stroke} />
          <circle cx="92" cy="72" r="4.5" fill={stroke} />
          <path d="M60 97 Q75 105 90 97" stroke={stroke} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M49 68 Q58 61 67 68" stroke={stroke} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M83 68 Q92 61 101 68" stroke={stroke} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M55 93 Q75 112 95 93" stroke={stroke} strokeWidth="3.6" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
      <path d="M1 5.5L5 9.5L13 1.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Chip de selección — plano, sin sombra dura: relleno sólido cuando está
// activo (violeta de marca, o coral en las preguntas "warm"), borde fino
// cuando no. El feedback táctil es un scale-down breve (estilo Cleo), no
// un desplazamiento con sombra que desaparece de golpe.
//
// `muted` es para las opciones "de escape" (Ninguno por ahora, Todavía no
// lo pensé, No me interesa, etc.) — se ven grisáceas incluso activas, para
// que no compitan visualmente con una respuesta real.
export function Chip({ on, warm: _warm, muted, onClick, children }: { on: boolean; warm?: boolean; muted?: boolean; onClick: () => void; children: React.ReactNode }) {
  // Seleccionado = relleno púrpura estructural + texto blanco (5.2:1). Las
  // opciones "de escape" (muted) se rellenan de hueco con tinta-media, para
  // que no compitan con una respuesta real. Sin seleccionar = superficie con
  // hairline. (Se dejó de usar el coral decorativo: la guía reserva el naranja
  // para atención accionable, no para dar énfasis a una pregunta.)
  const style: React.CSSProperties = on
    ? muted
      ? { background: COLORS.tint, color: COLORS.inkSoft }
      : { background: COLORS.brand, color: '#fff' }
    : { background: COLORS.surface, color: COLORS.ink, border: `1px solid ${COLORS.line}` };
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className="v2-focus inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14.5px] font-semibold select-none
        transition-all duration-100 ease-out active:scale-[0.96]"
    >
      {children}
    </button>
  );
}

// Chip "Otro" — a propósito distinto de un chip de opción real: borde
// punteado, sin relleno sólido ni cuando está abierto, para que se lea como
// "acá se escribe" y no como una opción más ya elegida.
export function OtroChip({ abierto, onClick }: { abierto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="v2-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14.5px] font-semibold select-none
        border border-dashed transition-all duration-100 ease-out active:scale-[0.96]"
      style={{ borderColor: COLORS.lilaBorde, color: COLORS.brandDark, background: abierto ? COLORS.brandSoft : COLORS.surface }}
    >
      + Otro
    </button>
  );
}

// Caja de ayuda/ejemplo — para los textos grises que acompañan una
// pregunta: más grandes y en una cajita, no una línea chiquita que se pierde.
export function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-3.5 py-2.5" style={{ background: COLORS.tint }}>
      <p className="text-[13.5px] font-semibold leading-snug" style={{ color: COLORS.brandDark }}>{children}</p>
    </div>
  );
}

export function Cta({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={disabled
        ? { background: COLORS.tint, color: COLORS.inkFaint }
        : { background: COLORS.brand, color: '#fff', boxShadow: '0 10px 24px -8px rgba(61,42,85,0.45)' }}
      className={`v2-focus w-full rounded-2xl py-4 text-[16px] font-bold select-none
        transition-all duration-100 ease-out active:scale-[0.98]
        ${disabled ? 'cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );
}

// Fila de acción grande de Home — tarjeta blanca con sombra suave.
export function ActionRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
      className="v2-focus w-full flex items-center gap-3.5 rounded-2xl px-4 py-4
        transition-all duration-100 ease-out active:scale-[0.98] text-left"
    >
      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.brandSoft, color: COLORS.brand }}>
        {icon}
      </span>
      <span className="flex-1 font-semibold text-[15px]" style={{ color: COLORS.ink }}>{label}</span>
      <span className="shrink-0" style={{ color: COLORS.inkFaint }}><IconChevron size={18} /></span>
    </button>
  );
}

// "Marco" de la pantalla del onboarding.
//   - Mobile: pantalla completa, sin marco (como cualquier página real).
//   - Desktop (lg+): PANEL DIVIDIDO — a la izquierda un panel de marca fijo
//     (FINA + los 3 pilares) y a la derecha el flujo de preguntas ocupando el
//     resto. Así se siente onboarding de app moderna y no un "teléfono
//     chiquito" centrado con medio monitor vacío.
export function DeviceFrame({ children }: { children: React.ReactNode }) {
  const PILARES = [
    { Icon: IconGastos, t: 'Conocé tus gastos' },
    { Icon: IconObjetivos, t: 'Lográ tus objetivos' },
    { Icon: IconSparkle, t: 'Cuidá tu bienestar financiero' },
  ];
  return (
    <div
      className="h-screen supports-[height:100dvh]:h-[100dvh] w-full flex flex-col overflow-hidden lg:flex-row"
      style={{ background: COLORS.paper, ...FONT_VARS }}
    >
      {/* Panel de marca — solo desktop */}
      <aside
        className="hidden lg:flex lg:flex-col lg:justify-between lg:w-[40%] lg:max-w-[520px] shrink-0 px-12 py-14"
        style={{ background: COLORS.brand, color: '#fff' }}
      >
        <div className="text-[26px] font-bold tracking-tight">FINA</div>
        <div className="flex flex-col gap-7">
          <p className="text-[30px] font-bold leading-[1.15]">Ordená tu plata,<br />a tu ritmo.</p>
          <ul className="flex flex-col gap-4">
            {PILARES.map((p) => (
              <li key={p.t} className="flex items-center gap-3 text-[16px] font-semibold">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}><p.Icon size={18} /></span>
                {p.t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12.5px]" style={{ color: 'rgba(255,255,255,0.75)' }}>Tu información es privada — no la compartimos con nadie.</p>
      </aside>

      {/* Flujo de preguntas */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ── "Primera vez" — un cartelito que explica una sección apenas se entra,
// se cierra con la cruz y no vuelve a aparecer nunca más (se recuerda por
// localStorage). Se usa en cada pantalla nueva, y en Home para explicar
// puntualmente qué es el botón de chat (el ícono solo no se entiende).
function coachmarkKey(id: string) {
  return `fina_v2_coach_${id}`;
}
export function Coachmark({ id, children }: { id: string; children: React.ReactNode }) {
  const [visto, setVisto] = useState(() => {
    try {
      return localStorage.getItem(coachmarkKey(id)) === '1';
    } catch {
      return true;
    }
  });
  if (visto) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-2xl p-3.5" style={{ background: COLORS.brandSoft }}>
      <p className="flex-1 text-[13px] font-medium leading-snug" style={{ color: COLORS.brandDark }}>{children}</p>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => {
          try { localStorage.setItem(coachmarkKey(id), '1'); } catch { /* no crítico */ }
          setVisto(true);
        }}
        className="v2-focus shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold transition-transform duration-100 active:scale-90"
        style={{ background: COLORS.lila, color: COLORS.brandDark }}
      >
        ✕
      </button>
    </div>
  );
}

// Toggle tipo "pestaña" (Pesos/Dólares) — una franja de color con una
// pestaña blanca elevada para la opción activa, en vez de dos botones
// iguales. Se usa donde haga falta elegir entre 2-3 opciones excluyentes
// con más carácter que un selector de chips.
export function SegmentedTab<T extends string>({
  options, value, onChange, trackColor = COLORS.gold,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  trackColor?: string;
}) {
  return (
    <div className="flex rounded-2xl p-1.5 gap-1" style={{ background: trackColor }}>
      {options.map((o) => {
        const sel = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className="flex-1 rounded-xl py-2.5 text-[14px] font-bold transition-all duration-150"
            style={sel
              ? { background: COLORS.surface, color: COLORS.ink, boxShadow: '0 2px 8px rgba(43,33,24,0.12)' }
              : { background: 'transparent', color: COLORS.ink, opacity: 0.75 }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Persistencia real de Gastos / Objetivos / Inversiones ──────────────
// Antes, lo que cargabas en cada sección vivía solo en el estado de esa
// pantalla y se perdía apenas navegabas a otra (Home, por ejemplo). Sin
// esto, ni un buscador de gastos ni un resumen tipo "anillo de bienestar"
// en Home pueden ser reales — no habría nada persistente que leer. Genérico
// a propósito (cada pantalla define su propia forma de estado) para no
// duplicar los tipos acá.
function saveV2State(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no crítico
  }
}
function loadV2State<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const LS_GASTOS_STATE = 'fina_v2_gastos_state';
export const saveV2GastosState = (s: unknown) => saveV2State(LS_GASTOS_STATE, s);
export const loadV2GastosState = <T,>() => loadV2State<T>(LS_GASTOS_STATE);

const LS_OBJETIVOS_STATE = 'fina_v2_objetivos_state';
export const saveV2ObjetivosState = (s: unknown) => saveV2State(LS_OBJETIVOS_STATE, s);
export const loadV2ObjetivosState = <T,>() => loadV2State<T>(LS_OBJETIVOS_STATE);

const LS_INVERSIONES_STATE = 'fina_v2_inversiones_state';
export const saveV2InversionesState = (s: unknown) => saveV2State(LS_INVERSIONES_STATE, s);
export const loadV2InversionesState = <T,>() => loadV2State<T>(LS_INVERSIONES_STATE);

// Reserva ("alcancía") — se movió de Gastos a Home (arriba de todo, al lado
// del perfil). Vive en su propia clave, independiente del estado de Gastos,
// para no pisar las categorías/gastos que administra esa pantalla.
const LS_RESERVA = 'fina_v2_reserva';
export function saveV2Reserva(monto: number) {
  try { localStorage.setItem(LS_RESERVA, String(monto)); } catch { /* no crítico */ }
}
export function loadV2Reserva(): number {
  try { return Number(localStorage.getItem(LS_RESERVA)) || 0; } catch { return 0; }
}

// Cartel "Así arrancás en FINA" de Home — se puede cerrar con la X y no
// vuelve a aparecer en este navegador.
const LS_ARRANCAS_OCULTO = 'fina_v2_arrancas_oculto';
export function saveV2ArrancasOculto() {
  try { localStorage.setItem(LS_ARRANCAS_OCULTO, '1'); } catch { /* no crítico */ }
}
export function loadV2ArrancasOculto(): boolean {
  try { return localStorage.getItem(LS_ARRANCAS_OCULTO) === '1'; } catch { return false; }
}

// Formatea una fecha real (timestamp) como "Hoy" / "Ayer" / "12 ago" — para
// que las listas de gastos/aportes se puedan ordenar y filtrar por fecha de
// verdad, no por una etiqueta de texto fija.
export function fechaDisplay(ts: number): string {
  const d = new Date(ts);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mismoDia(d, hoy)) return 'Hoy';
  if (mismoDia(d, ayer)) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
