import { useState } from 'react';
import { COLORS, EstadoConfianza, FONTS, fmtMoney, fmtMontoCompacto } from './shared';
import { IconBasura } from './FinaIcons';
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

const nombreMes = (clave: string, largo = false) =>
  new Date(`${clave}-15T12:00:00Z`).toLocaleDateString('es-AR', { month: largo ? 'long' : 'short', timeZone: 'UTC' }).replace('.', '');

export function IngresosVsGastos({ conLista = false }: { conLista?: boolean }) {
  const { estado } = useAlmacen();
  const meses = ultimosMeses(6);
  const [elegido, setElegido] = useState(meses[meses.length - 1]);
  const [borrando, setBorrando] = useState<string | null>(null);

  const porMes = meses.map((mes) => ({
    mes,
    entro: estado.ingresos.filter((i) => mesDe(i.ts) === mes).reduce((s, i) => s + i.montoArs, 0),
    salio: estado.gastos.filter((g) => mesDe(g.ts) === mes).reduce((s, g) => s + g.montoArs, 0),
  }));
  const actual = porMes.find((p) => p.mes === elegido) ?? porMes[porMes.length - 1];
  const tope = Math.max(1, ...porMes.map((p) => Math.max(p.entro, p.salio)));
  const nadaRegistrado = porMes.every((p) => p.entro === 0 && p.salio === 0);
  const quedo = actual.entro - actual.salio;
  const esEsteMes = elegido === meses[meses.length - 1];

  const ingresosDelMes = estado.ingresos.filter((i) => mesDe(i.ts) === elegido);

  if (nadaRegistrado) {
    return (
      <p className="text-[15px] leading-snug pl-3.5 border-l-2 py-1" style={{ color: COLORS.inkSoft, borderColor: COLORS.brandSoft }}>
        Cuando registres lo que te entra y lo que gastás, acá vas a ver cuánto te queda cada mes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* El mes elegido, en números. */}
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }}>
          {esEsteMes ? 'Este mes' : nombreMes(elegido, true)}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Cifra color={INGRESO} etiqueta="Entró" valor={actual.entro} />
          <Cifra color={GASTO} etiqueta="Salió" valor={actual.salio} />
          {actual.entro > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px]" style={{ color: COLORS.inkSoft }}>{quedo >= 0 ? 'Te quedó' : 'Salió de más'}</span>
              <span className="text-[17px] font-bold font-mono tabular-nums truncate" style={{ color: COLORS.ink }}>{fmtMontoCompacto(Math.abs(quedo))}</span>
            </div>
          )}
        </div>
        {actual.entro === 0 && actual.salio > 0 && (
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            {esEsteMes ? 'Este mes' : 'Ese mes'} no registraste ingresos. Si los cargás, se ve cuánto te queda.
          </p>
        )}
      </div>

      {/* Los últimos 6 meses. Cada mes es un botón para elegirlo. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-end gap-1" style={{ height: 124 }} role="group" aria-label="Ingresos y gastos de los últimos 6 meses">
          {porMes.map((p) => {
            const sel = p.mes === elegido;
            return (
              <button
                key={p.mes}
                type="button"
                onClick={() => setElegido(p.mes)}
                aria-pressed={sel}
                aria-label={`${nombreMes(p.mes, true)}: entró ${fmtMoney(p.entro)}, salió ${fmtMoney(p.salio)}`}
                className="v2-focus flex-1 min-w-[44px] h-full flex items-end justify-center gap-[2px] rounded-lg transition-opacity"
                style={{ opacity: sel ? 1 : 0.45 }}
              >
                <Barra valor={p.entro} tope={tope} color={INGRESO} />
                <Barra valor={p.salio} tope={tope} color={GASTO} />
              </button>
            );
          })}
        </div>
        <div className="flex gap-1">
          {porMes.map((p) => (
            <span
              key={p.mes}
              className="flex-1 min-w-[44px] text-center text-[12px]"
              style={{ color: p.mes === elegido ? COLORS.ink : COLORS.inkFaint, fontFamily: FONTS.mono, fontWeight: p.mes === elegido ? 700 : 400 }}
            >
              {nombreMes(p.mes)}
            </span>
          ))}
        </div>
      </div>

      {/* Leyenda: el color no es lo único que dice qué es cada barra. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Leyenda color={INGRESO} texto="Entró" />
        <Leyenda color={GASTO} texto="Salió" />
        <span className="text-[13px]" style={{ color: COLORS.inkFaint }}>Según lo que registraste</span>
      </div>
      <EstadoConfianza estado="declarado" />

      {conLista && (
        <div className="flex flex-col pt-1">
          <p className="text-[15px] font-bold" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>
            Ingresos de {esEsteMes ? 'este mes' : nombreMes(elegido, true)}
          </p>
          {ingresosDelMes.length === 0 && (
            <p className="text-[14px] py-2" style={{ color: COLORS.inkSoft }}>No hay ingresos registrados.</p>
          )}
          {ingresosDelMes.map((i) => (
            <FilaIngreso key={i.id} ingreso={i} abierto={borrando === i.id} onAbrir={() => setBorrando(borrando === i.id ? null : i.id)} onCerrar={() => setBorrando(null)} />
          ))}
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
      <span className="text-[17px] font-bold font-mono tabular-nums truncate" style={{ color: COLORS.ink }}>{fmtMontoCompacto(valor)}</span>
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
  const fuente = FUENTES_INGRESO.find((f) => f.id === i.fuente)?.label;
  const titulo = i.descripcion || fuente || 'Ingreso';
  const monto = i.moneda === 'USD' ? `US$${i.monto.toLocaleString('es-AR')}` : fmtMoney(i.monto);
  return (
    <div className="py-2.5 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: INGRESO }} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] truncate" style={{ color: COLORS.ink }}>{titulo}</p>
          <p className="text-[13px] truncate" style={{ color: COLORS.inkSoft }}>
            {[i.medio, i.origen === 'whatsapp' ? 'por WhatsApp' : null, new Date(i.ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="font-mono tabular-nums text-[15px] shrink-0" style={{ color: COLORS.ink }}>+{monto}</span>
        <button
          type="button"
          onClick={onAbrir}
          aria-label={`Borrar ingreso ${titulo}`}
          aria-expanded={abierto}
          className="v2-focus w-11 h-11 -my-2 -mr-2 rounded-full flex items-center justify-center shrink-0"
          style={{ color: abierto ? COLORS.ink : COLORS.inkFaint }}
        >
          <IconBasura size={18} />
        </button>
      </div>
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
