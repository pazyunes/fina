import { Currency } from '../types';

interface CurrencyToggleProps {
  value: Currency;
  onChange: (currency: Currency) => void;
  /** USD se deshabilita si no hay cotización disponible. */
  usdEnabled?: boolean;
}

// Segmented control ARS / USD para los campos de monto que aceptan ambas.
export function CurrencyToggle({ value, onChange, usdEnabled = true }: CurrencyToggleProps) {
  const options: Currency[] = ['ARS', 'USD'];
  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map((opt) => {
        const disabled = opt === 'USD' && !usdEnabled;
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`px-3 py-1 text-sm transition-colors ${
              active ? 'bg-[#9A3D9E] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={disabled ? 'Cotización no disponible' : undefined}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
