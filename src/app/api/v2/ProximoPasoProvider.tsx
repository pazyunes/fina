import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAlmacen } from './AlmacenProvider';
import * as api from './index';
import { elegirProximoPaso, pasosHechos, type ProximoPaso } from './proximoPaso';
import { RACHA_VACIA, type Racha } from './tipos';

// El próximo paso y la racha, para toda la app.
//
// Vive en el layout y no en Home: la racha cambia cuando se anota un gasto, y
// eso pasa en Gastos o por WhatsApp, no donde se muestra.
//
// Reemplaza al paso del día (migración 0042): en vez de un paso distinto cada
// día que se cumplía solo, hay UN paso grande que queda hasta que la persona
// marca que lo hizo. La racha cuenta los días con al menos un gasto anotado.

type Valor = {
  /** null mientras carga, o si ya hizo todos los pasos que le aplican. */
  paso: ProximoPaso | null;
  /** false mientras se leen los pasos marcados. */
  listo: boolean;
  hechos: { hechos: number; total: number };
  /** Marca el paso como hecho. Devuelve el error, o null si se guardó. */
  marcarHecho: (clave: string) => Promise<string | null>;
  /** Para "Me equivoqué, todavía no lo hice". */
  deshacer: (clave: string) => Promise<string | null>;
  racha: Racha;
};

const Ctx = createContext<Valor>({
  paso: null, listo: false, hechos: { hechos: 0, total: 0 }, marcarHecho: async () => null, deshacer: async () => null, racha: RACHA_VACIA,
});

export function ProximoPasoProvider({ children }: { children: React.ReactNode }) {
  const { estado, listo: almacenListo } = useAlmacen();
  const [marcados, setMarcados] = useState<Set<string> | null>(null);
  const [racha, setRacha] = useState<Racha>(RACHA_VACIA);

  const refrescarRacha = useCallback(async () => {
    const r = await api.leerRacha();
    if (r.error === null) setRacha(r.data);
  }, []);

  // Los pasos marcados, una vez por sesión.
  useEffect(() => {
    if (!almacenListo) return;
    let vivo = true;
    void api.leerProximosPasosHechos().then((r) => {
      // Sin la migración 0042 la tabla no existe: se sigue con nada marcado,
      // así Inicio muestra el primer paso en vez de quedar vacío.
      if (vivo) setMarcados(new Set(r.error === null ? r.data : []));
    });
    return () => { vivo = false; };
  }, [almacenListo]);

  // La racha: al entrar y cada vez que cambia la cantidad de gastos (anotar uno
  // hoy puede sumar el día).
  const cantGastos = estado.gastos.length;
  useEffect(() => {
    if (!almacenListo) return;
    void refrescarRacha();
  }, [almacenListo, cantGastos, refrescarRacha]);

  // Al volver a la pestaña: el bot escribe del otro lado, y un gasto contado
  // por WhatsApp suma el día. (Traer el gasto en sí lo hace el recordatorio de
  // Inicio al volver de WhatsApp.)
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void refrescarRacha();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [refrescarRacha]);

  const marcarHecho = useCallback(async (clave: string) => {
    // Se pinta en el acto; si la base no lo guarda, se vuelve atrás: mostrar
    // un paso hecho que la base no registró es mostrar algo que mañana no está.
    setMarcados((m) => new Set(m ?? []).add(clave));
    const r = await api.marcarProximoPaso(clave);
    if (r.error !== null) {
      setMarcados((m) => { const n = new Set(m ?? []); n.delete(clave); return n; });
      return r.error;
    }
    return null;
  }, []);

  const deshacer = useCallback(async (clave: string) => {
    setMarcados((m) => { const n = new Set(m ?? []); n.delete(clave); return n; });
    const r = await api.desmarcarProximoPaso(clave);
    if (r.error !== null) { setMarcados((m) => new Set(m ?? []).add(clave)); return r.error; }
    return null;
  }, []);

  const valor = useMemo<Valor>(() => {
    const m = marcados ?? new Set<string>();
    return {
      paso: marcados ? elegirProximoPaso(estado, m) : null,
      listo: marcados !== null,
      hechos: pasosHechos(estado, m),
      marcarHecho,
      deshacer,
      racha,
    };
  }, [estado, marcados, marcarHecho, deshacer, racha]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useProximoPaso(): Valor {
  return useContext(Ctx);
}
