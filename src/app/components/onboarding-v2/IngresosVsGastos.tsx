import { useState } from 'react';
import { COLORS, FONTS, fmtMoney } from './shared';
import { IconBasura, IconEditar } from './FinaIcons';
import { EditorIngreso } from './EditorIngreso';
import { VerTodos, recortar } from './VerTodos';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { diaArgentina } from '../../api/v2/pasos';
import { FUENTES_INGRESO, type Ingreso } from '../../api/v2/tipos';

// Lo que entra contra lo que sale, por mes.
//
// Arriba, el mes elegido (por defecto el actual): cuánto entró, cuánto salió y
// cuánto quedó. Abajo, los últimos 6 meses con una barra de ingresos y una de
// gastos por mes; tocar un mes lo elige.
//
// COLOR. Dos series, validadas con el script de dataviz (ΔE 29 para
// daltonismo deuteranope, 37 para visión normal, las dos con más de 3:1 contra
// la tarjeta): ingresos en el verde de datos (limaViz), gastos en el violeta de
// marca. Ninguna en color de alerta: un mes en el que salió más de lo que entró
// se muestra con el dato, no con rojo (regla 3). Los montos van en tinta.
//
// CONFIANZA. Es lo que la persona registró, no su plata real: si anota todos
// los gastos y ningún ingreso, el gráfico diría que gasta más de lo que gana.
// Por eso se marca como declarado y, si en un mes hay gastos sin ingresos, se
// invita a cargarlos en vez de mostrar "salió más de lo que entró".

const INGRESO = COLORS.limaViz;
const GASTO = COLORS.brand;

const mesDe = (ts: number) => diaArgentina(ts).slice(0, 7);

