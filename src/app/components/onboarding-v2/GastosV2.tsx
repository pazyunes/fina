import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { llevarA, useAlLlegar, useVolverAlOrigen } from './alLlegar';
import { BORDE_FALTA, COLORS, Donut, EstadoConfianza, FONTS, Monto, SegmentedTab, TextoFalta, Titulo, TituloSeccion, fmtMoney, formatThousands, parseMoneyInput } from './shared';
import { useFaltantes } from './useFaltantes';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { apartadoTotal } from '../../api/v2/apartado';
import * as acciones from '../../api/v2/acciones';
import { precargarCotizacion } from '../../api/v2/cotizacion';
import { Fini } from './Fini';
import { IconCalendario, IconChevron, IconEditar } from './FinaIcons';
import { LinkWhatsApp } from './LinkWhatsApp';
import { FilaIngreso, lunesAtras } from './IngresosVsGastos';
import { ListaGastosFijos } from './GastosFijos';
import { ListaRecurrentes } from './GastosRecurrentes';
import { FUENTES_INGRESO, type FuenteIngreso } from '../../api/v2/tipos';
import { FilaGasto } from './FilaGasto';
import { FilaSeccion } from './FilaSeccion';
import { FormularioGasto, INPUT_STYLE, METODOS_SUGERIDOS } from './FormularioGasto';
import { Hoja } from './Hoja';
import { ImportarGastos } from './ImportarGastos';
import { TIPOS, TIPO_INFO, colorDeSeccion, gastosDeLaBase, recientes, seccionesDeLaBase, ultimoGasto, type Periodo, type TipoGasto } from './datosGasto';

// REDISEÑO v2. Mis Gastos. Lo principal es el anillo del período: arriba se
// elige si se mira por mes o por semana, y se pasa al período anterior con las
// flechas o deslizando de costado. Debajo, las dos acciones (agregar gasto,
// agregar ingreso) y, en este orden (pedido de diseño, oct 2026): los últimos
// gastos, tus categorías (las 5 con gastos más recientes, con su tope), los
// gastos recurrentes y los gastos fijos. Después, cuánto fue de cada tipo, los
// últimos ingresos y los medios de pago. Todo va de lo más reciente a lo más
// viejo, no de lo que más se llevó a lo que menos. Las listas completas viven
// en Tus categorías y en Todos tus gastos. Lo que entra contra lo que sale ya
// está en Inicio y no se repite acá.
//
// Alineado a la guía (src/styles/frontend.md): todo el color sale de COLORS;
// los gastos se muestran NEUTRALES (montos en tinta, nunca color de alerta);
// cada dato declara su estado de confianza (§5); tarjeta elevada sólo para el
// dato central, hairline para las listas.
//
// PERSISTENCIA: esta pantalla no guarda nada por su cuenta. Lee del almacén
// (la copia en memoria de lo que hay en Supabase) y escribe llamando a
// `acciones`, que actualiza esa copia y encola la escritura contra la base.

const CARD_ELEVADA: React.CSSProperties = { background: COLORS.surface, boxShadow: '0 2px 8px rgba(43,33,24,0.08)' };

