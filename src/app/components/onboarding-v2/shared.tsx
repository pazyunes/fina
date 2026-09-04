import { useState } from 'react';
import { useNavigate } from 'react-router';

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

export const COLORS = {
  ink: '#1F1B2E',
  inkSoft: '#6B647A',
  inkFaint: '#A29BB3',
  paper: '#FBFAF8',
  surface: '#FFFFFF',
  tint: '#F3EEFA',
  line: 'rgba(31,27,46,0.09)',
  lineStrong: 'rgba(31,27,46,0.16)',

  brand: '#7626B3',
  brandSoft: '#F0E7FA',
  brandDark: '#431C72',

  // Fondo del "marco" que envuelve la pantalla en desktop — ver DeviceFrame.
  frameBg: '#E8E4F0',

  coral: '#FF5C7A',
  coralSoft: '#FFE3E9',
  coralDark: '#B3324D',
  gold: '#E8A33D',
  goldSoft: '#FBEDD3',
  green: '#2FAE66',
  greenSoft: '#E1F3E7',
  sky: '#4C8DFF',
  skySoft: '#E3ECFF',

  // Inversiones vive en modo oscuro — el mismo criterio "Nubank/Cleo": la
  // plata seria se muestra sin ruido de color, en un fondo casi negro.
  dark: '#17132A',
  darkCard: '#221C38',
  darkLine: 'rgba(244,241,250,0.12)',
  onDark: '#F4F1FA',
  onDarkSoft: 'rgba(244,241,250,0.6)',
};

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
      className="w-full flex items-center gap-3 text-left rounded-2xl px-4 py-3.5 transition-all duration-100 active:scale-[0.99]"
      style={{ background: COLORS.brandSoft }}
    >
      <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg" style={{ background: 'rgba(255,255,255,0.6)' }}>👥</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-bold" style={{ color: COLORS.brandDark }}>{grupo ? grupo.nombre : 'Armar un grupo'}</span>
        <span className="block text-[11.5px]" style={{ color: COLORS.inkSoft }}>{grupo ? 'Ver el ranking de tu grupo' : 'Competí con amigas y amigos por actividad'}</span>
      </span>
      <span className="shrink-0 font-bold" style={{ color: COLORS.brandDark }}>→</span>
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
export function Chip({ on, warm, muted, onClick, children }: { on: boolean; warm?: boolean; muted?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14.5px] font-semibold select-none
        transition-all duration-100 ease-out active:scale-[0.96]
        ${on
          ? (muted ? 'bg-[#E7E2ED] text-[#6B647A]' : warm ? 'bg-[#FF5C7A] text-white' : 'bg-[#7626B3] text-white')
          : 'bg-white text-[#1F1B2E] border border-[rgba(31,27,46,0.14)]'}`}
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
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14.5px] font-semibold select-none
        border border-dashed transition-all duration-100 ease-out active:scale-[0.96]
        ${abierto ? 'bg-[#F0E7FA]' : 'bg-white'}`}
      style={{ borderColor: 'rgba(118,38,179,0.45)', color: COLORS.brandDark }}
    >
      ✍️ Otro
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
      className={`w-full rounded-2xl py-4 text-[16px] font-bold select-none
        transition-all duration-100 ease-out active:scale-[0.98]
        ${disabled
          ? 'bg-[#E7E2ED] text-[#A29BB3] cursor-not-allowed'
          : 'bg-[#7626B3] text-white shadow-[0_10px_24px_-8px_rgba(118,38,179,0.55)] hover:bg-[#68219E]'}`}
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
      className="w-full flex items-center gap-3.5 bg-white rounded-2xl px-4 py-4
        shadow-[0_2px_18px_rgba(31,27,46,0.07)] transition-all duration-100 ease-out active:scale-[0.98] text-left"
    >
      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.brandSoft }}>
        {icon}
      </span>
      <span className="flex-1 font-semibold text-[15px]" style={{ color: COLORS.ink }}>{label}</span>
      <span style={{ color: COLORS.brand }}>→</span>
    </button>
  );
}

// "Marco" de la pantalla — mobile-first: en mobile es simplemente la
// pantalla completa (sin marco, como cualquier página real), y solo en
// desktop se convierte en una tarjeta con alto fijo tipo celular, centrada
// sobre un fondo neutro. Sin esto, en una ventana de escritorio alta el
// contenido corto queda pegado arriba con medio monitor vacío abajo.
export function DeviceFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-screen supports-[height:100dvh]:h-[100dvh] w-full flex flex-col overflow-hidden lg:items-center lg:justify-center lg:py-10"
      style={{ background: COLORS.frameBg }}
    >
      <div
        className="w-full flex flex-col flex-1 min-h-0 lg:flex-none lg:h-[860px] lg:max-w-[430px]
          lg:rounded-[36px] lg:shadow-[0_25px_70px_-15px_rgba(20,14,32,0.35)] overflow-hidden"
        style={{ background: COLORS.paper }}
      >
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
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold transition-transform duration-100 active:scale-90"
        style={{ background: 'rgba(67,28,114,0.12)', color: COLORS.brandDark }}
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
              ? { background: '#fff', color: COLORS.ink, boxShadow: '0 2px 8px rgba(31,27,46,0.12)' }
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
