import { createContext, useContext, useEffect, useState } from 'react';
import { useAlmacen } from './AlmacenProvider';
import { leerEstado } from './almacen';
import * as api from './index';
import { diaAnterior, diaArgentina, elegirPaso, pasoPorClave, type Paso } from './pasos';
import { RACHA_VACIA, type PasoGuardado, type Racha } from './tipos';

// El paso del día y la racha, para toda la app.
//
// Vive en el layout y no en Home a propósito: el paso se cumple donde se hace
// (en Gastos, en Objetivos, en Perfil), no donde se muestra. Si la detección
// viviera en Home, registrar un gasto en Gastos no marcaría el paso hasta
// volver a Home — y si la persona cerraba la app antes, ese día no contaba.

type Valor = {
  /** null mientras se asigna. */
  paso: Paso | null;
  cumplido: boolean;
  racha: Racha;
};

const Ctx = createContext<Valor>({ paso: null, cumplido: false, racha: RACHA_VACIA });

export function PasoDelDiaProvider({ children }: { children: React.ReactNode }) {
  const { estado, listo, recargar } = useAlmacen();
  const [dia, setDia] = useState(() => diaArgentina());
  const [guardado, setGuardado] = useState<PasoGuardado | null>(null);
  const [racha, setRacha] = useState<Racha>(RACHA_VACIA);

  const refrescarRacha = async () => {
    const r = await api.leerRacha();
    if (r.error === null) setRacha(r.data);
  };

  // ── 1. Asignar el paso de hoy (una sola vez por día) ────────────────────
  useEffect(() => {
    if (!listo) return;
    let vivo = true;
    void (async () => {
      let r = await api.leerPasoDelDia(dia);
      if (r.error === null && r.data === null) {
        // Todavía no tiene paso hoy: se elige mirando el de ayer, para no
        // repetirlo, y con los datos recién traídos de la base.
        const ayer = await api.leerPasoDelDia(diaAnterior(dia));
        const clave = elegirPaso(leerEstado(), dia, ayer.data?.clave ?? null);
        r = await api.asignarPasoDelDia(dia, clave);
      }
      if (!vivo) return;
      if (r.error === null && r.data) setGuardado(r.data);
      await refrescarRacha();
    })();
    return () => { vivo = false; };
  }, [listo, dia]);

  // ── 2. Detectar que se cumplió, con cada cambio de datos ────────────────
  useEffect(() => {
    if (!guardado || guardado.cumplidoEn) return;
    const def = pasoPorClave(guardado.clave);
    if (!def || !def.cumplido(estado, dia)) return;

    // Se pinta cumplido en el acto; la escritura va detrás.
    setGuardado({ ...guardado, cumplidoEn: new Date().toISOString() });
    void (async () => {
      const w = await api.cumplirPasoDelDia(dia);
      // Si no se pudo guardar, se vuelve atrás: mostrar un paso cumplido que
      // la base no registró es mostrar una racha que mañana no va a estar.
      if (w.error !== null) { setGuardado((g) => (g ? { ...g, cumplidoEn: null } : g)); return; }
      await refrescarRacha();
    })();
  }, [estado, guardado, dia]);

  // ── 3. Al volver a la pestaña ───────────────────────────────────────────
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;

      // Pasó la medianoche con la app abierta: es otro día, toca otro paso.
      const ahora = diaArgentina();
      if (ahora !== dia) { setGuardado(null); setDia(ahora); return; }

      // El bot escribe del otro lado. Si el paso de hoy es contarle un gasto
      // por WhatsApp, al volver de WhatsApp hay que traer los datos: si no, el
      // paso seguiría pendiente justo después de haberlo hecho.
      if (guardado && !guardado.cumplidoEn && guardado.clave === 'gasto_whatsapp') void recargar();

      // Y la racha siempre: un gasto por WhatsApp salva el día aunque el paso
      // sea otro.
      void refrescarRacha();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [dia, guardado, recargar]);

  const paso = guardado ? pasoPorClave(guardado.clave) ?? null : null;

  return (
    <Ctx.Provider value={{ paso, cumplido: !!guardado?.cumplidoEn, racha }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePasoDelDia(): Valor {
  return useContext(Ctx);
}
