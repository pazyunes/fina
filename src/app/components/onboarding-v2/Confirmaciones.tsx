import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { COLORS, CheckIcon } from './shared';
import { suscribirConfirmaciones } from '../../api/v2/almacen';

// Los carteles de "se hizo": "Registramos tu gasto de $15.000", "Guardamos el
// tope". Existen para que la persona sepa que lo que tocó pasó de verdad.
//
// SÓLO SE MUESTRAN CUANDO SUPABASE CONFIRMA. La app pinta cada cambio al
// instante y guarda por detrás; `acciones` avisa recién cuando la escritura
// volvió bien. Si fallara, no hay cartel verde: lo cuenta el aviso de error del
// layout. Un "se guardó" antes de saberlo sería una promesa, no una
// confirmación.
//
// Arriba y no abajo: abajo está el menú, el botón de chat y, al escribir, el
// teclado. Un cartel tapado no confirma nada.

type Cartel = { id: number; mensaje: string };

const DURACION = 2800;
const MAXIMO = 3;

export function Confirmaciones() {
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const siguiente = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const timers = new Set<number>();
    const quitar = (id: number) => setCarteles((cs) => cs.filter((c) => c.id !== id));

    const off = suscribirConfirmaciones((mensaje) => {
      const id = siguiente.current++;
      // Si llegan varios seguidos (borrar tres registros), se apilan hasta tres
      // y el más viejo se va: una columna de diez carteles tapa la pantalla
      // que se está usando.
      setCarteles((cs) => [...cs, { id, mensaje }].slice(-MAXIMO));
      timers.add(window.setTimeout(() => quitar(id), DURACION));
    });

    return () => {
      off();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    // La región existe siempre, aunque esté vacía: un lector de pantalla sólo
    // anuncia los cambios de una región `aria-live` que ya estaba en la página.
    <div
      aria-live="polite"
      className="fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ top: 'max(12px, env(safe-area-inset-top))' }}
    >
      <AnimatePresence initial={false}>
        {carteles.map((c) => (
          <motion.button
            key={c.id}
            type="button"
            role="status"
            // Se puede cerrar tocándolo: si tapa algo, no hace falta esperar.
            onClick={() => setCarteles((cs) => cs.filter((x) => x.id !== c.id))}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0.12 : 0.2 }}
            className="v2-focus pointer-events-auto flex items-center gap-2.5 rounded-full pl-2 pr-4 py-2 text-left max-w-[420px] w-fit"
            style={{
              // Lima de relleno con texto en tinta: es el color de "esto salió
              // bien" en FINA, y sobre lima el texto nunca va en blanco (regla 2).
              background: COLORS.lima,
              color: COLORS.ink,
              boxShadow: '0 6px 20px -6px rgba(43,33,24,0.35)',
            }}
          >
            <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.ink, color: COLORS.lima }}>
              <CheckIcon />
            </span>
            <span className="text-[15px] font-semibold leading-snug">{c.mensaje}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
