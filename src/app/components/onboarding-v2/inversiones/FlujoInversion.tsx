import { useEffect, useMemo, useState } from 'react';
import * as acciones from '../../../api/v2/acciones';
import { guardarPlan, leerPlan } from '../../../api/v2/planes';
import { type ProveedorId } from '../../../lib/inversiones/catalogo';
import type { SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import { armarGuia, CONTEXTO_VACIO, previosParaRegistro, type ContextoGuia } from '../../../lib/inversiones/guias';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import type { Recomendacion } from '../../../lib/inversiones/motor';
import { avisoDePlazo } from '../../../lib/inversiones/plazo';
import { describirRinde } from '../../../lib/inversiones/rinde';
import type { Valores } from '../../../lib/inversiones/registro';
import { AprendeEn2Min } from './AprendeEn2Min';
import { ElegirDonde } from './ElegirDonde';
import { ElegirMonto, type Entradas } from './ElegirMonto';
import { Hoja } from './Hoja';
import { PasosNumerados } from './PasosNumerados';

type Fase = 'aprende' | 'donde' | 'monto' | 'pasos';

// De "me interesa" a "ya lo hice", en este orden:
//   1. Aprendé en 2 minutos (cuatro pantallas: la primera es el glosario)
//   2. Dónde lo hacés (las opciones una al lado de la otra)
//   3. Con cuánto empezás (lo que cada inversión realmente pide)
//   4. Los pasos, numerados
// El avance se guarda: si lo deja a la mitad y vuelve, sigue donde estaba.
export function FlujoInversion({
  rec, mercado, usa, sugerencia, montoDeseado, horizonteMeses, onRegistrar, onCerrar,
}: {
  rec: Recomendacion;
  mercado: Mercado;
  usa: ProveedorId[];
  sugerencia: SugerenciaMonto;
  montoDeseado: number | null;
  /** Para cuándo es la plata, si lo dijo: sirve para avisar si la inversión no encaja con ese plazo. */
  horizonteMeses: number | null;
  onRegistrar: (previos: Partial<Valores>) => void;
  onCerrar: () => void;
}) {
  const producto = rec.producto;
  const [fase, setFase] = useState<Fase | null>(null);
  const [proveedor, setProveedor] = useState<ProveedorId | null>(rec.opciones.length === 1 ? rec.opciones[0].proveedor : rec.mejor.proveedor);
  const [banco, setBanco] = useState<string | null>(null);
  const [entradas, setEntradas] = useState<Entradas>({ monto: null, plazoDias: null, ticker: null, cantidad: null, dolares: null });
  const [hechos, setHechos] = useState<number[]>([]);
  const [abierto, setAbierto] = useState(0);
  // La tasa que la persona anotó en el paso a paso: llega ya cargada al registro.
  const [tnaAnotada, setTnaAnotada] = useState<number | null>(null);

  // Retoma donde había quedado, en el proveedor que estaba haciendo.
  useEffect(() => {
    let vivo = true;
    Promise.all(rec.opciones.map((o) => leerPlan(producto.id, o.proveedor))).then((planes) => {
      if (!vivo) return;
      const idx = planes.findIndex((p) => p && (p.hechos.length > 0 || p.monto !== null));
      const plan = idx >= 0 ? planes[idx] : null;
      if (plan) {
        setProveedor(rec.opciones[idx].proveedor);
        setHechos(plan.hechos);
        const x = plan.extra ?? {};
        setBanco(x.banco || null);
        setEntradas({
          monto: plan.monto,
          plazoDias: x.plazoDias ? Number(x.plazoDias) : null,
          ticker: x.ticker || null,
          cantidad: x.cantidad ? Number(x.cantidad) : null,
          dolares: x.dolares ? Number(x.dolares) : null,
        });
        setFase('pasos');
      } else {
        setFase('aprende');
      }
    });
    return () => { vivo = false; };
  }, [producto.id, rec.opciones]);

  const evaluacion = rec.opciones.find((o) => o.proveedor === proveedor) ?? rec.mejor;
  const ctx: ContextoGuia = useMemo(
    () => ({ ...CONTEXTO_VACIO, ...entradas, mercado, evaluacion, banco }),
    [entradas, mercado, evaluacion, banco],
  );
  const guia = useMemo(() => (proveedor ? armarGuia(proveedor, producto.id, ctx) : null), [proveedor, producto.id, ctx]);

  // Al entrar a los pasos se abre el primero que falta.
  const total = guia?.pasos.length ?? 0;
  useEffect(() => {
    if (fase === 'pasos' && total > 0) {
      const primero = Array.from({ length: total }, (_, i) => i).find((i) => !hechos.includes(i));
      setAbierto(primero ?? total - 1);
    }
    // Sólo al cambiar de fase: después manda la persona.
  }, [fase, total]);

  function persistir(nuevosHechos: number[], e: Entradas = entradas, b: string | null = banco) {
    if (!proveedor) return;
    void guardarPlan({
      producto: producto.id, proveedor, monto: e.monto, hechos: nuevosHechos,
      extra: {
        banco: b ?? '', plazoDias: e.plazoDias ? String(e.plazoDias) : '', ticker: e.ticker ?? '',
        cantidad: e.cantidad ? String(e.cantidad) : '', dolares: e.dolares ? String(e.dolares) : '',
      },
    });
  }

  if (fase === null) {
    return <Hoja titulo={producto.nombre} onCerrar={onCerrar}><p className="text-[15px]">Un segundo…</p></Hoja>;
  }

  if (fase === 'aprende') {
    const ficha = describirRinde(producto.id, rec.mejor, mercado);
    return (
      <AprendeEn2Min
        producto={producto}
        ficha={ficha}
        confianza={rec.mejor.confianza}
        aviso={avisoDePlazo(producto, horizonteMeses)}
        onEmpezar={() => setFase(rec.opciones.length > 1 || producto.id === 'plazo_fijo' || producto.id === 'plazo_fijo_uva' ? 'donde' : 'monto')}
        onCerrar={onCerrar}
      />
    );
  }

  const hayDonde = rec.opciones.length > 1 || producto.id === 'plazo_fijo' || producto.id === 'plazo_fijo_uva';

  if (fase === 'donde') {
    return (
      <ElegirDonde
        producto={producto.id}
        opciones={rec.opciones}
        usa={usa}
        mercado={mercado}
        proveedor={proveedor}
        banco={banco}
        onProveedor={setProveedor}
        onBanco={setBanco}
        onSeguir={() => setFase('monto')}
        onVolver={() => setFase('aprende')}
        onCerrar={onCerrar}
      />
    );
  }

  if (fase === 'monto' && proveedor) {
    return (
      <ElegirMonto
        producto={producto.id}
        proveedor={proveedor}
        banco={banco}
        mercado={mercado}
        sugerencia={sugerencia}
        montoDeseado={montoDeseado}
        inicial={entradas}
        onListo={(e) => { setEntradas(e); persistir(hechos, e); setFase('pasos'); }}
        onVolver={() => setFase(hayDonde ? 'donde' : 'aprende')}
        onCerrar={onCerrar}
      />
    );
  }

  if (!guia || !proveedor) return null;

  const previosConTasa = (): Partial<Valores> => ({
    ...previosParaRegistro(proveedor, producto.id, ctx),
    ...(tnaAnotada !== null ? { tna: (tnaAnotada * 100).toLocaleString('es-AR', { maximumFractionDigits: 4 }) } : {}),
  });

  return (
    <Hoja titulo={guia.titulo} onCerrar={onCerrar} ancho={460}>
      <PasosNumerados
        guia={guia}
        monto={entradas.monto}
        hechos={hechos}
        abierto={abierto}
        onAbrir={setAbierto}
        onHacer={(i, paso) => {
          const nuevos = hechos.includes(i) ? hechos : [...hechos, i];
          setHechos(nuevos);
          persistir(nuevos);
          if (paso.registra) { onRegistrar(previosConTasa()); return; }
          if (i < total - 1) setAbierto(i + 1);
        }}
        onDeshacer={(i) => { const nuevos = hechos.filter((h) => h !== i); setHechos(nuevos); persistir(nuevos); }}
        onVerBasico={() => setFase('aprende')}
        onDeclarar={(paso, tna) => { setTnaAnotada(tna); if (paso.declara) acciones.declararTasa({ ...paso.declara, tna }); }}
        onRegistrar={() => onRegistrar(previosConTasa())}
      />
    </Hoja>
  );
}