function ultimosMeses(n: number): string[] {
  const [a, m] = diaArgentina().slice(0, 7).split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** La clave 'YYYY-MM' del mes de hace `n` meses (0 = el actual). */
export function mesAtras(n: number): string {
  return ultimosMeses(n + 1)[0];
}

const nombreMes = (clave: string, largo = false) =>
  new Date(`${clave}-15T12:00:00Z`).toLocaleDateString('es-AR', { month: largo ? 'long' : 'short', timeZone: 'UTC' }).replace('.', '');

// Dos formas, según dónde se use:
//
// · Fijo (por defecto, la pantalla de Gastos): no se toca. Marca el mes que la
//   pantalla está mirando (`mesElegido`, el de las flechas de la torta; si no
//   se pasa, el actual) y atenúa los demás, y muestra sólo "Entró" y "Salió".
//   Antes cada mes era un botón: un toque sin querer te movía a otro mes sin
//   que la pantalla cambiara con él.
// · `explorar` (Home): cada mes se puede tocar para ver sus números, y se dice
//   cuánto te quedó o por cuánto te pasaste. Es un gráfico para recorrer, no
//   donde estás parada.
type Semana = {
  /** Lunes de la semana que se mira, 'YYYY-MM-DD' en Argentina. */
  lunes: string;
  /** "Esta semana", "Semana pasada" o el rango ("10 – 16 sep"). */
  etiqueta: string;
  /** Si es la semana en curso. */
  actual: boolean;
};

/** El lunes de la semana de hace `n` semanas (0 = la actual), 'YYYY-MM-DD' en Argentina. */
export function lunesAtras(n: number): string {
  const d = new Date(`${diaArgentina()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7 * n);
  return d.toISOString().slice(0, 10);
}

const DIAS_CORTOS = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

type Columna = { clave: string; etiqueta: string; aria: string; entro: number; salio: number; sel: boolean };

// Tres formas, según dónde se use:
//
// · Fijo por meses (por defecto, Gastos con "Este mes"): no se toca. Marca el
//   mes que la pantalla está mirando (`mesElegido`, el de las flechas de la
//   torta; si no se pasa, el actual) y atenúa los demás, y muestra sólo
//   "Entró" y "Salió". Antes cada mes era un botón: un toque sin querer te
//   movía a otro mes sin que la pantalla cambiara con él.
// · Fijo por días (`semana`, Gastos con "Esta semana"): los siete días de la
//   semana que se mira, de lunes a domingo. La semana la eligen las flechas de
//   la pantalla, igual que el mes: el gráfico sólo la muestra.
// · `explorar` (Home): cada mes se puede tocar para ver sus números, y se dice
//   cuánto te quedó o por cuánto te pasaste. Es un gráfico para recorrer, no
//   donde estás parada.
export function IngresosVsGastos({ conLista = false, explorar = false, mesElegido, semana }: {
  conLista?: boolean; explorar?: boolean; mesElegido?: string; semana?: Semana;
}) {
  const { estado } = useAlmacen();
  // De los últimos 6 meses, desde el primero que tiene algo cargado: los meses
  // de antes de empezar a usar FINA no dicen nada y achicaban las columnas.
  // El actual queda siempre, aunque esté vacío.
  const seisMeses = ultimosMeses(6);
  const conDatos = (mes: string) =>
    estado.ingresos.some((i) => mesDe(i.ts) === mes) || estado.gastos.some((g) => mesDe(g.ts) === mes);
  const primero = seisMeses.findIndex(conDatos);
  const meses = seisMeses.slice(primero === -1 ? seisMeses.length - 1 : primero);
  const mesActual = meses[meses.length - 1];
  const [tocado, setTocado] = useState(mesActual);
  const elegido = explorar ? tocado : (mesElegido ?? mesActual);
  const esEsteMes = elegido === mesActual;
  const [borrando, setBorrando] = useState<string | null>(null);
  // La lista de ingresos (sólo en Gastos) muestra los primeros y "Ver todos".
  const [verTodosIngresos, setVerTodosIngresos] = useState(false);

  const modoSemana = !!semana;
  const dias = semana
    ? Array.from({ length: 7 }, (_, k) => {
      const d = new Date(`${semana.lunes}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + k);
      return d.toISOString().slice(0, 10);
    })
    : [];

  const columnas: Columna[] = modoSemana
    ? dias.map((dia) => {
      const dow = new Date(`${dia}T12:00:00Z`).getUTCDay();
      const entro = estado.ingresos.filter((i) => diaArgentina(i.ts) === dia).reduce((t, i) => t + i.montoArs, 0);
      const salio = estado.gastos.filter((g) => diaArgentina(g.ts) === dia).reduce((t, g) => t + g.montoArs, 0);
      return {
        clave: dia, etiqueta: DIAS_CORTOS[dow], entro, salio, sel: true,
        aria: `${DIAS_LARGOS[dow]} ${Number(dia.slice(8))}: entró ${fmtMoney(entro)}, salió ${fmtMoney(salio)}`,
      };
    })
    : meses.map((mes) => {
      const entro = estado.ingresos.filter((i) => mesDe(i.ts) === mes).reduce((t, i) => t + i.montoArs, 0);
      const salio = estado.gastos.filter((g) => mesDe(g.ts) === mes).reduce((t, g) => t + g.montoArs, 0);
      return {
        clave: mes, etiqueta: nombreMes(mes), entro, salio, sel: mes === elegido,
        aria: `${mes === mesActual ? 'Este mes' : nombreMes(mes, true)}: entró ${fmtMoney(entro)}, salió ${fmtMoney(salio)}`,
      };
    });

  // Los números de arriba salen directo de los datos y no de las columnas: en
  // meses el que se mira puede ser más viejo que los 6 que dibuja el gráfico.
  const actual = modoSemana
    ? { entro: columnas.reduce((t, c) => t + c.entro, 0), salio: columnas.reduce((t, c) => t + c.salio, 0) }
    : {
      entro: estado.ingresos.filter((i) => mesDe(i.ts) === elegido).reduce((t, i) => t + i.montoArs, 0),
      salio: estado.gastos.filter((g) => mesDe(g.ts) === elegido).reduce((t, g) => t + g.montoArs, 0),
    };
  const tope = Math.max(1, ...columnas.map((c) => Math.max(c.entro, c.salio)));
  // En meses, "nada registrado" mira los 6 que dibuja. En semanas se mira todo:
  // una semana vacía igual se dibuja (plana), para poder seguir yendo hacia atrás.
  const nadaRegistrado = modoSemana
    ? estado.ingresos.length === 0 && estado.gastos.length === 0
    : columnas.every((c) => c.entro === 0 && c.salio === 0);
  const quedo = actual.entro - actual.salio;

  const ingresosLista = modoSemana
    ? estado.ingresos.filter((i) => dias.includes(diaArgentina(i.ts)))
    : estado.ingresos.filter((i) => mesDe(i.ts) === elegido);
  const tituloPeriodo = modoSemana ? semana.etiqueta : esEsteMes ? 'Este mes' : nombreMes(elegido, true);
  const esteTexto = modoSemana ? (semana.actual ? 'esta semana' : 'esa semana') : esEsteMes ? 'este mes' : 'ese mes';
  // Los meses no llevan ancho mínimo: con 6 columnas de 44px el gráfico medía
  // más que la tarjeta en un celular de 360px y se salía de la pantalla.
  const anchoColumna = modoSemana ? 'min-w-[34px]' : 'min-w-0';

  if (nadaRegistrado) {
    return (
      <p className="text-[15px] leading-snug pl-3.5 border-l-2 py-1" style={{ color: COLORS.inkSoft, borderColor: COLORS.brandSoft }}>
        Cuando registres lo que te entra y lo que gastás, acá vas a ver cuánto entra y cuánto sale cada {modoSemana ? 'día' : 'mes'}{explorar ? ', y cuánto te queda' : ''}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* El período elegido, en números. */}
      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>
          {tituloPeriodo}
        </p>
        <div className={`grid gap-2 ${explorar ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <Cifra color={INGRESO} etiqueta="Entró" valor={actual.entro} />
          <Cifra color={GASTO} etiqueta="Salió" valor={actual.salio} />
          {/* Sólo cuando hay ingresos cargados: sin ellos "te quedó" sería
              "menos lo que gastaste", que no es verdad. En tinta, nunca en
              alerta: pasarse no es un error (regla 3). */}
          {explorar && actual.entro > 0 && (
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px]" style={{ color: COLORS.inkSoft }}>{quedo >= 0 ? 'Te quedó' : 'Salió de más'}</span>
              <span className="text-[17px] font-bold font-mono tabular-nums truncate" style={{ color: COLORS.ink }}>{fmtMoney(Math.abs(quedo))}</span>
            </div>
          )}
        </div>
        {actual.entro === 0 && actual.salio > 0 && (
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            Registraste gastos {esteTexto}, pero no ingresos.{' '}
            {explorar ? 'Si los cargás, se ve cuánto te queda.' : 'Si los cargás, se ve cuánto entró.'}
          </p>
        )}
      </div>

      {/* Los últimos 6 meses, o los 7 días de la semana. En Gastos, sólo para
          mirar (en meses, el que se mira marcado y el resto atenuado); en Home,
          cada mes es un botón para elegirlo. */}
      <div className="flex flex-col gap-1.5">
        <div
          className="flex items-end gap-1"
          style={{ height: 124 }}
          role="group"
          aria-label={modoSemana ? `Ingresos y gastos de cada día: ${semana.etiqueta}` : 'Ingresos y gastos por mes'}
        >
          {columnas.map((c) => {
            const barras = (
              <>
                <Barra valor={c.entro} tope={tope} color={INGRESO} />
                <Barra valor={c.salio} tope={tope} color={GASTO} />
              </>
            );
            return explorar ? (
              <button
                key={c.clave}
                type="button"
                onClick={() => setTocado(c.clave)}
                aria-pressed={c.sel}
                aria-label={c.aria}
                className={`v2-focus flex-1 ${anchoColumna} h-full flex items-end justify-center gap-[2px] rounded-lg transition-opacity`}
                style={{ opacity: c.sel ? 1 : 0.45 }}
              >
                {barras}
              </button>
            ) : (
              <div
                key={c.clave}
                role="img"
                aria-label={c.aria}
                className={`flex-1 ${anchoColumna} h-full flex items-end justify-center gap-[2px] rounded-lg`}
                style={{ opacity: c.sel ? 1 : 0.4 }}
              >
                {barras}
              </div>
            );
          })}
        </div>
        <div className="flex gap-1">
          {columnas.map((c) => (
            <span
              key={c.clave}
              className={`flex-1 ${anchoColumna} text-center text-[12px]`}
              style={{ color: c.sel ? COLORS.ink : COLORS.inkFaint, fontFamily: FONTS.mono, fontWeight: c.sel && !modoSemana ? 700 : 400 }}
            >
              {c.etiqueta}
            </span>
          ))}
        </div>
        {/* Con días, el número del día va abajo: "lu" solo no dice cuál lunes. */}
        {modoSemana && (
          <div className="flex gap-1" aria-hidden>
            {dias.map((d) => (
              <span key={d} className={`flex-1 ${anchoColumna} text-center text-[11px]`} style={{ color: COLORS.inkFaint, fontFamily: FONTS.mono }}>
                {Number(d.slice(8))}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Leyenda: el color no es lo único que dice qué es cada barra. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Leyenda color={INGRESO} texto="Entró" />
        <Leyenda color={GASTO} texto="Salió" />
        <span className="text-[13px]" style={{ color: COLORS.inkFaint }}>Según lo que registraste</span>
      </div>

      {conLista && (
        <div className="flex flex-col pt-1">
          <p className="text-[16px] font-bold" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>
            {modoSemana ? `Ingresos de ${semana.actual ? 'esta semana' : semana.etiqueta === 'Semana pasada' ? 'la semana pasada' : `la semana del ${semana.etiqueta}`}` : `Ingresos de ${esEsteMes ? 'este mes' : nombreMes(elegido, true)}`}
          </p>
          {ingresosLista.length === 0 && (
            <p className="text-[14px] py-2" style={{ color: COLORS.inkSoft }}>No hay ingresos registrados.</p>
          )}
          {recortar(ingresosLista, verTodosIngresos).map((i) => (
            <FilaIngreso key={i.id} ingreso={i} abierto={borrando === i.id} onAbrir={() => setBorrando(borrando === i.id ? null : i.id)} onCerrar={() => setBorrando(null)} />
          ))}
          <VerTodos total={ingresosLista.length} abierta={verTodosIngresos} onToggle={() => setVerTodosIngresos((v) => !v)} />
        </div>
      )}
    </div>
  );
}

function Cifra({ color, etiqueta, valor }: { color: string; etiqueta: string; valor: number }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="flex items-center gap-1.5 text-[13px]" style={{ color: COLORS.inkSoft }}>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} aria-hidden />
        {etiqueta}
      </span>
      <span className="text-[17px] font-bold font-mono tabular-nums truncate" style={{ color: COLORS.ink }}>{fmtMoney(valor)}</span>
    </div>
  );
}

function Barra({ valor, tope, color }: { valor: number; tope: number; color: string }) {
  return (
    <span
      className="w-[42%] max-w-[16px] rounded-t-[4px]"
      style={{ height: `${Math.max((valor / tope) * 100, valor > 0 ? 3 : 1)}%`, background: valor > 0 ? color : COLORS.line }}
      aria-hidden
    />
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: COLORS.ink }}>
      <span className="w-3 h-3 rounded-[3px]" style={{ background: color }} aria-hidden />
      {texto}
    </span>
  );
}

function FilaIngreso({ ingreso: i, abierto, onAbrir, onCerrar }: { ingreso: Ingreso; abierto: boolean; onAbrir: () => void; onCerrar: () => void }) {
  const fuente = i.fuente === 'otro' && i.fuenteOtra ? i.fuenteOtra : FUENTES_INGRESO.find((f) => f.id === i.fuente)?.label;
  const titulo = i.descripcion || fuente || 'Ingreso';
  const monto = i.moneda === 'USD' ? `US$${i.monto.toLocaleString('es-AR')}` : fmtMoney(i.monto);
  // El lapicito abre el editor debajo del renglón, igual que en los gastos.
  const [editando, setEditando] = useState(false);
  return (
    <div className="py-2.5 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: INGRESO }} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[16px] truncate" style={{ color: COLORS.ink }}>{titulo}</p>
          <p className="text-[14px] truncate" style={{ color: COLORS.inkSoft }}>
            {[i.medio, i.origen === 'whatsapp' ? 'por WhatsApp' : null, new Date(i.ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })].filter(Boolean).join(', ')}
          </p>
        </div>
        <span className="font-mono tabular-nums text-[16px] shrink-0" style={{ color: COLORS.ink }}>+{monto}</span>
        <button
          type="button"
          onClick={() => { setEditando((v) => !v); onCerrar(); }}
          aria-label={`Editar ingreso ${titulo}`}
          aria-expanded={editando}
          className="v2-focus w-11 h-11 -my-2 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
          style={{ color: editando ? COLORS.ink : COLORS.inkFaint }}
        >
          <IconEditar size={18} />
        </button>
        <button
          type="button"
          onClick={() => { setEditando(false); onAbrir(); }}
          aria-label={`Borrar ingreso ${titulo}`}
          aria-expanded={abierto}
          className="v2-focus w-11 h-11 -my-2 -mr-2 rounded-full flex items-center justify-center shrink-0"
          style={{ color: abierto ? COLORS.ink : COLORS.inkFaint }}
        >
          <IconBasura size={18} />
        </button>
      </div>
      {editando && <EditorIngreso ingreso={i} onCerrar={() => setEditando(false)} />}
      {abierto && (
        <div className="mt-2 rounded-xl px-3.5 py-3 flex flex-col gap-2.5" style={{ background: COLORS.tint }} role="group" aria-label="Confirmar borrado">
          <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>
            ¿Borrar este ingreso de <span className="font-mono tabular-nums">{monto}</span>?
          </p>
          <div className="flex gap-2">
            <button type="button" autoFocus onClick={onCerrar} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[15px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
              Cancelar
            </button>
            <button type="button" onClick={() => { onCerrar(); acciones.borrarIngreso(i.id); }} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[15px] font-bold" style={{ background: COLORS.ink, color: COLORS.paper }}>
              Sí, borrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
