// PR — Toggle "por semana / por mes" reutilizable para todas las frecuencias de
// gasto del onboarding. La persona DEBE elegir (arranca sin selección).
//
// El sistema guarda SIEMPRE la frecuencia en base SEMANAL (para no tocar el bot
// ni el analizador, que multiplican × 4.33). El toggle solo define la conversión:
//   - por semana → el número es semanal (se guarda tal cual)
//   - por mes    → el número es mensual (se guarda ÷ 4.33)

export type FreqUnit = 'week' | 'month';

const W = 4.33;

// número tipeado (en la unidad elegida) → frecuencia semanal canónica.
export function toWeekly(typed: number, unit: FreqUnit): number {
  return unit === 'month' ? typed / W : typed;
}

// frecuencia semanal canónica → número a mostrar (en la unidad elegida).
export function fromWeekly(weekly: number, unit: FreqUnit): number {
  return unit === 'month' ? Math.round(weekly * W) : Math.round(weekly);
}

export function FrequencyUnitToggle({
  value,
  onChange,
}: {
  value: FreqUnit | null;
  onChange: (u: FreqUnit) => void;
}) {
  return (
    <div className="inline-flex rounded-full border-2 border-[#D7C2EF] overflow-hidden text-xs shrink-0">
      {(['week', 'month'] as const).map((u) => {
        const active = value === u;
        return (
          <button
            key={u}
            type="button"
            onClick={() => onChange(u)}
            className={`px-3 py-1.5 font-semibold transition-colors ${active ? 'bg-[#7626B3] text-white' : 'text-[#7626B3] hover:bg-[#F0E7FA]'}`}
          >
            {u === 'week' ? 'por semana' : 'por mes'}
          </button>
        );
      })}
    </div>
  );
}