export function GastosV2() {
  const { estado: db } = useAlmacen();
  const navigate = useNavigate();
  const gastos = useMemo(() => gastosDeLaBase(db), [db]);
  const { categorias, topes } = useMemo(() => seccionesDeLaBase(db), [db]);

  // La cotización se pide al entrar, no al tocar "guardar": si la persona carga
  // un gasto en dólares, el valor ya está y no espera a la red.
  useEffect(() => { precargarCotizacion(); }, []);

  // La sección con la hoja del tope abierta (una a la vez).
  const [openCatId, setOpenCatId] = useState<string | null>(null);
  // La hoja abierta en Tus gastos (editar o borrar), de a un gasto por vez.
  const [gastoAbierto, setGastoAbierto] = useState<{ id: string; que: 'editar' | 'borrar' } | null>(null);
  const [ingresoBorrando, setIngresoBorrando] = useState<string | null>(null);

  const [addingGasto, setAddingGasto] = useState(false);
  // "Anotar un gasto fijo" o "Anotar un gasto recurrente" abren el mismo
  // formulario con esa opción ya prendida.
  const [repeticionNueva, setRepeticionNueva] = useState<'fijo' | 'recurrente' | undefined>(undefined);
  // Popup al tocar "+ Agregar gasto": ¿un gasto diario o un gasto fijo? Se
  // asume que se carga acá; WhatsApp queda como recordatorio con su enlace.
  const [chooser, setChooser] = useState(false);

  // Importar gastos anteriores, en una hoja aparte.
  const [importando, setImportando] = useState(false);

  // Agregar ingreso.
  const [addingDisponible, setAddingDisponible] = useState(false);
  const [addDispVal, setAddDispVal] = useState('');
  const faltaIngreso = useFaltantes({ monto: parseMoneyInput(addDispVal) <= 0 }, addingDisponible);
  const [addDispMetodo, setAddDispMetodo] = useState<string | null>(null);
  const [addDispMetodoOtro, setAddDispMetodoOtro] = useState('');
  const [addDispFuente, setAddDispFuente] = useState<FuenteIngreso | ''>('');
  const [addDispFuenteOtra, setAddDispFuenteOtra] = useState('');

  // El período que se mira: por mes o por semana. 0 es el actual, 1 el
  // anterior, y así.
  const [ventana, setVentana] = useState<Periodo>('mes');
  const [mesOffset, setMesOffset] = useState(0);
  const [semanaOffset, setSemanaOffset] = useState(0);
  // Hacia dónde se movió el período la última vez, para que el anillo entre
  // desde ese lado.
  const [direccion, setDireccion] = useState<'atras' | 'adelante' | null>(null);

  // El total y el anillo miran una VENTANA, no todo el historial: "gastado"
  // sin período no se puede comparar con nada, y un tope es por semana o por
  // mes. Es el mes o la semana de calendario, no los últimos 30 o 7 días: es lo
  // que la persona tiene en la cabeza cuando piensa "cuánto gasté este mes".
  const desdeVentana = (() => {
    const d = new Date();
    if (ventana === 'mes') return new Date(d.getFullYear(), d.getMonth() - mesOffset, 1).getTime();
    // La semana va de lunes a domingo, en días de Argentina.
    return Date.parse(`${lunesAtras(semanaOffset)}T00:00:00-03:00`);
  })();
  // Un período pasado necesita también un límite de arriba: si no, "julio"
  // incluye agosto, septiembre... hasta hoy.
  const hastaVentana = ventana === 'mes' && mesOffset > 0
    ? (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - mesOffset + 1, 1).getTime(); })()
    : ventana === 'semana' && semanaOffset > 0
      ? desdeVentana + 7 * 86_400_000
      : Infinity;
  const gastosVentana = gastos.filter((g) => g.ts >= desdeVentana && g.ts < hastaVentana);

  // Nombre del mes, para la esquina del anillo. Siempre el nombre, también el
  // del mes en curso: es lo que ubica al pasar de un mes a otro.
  const nombreMesOffset = (offset: number) => {
    const hoy = new Date();
    const objetivo = new Date(hoy.getFullYear(), hoy.getMonth() - offset, 1);
    const nombre = objetivo.toLocaleDateString('es-AR', { month: 'long' });
    const conAño = objetivo.getFullYear() !== hoy.getFullYear() ? `${nombre} ${objetivo.getFullYear()}` : nombre;
    return conAño.charAt(0).toUpperCase() + conAño.slice(1);
  };
  // La semana, como rango de lunes a domingo ("10 – 16 sep").
  const etiquetaSemana = (offset: number) => {
    const lunes = new Date(`${lunesAtras(offset)}T12:00:00Z`);
    const domingo = new Date(lunes);
    domingo.setUTCDate(domingo.getUTCDate() + 6);
    const f = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
    return `${f(lunes)} – ${f(domingo)}`;
  };
  const etiquetaVentana = ventana === 'mes' ? nombreMesOffset(mesOffset) : etiquetaSemana(semanaOffset);
  const offsetVentana = ventana === 'mes' ? mesOffset : semanaOffset;
  const textoPeriodo = ventana === 'mes'
    ? (mesOffset === 0 ? 'este mes' : nombreMesOffset(mesOffset))
    : semanaOffset === 0 ? 'esta semana' : semanaOffset === 1 ? 'la semana pasada' : `la semana del ${etiquetaSemana(semanaOffset)}`;
  // "este mes", "en septiembre": para decir de cuándo es un número.
  const referenciaPeriodo = /^(este|esta|la)\b/.test(textoPeriodo) ? textoPeriodo : `en ${textoPeriodo.toLowerCase()}`;

  const totalGastado = gastosVentana.reduce((s, g) => s + g.montoArs, 0);
  // Lo que entró EN EL PERÍODO, sólo con lo registrado (los ingresos y las
  // cargas de saldo que ya existían). No se arrastra lo que sobró del mes anterior: que haya sobrado no
  // quiere decir que siga estando.
  const plataDelPeriodo =
    db.ingresos.filter((i) => i.ts >= desdeVentana && i.ts < hastaVentana).reduce((t, i) => t + i.montoArs, 0)
    + db.cargas.filter((c) => c.ts >= desdeVentana && c.ts < hastaVentana).reduce((t, c) => t + c.montoArs, 0);
  // Un período que ya terminó se cuenta en pasado: "te quedó", no "te queda".
  const periodoCerrado = offsetVentana > 0;
  // Lo apartado (para lo que ya sabe que va a gastar y para sus objetivos de
  // ahorro, migración 0043) ya tiene destino: en el período actual deja de
  // contar como libre para gastar. En un período pasado no se resta: lo
  // apartado es de hoy, no de entonces.
  const apartado = apartadoTotal(db);
  const apartadoAhora = !periodoCerrado ? apartado.total : 0;
  // En cero y no en negativo: gastar más de lo que se cargó suele ser que
  // falta cargar ingresos, y se dice aparte, sin alerta (regla 3).
  const disponibleVentana = Math.max(plataDelPeriodo - totalGastado - apartadoAhora, 0);
  const teQueda = periodoCerrado ? 'Te quedó' : 'Disponible';
  const gastadoEn = (catId: string) => gastosVentana.filter((g) => g.categoriaId === catId).reduce((s, g) => s + g.montoArs, 0);
  const colorDe = (catId: string) => colorDeSeccion(catId, categorias);
  // Cuándo fue el último gasto de cada sección: en el período, y si no hubo,
  // en todo el historial. Ordena el anillo y Tus categorías.
  const ultimoEnVentana = ultimoGasto(gastosVentana, (g) => [g.categoriaId || '__sin']);
  const ultimoEnTodo = ultimoGasto(gastos, (g) => [g.categoriaId || '__sin']);
  const masReciente = (a: string, b: string) =>
    (ultimoEnVentana.get(b) ?? 0) - (ultimoEnVentana.get(a) ?? 0) || (ultimoEnTodo.get(b) ?? 0) - (ultimoEnTodo.get(a) ?? 0);

  // ── Anillo: de lo que entró, cuánto se fue en cada sección y cuánto te
  // queda. Sin nada registrado como entrada, muestra sólo cómo se reparten los
  // gastos entre secciones (no hace falta cargar el ingreso para usar Gastos).
  const conIngreso = plataDelPeriodo > 0;
  const porSeccion = [
    ...categorias.map((c) => ({ id: c.id, nombre: c.nombre, color: colorDe(c.id), monto: gastadoEn(c.id) })),
    { id: '__sin', nombre: 'Sin categoría', color: COLORS.lineStrong, monto: gastosVentana.filter((g) => !g.categoriaId).reduce((s, g) => s + g.montoArs, 0) },
  ].filter((s) => s.monto > 0).sort((a, b) => masReciente(a.id, b.id));
  // Lo apartado entra al anillo como su propia porción (lila): ni gastado ni
  // libre.
  const conApartado = conIngreso && apartadoAhora > 0;
  const baseAnillo = conIngreso ? Math.max(plataDelPeriodo, totalGastado + apartadoAhora) : totalGastado;
  const segmentosAnillo = [
    ...porSeccion.map((s) => ({ color: s.color, pct: baseAnillo > 0 ? (s.monto / baseAnillo) * 100 : 0 })),
    ...(conApartado ? [{ color: COLORS.lila, pct: (apartadoAhora / baseAnillo) * 100 }] : []),
    ...(conIngreso && disponibleVentana > 0 ? [{ color: COLORS.lima, pct: (disponibleVentana / baseAnillo) * 100 }] : []),
  ];
  const gastasteDeMas = conIngreso && totalGastado + apartadoAhora > plataDelPeriodo ? totalGastado + apartadoAhora - plataDelPeriodo : 0;

  // ── Por tipo. El "otro" se abre por lo que la persona escribió (Salud,
  // Mascota): cada texto es su propia fila. Los "otro" sin texto van juntos.
  // Primero el tipo del gasto más reciente.
  type FilaTipo = { clave: string; tipo: TipoGasto; label: string; monto: number; ultimo: number };
  const porTipo: FilaTipo[] = TIPOS.flatMap((t): FilaTipo[] => {
    const deEsteTipo = gastosVentana.filter((g) => g.tipo === t);
    if (t !== 'otro') {
      return [{ clave: t, tipo: t, label: TIPO_INFO[t].label, monto: deEsteTipo.reduce((s, g) => s + g.montoArs, 0), ultimo: Math.max(0, ...deEsteTipo.map((g) => g.ts)) }];
    }
    const grupos = new Map<string, { label: string; monto: number; ultimo: number }>();
    for (const g of deEsteTipo) {
      const label = g.tipoOtro?.trim() || TIPO_INFO.otro.label;
      const k = label.toLowerCase();
      const antes = grupos.get(k);
      grupos.set(k, { label: antes?.label ?? label, monto: (antes?.monto ?? 0) + g.montoArs, ultimo: Math.max(antes?.ultimo ?? 0, g.ts) });
    }
    return [...grupos.entries()].map(([k, v]) => ({ clave: `otro:${k}`, tipo: t, label: v.label, monto: v.monto, ultimo: v.ultimo }));
  }).filter((t) => t.monto > 0).sort((a, b) => b.ultimo - a.ultimo);

  // ── Tus secciones: las 5 con gastos más recientes en el período. Si hay
  // menos de 5 con gastos, se completan con las otras, así se les puede poner
  // tope. La que se abrió desde Inicio para ponerle tope se muestra aunque no
  // entre.
  const seccionesOrdenadas = [...categorias].sort((a, b) => masReciente(a.id, b.id));
  const seccionesVisibles = seccionesOrdenadas.slice(0, 5);
  const abiertaFuera = openCatId ? seccionesOrdenadas.slice(5).find((c) => c.id === openCatId) : undefined;
  if (abiertaFuera) seccionesVisibles.push(abiertaFuera);

  // ── Tus gastos: los 5 más recientes del período (el 1 de un mes nuevo la
  // lista arranca vacía). La lista completa está en Todos tus gastos.
  const ultimosGastos = [...gastosVentana].sort((a, b) => b.ts - a.ts).slice(0, 5);
  const ultimosIngresos = db.ingresos
    .filter((i) => i.ts >= desdeVentana && i.ts < hastaVentana)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);

  // ── Con qué pagaste en el período: cada medio con lo que salió de él. Un
  // gasto dividido suma a cada medio su parte. No es el dato principal: va abajo.
  // Primero el medio que se usó más recién.
  const porMedio = (() => {
    const m = new Map<string, number>();
    for (const g of gastosVentana) {
      if (g.pagos?.length) for (const p of g.pagos) m.set(p.medio, (m.get(p.medio) ?? 0) + p.monto);
      else m.set(g.metodoPago || 'Sin medio elegido', (m.get(g.metodoPago || 'Sin medio elegido') ?? 0) + g.montoArs);
    }
    const ultimo = ultimoGasto(gastosVentana, (g) => (g.pagos?.length ? g.pagos.map((p) => p.medio) : [g.metodoPago || 'Sin medio elegido']));
    return [...m.entries()].map(([nombre, monto]) => ({ nombre, monto })).filter((x) => x.monto > 0)
      .sort((a, b) => (ultimo.get(b.nombre) ?? 0) - (ultimo.get(a.nombre) ?? 0));
  })();
  const maxMedio = Math.max(1, ...porMedio.map((x) => x.monto));

  const mediosUsados = db.mediosPago.map((m) => m.nombre);
  const metodosOfrecidos = mediosUsados.length ? mediosUsados : METODOS_SUGERIDOS;
  const fuentesOtraRecientes = recientes(db.ingresos.map((i) => i.fuenteOtra));

  // Mover el período: hacia atrás sin límite, hacia adelante hasta el actual.
  function moverPeriodo(hacia: 'atras' | 'adelante') {
    if (hacia === 'adelante' && offsetVentana === 0) return;
    const delta = hacia === 'atras' ? 1 : -1;
    setDireccion(hacia);
    if (ventana === 'mes') setMesOffset((o) => o + delta);
    else setSemanaOffset((o) => o + delta);
  }
  // Deslizar el anillo de costado: hacia la derecha trae el período anterior,
  // como pasar la hoja de un calendario. Sólo cuenta si el gesto fue más
  // horizontal que vertical, para no robarle el scroll a la pantalla.
  const toqueRef = useRef<{ x: number; y: number } | null>(null);
  function alEmpezarToque(e: React.TouchEvent) {
    toqueRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function alTerminarToque(e: React.TouchEvent) {
    const inicio = toqueRef.current;
    toqueRef.current = null;
    if (!inicio) return;
    const dx = e.changedTouches[0].clientX - inicio.x;
    const dy = e.changedTouches[0].clientY - inicio.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    moverPeriodo(dx > 0 ? 'atras' : 'adelante');
  }

  // Desde "Tu paso de hoy" en Home:
  // · "Registrar un gasto" abre el formulario con el monto listo para escribir.
  //   No pasa por el "¿desde FINA o desde WhatsApp?": quien tocó "registrar"
  //   acá quiere cargarlo acá.
  // · "Poner un tope" abre la sección que nombra el paso, o la que más se llevó
  //   este mes, con el campo del tope listo.
  const pantallaRef = useRef<HTMLDivElement>(null);
  // Si el formulario se abrió al llegar desde Inicio, cancelarlo vuelve a
  // Inicio; si se abrió acá, se queda en Gastos.
  const volverAlOrigen = useVolverAlOrigen();
  const formDesdeOrigen = useRef(false);
  useAlLlegar('gasto', () => {
    formDesdeOrigen.current = true;
    setChooser(false);
    setRepeticionNueva(undefined);
    setAddingGasto(true);
  });
  function abrirFormulario(repeticion?: 'fijo' | 'recurrente') {
    setChooser(false);
    setAddingDisponible(false);
    setRepeticionNueva(repeticion);
    setAddingGasto(true);
  }
  // Desde el aviso de vencimiento o la tarjeta de Home. Sin gastos fijos
  // todavía (el paso "Anotá un gasto fijo"), abre el formulario para anotar uno.
  useAlLlegar('fijos', () => {
    if (db.gastosFijos.length === 0) { abrirFormulario('fijo'); return; }
    llevarA(() => pantallaRef.current?.querySelector<HTMLElement>('[data-gastos-fijos]'));
  });
  useAlLlegar('tope', ({ ref }) => {
    const pedida = categorias.find((c) => c.id === ref);
    const sinTope = categorias.filter((c) => !topes[c.id]);
    const candidatas = sinTope.length ? sinTope : categorias;
    const elegida = pedida ?? [...candidatas].sort((a, b) => gastadoEn(b.id) - gastadoEn(a.id))[0];
    if (!elegida) return;
    setVentana('mes');
    setMesOffset(0);
    setOpenCatId(elegida.id);
    llevarA(
      () => pantallaRef.current?.querySelector<HTMLElement>(`[data-seccion="${elegida.id}"]`),
      () => pantallaRef.current?.querySelector<HTMLElement>(`[data-tope-de="${elegida.id}"]`),
    );
  });

  function cerrarFormGasto() {
    const volver = formDesdeOrigen.current ? volverAlOrigen : null;
    formDesdeOrigen.current = false;
    setAddingGasto(false);
    volver?.();
  }

  function cerrarIngreso() {
    setAddDispVal('');
    setAddDispMetodo(null);
    setAddDispMetodoOtro('');
    setAddDispFuente('');
    setAddDispFuenteOtra('');
    setAddingDisponible(false);
  }

  function agregarDinero() {
    const n = parseMoneyInput(addDispVal);
    if (!n) return;
    const metodo = (addDispMetodo === 'otro' ? addDispMetodoOtro.trim() : addDispMetodo) || '';
    // El medio usado sube al principio de la lista: al registrar un gasto se
    // ofrecen los más recientes primero.
    void acciones.registrarIngreso({ monto: n, moneda: 'ARS', fuente: addDispFuente || null, fuenteOtra: addDispFuenteOtra, medio: metodo });
    cerrarIngreso();
  }

  return (
    <div ref={pantallaRef} className="px-[22px] pt-4 flex flex-col gap-4 pb-4 lg:max-w-2xl lg:mx-auto lg:pt-6">
      {/* Sin Fini: esta pantalla está llena de números y el personaje no va
          cerca de datos (§6). */}
      <header data-franja>
        <Titulo>Mis gastos</Titulo>
      </header>

      {/* Lo primero que se elige: mirar por mes o por semana. Va en su propia
          fila, afuera del título y del anillo; todo lo de abajo sigue esta
          elección. */}
      <SegmentedTab
        options={[{ id: 'mes' as Periodo, label: 'Por mes' }, { id: 'semana' as Periodo, label: 'Por semana' }]}
        value={ventana}
        onChange={(v) => { setVentana(v); setMesOffset(0); setSemanaOffset(0); setDireccion(null); }}
        trackColor={COLORS.tint}
      />

      {/* EL dato de la pantalla (§3.5). Con lo que te entró registrado: de esa
          plata, cuánto se fue en cada sección y cuánto te queda (en lima, que
          es el valor). Sin entradas: sólo cómo se reparten tus gastos. Es la
          única tarjeta elevada. Se pasa al período anterior con las flechas de
          los costados o deslizando el anillo; el período va chiquito en la
          esquina, para ubicarse. */}
      <section
        aria-label={conIngreso ? `${teQueda}, ${textoPeriodo}` : `Tus gastos, ${textoPeriodo}`}
        className="rounded-2xl px-3 pt-3 pb-5 flex flex-col gap-3"
        style={CARD_ELEVADA}
        onTouchStart={alEmpezarToque}
        onTouchEnd={alTerminarToque}
      >
        <p className="px-2 text-[13px] font-semibold" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }} aria-live="polite">
          {etiquetaVentana}
        </p>
        {/* La key cambia con el período: así el contenido vuelve a entrar,
            desde el lado hacia el que se movió. */}
        <div
          key={`${ventana}-${offsetVentana}`}
          className={`flex flex-col gap-4 ${direccion === 'atras' ? 'v2-entra-izq' : direccion === 'adelante' ? 'v2-entra-der' : ''}`}
        >
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => moverPeriodo('atras')}
              aria-label={ventana === 'mes' ? 'Ver mes anterior' : 'Ver semana anterior'}
              className="v2-focus w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
              style={{ color: COLORS.inkSoft }}
            >
              <IconChevron size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <Donut
              size={132}
              segments={segmentosAnillo}
              centerLabel={conIngreso ? teQueda : 'Gastaste'}
              centerValue={fmtMoney(conIngreso ? disponibleVentana : totalGastado)}
            />
            {/* En el período actual no hay siguiente: la flecha queda tenue
                pero ocupa su lugar, así el anillo no se corre. */}
            <button
              type="button"
              onClick={() => moverPeriodo('adelante')}
              disabled={offsetVentana === 0}
              aria-label={ventana === 'mes' ? 'Ver mes siguiente' : 'Ver semana siguiente'}
              className="v2-focus w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
              style={{ color: COLORS.inkSoft, opacity: offsetVentana === 0 ? 0.3 : 1, cursor: offsetVentana === 0 ? 'default' : 'pointer' }}
            >
              <IconChevron size={18} />
            </button>
          </div>

          {/* Abajo del anillo van sólo las referencias: el monto ya está en el
              centro. Primero lo disponible y el total gastado, después las 3
              secciones con gastos más recientes y lo apartado. El resto de las
              secciones está en Tus categorías, más abajo. */}
          {(porSeccion.length > 0 || conIngreso) && (
            <ul className="px-2 flex flex-col gap-1.5">
              {conIngreso && (
                <li className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS.lima }} aria-hidden />
                  <span className="flex-1 min-w-0" style={{ color: COLORS.limaText }}>{teQueda}</span>
                  <Monto value={disponibleVentana} className="text-[13px] font-semibold" />
                </li>
              )}
              {/* La suma de las secciones de abajo, con punto en tinta: los
                  gastos son neutrales. Sin ingresos no va: el centro del
                  anillo ya dice cuánto gastaste. */}
              {conIngreso && (
                <li className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS.ink }} aria-hidden />
                  <span className="flex-1 min-w-0" style={{ color: COLORS.ink }}>Total gastado</span>
                  <Monto value={totalGastado} className="text-[13px] font-semibold" />
                </li>
              )}
              {porSeccion.slice(0, 3).map((s) => (
                <li key={s.id} className="flex items-center gap-2.5 text-[13px]">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} aria-hidden />
                  <span className="flex-1 min-w-0 truncate" style={{ color: COLORS.ink }}>{s.nombre}</span>
                  <Monto value={s.monto} className="text-[13px] font-semibold" />
                </li>
              ))}
              {/* Lleva a Tus categorías, más abajo en esta pantalla, donde está
                  el resto. El área para tocar mide 44px sin agrandar la lista. */}
              {porSeccion.length > 3 && (
                <li className="pl-[22px]">
                  <button
                    type="button"
                    onClick={() => llevarA(
                      () => pantallaRef.current?.querySelector<HTMLElement>('[data-tus-categorias]'),
                      () => pantallaRef.current?.querySelector<HTMLElement>('[data-tus-categorias]'),
                      'start',
                    )}
                    className="v2-focus inline-flex items-center min-h-[44px] -my-3 text-[13px] font-semibold underline text-left rounded-lg"
                    style={{ color: COLORS.brand }}
                  >
                    Y {porSeccion.length - 3} {porSeccion.length - 3 === 1 ? 'categoría más' : 'categorías más'}
                  </button>
                </li>
              )}
              {conApartado && (
                <li>
                  {/* Lo apartado lleva a Mis planes, donde está para qué es. */}
                  <button type="button" onClick={() => navigate('/onboarding-v2/objetivos')} className="v2-focus w-full flex items-center gap-2.5 text-[13px] text-left rounded-lg">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS.lila }} aria-hidden />
                    <span className="flex-1 min-w-0 truncate" style={{ color: COLORS.ink }}>Apartado para tus planes</span>
                    <Monto value={apartadoAhora} className="text-[13px] font-semibold" />
                  </button>
                </li>
              )}
            </ul>
          )}

          {gastasteDeMas > 0 && (
            <p className="px-2 text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>
              {apartadoAhora > 0
                ? <>Gastos y apartado superan en <span className="font-mono tabular-nums">{fmtMoney(gastasteDeMas)}</span> lo que registraste</>
                : <>Tus gastos superan en <span className="font-mono tabular-nums">{fmtMoney(gastasteDeMas)}</span> lo que registraste</>}
            </p>
          )}
          {!conIngreso && totalGastado > 0 && (
            <button
              type="button"
              onClick={() => { setAddingDisponible(true); setAddingGasto(false); }}
              className="v2-focus self-center min-h-[44px] text-[13px] font-semibold"
              style={{ color: COLORS.brand }}
            >
              Agregá tus ingresos para ver lo que te queda disponible
            </button>
          )}
          {!conIngreso && totalGastado === 0 && (
            <p className="px-2 text-[13px] leading-snug text-center" style={{ color: COLORS.inkSoft }}>
              {periodoCerrado
                ? `No registraste ingresos ni gastos ${referenciaPeriodo}.`
                : 'Registrá ingresos y gastos para ver tu disponible.'}
            </p>
          )}
        </div>
      </section>

      {/* Agregar gasto y agregar ingreso: las dos acciones que se hacen todo
          el tiempo, lado a lado y con el mismo peso. El de ingreso va en un
          violeta más claro para que se lean como dos acciones distintas. */}
      <div className="flex flex-col gap-3">
        {/* Los dos formularios se abren aparte, en una hoja (CLAUDE.md regla
            12): los botones quedan siempre a la vista. */}
        <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setChooser(true)}
              className="v2-focus flex-1 rounded-2xl py-4 text-[14px] font-bold select-none transition-all duration-100 ease-out active:scale-[0.98]"
              style={{ background: COLORS.brand, color: COLORS.surface }}
            >
              + Agregar gasto
            </button>
            <button
              type="button"
              onClick={() => setAddingDisponible(true)}
              className="v2-focus flex-1 rounded-2xl py-4 text-[14px] font-bold select-none transition-all duration-100 ease-out active:scale-[0.98]"
              style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}
            >
              + Agregar ingreso
            </button>
          </div>
          {/* Gastos de antes (una planilla, notas, una captura o un PDF): se
              revisan antes de guardarlos y no mueven saldos. */}
          <button
            type="button"
            onClick={() => setImportando(true)}
            className="v2-focus self-center min-h-[44px] text-[13px] font-semibold"
            style={{ color: COLORS.brand }}
          >
            Importar gastos anteriores
          </button>
          {importando && <ImportarGastos onCerrar={() => setImportando(false)} />}

        {addingDisponible && (
          <Hoja titulo="Nuevo ingreso" onCerrar={cerrarIngreso}>
          <div ref={faltaIngreso.ref} className="flex flex-col gap-2 pt-1">
            <input
              autoFocus
              data-campo="monto"
              aria-label="Monto que te entró"
              aria-invalid={faltaIngreso.marcado('monto') || undefined}
              className="v2-focus w-full rounded-xl px-3 min-h-[44px] text-[14px] transition-colors"
              style={{ ...INPUT_STYLE, ...(faltaIngreso.marcado('monto') ? { border: BORDE_FALTA } : {}) }}
              placeholder="Monto"
              inputMode="decimal"
              value={addDispVal}
              onChange={(e) => setAddDispVal(formatThousands(e.target.value))}
            />
            {faltaIngreso.marcado('monto') && <TextoFalta>Falta el monto.</TextoFalta>}
            <select
              aria-label="De dónde vino la plata"
              value={addDispFuente}
              onChange={(e) => setAddDispFuente(e.target.value as FuenteIngreso | '')}
              className="v2-focus w-full rounded-xl px-3 min-h-[44px] text-[14px]"
              style={{ ...INPUT_STYLE, color: addDispFuente ? COLORS.ink : COLORS.inkFaint }}
            >
              <option value="" style={{ color: COLORS.ink }}>¿De dónde vino? (opcional)</option>
              {FUENTES_INGRESO.map((f) => <option key={f.id} value={f.id} style={{ color: COLORS.ink }}>{f.label}</option>)}
            </select>
            {addDispFuente === 'otro' && (
              <div className="flex flex-col gap-2">
                <input
                  autoFocus
                  aria-label="De dónde vino la plata, cuál"
                  maxLength={40}
                  className="v2-focus w-full rounded-xl px-3 min-h-[44px] text-[14px] transition-colors"
                  style={INPUT_STYLE}
                  placeholder="Escribí de dónde (ej: Beca, Alquiler)"
                  value={addDispFuenteOtra}
                  onChange={(e) => setAddDispFuenteOtra(e.target.value)}
                />
                {fuentesOtraRecientes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Los que escribiste antes">
                    {fuentesOtraRecientes.map((t) => {
                      const sel = addDispFuenteOtra.trim().toLowerCase() === t.toLowerCase();
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={sel}
                          onClick={() => setAddDispFuenteOtra(t)}
                          className="v2-focus rounded-lg px-2.5 py-1 text-[13px] font-semibold transition-all duration-100 active:scale-95"
                          style={sel
                            ? { background: COLORS.brandSoft, color: COLORS.brandDark }
                            : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* Se pregunta el medio acá para que después, al registrar un
                gasto, se puedan ofrecer los que de verdad tenés. */}
            <p className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>¿Dónde entró?</p>
            <div className="flex flex-wrap gap-1.5">
              {metodosOfrecidos.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAddDispMetodo(m)}
                  className="v2-focus rounded-lg px-2.5 py-1 min-h-[36px] text-[13px] font-semibold transition-all duration-100 active:scale-95"
                  style={addDispMetodo === m
                    ? { background: COLORS.brand, color: COLORS.surface }
                    : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                >
                  {m}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAddDispMetodo('otro')}
                className="v2-focus rounded-lg px-2.5 py-1 min-h-[36px] text-[13px] font-semibold border border-dashed transition-all duration-100 active:scale-95"
                style={{ background: addDispMetodo === 'otro' ? COLORS.brandSoft : COLORS.surface, color: addDispMetodo === 'otro' ? COLORS.brandDark : COLORS.ink, borderColor: COLORS.lineStrong }}
              >
                + Otro
              </button>
            </div>
            {addDispMetodo === 'otro' && (
              <input
                autoFocus
                aria-label="En qué tenés esa plata"
                className="v2-focus w-full rounded-xl px-3 min-h-[44px] text-[14px] transition-colors"
                style={INPUT_STYLE}
                placeholder="Ej: Ualá"
                value={addDispMetodoOtro}
                onChange={(e) => setAddDispMetodoOtro(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={cerrarIngreso} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}>
                Cancelar
              </button>
              <button type="button" onClick={() => faltaIngreso.intentar(agregarDinero)} className="v2-focus flex-[2] rounded-xl min-h-[44px] text-[13px] font-bold transition-all duration-100 active:scale-95" style={{ background: COLORS.brand, color: COLORS.surface }}>
                Agregar ingreso
              </button>
            </div>
          </div>
          </Hoja>
        )}

        {/* Registrar un gasto se abre aparte, en una hoja encima de la
            pantalla: mezclado con el resto de Gastos no se distinguía dónde
            terminaba el formulario. */}
        {addingGasto && (
          <Hoja titulo={repeticionNueva === 'fijo' ? 'Nuevo gasto fijo' : repeticionNueva === 'recurrente' ? 'Nuevo gasto recurrente' : 'Nuevo gasto'} onCerrar={cerrarFormGasto}>
            <FormularioGasto
              repeticion={repeticionNueva}
              categorias={categorias}
              onListo={() => { formDesdeOrigen.current = false; setAddingGasto(false); }}
              onCancelar={cerrarFormGasto}
            />
          </Hoja>
        )}
      </div>

      {/* Tus gastos: los 5 más recientes, cada uno con su sección. Editar abre
          el formulario en una hoja aparte. La lista completa, con buscador y
          filtros, está en Todos tus gastos. */}
      <section className="flex flex-col gap-1" aria-label="Últimos gastos">
        <TituloSeccion>Últimos gastos</TituloSeccion>
        {gastos.length === 0 && <p className="py-2 text-[13px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste gastos.</p>}
        {gastos.length > 0 && ultimosGastos.length === 0 && (
          <p className="py-2 text-[13px]" style={{ color: COLORS.inkSoft }}>No hay gastos {referenciaPeriodo}.</p>
        )}
        <div className="flex flex-col">
          {ultimosGastos.map((g) => (
            <FilaGasto
              key={g.id}
              gasto={g}
              categorias={categorias}
              abierto={gastoAbierto?.id === g.id ? gastoAbierto.que : null}
              onAbrir={(que) => setGastoAbierto(que ? { id: g.id, que } : null)}
            />
          ))}
        </div>
        {gastos.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/onboarding-v2/gastos/todos')}
            className="v2-focus self-start min-h-[44px] text-[13px] font-semibold underline"
            style={{ color: COLORS.brand }}
          >
            Ver todos
          </button>
        )}
      </section>

      {/* Tus secciones: las 5 con gastos más recientes, con su total y su tope.
          Renombrar y borrar están en Tus secciones, la pantalla completa. */}
      <section data-tus-categorias tabIndex={-1} className="flex flex-col gap-1 scroll-mt-4" aria-label="Tus categorías">
        <TituloSeccion>Tus categorías</TituloSeccion>
        {categorias.length === 0 ? (
          // Vidriera vacía (§10): promesa, no falla. Único lugar de esta
          // pantalla donde Fini puede aparecer (§6).
          <div className="py-4 flex flex-col items-center text-center gap-3">
            <Fini state="vacio" size={104} />
            <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>
              Registrá un gasto y su categoría aparece acá para ponerle un tope.
            </p>
            <EstadoConfianza estado="por-descubrir" />
          </div>
        ) : (
          <>
            <div className="flex flex-col">
              {seccionesVisibles.map((c) => (
                <FilaSeccion
                  key={c.id}
                  cat={c}
                  color={colorDe(c.id)}
                  gastado={gastadoEn(c.id)}
                  referencia={referenciaPeriodo}
                  tope={topes[c.id]}
                  cantGastos={gastos.filter((g) => g.categoriaId === c.id).length}
                  abierta={openCatId === c.id}
                  onAbrir={(abrir) => setOpenCatId(abrir ? c.id : null)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate('/onboarding-v2/gastos/secciones')}
              className="v2-focus self-start min-h-[44px] text-[13px] font-semibold underline"
              style={{ color: COLORS.brand }}
            >
              Ver todas
            </button>
          </>
        )}
      </section>

      {/* Los gastos recurrentes: lo que se gasta seguido, para registrarlo con
          un toque. */}
      <ListaRecurrentes categorias={categorias} onAgregar={() => abrirFormulario('recurrente')} />

      {/* Los gastos fijos: lo que pagás siempre, con su próximo vencimiento y
          "Ya lo pagué". */}
      <ListaGastosFijos onAgregar={() => abrirFormulario('fijo')} />

      {/* Por tipo: sólo la pregunta y cuánto fue de cada uno en el período. */}
      {porTipo.length > 0 && (
        <section className="flex flex-col gap-1" aria-label="Por tipo de gasto">
          <TituloSeccion>Por tipo de gasto</TituloSeccion>
          <ul className="flex flex-col">
            {porTipo.map((t) => (
              <li key={t.clave} className="flex items-center gap-2.5 py-2 border-b last:border-b-0 text-[13px]" style={{ borderColor: COLORS.line }}>
                <span className="flex-1 min-w-0 truncate" style={{ color: COLORS.ink }}>{t.label}</span>
                <Monto value={t.monto} className="text-[13px] font-semibold" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tus ingresos: los 5 más recientes del período, igual que los gastos.
          La lista completa está en Todos tus ingresos. */}
      <section className="flex flex-col gap-1" aria-label="Últimos ingresos">
        <TituloSeccion>Últimos ingresos</TituloSeccion>
        {db.ingresos.length === 0 && <p className="py-2 text-[13px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste ingresos.</p>}
        {db.ingresos.length > 0 && ultimosIngresos.length === 0 && (
          <p className="py-2 text-[13px]" style={{ color: COLORS.inkSoft }}>No hay ingresos {referenciaPeriodo}.</p>
        )}
        <div className="flex flex-col">
          {ultimosIngresos.map((i) => (
            <FilaIngreso
              key={i.id}
              ingreso={i}
              abierto={ingresoBorrando === i.id}
              onAbrir={() => setIngresoBorrando(ingresoBorrando === i.id ? null : i.id)}
              onCerrar={() => setIngresoBorrando(null)}
            />
          ))}
        </div>
        {db.ingresos.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/onboarding-v2/gastos/ingresos')}
            className="v2-focus self-start min-h-[44px] text-[13px] font-semibold underline"
            style={{ color: COLORS.brand }}
          >
            Ver todos
          </button>
        )}
      </section>

      {/* Con qué pagaste en el período. Una sola serie (cuánto salió de cada
          medio), así que un solo color; el monto en tinta. */}
      {porMedio.length > 0 && (
        <section className="flex flex-col gap-2.5" aria-label="Medios de pago">
          <TituloSeccion>Medios de pago {referenciaPeriodo}</TituloSeccion>
          {porMedio.map((x) => (
            <div key={x.nombre} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] truncate" style={{ color: COLORS.ink }}>{x.nombre}</span>
                <Monto value={x.monto} className="text-[13px] font-semibold shrink-0" />
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
                <div className="h-full rounded-full" style={{ width: `${(x.monto / maxMedio) * 100}%`, background: COLORS.brand }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Popup: ¿gasto diario o gasto fijo? Scrim = velo de tinta translúcido. */}
      {chooser && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(43,33,24,0.45)' }}
          onClick={() => setChooser(false)}
        >
          <div className="w-full max-w-md rounded-2xl p-5 flex flex-col gap-3" style={{ background: COLORS.surface, boxShadow: '0 12px 40px -8px rgba(43,33,24,0.35)' }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[17px] font-bold" style={{ color: COLORS.ink }}>¿Qué gasto querés registrar?</p>
            {([
              { modo: 'diario', titulo: 'Gasto diario', ejemplo: 'El súper, un café, un viaje.' },
              { modo: 'fijo', titulo: 'Gasto fijo', ejemplo: 'El alquiler, el gimnasio, una suscripción.' },
            ] as const).map((o) => (
              <button
                key={o.modo}
                type="button"
                onClick={() => abrirFormulario(o.modo === 'fijo' ? 'fijo' : undefined)}
                className="v2-focus text-left rounded-2xl p-4 flex items-start gap-3 border transition-transform active:scale-[0.99]"
                style={{ borderColor: COLORS.line }}
              >
                <span className="shrink-0" style={{ color: COLORS.brand }}>{o.modo === 'fijo' ? <IconCalendario size={22} /> : <IconEditar size={22} />}</span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-bold" style={{ color: COLORS.ink }}>{o.titulo}</span>
                  <span className="text-[13px]" style={{ color: COLORS.inkSoft }}>{o.ejemplo}</span>
                </span>
              </button>
            ))}
            {/* WhatsApp sigue siendo lo más cómodo para anotar: se recuerda, sin
                ser un paso más. El enlace abre el chat (y avisa si falta
                verificar el teléfono). */}
            <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>
              Recordá que podés registrar gastos por{' '}
              <LinkWhatsApp onClick={() => setChooser(false)} className="v2-focus font-semibold underline" style={{ color: COLORS.brand }}>WhatsApp</LinkWhatsApp>.
            </p>
            <button type="button" onClick={() => setChooser(false)} className="v2-focus text-[13px] font-semibold py-1 min-h-[44px]" style={{ color: COLORS.inkSoft }}>Cancelar</button>
          </div>
        </div>
      )}

    </div>
  );
}
