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

  coral: '#FF5C7A',
  coralSoft: '#FFE3E9',
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

// Puente Onboarding → Inversiones: si contestó el mini-perfil ("¿por qué
// querés invertir?" + "si baja 20%, qué hacés?") en el onboarding, Inversiones
// arranca directo desde ahí en vez de repreguntar.
const LS_INV_PERFIL = 'fina_v2_inversiones_perfil';
export function saveV2InversionesPerfil(p: { porQue: string; reaccion: string } | null) {
  try {
    if (!p) { localStorage.removeItem(LS_INV_PERFIL); return; }
    localStorage.setItem(LS_INV_PERFIL, JSON.stringify(p));
  } catch {
    // no crítico
  }
}
export function loadV2InversionesPerfil(): { porQue: string; reaccion: string } | null {
  try {
    const raw = localStorage.getItem(LS_INV_PERFIL);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Puente Onboarding → Objetivos: si dijo que ya tiene objetivos en mente y
// los nombró, aparecen ya creados (sin monto todavía) para completar ahí.
const LS_OBJETIVOS_INICIALES = 'fina_v2_objetivos_iniciales';
export function saveV2ObjetivosIniciales(nombres: string[]) {
  try {
    localStorage.setItem(LS_OBJETIVOS_INICIALES, JSON.stringify(nombres));
  } catch {
    // no crítico
  }
}
export function loadV2ObjetivosIniciales(): string[] {
  try {
    const raw = localStorage.getItem(LS_OBJETIVOS_INICIALES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
export function Chip({ on, warm, onClick, children }: { on: boolean; warm?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14.5px] font-semibold select-none
        transition-all duration-100 ease-out active:scale-[0.96]
        ${on
          ? (warm ? 'bg-[#FF5C7A] text-white' : 'bg-[#7626B3] text-white')
          : 'bg-white text-[#1F1B2E] border border-[rgba(31,27,46,0.14)]'}`}
    >
      {children}
    </button>
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
