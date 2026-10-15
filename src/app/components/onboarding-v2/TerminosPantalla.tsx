import { useEffect } from 'react';
import { BotonVolver, COLOR_VARS, COLORS, FONT_VARS, useVolver } from './shared';
import { TextoLegal } from './TextoLegal';

// Los términos y la política, para leer. Pública (fuera de V2Layout): se lee
// antes de crear la cuenta, que es cuando se aceptan. `#privacidad` baja directo
// a la política.
export function TerminosPantalla() {
  const volver = useVolver('/onboarding-v2');

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <div className="h-[100dvh] overflow-y-auto" style={{ background: COLORS.paper, ...FONT_VARS, ...COLOR_VARS }}>
      <div className="mx-auto w-full max-w-2xl px-6 pt-6 pb-16 flex flex-col gap-6">
        <BotonVolver onClick={volver} />
        <TextoLegal />
      </div>
    </div>
  );
}
