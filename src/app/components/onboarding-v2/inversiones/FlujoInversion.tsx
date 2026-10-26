import { useCallback, useEffect, useMemo, useState } from 'react';
import * as acciones from '../../../api/v2/acciones';
import { borrarPlanesDe, guardarPlan, listarPlanes } from '../../../api/v2/planes';
import type { TipoPosicion } from '../../../api/v2/tipos';
import { PROVEEDORES, type ProveedorId } from '../../../lib/inversiones/catalogo';
import { bancosParaPlazoFijo, cuentasParaElegir } from '../../../lib/inversiones/entidades';
import { armarGuia, camposBloqueados, CONTEXTO_VACIO, previosParaRegistro, type ContextoGuia, type PasoGuia } from '../../../lib/inversiones/guias';
import { pct } from '../../../lib/inversiones/formato';
import { plazosDe } from '../../../lib/inversiones/limites';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import { inflacionDeReferencia, type Recomendacion } from '../../../lib/inversiones/motor';
import { avisoDePlazo } from '../../../lib/inversiones/plazo';
import { describirRinde } from '../../../lib/inversiones/rinde';
import type { Valores } from '../../../lib/inversiones/registro';
import { AprendeEn2Min } from './AprendeEn2Min';
import { Hoja } from './Hoja';
import { PasosGuia, type OpcionDonde } from './PasosGuia';

type Fase = 'aprende' | 'pasos';

/** Lo que se elige adentro de los pasos. */
type Entradas = { plazoDias: number | null; ticker: string | null; cantidad: number | null; dolares: number | null };

const ENTRADAS_VACIAS: Entradas = { plazoDias: null, ticker: null, cantidad: null, dolares: null };

