import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Plus, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { BackButton } from './BackButton';
import { OnboardingAside } from './OnboardingAside';
import { OnboardingProgress } from './OnboardingProgress';
import { saveUserPreferences } from '../lib/preferences';
import { formatArs } from '../lib/currency';
import { g } from '../utils/gender';
import { DEBUG_MODE } from '../config';
import { UserData } from '../types';

// PR — Paso de onboarding "Tus prioridades" (después de objetivos). Reemplaza
// al viejo PreferencesModal de Objetivos. Solo muestra en el ranking las
// categorías que la usuaria efectivamente paga (valor > 0 en su informe) y
// suma los lugares que frecuenta. Persiste en user_preferences.

interface PreferencesProps {
  initial?: Partial<UserData>;
  onComplete?: () => void;
}

const CATEGORY_CATALOG: { value: string; label: string; emoji: string }[] = [
  { value: 'entertainment', label: 'Salidas / ocio', emoji: '🎉' },
  { value: 'cafeterias', label: 'Cafeterías', emoji: '☕' },
  { value: 'restaurants', label: 'Restaurantes', emoji: '🍽️' },
  { value: 'delivery', label: 'Delivery', emoji: '🍕' },
  { value: 'supermarket', label: 'Supermercado', emoji: '🛒' },
  { value: 'subscriptions', label: 'Suscripciones', emoji: '📱' },
  { value: 'beauty', label: 'Belleza y cuidado', emoji: '💅' },
  { value: 'gym', label: 'Gimnasio', emoji: '🏋️' },
  { value: 'therapy', label: 'Terapia / psicología', emoji: '🧘' },
  { value: 'transport', label: 'Transporte', emoji: '🚗' },
  { value: 'installments', label: 'Cuotas', emoji: '💳' },
];

// ¿La usuaria carga esta categoría como gasto propio? (valor > 0 en su informe)
function paysCategory(slug: string, u: Partial<UserData>): boolean {
  const exp = u.expenses;
  switch (slug) {
    case 'entertainment': return (u.entertainmentFrequency ?? 0) > 0 && (u.entertainmentAmount ?? 0) > 0;
    case 'cafeterias':    return (u.cafeteriasFrequency ?? 0) > 0 && (u.cafeteriasAmount ?? 0) > 0;
    case 'restaurants':   return (u.restaurantsFrequency ?? 0) > 0 && (u.restaurantsAmount ?? 0) > 0;
    case 'delivery':      return (u.deliveryFrequency ?? 0) > 0 && (u.deliveryAmount ?? 0) > 0;
    case 'supermarket':   return (u.supermarketFrequency ?? 0) > 0 && (u.supermarketAmount ?? 0) > 0;
    case 'subscriptions': return (u.subscriptions?.length ?? 0) > 0;
    case 'beauty':        return (exp?.beauty ?? 0) > 0;
    case 'gym':           return (exp?.gym ?? 0) > 0;
    case 'therapy':       return (exp?.therapy ?? 0) > 0;
    case 'transport':     return (exp?.transport ?? 0) > 0;
    case 'installments':  return (u.installments?.length ?? 0) > 0;
    default:              return false;
  }
}

// Gasto mensual estimado por categoría (para mostrar cuánto ahorraría si la recorta).
function monthlyOf(slug: string, u: Partial<UserData>): number {
  const exp = u.expenses;
  switch (slug) {
    case 'entertainment': return Math.round((u.entertainmentFrequency ?? 0) * (u.entertainmentAmount ?? 0) * 4.33);
    case 'cafeterias':    return Math.round((u.cafeteriasFrequency ?? 0) * (u.cafeteriasAmount ?? 0) * 4.33);
    case 'restaurants':   return Math.round((u.restaurantsFrequency ?? 0) * (u.restaurantsAmount ?? 0) * 4.33);
    case 'delivery':      return Math.round((u.deliveryFrequency ?? 0) * (u.deliveryAmount ?? 0) * 4.33);
    case 'supermarket':   return Math.round((u.supermarketFrequency ?? 0) * (u.supermarketAmount ?? 0) * 4.33);
    case 'subscriptions': return (u.subscriptions ?? []).reduce((s, x) => s + (x.cost || 0), 0);
    case 'beauty':        return exp?.beauty ?? 0;
    case 'gym':           return exp?.gym ?? 0;
    case 'therapy':       return exp?.therapy ?? 0;
    case 'transport':     return exp?.transport ?? 0;
    case 'installments':  return (u.installments ?? []).reduce((s, x) => s + (x.monthlyAmount || 0), 0);
    default:              return 0;
  }
}

