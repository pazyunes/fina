import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '../../lib/auth';
import {
  estaHidratado, hidratar, leerEstado, leerGuardado, olvidar, suscribir,
  type EstadoGuardado,
} from './almacen';
import type { EstadoV2 } from './tipos';

// Puente entre el almacén (que es un módulo, no un hook) y React.
//
// `useSyncExternalStore` en vez de useState + useEffect: el almacén se escribe
// desde fuera de React —las respuestas de Supabase llegan cuando llegan— y
// este hook es el que garantiza que no se pinte un render con datos a medio
// actualizar.

type Valor = {
  estado: EstadoV2;
  guardado: EstadoGuardado;
  /** false hasta que terminó la primera carga contra Supabase. */
  listo: boolean;
  /** null si la última carga salió bien. */
  error: string | null;
  recargar: () => Promise<void>;
};

const Ctx = createContext<Valor | null>(null);

export function AlmacenProvider({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const uid = session?.user.id ?? null;

  const estado = useSyncExternalStore(suscribir, leerEstado, leerEstado);
  const guardado = useSyncExternalStore(suscribir, leerGuardado, leerGuardado);
  const listo = useSyncExternalStore(suscribir, estaHidratado, estaHidratado);

  // El error de carga vive acá y no en el almacén: es del ciclo de vida de esta
  // pantalla, y si la persona reintenta arranca de cero.
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setError(await hidratar());
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!uid) { olvidar(); setError(null); return; }
    void recargar();
  }, [uid, loading, recargar]);

  // Al volver a la app, se traen los datos de nuevo. Lo que carga el bot de
  // WhatsApp llega del otro lado: sin esto, quien deja FINA abierta (la app
  // instalada en el celular queda abierta en segundo plano), va a WhatsApp a
  // contar un gasto y vuelve, no lo veía hasta cerrar y abrir la app.
  //
  // Dos frenos: no más de una vez cada 20 segundos (ir y volver seguido no
  // tiene que pegarle a la base cada vez), y nunca con escrituras pendientes
  // (recargar a mitad de un guardado podría hacer desaparecer por un momento
  // lo que la persona acaba de cargar).
  useEffect(() => {
    if (!uid) return;
    let ultima = Date.now();
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - ultima < 20_000) return;
      if (leerGuardado().tipo !== 'quieto' || !estaHidratado()) return;
      ultima = Date.now();
      void hidratar().then((e) => { if (e === null) setError(null); });
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [uid]);

  return (
    <Ctx.Provider value={{ estado, guardado, listo, error, recargar }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAlmacen(): Valor {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAlmacen tiene que estar dentro de <AlmacenProvider>');
  return v;
}
