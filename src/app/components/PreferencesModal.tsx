import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { fetchUserPreferences, saveUserPreferences } from '../lib/preferences';
import { g } from '../utils/gender';
import { UserData } from '../types';

// PR7 — Form de "Quiero recomendaciones personalizadas". Persistencia en
// user_preferences (migration 0006). Se abre desde ObjetivosPage como un
// bottom-sheet modal.

// Catálogo de categorías que pueden entrar al ranking. El value es el slug
// interno (usado en DB); el label es lo que ve la usuaria.
const CATEGORY_CATALOG: { value: string; label: string; emoji: string }[] = [
  { value: 'entertainment',   label: 'Salidas / ocio',            emoji: '🎉' },
  { value: 'cafeterias',      label: 'Cafeterías y restaurantes', emoji: '☕' },
  { value: 'delivery',        label: 'Delivery',                  emoji: '🍕' },
  { value: 'supermarket',     label: 'Supermercado',              emoji: '🛒' },
  { value: 'subscriptions',   label: 'Suscripciones',             emoji: '📱' },
  { value: 'beauty',          label: 'Belleza y cuidado',         emoji: '💅' },
  { value: 'gym',             label: 'Gimnasio',                  emoji: '🏋️' },
  { value: 'therapy',         label: 'Terapia / psicología',      emoji: '🧘' },
  { value: 'transport',       label: 'Transporte',                emoji: '🚗' },
  { value: 'installments',    label: 'Cuotas',                    emoji: '💳' },
];

const labelOf = (slug: string) =>
  CATEGORY_CATALOG.find(c => c.value === slug)?.label ?? slug;
const emojiOf = (slug: string) =>
  CATEGORY_CATALOG.find(c => c.value === slug)?.emoji ?? '•';

interface PreferencesModalProps {
  onClose: () => void;
  // PR8 — Gender opcional para adaptar el copy del form ("dispuesta/o").
  gender?: UserData['gender'];
}

export function PreferencesModal({ onClose, gender }: PreferencesModalProps) {
  // Ranking: array ordenado de slugs. ranking[0] = #1 (la que MENOS está
  // dispuesta a recortar); ranking[4] = #5 (la que más). Máx 5.
  const [ranking, setRanking] = useState<string[]>([]);
  // Disposición a recortar (modelo nuevo). Acá la preservamos tal cual para no
  // pisarla al guardar desde este modal legacy.
  const [cutWillingness, setCutWillingness] = useState<Record<string, number>>({});
  const [spots, setSpots] = useState<string[]>([]);
  const [newSpot, setNewSpot] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Prefill desde DB cuando el modal abre.
  useEffect(() => {
    let active = true;
    fetchUserPreferences().then((prefs) => {
      if (!active) return;
      setRanking(prefs.topUnwilling.slice(0, 5));
      setCutWillingness(prefs.cutWillingness ?? {});
      setSpots(prefs.frequentSpots);
    });
    return () => { active = false; };
  }, []);

  // Toggle: si la categoría no está, la suma al final (próxima posición).
  // Si ya está, la saca y reordena.
  const toggle = (slug: string) => {
    setRanking((prev) => {
      if (prev.includes(slug)) return prev.filter(s => s !== slug);
      if (prev.length >= 5) return prev; // cap
      return [...prev, slug];
    });
  };

  const addSpot = () => {
    const v = newSpot.trim();
    if (!v) return;
    if (spots.length >= 20) return;
    setSpots((prev) => [...prev, v]);
    setNewSpot('');
  };

  const removeSpot = (i: number) => {
    setSpots((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const { error } = await saveUserPreferences({
      topUnwilling: ranking,
      cutWillingness,
      frequentSpots: spots,
    });
    setSaving(false);
    if (error) {
      setFeedback(error);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-[#D7C2EF]/60 px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-medium text-[#7626B3]" style={{ fontFamily: 'var(--font-serif)' }}>
            Recomendaciones personalizadas
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-[#7626B3]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Top-5 ranking */}
          <section>
            <p className="text-sm font-medium text-gray-700 mb-1">
              ¿Qué gastos NO estás {g(gender, 'dispuesta', 'dispuesto')} a recortar?
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Tocá hasta 5 en orden. El <strong>#1</strong> es lo que menos recortarías; el <strong>#5</strong>, lo que más.
            </p>
            <div className="space-y-2">
              {CATEGORY_CATALOG.map((cat) => {
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
            {ranking.length > 0 && ranking.length < 5 && (
              <p className="text-xs text-gray-400 mt-2">
                Llevás {ranking.length}/5. Podés guardar igual si no llegás a las 5.
              </p>
            )}
          </section>

          {/* Frequent spots */}
          <section>
            <p className="text-sm font-medium text-gray-700 mb-1">
              ¿En qué lugares (cafecitos / restaurantes) solés consumir frecuentemente?
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Cargá los que vengan a la mente. Cualquier formato — barrio, nombre, lo que sea.
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
                  <span
                    key={`${s}-${i}`}
                    className="inline-flex items-center gap-1.5 bg-[#F0E7FA] text-[#431C72] text-xs rounded-full pl-3 pr-2 py-1"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSpot(i)}
                      className="text-[#7626B3] hover:text-[#431C72]"
                      aria-label={`Quitar ${s}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Preview del ranking guardado */}
          {ranking.length > 0 && (
            <section className="bg-[#F0E7FA]/60 rounded-xl p-3 border-l-[3px] border-[#7626B3]">
              <p className="text-xs text-[#431C72]">
                Vamos a usar este orden para priorizar dónde NO sugerir recortes:{' '}
                {ranking.map((s, i) => `${i + 1}) ${emojiOf(s)} ${labelOf(s)}`).join(' · ')}
              </p>
            </section>
          )}

          {feedback && <p className="text-xs text-[#7626B3]">{feedback}</p>}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-full py-5 text-base"
          >
            {saving ? 'Guardando…' : 'Guardar preferencias'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
