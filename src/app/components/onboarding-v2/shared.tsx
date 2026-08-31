// REDISEÑO v2 (rama feat/rediseno-onboarding-v2) — piezas compartidas entre
// el onboarding y las pantallas post-onboarding: paleta, la "carita" (avatar
// estilo rubber-hose) y los controles base (chip, cta). Todo lo nuevo de esta
// rama importa de acá para no repetir el mismo botón/color en cada archivo.

export const COLORS = {
  mint: '#2ECC71',
  mintLight: '#8EFEA0',
  cream: '#FFF8E7',
  yellow: '#FCE042',
  yellowSoft: '#FFF3B0',
  ink: '#1E1E1E',
  coral: '#FF6B81',
  coralSoft: '#FFE1E6',
  inkSoft: '#5b5b52',
  sky: '#6BC1FF',
  skySoft: '#DCEEFF',
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
      .replace(/[\u0300-\u036f]/g, '')
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
}: {
  segments: { color: string; pct: number }[];
  centerLabel: string;
  centerValue: string;
  size?: number;
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
  const inset = Math.round(size * 0.12);
  return (
    <div
      className="relative rounded-full shrink-0 border-[2.5px] border-[#1E1E1E]"
      style={{ width: size, height: size, background: stops || '#eee' }}
    >
      <div
        className="absolute rounded-full flex flex-col items-center justify-center border-[2.5px] border-[#1E1E1E]"
        style={{ inset, background: COLORS.cream }}
      >
        <span className="text-[10.5px] text-[#5b5b52] leading-tight text-center">{centerLabel}</span>
        <span className="font-['Baloo_2'] font-bold text-[15px] text-[#1E1E1E] leading-tight">{centerValue}</span>
      </div>
    </div>
  );
}

export function Face({ color, size = 150, mood = 'neutral' }: { color: string; size?: number; mood?: 'neutral' | 'happy' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 150 150">
      <circle cx="75" cy="75" r="62" fill={color} stroke="#1E1E1E" strokeWidth="4" />
      {mood === 'neutral' ? (
        <>
          <path d="M48 55 Q56 46 64 55" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M86 55 Q94 46 102 55" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="58" cy="70" rx="13" ry="16" fill="#fff" stroke="#1E1E1E" strokeWidth="3" />
          <ellipse cx="92" cy="70" rx="13" ry="16" fill="#fff" stroke="#1E1E1E" strokeWidth="3" />
          <circle cx="60" cy="74" r="4.5" fill="#1E1E1E" />
          <circle cx="94" cy="74" r="4.5" fill="#1E1E1E" />
          <path d="M58 98 Q75 112 92 98" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M46 52 Q56 42 66 50" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M84 50 Q94 42 104 52" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M46 68 Q58 52 70 68" stroke="#1E1E1E" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M80 68 Q92 52 104 68" stroke="#1E1E1E" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M55 96 Q75 118 95 96" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
      <path d="M1 5.5L5 9.5L13 1.5" stroke="#1E1E1E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Chip({ on, warm, onClick, children }: { on: boolean; warm?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl border-[2.5px] border-[#1E1E1E] px-4 py-2.5 text-[14.5px] font-semibold select-none
        transition-all duration-100 ease-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
        shadow-[3px_3px_0_#1E1E1E]
        ${on ? (warm ? 'bg-[#FF6B81] text-white' : 'bg-[#2ECC71] text-[#1E1E1E]') : 'bg-white text-[#1E1E1E]'}`}
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
      className={`w-full rounded-full border-[2.5px] border-[#1E1E1E] py-4 text-[16px] font-bold select-none
        transition-all duration-100 ease-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
        ${disabled
          ? 'bg-[#e8e3d0] text-[#a8a394] border-[#e8e3d0] shadow-none cursor-not-allowed'
          : 'bg-[#2ECC71] text-[#1E1E1E] shadow-[4px_4px_0_#1E1E1E]'}`}
    >
      {label}
    </button>
  );
}

// Fila de acción grande, estilo "rubber hose" (borde grueso + sombra dura),
// usada en Home para los 3 CTAs y reusable donde haga falta algo parecido.
export function ActionRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3.5 bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-4
        shadow-[4px_4px_0_#1E1E1E] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-left"
    >
      <span className="w-11 h-11 rounded-full bg-[#FFF3B0] border-2 border-[#1E1E1E] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="flex-1 font-semibold text-[15px] text-[#1E1E1E]">{label}</span>
      <span className="text-[#1E1E1E]">→</span>
    </button>
  );
}
