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
};

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
      className={`flex items-center gap-2 rounded-2xl border-[2.5px] border-[#1E1E1E] px-4 py-2.5 text-[14.5px] font-semibold
        transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
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
      className={`w-full rounded-full border-[2.5px] border-[#1E1E1E] py-4 text-[16px] font-bold
        transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
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