// De "me interesa" a "ya lo hice", en este orden:
//   1. Aprendé en 2 minutos (pantallas cortas: qué es, cuánto rinde, qué tenés que saber, cuándo la sacás)
//   2. Los pasos, de a uno: el primero es elegir dónde (ahí mismo, sin pantalla aparte), y el último es anotarla en FINA
//   3. Felicitaciones
// El avance se guarda: si lo deja a la mitad, queda "pendiente" debajo de las alternativas y retoma donde estaba.
export function FlujoInversion({
  rec, mercado, usa, propias, montoDeseado, horizonteMeses, onVerMias, onCerrar,
}: {
  rec: Recomendacion;
  mercado: Mercado;
  /** Los brokers que la persona dijo que ya usa. */
  usa: ProveedorId[];
  /** Los nombres de los bancos y billeteras que usa (por lo que contó y por sus medios de pago): sirven para marcar uno como recomendado. */
  propias: string[];
  /** El monto que escribió arriba, en pesos (si lo puso en dólares, ya viene convertido). */
  montoDeseado: number | null;
  /** Para cuándo es la plata, si lo dijo: sirve para avisar si la inversión no encaja con ese plazo. */
  horizonteMeses: number | null;
  /** Termina el flujo y lleva a "Mis inversiones". */
  onVerMias: () => void;
  onCerrar: () => void;
}) {
  const producto = rec.producto;
  const esPlazo = producto.id === 'plazo_fijo' || producto.id === 'plazo_fijo_uva';
  const esCuenta = producto.id === 'cuenta_remunerada';
  const tipoPosicion = producto.id as TipoPosicion;

  const [fase, setFase] = useState<Fase | null>(null);
  const [alVolverDePasos, setAlVolverDePasos] = useState(false);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [tieneCuenta, setTieneCuenta] = useState<boolean | null>(null);
  const [entradas, setEntradas] = useState<Entradas>(ENTRADAS_VACIAS);
  const [hechos, setHechos] = useState<number[]>([]);
  const [actual, setActual] = useState(0);
  // La tasa que la persona anotó en el paso: llega ya cargada al registro.
  const [tnaAnotada, setTnaAnotada] = useState<number | null>(null);
  const [terminado, setTerminado] = useState(false);

  const infl = useMemo(() => inflacionDeReferencia(mercado), [mercado]);
  const uva = producto.id === 'plazo_fijo_uva';

  // ── dónde: el banco, la cuenta o el broker ──
  const cuentas = useMemo(() => (esCuenta ? cuentasParaElegir(mercado, infl?.mensual ?? 0, propias) : []), [esCuenta, mercado, infl, propias]);
  const opcionesDonde: OpcionDonde[] = useMemo(() => {
    if (esPlazo) {
      return bancosParaPlazoFijo(mercado, uva, propias).map((b) => ({
        id: b.entidad,
        nombre: b.nombre,
        detalle: b.tna !== null ? `${pct(b.tna * 100, 1)} anual` : b.extraUva !== null ? `UVA + ${pct(b.extraUva * 100, 1)}` : undefined,
        recomendado: b.recomendado,
      }));
    }
    if (esCuenta) {
      return cuentas.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        detalle: c.techo > c.tna + 0.001 ? `${pct(c.tna * 100, 0)} (hasta ${pct(c.techo * 100, 0)})` : `${pct(c.tna * 100, 0)} anual`,
        aviso: c.pierde ? 'Hoy rinde menos que la inflación: sirve para tener la plata a mano, no para que crezca.' : null,
        recomendado: c.recomendado,
      }));
    }
    return rec.opciones
      .map((o): OpcionDonde => ({ id: o.proveedor, nombre: PROVEEDORES[o.proveedor].nombre, recomendado: usa.includes(o.proveedor) }))
      .sort((a, b) => Number(b.recomendado) - Number(a.recomendado));
  }, [esPlazo, esCuenta, uva, mercado, propias, cuentas, rec.opciones, usa]);

  const { proveedor, banco } = useMemo((): { proveedor: ProveedorId; banco: string | null } => {
    if (esPlazo) return { proveedor: 'banco', banco: seleccion };
    if (esCuenta) return { proveedor: cuentas.find((c) => c.id === seleccion)?.proveedor ?? rec.mejor.proveedor, banco: seleccion };
    return { proveedor: (seleccion as ProveedorId | null) ?? rec.mejor.proveedor, banco: null };
  }, [esPlazo, esCuenta, seleccion, cuentas, rec.mejor.proveedor]);

  const evaluacion = rec.opciones.find((o) => o.proveedor === proveedor) ?? rec.mejor;
  const ctx: ContextoGuia = useMemo(
    () => ({ ...CONTEXTO_VACIO, monto: montoDeseado, ...entradas, mercado, evaluacion, banco, horizonteMeses, tieneCuenta }),
    [montoDeseado, entradas, mercado, evaluacion, banco, horizonteMeses, tieneCuenta],
  );
  const guia = useMemo(() => {
    const g = armarGuia(proveedor, producto.id, ctx);
    // Hasta que elige dónde, el título es el de la inversión (no el de un proveedor que todavía no eligió).
    return g && seleccion === null ? { ...g, titulo: producto.nombre } : g;
  }, [proveedor, producto.id, producto.nombre, ctx, seleccion]);

  // ── lo que llega al registro ──
  const previosRegistro = useMemo((): Partial<Valores> => {
    const base = previosParaRegistro(proveedor, producto.id, ctx);
    if (tnaAnotada !== null && (producto.id === 'cuenta_remunerada' || producto.id === 'fci')) {
      base.tna = (tnaAnotada * 100).toLocaleString('es-AR', { maximumFractionDigits: 4 });
    }
    return base;
  }, [proveedor, producto.id, ctx, tnaAnotada]);
  const bloqueadosRegistro = useMemo(() => camposBloqueados(producto.id, previosRegistro), [producto.id, previosRegistro]);

  // ── retomar donde había quedado ──
  useEffect(() => {
    let vivo = true;
    void listarPlanes().then((planes) => {
      if (!vivo) return;
      const plan = planes.find((p) => p.producto === producto.id);
      if (!plan) { setFase('aprende'); return; }
      const x = plan.extra ?? {};
      setSeleccion(x.seleccion || null);
      setTieneCuenta(x.tieneCuenta === '1' ? true : x.tieneCuenta === '0' ? false : null);
      setEntradas({
        plazoDias: x.plazoDias ? Number(x.plazoDias) : null,
        ticker: x.ticker || null,
        cantidad: x.cantidad ? Number(x.cantidad) : null,
        dolares: x.dolares ? Number(x.dolares) : null,
      });
      setTnaAnotada(x.tna ? Number(x.tna) : null);
      setHechos(plan.hechos);
      setActual(x.actual ? Number(x.actual) : Math.min(plan.hechos.length, 99));
      setFase('pasos');
    });
    return () => { vivo = false; };
  }, [producto.id]);

  const persistir = useCallback((nuevosHechos: number[], irA: number, e: Entradas, sel: string | null, tiene: boolean | null, tna: number | null) => {
    void guardarPlan({
      producto: producto.id,
      proveedor: 'flujo',
      monto: montoDeseado,
      hechos: nuevosHechos,
      extra: {
        seleccion: sel ?? '', tieneCuenta: tiene === null ? '' : tiene ? '1' : '0', actual: String(irA),
        plazoDias: e.plazoDias ? String(e.plazoDias) : '', ticker: e.ticker ?? '', cantidad: e.cantidad ? String(e.cantidad) : '',
        dolares: e.dolares ? String(e.dolares) : '', tna: tna !== null ? String(tna) : '',
      },
    });
  }, [producto.id, montoDeseado]);

  if (fase === null || !guia) {
    return <Hoja titulo={producto.nombre} onCerrar={onCerrar}><p className="text-[15px]">Un segundo…</p></Hoja>;
  }

  if (fase === 'aprende') {
    return (
      <AprendeEn2Min
        producto={producto}
        ficha={describirRinde(producto.id, rec.mejor, mercado)}
        confianza={rec.mejor.confianza}
        aviso={avisoDePlazo(producto, horizonteMeses)}
        alVolverDePasos={alVolverDePasos}
        onEmpezar={() => { setFase('pasos'); setAlVolverDePasos(false); }}
        onCerrar={onCerrar}
      />
    );
  }

  const ir = (i: number) => { setActual(i); persistir(hechos, i, entradas, seleccion, tieneCuenta, tnaAnotada); };
  const marcar = (i: number, e: Entradas = entradas, sel = seleccion, tiene = tieneCuenta, tna = tnaAnotada) => {
    const nuevos = hechos.includes(i) ? hechos : [...hechos, i];
    const siguiente = Math.min(i + 1, guia.pasos.length - 1);
    setHechos(nuevos);
    setActual(siguiente);
    persistir(nuevos, siguiente, e, sel, tiene, tna);
  };

  return (
    <PasosGuia
      guia={guia}
      tipoPosicion={tipoPosicion}
      mercado={mercado}
      hechos={hechos}
      actual={Math.min(actual, guia.pasos.length - 1)}
      terminado={terminado}
      onIr={ir}
      onHecho={(i) => marcar(i)}
      onDeshacer={(i) => { const nuevos = hechos.filter((h) => h !== i); setHechos(nuevos); persistir(nuevos, actual, entradas, seleccion, tieneCuenta, tnaAnotada); }}
      onVolverAExplicacion={() => { setAlVolverDePasos(true); setFase('aprende'); }}
      onCerrar={onCerrar}
      opcionesDonde={opcionesDonde}
      seleccionDonde={seleccion}
      onElegirDonde={(id) => {
        const recomendado = opcionesDonde.find((o) => o.id === id)?.recomendado ?? false;
        setSeleccion(id);
        setTieneCuenta(recomendado);
        // Lo que viene después depende de dónde lo hace: si cambia, los pasos siguientes se vuelven a mirar.
        const nuevos = hechos.filter((h) => h === 0);
        setHechos(nuevos);
        persistir(nuevos, actual, entradas, id, recomendado, tnaAnotada);
      }}
      tieneCuenta={tieneCuenta}
      onTieneCuenta={(b) => { setTieneCuenta(b); persistir(hechos, actual, entradas, seleccion, b, tnaAnotada); }}
      plazos={plazosDe(producto.id)}
      plazoDias={entradas.plazoDias}
      onPlazo={(d) => { const e = { ...entradas, plazoDias: d }; setEntradas(e); persistir(hechos, actual, e, seleccion, tieneCuenta, tnaAnotada); }}
      ticker={entradas.ticker}
      cantidad={entradas.cantidad}
      onTicker={(t) => { const e = { ...entradas, ticker: t }; setEntradas(e); persistir(hechos, actual, e, seleccion, tieneCuenta, tnaAnotada); }}
      onCantidad={(n) => { const e = { ...entradas, cantidad: n }; setEntradas(e); persistir(hechos, actual, e, seleccion, tieneCuenta, tnaAnotada); }}
      dolares={entradas.dolares}
      onDolares={(d) => { const e = { ...entradas, dolares: d }; setEntradas(e); }}
      tasaAnotada={tnaAnotada}
      onDeclarar={(paso: PasoGuia, tna) => {
        setTnaAnotada(tna);
        if (paso.declara) void acciones.declararTasa({ ...paso.declara, tna });
        // Al anotar la tasa se pasa solo al paso siguiente.
        marcar(guia.pasos.findIndex((x) => x.id === paso.id), entradas, seleccion, tieneCuenta, tna);
      }}
      previosRegistro={previosRegistro}
      bloqueadosRegistro={bloqueadosRegistro}
      onRegistrado={() => { setTerminado(true); void borrarPlanesDe(producto.id); }}
      nombreProducto={producto.nombre}
      onVerMias={() => { onCerrar(); onVerMias(); }}
    />
  );
}
