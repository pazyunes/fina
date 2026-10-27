import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { COLORS, COLOR_VARS, FONTS, FONT_VARS } from './shared';
import { Fini } from './Fini';
import { VerificarTelefono } from './VerificarTelefono';
import { WHATSAPP_URL } from '../WhatsAppFab';
import { useAlmacen } from '../../api/v2/AlmacenProvider';

// Todo lo que abre el WhatsApp de FINA pasa por acá.
//
// Si la persona todavía no verificó su teléfono, en vez de abrir WhatsApp se le
// recuerda que lo haga, y lo puede hacer en el mismo cartel sin irse a Perfil.
// Sin verificar, el bot no tiene la garantía de que ese número sea de ella: el
// gasto que le cuente podría no llegar a su cuenta, y la persona pensaría que
// quedó registrado. Mejor frenarla un minuto antes que perderle un gasto.
//
// El link de la verificación en sí (VerificarTelefono) NO pasa por acá: es el
// que tiene que abrir WhatsApp justamente cuando no está verificado.

type Interceptar = (e: React.MouseEvent<HTMLAnchorElement>) => void;
const Ctx = createContext<Interceptar | null>(null);

export function AvisoWhatsAppProvider({ children }: { children: React.ReactNode }) {
  const { estado, listo } = useAlmacen();
  const verificado = !!estado.perfil.telefonoVerificadoEn;
  const [abierto, setAbierto] = useState(false);

  const interceptar = useCallback<Interceptar>((e) => {
    // Mientras no terminó de cargar no se sabe si está verificado: se deja
    // abrir WhatsApp antes que frenar a alguien que sí lo está.
    if (!listo || verificado) return;
    e.preventDefault();
    setAbierto(true);
  }, [listo, verificado]);

  return (
    <Ctx.Provider value={interceptar}>
      {children}
      {abierto && <AvisoVerificar verificado={verificado} onCerrar={() => setAbierto(false)} />}
    </Ctx.Provider>
  );
}

type PropsLink = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'>;

/** Un link al WhatsApp de FINA que primero chequea que el teléfono esté verificado. */
export function LinkWhatsApp({ onClick, children, ...props }: PropsLink) {
  const interceptar = useContext(Ctx);
  return (
    <a
      {...props}
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => { onClick?.(e); interceptar?.(e); }}
    >
      {children}
    </a>
  );
}

function AvisoVerificar({ verificado, onCerrar }: { verificado: boolean; onCerrar: () => void }) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      // Afuera del layout: se le pasan las variables de fuente y color de v2.
      style={{ background: 'rgba(43,33,24,0.45)', ...FONT_VARS, ...COLOR_VARS }}
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aviso-wpp-titulo"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto v2-sin-barra rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: COLORS.surface, boxShadow: '0 12px 40px -8px rgba(43,33,24,0.35)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!verificado ? (
          <>
            <div className="flex items-center gap-3">
              <div className="shrink-0 -ml-1"><Fini state="pensando" size={64} /></div>
              <h2 id="aviso-wpp-titulo" className="text-[21px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>
                Antes, verificá tu teléfono
              </h2>
            </div>
            <p className="text-[16px] leading-snug" style={{ color: COLORS.inkSoft }}>
              Así FINA sabe que los gastos que le contás por WhatsApp son tuyos y los anota en tu cuenta.
              Es mandar un mensaje, tarda un minuto.
            </p>
            <VerificarTelefono sinTitulo />
            <button
              type="button"
              autoFocus
              onClick={onCerrar}
              className="v2-focus self-center min-h-[44px] px-4 text-[15px] font-semibold rounded-full"
              style={{ color: COLORS.inkSoft }}
            >
              Ahora no
            </button>
          </>
        ) : (
          // Se verificó con el cartel abierto (la pantalla se actualiza sola):
          // ahora sí, WhatsApp.
          <>
            <div className="flex items-center gap-3">
              <div className="shrink-0 -ml-1"><Fini state="logro" size={64} /></div>
              <h2 id="aviso-wpp-titulo" className="text-[21px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>
                ¡Listo, ya está verificado!
              </h2>
            </div>
            <p className="text-[16px] leading-snug" style={{ color: COLORS.inkSoft }}>
              Ya podés contarle tus gastos a FINA por WhatsApp.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onCerrar}
              className="v2-focus w-full rounded-2xl py-3.5 text-center text-[18px] font-bold transition-transform active:scale-[0.99]"
              style={{ background: COLORS.lima, color: COLORS.ink }}
            >
              Ir a WhatsApp
            </a>
          </>
        )}
      </div>
    </div>
  );
}
