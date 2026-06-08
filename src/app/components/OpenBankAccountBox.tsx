import { useState } from 'react';
import { Landmark, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// PR — Caja desplegable "Quiero abrir una cuenta de banco". Se muestra en el
// informe (right rail) cuando la usuaria eligió "No uso banco". Tiene un paso a
// paso corto + recomendaciones de plataformas con sus beneficios.

interface BankOption {
  emoji: string;
  name: string;
  benefits: string[];
}

const STEPS = [
  'Descargá la app de la plataforma que elijas.',
  'Registrate con tu DNI y una selfie (todo desde el celu).',
  'Esperá la validación (suele tardar unos minutos).',
  '¡Listo! Ya tenés CBU/CVU para cobrar, pagar y empezar a ahorrar.',
];

const OPTIONS: BankOption[] = [
  {
    emoji: '💜',
    name: 'Mercado Pago',
    benefits: ['Tu saldo genera rendimientos todos los días', 'Tarjeta prepaga gratis', 'Aceptado en casi todos lados'],
  },
  {
    emoji: '💙',
    name: 'Ualá',
    benefits: ['Cuenta e inversiones en un solo lugar', 'Tarjeta sin costo de mantenimiento', 'Apertura 100% online'],
  },
  {
    emoji: '🤍',
    name: 'Brubank',
    benefits: ['Banco 100% digital con CBU propio', 'Plazos fijos desde la app', 'Sin sucursales ni filas'],
  },
  {
    emoji: '🧡',
    name: 'Naranja X',
    benefits: ['Sin costos de mantenimiento', 'Rendimientos sobre tu saldo', 'Transferencias y tarjeta gratis'],
  },
];

export function OpenBankAccountBox() {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 bg-[#7626B3] hover:bg-[#5F1F94] text-white rounded-xl px-4 py-3 transition-colors"
      >
        <Landmark className="w-5 h-5 shrink-0" />
        <span className="flex-1 text-left text-sm font-semibold">Quiero abrir una cuenta de banco</span>
        <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-xl border border-[#D7C2EF]/70 shadow-sm p-4 mt-2">
              {/* Paso a paso */}
              <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-2">Cómo abrir tu cuenta</p>
              <ol className="space-y-2 mb-4">
                {STEPS.map((s, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#7626B3] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700 leading-snug">{s}</span>
                  </li>
                ))}
              </ol>

              {/* Recomendaciones con beneficios */}
              <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-2">Opciones recomendadas</p>
              <div className="space-y-2.5">
                {OPTIONS.map((opt) => (
                  <div key={opt.name} className="rounded-xl border border-gray-200 p-3">
                    <p className="text-sm font-semibold text-gray-800 mb-1.5">
                      <span className="mr-1">{opt.emoji}</span>{opt.name}
                    </p>
                    <ul className="space-y-1">
                      {opt.benefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <Check className="w-3.5 h-3.5 text-[#3B6D11] shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                Son ejemplos para que arranques. FINA no tiene relación comercial con estas apps.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
