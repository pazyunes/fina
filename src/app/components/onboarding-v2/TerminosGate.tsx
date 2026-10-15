import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Fini } from './Fini';
import { COLORS, Cta, Titulo, borrarDatosLocales, saveV2TerminosAceptados } from './shared';
import { TextoLegal } from './TextoLegal';
import { cerrarSesion } from '../../api/v2/cuenta';

// Antes de entrar: hay que aceptar los términos y la política vigentes. Se
// muestra a quien nunca los aceptó y a quien aceptó una versión anterior
// (ver `terminosAlDia` en lib/legales.ts). El texto está entero acá y no atrás
// de un link: un consentimiento sólo es informado si se pudo leer.
export function TerminosGate() {
  const navigate = useNavigate();
  const [acepto, setAcepto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await cerrarSesion();
    borrarDatosLocales();
    navigate('/onboarding-v2/entrar', { replace: true });
  }

  return (
    <div className="flex flex-col">
      <div className="px-6 pt-8 pb-6 flex flex-col gap-5 lg:max-w-2xl lg:mx-auto w-full">
        <div className="flex items-center gap-3">
          <Fini state="idle" size={64} />
          <div className="flex flex-col gap-1">
            <Titulo className="!text-[20px]">Antes de entrar</Titulo>
            <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>
              Leé cómo cuidamos tu plata y tus datos, y aceptá para seguir.
            </p>
          </div>
        </div>
        <TextoLegal />
      </div>

      {/* Fija abajo: la persona lee y, cuando termina, acepta sin buscar el botón. */}
      <div
        className="sticky bottom-0 px-6 pt-3 pb-4 flex flex-col gap-3"
        style={{ background: COLORS.paper, borderTop: `1.5px solid ${COLORS.line}` }}
      >
        <div className="flex flex-col gap-3 w-full lg:max-w-2xl lg:mx-auto">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acepto}
              onChange={(e) => setAcepto(e.target.checked)}
              className="v2-focus mt-0.5 w-6 h-6 shrink-0 rounded"
              style={{ accentColor: COLORS.brand }}
            />
            <span className="text-[14px] font-medium leading-snug" style={{ color: COLORS.ink }}>
              Leí y acepto los términos y condiciones y la política de privacidad.
            </span>
          </label>
          <Cta
            label="Aceptar y entrar"
            disabled={!acepto}
            onClick={() => saveV2TerminosAceptados(true)}
          />
          <button
            type="button"
            onClick={() => void salir()}
            disabled={saliendo}
            className="v2-focus self-center text-[14px] font-semibold underline"
            style={{ color: COLORS.inkSoft }}
          >
            {saliendo ? 'Saliendo…' : 'No acepto, cerrar sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
