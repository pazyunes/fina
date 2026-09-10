import { useEffect, useRef, useState } from 'react';
import { COLORS, FONTS, TituloSeccion } from './shared';
import { WHATSAPP_URL } from '../WhatsAppFab';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { IconChevron } from './FinaIcons';

// Verificar el teléfono mandándole un código al bot de WhatsApp.
//
// POR QUÉ NO ES UN SMS. El bot no puede escribirle primero a nadie: WhatsApp
// sólo deja iniciar una conversación con una plantilla aprobada y pagando. Así
// que la verificación va al revés — la persona le manda un mensaje al bot.
// Recibirlo prueba que el número es suyo (la misma garantía que un código por
// SMS) y además deja la conversación abierta, que es lo que el bot necesita
// para poder responderle después.
//
// La pantalla anterior pedía un código de 4 dígitos y aceptaba cualquiera: no
// verificaba nada y le hacía creer a la persona que su teléfono estaba
// validado. Preferimos no tener el paso antes que tener uno que miente.

const MARCA = 'FINA-VERIF-';

export function VerificarTelefono() {
  const { estado: db } = useAlmacen();
  const verificado = !!db.perfil.telefonoVerificadoEn;
  const telefono = db.perfil.telefono;

  const [codigo, setCodigo] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [esperando, setEsperando] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Se pregunta cada 3 segundos si el bot ya confirmó. El que confirma está del
  // otro lado, así que no hay forma de que nos avise; la consulta vive sólo
  // mientras hay un código en pantalla y se corta al verificarse.
  useEffect(() => {
    if (!esperando || verificado) return;
    let vivo = true;
    const preguntar = async () => {
      const listo = await acciones.refrescarTelefono();
      if (!vivo) return;
      if (listo) { setEsperando(false); return; }
      timerRef.current = window.setTimeout(preguntar, 3000);
    };
    timerRef.current = window.setTimeout(preguntar, 3000);
    return () => {
      vivo = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [esperando, verificado]);

  // Y se corta a los 15 minutos, que es cuando el código vence: seguir
  // preguntando por un código muerto es gastar batería para nada.
  useEffect(() => {
    if (!esperando) return;
    const corte = window.setTimeout(() => {
      setEsperando(false);
      setCodigo(null);
      setError('El código venció. Pedí uno nuevo.');
    }, 15 * 60 * 1000);
    return () => window.clearTimeout(corte);
  }, [esperando, codigo]);

  async function pedir() {
    if (pidiendo) return;
    setPidiendo(true);
    setError(null);
    const r = await acciones.pedirCodigoTelefono(telefono);
    setPidiendo(false);
    if (r.error !== null || !r.codigo) {
      setError(
        r.error?.includes('demasiados')
          ? 'Pediste varios códigos seguidos. Esperá un rato y probá de nuevo.'
          : 'No pudimos generar el código. Probá de nuevo.',
      );
      return;
    }
    setCodigo(r.codigo);
    setEsperando(true);
  }

  if (verificado) {
    return (
      <div className="flex flex-col gap-1.5">
        <TituloSeccion>Tu teléfono</TituloSeccion>
        <p className="text-[17px] font-semibold tabular-nums" style={{ color: COLORS.ink, fontFamily: FONTS.mono }}>
          {telefono}
        </p>
        <p className="text-[15px]" style={{ color: COLORS.limaText }}>
          Verificado — ya podés registrar gastos hablándole a FINA por WhatsApp.
        </p>
      </div>
    );
  }

  const mensaje = codigo ? `${MARCA}${codigo}` : '';
  const link = `${WHATSAPP_URL}?text=${encodeURIComponent(mensaje)}`;

  return (
    <div className="flex flex-col gap-3">
      <TituloSeccion>Verificá tu teléfono</TituloSeccion>
      <p className="text-[16px] leading-snug" style={{ color: COLORS.inkSoft }}>
        Es para que puedas registrar gastos hablándole a FINA por WhatsApp. Le mandás
        un código desde tu teléfono y listo — no te vamos a mandar ningún SMS.
      </p>

      {codigo === null ? (
        <button
          type="button"
          onClick={() => void pedir()}
          disabled={pidiendo}
          className="v2-focus rounded-2xl py-3.5 text-[17px] font-bold v2-disabled transition-all duration-100 active:scale-[0.98]"
          style={{ background: COLORS.lima, color: COLORS.ink }}
        >
          {pidiendo ? 'Generando…' : 'Verificar con WhatsApp'}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          {/* El código se muestra igual que el link: si abre WhatsApp desde la
              computadora y manda desde el celular, tiene que poder copiarlo. */}
          <div className="rounded-2xl px-4 py-3 flex flex-col gap-1" style={{ background: COLORS.tint }}>
            <span className="text-[14px]" style={{ color: COLORS.inkSoft }}>Tu código</span>
            <span
              className="text-[24px] font-bold tabular-nums tracking-[0.12em]"
              style={{ color: COLORS.ink, fontFamily: FONTS.mono }}
            >
              {codigo}
            </span>
          </div>

          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="v2-focus rounded-2xl py-3.5 text-[17px] font-bold text-center transition-all duration-100 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: COLORS.lima, color: COLORS.ink }}
          >
            Abrir WhatsApp y enviar <IconChevron size={17} />
          </a>

          <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
            {esperando
              ? 'Esperando tu mensaje… Cuando lo envíes, esta pantalla se actualiza sola.'
              : 'Mandale el mensaje y volvé acá.'}
          </p>

          <button
            type="button"
            onClick={() => void pedir()}
            className="v2-focus self-start text-[15px] font-semibold underline rounded-full py-2"
            style={{ color: COLORS.brand }}
          >
            Pedir otro código
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[15px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>
      )}
    </div>
  );
}
