import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { saveFeedback, hasAnsweredFeedback, markFeedbackAnswered } from '../lib/feedback';

// PR — Encuesta in-app reutilizable. Rating de 1 a 5 (caritas) + comentario
// opcional. Se guarda en la tabla feedback con el `context` de la pantalla.
const FACES = [
  { rating: 1, emoji: '😖', label: 'Muy mala' },
  { rating: 2, emoji: '🙁', label: 'Mala' },
  { rating: 3, emoji: '😐', label: 'Más o menos' },
  { rating: 4, emoji: '🙂', label: 'Buena' },
  { rating: 5, emoji: '😍', label: 'Excelente' },
];

export function FeedbackModal({
  context,
  title,
  question,
  onClose,
}: {
  context: string;
  title?: string;
  question: string;
  onClose: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const close = () => { markFeedbackAnswered(context); onClose(); };

  const submit = async () => {
    if (rating === null) return;
    setSaving(true);
    await saveFeedback(context, rating, comment);
    setSaving(false);
    markFeedbackAnswered(context);
    setDone(true);
    setTimeout(onClose, 1400);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center" onClick={close}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
      >
        <div className="bg-[#7626B3] text-white px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ fontFamily: 'var(--font-serif)' }}>
            {title ?? '¿Nos ayudás con tu opinión? 💜'}
          </h2>
          <button onClick={close} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {done ? (
          <div className="px-5 py-8 text-center">
            <p className="text-4xl mb-2">🙌</p>
            <p className="text-sm text-gray-700">¡Gracias! Tu opinión nos ayuda un montón.</p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-gray-700">{question}</p>

            <div className="flex justify-between">
              {FACES.map((f) => (
                <button
                  key={f.rating}
                  type="button"
                  onClick={() => setRating(f.rating)}
                  className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-all ${
                    rating === f.rating ? 'bg-[#F0E7FA] scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  aria-label={f.label}
                >
                  <span className="text-2xl">{f.emoji}</span>
                  <span className={`text-[10px] ${rating === f.rating ? 'text-[#7626B3] font-semibold' : 'text-gray-400'}`}>{f.label}</span>
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="¿Algo que te gustó o que cambiarías? (opcional)"
              rows={3}
              className="w-full rounded-xl border-2 border-gray-200 focus:border-[#7626B3] outline-none px-3 py-2 text-sm resize-none"
            />

            <div className="flex items-center gap-3">
              <button type="button" onClick={close} className="text-sm text-gray-400 hover:text-gray-600">Ahora no</button>
              <button
                type="button"
                onClick={submit}
                disabled={rating === null || saving}
                className="flex-1 bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Se monta en una pantalla y dispara la encuesta una sola vez (por contexto),
// tras un pequeño delay para que la usuaria use la función antes de opinar.
export function FeedbackTrigger({
  context,
  question,
  title,
  delayMs = 7000,
}: {
  context: string;
  question: string;
  title?: string;
  delayMs?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (hasAnsweredFeedback(context)) return;
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [context, delayMs]);

  if (!show) return null;
  return <FeedbackModal context={context} title={title} question={question} onClose={() => setShow(false)} />;
}
