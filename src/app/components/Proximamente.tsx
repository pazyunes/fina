import { COLORS, FONTS } from './onboarding-v2/shared';
import { Fini } from './onboarding-v2/Fini';

// Pantalla única mientras la app está cerrada (ver app/mantenimiento.ts).
// Sin login, sin links, sin nada que invite a seguir: es una puerta cerrada
// con un cartel, no una landing.
export function Proximamente() {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center gap-5 px-8 text-center"
      style={{ background: COLORS.paper, ...({ '--font-serif': FONTS.display, '--font-sans': FONTS.body } as React.CSSProperties) }}
    >
      <Fini state="idle" size={150} />
      <h1
        className="font-extrabold text-[32px] leading-[1.1] tracking-[-0.01em]"
        style={{ color: COLORS.ink, fontFamily: FONTS.display }}
      >
        Volvemos pronto
      </h1>
      <p className="text-[17px] leading-snug max-w-[34ch]" style={{ color: COLORS.inkSoft, fontFamily: FONTS.body }}>
        Estamos rehaciendo FINA de cero para que sea mucho más clara. Si ya la venías usando, te vamos a avisar cuando esté.
      </p>
    </div>
  );
}