export function Preferences({ initial, onComplete }: PreferencesProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const gender = initial?.gender;

  // Solo las categorías que efectivamente paga.
  const available = CATEGORY_CATALOG.filter((c) => paysCategory(c.value, initial ?? {}));

  // Disposición a recortar por categoría: 1 (no estoy dispuesta) … 5 (re dispuesta).
  // Arranca en 3 (neutral) para cada categoría que paga.
  const [willingness, setWillingness] = useState<Record<string, number>>(() =>
    Object.fromEntries(available.map((c) => [c.value, 3]))
  );
  const setWill = (slug: string, n: number) =>
    setWillingness((prev) => ({ ...prev, [slug]: n }));

  const [spots, setSpots] = useState<string[]>([]);
  const [newSpot, setNewSpot] = useState('');
  const [saving, setSaving] = useState(false);

  const addSpot = () => {
    const v = newSpot.trim();
    if (!v || spots.length >= 20) return;
    setSpots((prev) => [...prev, v]);
    setNewSpot('');
  };
  const removeSpot = (i: number) => setSpots((prev) => prev.filter((_, idx) => idx !== i));

  const handleContinue = async () => {
    setSaving(true);
    await saveUserPreferences({ topUnwilling: [], cutWillingness: willingness, frequentSpots: spots });
    setSaving(false);
    onComplete?.();
    navigate(DEBUG_MODE ? '/ai-reasoning' : '/loading');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#F0E7FA] flex flex-col lg:pl-72">
      <OnboardingAside currentPath={pathname} />
      <div className="flex-1 flex flex-col p-6 max-w-md lg:max-w-2xl mx-auto w-full overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full pb-28">
          <BackButton currentPath={pathname} />

          <div className="mb-6">
            <h2 className="text-3xl mb-2 text-[#7626B3]" style={{ fontFamily: 'var(--font-serif)' }}>
              Para lograr estos objetivos
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              Marcá del 1 al 5 cuánto estás {g(gender, 'dispuesta', 'dispuesto')} a recortar cada gasto, así las recomendaciones respetan lo que más te importa.
            </p>
          </div>

          {/* Disposición a recortar por categoría (slider 1-5) */}
          <section className="mb-8">
            <p className="text-base font-semibold text-gray-800 mb-1">
              ¿Qué gastos estás {g(gender, 'dispuesta', 'dispuesto')} a recortar?
            </p>
            <p className="text-sm text-gray-500 mb-4">
              <strong>1</strong> = no lo querés tocar · <strong>5</strong> = lo recortás sin problema.
            </p>

            {available.length === 0 ? (
              <p className="text-sm text-gray-500 bg-white rounded-xl border border-[#D7C2EF]/60 p-4">
                No cargaste gastos variables, así que por ahora no hay categorías para priorizar. Podés continuar igual.
              </p>
            ) : (
              <div className="space-y-3">
                {available.map((cat) => {
                  const val = willingness[cat.value] ?? 3;
                  const monthly = monthlyOf(cat.value, initial ?? {});
                  return (
                    <div key={cat.value} className="bg-white rounded-xl border-2 border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">{cat.emoji}</span>
                        <span className="flex-1 text-sm font-medium text-gray-800">
                          {cat.label}
                          {monthly > 0 && (
                            <span className="block text-xs text-[#3B6D11] font-medium">
                              recortándolo ahorrás ~{formatArs(monthly)}/mes
                            </span>
                          )}
                        </span>
                        <span className="w-7 h-7 rounded-full bg-[#7626B3] text-white text-sm font-bold flex items-center justify-center shrink-0">
                          {val}
                        </span>
                      </div>
                      <Slider
                        value={[val]}
                        min={1}
                        max={5}
                        step={1}
                        onValueChange={(v) => setWill(cat.value, v[0])}
                      />
                      {/* Topes fijos 1..5 */}
                      <div className="flex justify-between text-xs text-gray-400 mt-1.5 px-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={n === val ? 'text-[#7626B3] font-bold' : ''}>{n}</span>
                        ))}
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
                        <span>No lo recorto</span>
                        <span>Lo recorto fácil</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Lugares frecuentes */}
          <section>
            <p className="text-base font-semibold text-gray-800 mb-1">
              ¿En qué lugares solés consumir seguido?
            </p>
            <p className="text-sm text-gray-500 mb-3">
              Cafés, restoranes, lo que se te ocurra. Cualquier formato — barrio, nombre, lo que sea.
            </p>
            <div className="flex gap-2 mb-3">
              <Input
                value={newSpot}
                onChange={(e) => setNewSpot(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpot(); } }}
                placeholder="Ej: Café Martínez Palermo"
                className="flex-1 rounded-xl"
              />
              <Button
                type="button"
                onClick={addSpot}
                disabled={!newSpot.trim() || spots.length >= 20}
                className="bg-[#059669] hover:bg-[#047857] text-white rounded-xl px-3"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {spots.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {spots.map((s, i) => (
                  <span key={`${s}-${i}`} className="inline-flex items-center gap-1.5 bg-[#F0E7FA] text-[#431C72] text-xs rounded-full pl-3 pr-2 py-1">
                    {s}
                    <button type="button" onClick={() => removeSpot(i)} className="text-[#7626B3] hover:text-[#431C72]" aria-label={`Quitar ${s}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-72 bg-white border-t p-4 shadow-lg">
        <div className="max-w-md lg:max-w-2xl mx-auto">
          <Button
            onClick={handleContinue}
            disabled={saving}
            className="w-full bg-[#059669] hover:bg-[#047857] text-white py-5 rounded-full text-lg disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Ver mi análisis'}
          </Button>
          <div className="mt-4">
            <OnboardingProgress currentPath={pathname} />
          </div>
        </div>
      </div>
    </div>
  );
}
