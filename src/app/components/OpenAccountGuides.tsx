import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// PR — Pack de guías "cómo abrir tu cuenta para invertir". Se muestra en la
// pestaña Inversiones cuando la usuaria NO está bancarizada (eligió "No uso
// banco" en el onboarding). Son cards expandibles: ofrecemos varias opciones
// y ella elige por dónde arrancar. Contenido estático y orientativo — los
// pasos de alta son estables; FINA no tiene relación comercial con estas apps.

interface Guide {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  meta: string;
  steps: string[];
}

const GUIDES: Guide[] = [
  {
    id: 'mercadopago',
    emoji: '💜',
    title: 'Mercado Pago',
    tagline: 'Lo más rápido para arrancar y hacer rendir tu plata',
    meta: '~5 min · 100% online · gratis',
    steps: [
      'Descargá la app de Mercado Pago (Play Store o App Store).',
      'Registrate con tu email y creá una contraseña.',
      'Cargá tu DNI: foto del frente, del dorso y una selfie.',
      'Esperá la verificación (suele tardar unos minutos).',
      'Entrá a “Rendimientos” y activalo: tu saldo empieza a generar intereses todos los días.',
      '¡Listo! Ya tenés dónde guardar tu plata y verla crecer.',
    ],
  },
  {
    id: 'uala',
    emoji: '💙',
    title: 'Ualá',
    tagline: 'Billetera e inversiones en un solo lugar',
    meta: '~10 min · 100% online · gratis',
    steps: [
      'Descargá Ualá y tocá “Crear cuenta”.',
      'Ingresá tu DNI y validá tu identidad con una selfie.',
      'Confirmá tus datos y aceptá los términos.',
      'Cuando la cuenta esté activa, entrá a la sección “Inversiones”.',
      'Elegí el fondo (Money Market) y poné el monto que quieras invertir.',
      'Podés retirar cuando quieras; el dinero queda disponible.',
    ],
  },
  {
    id: 'brubank',
    emoji: '🤍',
    title: 'Brubank',
    tagline: 'Un banco 100% digital, sin ir a ninguna sucursal',
    meta: '~10 min · 100% online · gratis',
    steps: [
      'Descargá Brubank y empezá el registro.',
      'Cargá tu DNI y hacé la validación por selfie o video.',
      'Completá tus datos personales.',
      'Activá tu cuenta y obtené tu CBU.',
      'Desde la app, activá un plazo fijo o el fondo de inversión.',
    ],
  },
  {
    id: 'broker',
    emoji: '📈',
    title: 'Cuenta de inversión (broker)',
    tagline: 'Para invertir en serio: FCI, bonos y CEDEARs',
    meta: '~15 min · online · abrir es gratis',
    steps: [
      'Elegí un broker conocido (por ej. Cocos Capital, Balanz o IOL Invertir Online).',
      'Descargá su app y registrate con tu email y DNI.',
      'Completá el test de perfil de inversor (te toma 2 minutos).',
      'Validá tu identidad con una foto del DNI y una selfie.',
      'Transferí pesos desde tu banco o billetera usando tu CBU/CVU.',
      'Comprá tu primera inversión: si querés algo simple, arrancá por un FCI Money Market.',
    ],
  },
];

export function OpenAccountGuides() {
  // Primera guía abierta por defecto para que se vea el formato; el resto las
  // abre la usuaria según le interese.
  const [openId, setOpenId] = useState<string | null>(GUIDES[0].id);

  return (
    <section>
      <p className="text-xs font-bold text-[#7E2EA8] uppercase tracking-wider mb-2">
        Empezá por acá: abrí tu cuenta
      </p>
      <div className="bg-white rounded-xl p-4 border border-[#DCC6EC]/50">
        <p className="text-base font-semibold mb-1">Todavía no tenés cuenta. ¡Arranquemos! 🚀</p>
        <p className="text-sm text-gray-500 mb-4">
          Estas son las formas más fáciles de abrir una cuenta para guardar e invertir.
          Elegí la que más te guste y seguí el paso a paso.
        </p>

        <div className="space-y-2.5">
          {GUIDES.map((guide) => {
            const isOpen = openId === guide.id;
            return (
              <div
                key={guide.id}
                className={`rounded-xl border transition-colors ${
                  isOpen ? 'border-[#7E2EA8] bg-[#F1E8F8]/40' : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : guide.id)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-2xl shrink-0">{guide.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{guide.title}</p>
                    <p className="text-xs text-gray-500 leading-snug">{guide.tagline}</p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-[#7E2EA8] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3.5 pt-0.5">
                        <span className="inline-block text-xs font-medium text-[#854F0B] bg-[#FAEEDA] rounded-full px-2.5 py-0.5 mb-3">
                          {guide.meta}
                        </span>
                        <ol className="space-y-2.5">
                          {guide.steps.map((step, i) => (
                            <li key={i} className="flex gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-[#7E2EA8] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span className="text-sm text-gray-700 leading-snug">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-4 leading-relaxed">
          Son ejemplos para que puedas arrancar. FINA no tiene relación comercial con estas apps
          ni mueve tu plata.
        </p>
      </div>
    </section>
  );
}
