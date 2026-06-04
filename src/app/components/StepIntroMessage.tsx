import { ReactNode } from 'react';
import { motion } from 'motion/react';

// PR6b — Mensajito conversacional que vive ARRIBA de un step del onboarding,
// no en una pantalla aparte. Card chica con fondo rosado pálido, título en
// serif rosa fuerte y body en sans gris. Sin botón — el usuario lo lee y baja
// al contenido del step.
interface StepIntroMessageProps {
  title: ReactNode;
  body: ReactNode;
}

export function StepIntroMessage({ title, body }: StepIntroMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-[#F3E9F8]/70 border border-[#9A3D9E]/20 rounded-2xl px-5 py-4 mb-5"
    >
      <p className="text-[#9A3D9E] mb-1" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem' }}>
        {title}
      </p>
      <p className="text-sm text-gray-700 leading-relaxed">
        {body}
      </p>
    </motion.div>
  );
}
