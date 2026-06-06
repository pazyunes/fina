import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Plus, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { BackButton } from './BackButton';
import { OnboardingProgress } from './OnboardingProgress';
import { saveUserPreferences } from '../lib/preferences';
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

export function Preferences({ initial, onComplete }: PreferencesProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const gender = initial?.gender;

  // Solo las categorías que efectivamente paga.
  const available = CATEGORY_CATALOG.filter((c) => paysCategory(c.value, initial ?? {}));

  const [ranking, setRanking] = useState<string[]>([]);
  const [spots, setSpots] = useState<string[]>([]);
  const [newSpot, setNewSpot] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (slug: string) => {
    setRanking((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 5) return prev;
      return [...prev, slug];
    });
  };

  const addSpot = () => {
    const v = newSpot.trim();
    if (!v || spots.length >= 20) return;
    setSpots((prev) => [...prev, v]);
    setNewSpot('');
  };
  const removeSpot = (i: number) => setSpots((prev) => prev.filter((_, idx) => idx !== i));

  const handleContinue = async () => {
    setSaving(true);
    await saveUserPreferences({ topUnwilling: ranking, frequentSpots: spots });
    setSaving(false);
    onComplete?.();
    navigate(DEBUG_MODE ? '/ai-reasoning' : '/loading');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#F0E7FA] flex flex-col">
      <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full pb-28">
          <BackButton currentPath={pathname} />

          <div className="mb-6">
            <h2 className="text-3xl mb-2 text-[#7626B3]" style={{ fontFamily: 'var(--font-serif)' }}>
              Para lograr estos objetivos
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              Contanos qué NO querés resignar, así las recomendaciones respetan lo que más te importa.
            </p>
          </div>

          {/* Ranking de categorías que paga */}
          <section className="mb-8">
            <p className="text-base font-semibold text-gray-800 mb-1">
              ¿Qué gastos NO estás {g(gender, 'dispuesta', 'dispuesto')} a recortar?
            </p>
            <p className="text-sm text-gray-500 mb-3">
              Tocá hasta 5 en orden. El <strong>#1</strong> es lo que menos recortarías; el <strong>#5</strong>, lo que más.
            </p>

            {available.length === 0 ? (
              <p className="text-sm text-gray-500 bg-white rounded-xl border border-[#D7C2EF]/60 p-4">
                No cargaste gastos variables, así que por ahora no hay categorías para priorizar. Podés continuar igual.
              </p>
            ) : (
              <div className="space-y-2">
                {available.map((cat) => {
                  const pos = ranking.indexOf(cat.value);
                  const picked = pos !== -1;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggle(cat.value)}
                      disabled={!picked && ranking.length >= 5}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-sm ${
                        picked
                          ? 'border-[#7626B3] bg-[#F0E7FA] text-[#7626B3]'
                          : ranking.length >= 5
                          ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-[#7626B3]/50'
                      }`}
                    >
                      <span className="text-base">{cat.emoji}</span>
                      <span className="flex-1 text-left">{cat.label}</span>
                      {picked && (
                        <span className="w-6 h-6 rounded-full bg-[#7626B3] text-white text-xs font-medium flex items-center justify-center">
                          {pos + 1}
                        </span>
                      )}
                    </button>
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

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="max-w-md mx-auto">
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
