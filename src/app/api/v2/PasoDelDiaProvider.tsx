import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAlmacen } from './AlmacenProvider';
import { leerEstado } from './almacen';
import { supabase } from './cliente';
import * as api from './index';
import {
  diaAnterior, diaArgentina, elegirPaso, estaCumplido, pasoElegidoSirve, pasoPorClave, sumarDiasAR,
  type Historial, type Paso,
} from './pasos';
import { leerPasoElegido } from './recomendaciones';
import { RACHA_VACIA, type PasoGuardado, type Racha } from './tipos';

// El paso del día y la racha, para toda la app.
//
// Vive en el layout y no en Home a propósito: el paso se cumple donde se hace
// (en Gastos, en Objetivos, en Perfil), no donde se muestra. Si la detección
// viviera en Home, registrar un gasto en Gastos no marcaría el paso hasta
// volver a Home, y si la persona cerraba la app antes, ese día no contaba.

type Valor = {
  /** null mientras se asigna. */
  paso: Paso | null;
  /** Si el paso lo eligió la IA, lo que escribió para esta persona. */
  mensaje: string | null;
  cumplido: boolean;
  racha: Racha;
  /** Las claves de los pasos de los últimos 7 días (sin hoy), del más nuevo al más viejo. */
  recientes: string[];
  /** Para los pasos de revisión: la persona contestó la pregunta sobre los números. */
  marcarRevisado: () => void;
};

const Ctx = createContext<Valor>({ paso: null, mensaje: null, cumplido: false, racha: RACHA_VACIA, recientes: [], marcarRevisado: () => {} });

// ── Revisiones contestadas ───────────────────────────────────────────────
// Un paso de revisión se cumple al contestar la pregunta. La respuesta se
// recuerda en el navegador sólo hasta que la base guarda el paso cumplido;
// después manda `completed_at`.
const CLAVE_REVISADOS = 'fina:pasos-revisados';

function leerRevisados(dia: string): Set<string> {
  try {
    const crudo = window.localStorage.getItem(CLAVE_REVISADOS);
    const v = crudo ? (JSON.parse(crudo) as { dia?: unknown; claves?: unknown }) : null;
    if (!v || v.dia !== dia || !Array.isArray(v.claves)) return new Set();
    return new Set(v.claves.filter((c): c is string => typeof c === 'string'));
  } catch {
    return new Set();
  }
}

function guardarRevisados(dia: string, claves: Set<string>) {
  try {
    window.localStorage.setItem(CLAVE_REVISADOS, JSON.stringify({ dia, claves: [...claves] }));
  } catch {
    // Sin almacenamiento: el paso igual se marca en pantalla y en la base.
  }
}

/** Los pasos de los 7 días anteriores a `dia`, del más nuevo al más viejo. */
async function leerPasosRecientes(dia: string): Promise<{ dia: string; clave: string }[]> {
  try {
    const { data, error } = await supabase
      .from('daily_steps')
      .select('day, step_key')
      .gte('day', sumarDiasAR(dia, -7))
      .lt('day', dia)
      .order('day', { ascending: false });
    if (!error && data) return (data as { day: string; step_key: string }[]).map((f) => ({ dia: f.day, clave: f.step_key }));
  } catch {
    // Sigue abajo, con sólo el de ayer.
  }
  const ayer = await api.leerPasoDelDia(diaAnterior(dia));
  return ayer.data ? [{ dia: ayer.data.dia, clave: ayer.data.clave }] : [];
}

export function PasoDelDiaProvider({ children }: { children: React.ReactNode }) {
  const { estado, listo, recargar } = useAlmacen();
  const [dia, setDia] = useState(() => diaArgentina());
  const [guardado, setGuardado] = useState<PasoGuardado | null>(null);
  const [racha, setRacha] = useState<Racha>(RACHA_VACIA);
  const [recientes, setRecientes] = useState<string[]>([]);
  const [revisados, setRevisados] = useState<Set<string>>(() => leerRevisados(diaArgentina()));

  const refrescarRacha = async (): Promise<Racha | null> => {
    const r = await api.leerRacha();
    if (r.error !== null) return null;
    setRacha(r.data);
    return r.data;
  };

  // ── 1. Asignar el paso de hoy (una sola vez por día) ────────────────────
  useEffect(() => {
    if (!listo) return;
    let vivo = true;
    void (async () => {
      const previos = await leerPasosRecientes(dia);
      const historial: Historial = {
        ayer: previos.find((p) => p.dia === diaAnterior(dia))?.clave ?? null,
        recientes: previos.map((p) => p.clave),
      };
      if (vivo) setRecientes(historial.recientes);

      let r = await api.leerPasoDelDia(dia);
      if (r.error === null && r.data === null) {
        // Todavía no tiene paso hoy. Primero, el que la IA eligió ayer para
        // hoy, si todavía se puede cumplir y no se vio en la semana; si no hay
        // o ya no sirve, la regla. La racha destraba los niveles.
        const rachaHoy = await refrescarRacha();
        const elegido = await leerPasoElegido(dia);
        const e = leerEstado();
        r = elegido && pasoElegidoSirve(e, elegido.clave, historial, dia)
          ? await api.asignarPasoDelDia(dia, elegido.clave, elegido.mensaje)
          : await api.asignarPasoDelDia(dia, elegirPaso(e, dia, historial, rachaHoy?.dias ?? 0));
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
    if (!estaCumplido(guardado.clave, estado, dia, revisados)) return;

    // Se pinta cumplido en el acto; la escritura va detrás.
    setGuardado({ ...guardado, cumplidoEn: new Date().toISOString() });
    void (async () => {
      const w = await api.cumplirPasoDelDia(dia);
      // Si no se pudo guardar, se vuelve atrás: mostrar un paso cumplido que
      // la base no registró es mostrar una racha que mañana no va a estar.
      if (w.error !== null) { setGuardado((g) => (g ? { ...g, cumplidoEn: null } : g)); return; }
      await refrescarRacha();
    })();
  }, [estado, guardado, dia, revisados]);

  // ── 3. Al volver a la pestaña ───────────────────────────────────────────
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;

      // Pasó la medianoche con la app abierta: es otro día, toca otro paso.
      const ahora = diaArgentina();
      if (ahora !== dia) { setGuardado(null); setRevisados(leerRevisados(ahora)); setDia(ahora); return; }

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

  const marcarRevisado = useCallback(() => {
    if (!guardado) return;
    setRevisados((prev) => {
      const nuevo = new Set(prev).add(guardado.clave);
      guardarRevisados(dia, nuevo);
      return nuevo;
    });
  }, [guardado, dia]);

  const paso = guardado ? pasoPorClave(guardado.clave, estado) ?? null : null;

  return (
    <Ctx.Provider value={{ paso, mensaje: guardado?.mensaje ?? null, cumplido: !!guardado?.cumplidoEn, racha, recientes, marcarRevisado }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePasoDelDia(): Valor {
  return useContext(Ctx);
}
