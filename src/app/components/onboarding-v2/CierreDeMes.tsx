import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { diaArgentina } from '../../api/v2/pasos';
import {
  fijosDelMes, fraseDelMes, pesos, recomendaciones, resumenDelMes,
  type DatosDelMes, type MesACerrar, type Recomendacion,
} from '../../lib/cierreDeMes';
import { marcarCierreVisto } from '../../lib/cierreLocal';
import { Hoja, DatoFila, ProgresoPasos } from './inversiones/Hoja';
import { COLORS, fechaDisplay } from './shared';

// El cierre de mes, en tres pantallas cortas: cómo terminó el mes, qué hacer el
// que viene y lo que ya se sabe que se va a pagar. Los números son los que la
// persona anotó; la frase dice qué significan, sin juzgar. Se abre desde la
// fila de Inicio de los últimos días del mes y los primeros del siguiente.

const PAGINAS = 3;
const FIJOS_VISIBLES = 4;
const IDEAS = ['Cumpleaños', 'Feriado', 'Actividad', 'Regalo'];

export function CierreDeMes({ mes, onCerrar }: { mes: MesACerrar; onCerrar: () => void }) {
  const { estado: db } = useAlmacen();
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(0);

  const datos = useMemo<DatosDelMes>(() => ({
    gastos: db.gastos.map((g) => ({ fecha: diaArgentina(g.ts), montoArs: g.montoArs, seccionId: g.seccionId })),
    ingresos: db.ingresos.map((i) => ({ fecha: diaArgentina(i.ts), montoArs: i.montoArs })),
    aportes: db.objetivos.flatMap((o) => o.contribuciones
      .filter((c) => c.kind === 'saved' && c.montoArs !== null)
      .map((c) => ({ fecha: diaArgentina(c.ts), montoArs: c.montoArs as number }))),
    secciones: db.secciones.map((s) => ({ id: s.id, nombre: s.nombre, tieneTope: s.tope !== null })),
    objetivos: db.objetivos.filter((o) => o.estado === 'active' && o.clase !== 'gasto').map((o) => ({ id: o.id, nombre: o.nombre })),
    fijos: db.gastosFijos.map((f) => ({ descripcion: f.descripcion, monto: f.monto, moneda: f.moneda, proximoPago: f.proximoPago, frecuencia: f.frecuencia, diaAncla: f.diaAncla })),
    dolar: db.dolar,
  }), [db]);

  const r = useMemo(() => resumenDelMes(datos, mes), [datos, mes]);
  const recs = useMemo(() => recomendaciones(r, datos, mes), [r, datos, mes]);
  const fijos = useMemo(() => fijosDelMes(datos, mes), [datos, mes]);
  const totalFijos = fijos.reduce((s, f) => s + f.montoArs, 0);

  function cerrar() {
    marcarCierreVisto(mes.clave);
    onCerrar();
  }
  function ir(ruta: string, estado?: Record<string, unknown>) {
    cerrar();
    navigate(ruta, { state: { from: '/onboarding-v2/home', ...estado } });
  }
  function hacer(rec: Recomendacion) {
    const a = rec.accion;
    if (a.tipo === 'tope') ir('/onboarding-v2/gastos', { abrir: 'tope', ref: a.seccionId });
    else if (a.tipo === 'objetivo') ir('/onboarding-v2/objetivos?abrir=aporte_objetivo');
    else if (a.tipo === 'nuevo-objetivo') ir('/onboarding-v2/objetivos', { crearObjetivo: true });
    else ir('/onboarding-v2/gastos');
  }
  const anotarQueSeViene = (idea: string) => ir(`/onboarding-v2/gastos?abrir=gasto&descripcion=${encodeURIComponent(idea)}&fijo=anual`);

  const titulos = [mes.terminado ? `Cómo cerró ${mes.nombre}` : `Cómo va ${mes.nombre}`, `Para ${mes.siguiente.nombre}`, `Se viene en ${mes.siguiente.nombre}`];
  const sigue = pagina < PAGINAS - 1;
  const arriba = (
    <button type="button" onClick={sigue ? () => setPagina(pagina + 1) : cerrar} className="v2-focus min-h-[40px] px-3 text-[14px] font-bold shrink-0" style={{ color: COLORS.brand }}>
      {sigue ? 'Siguiente ›' : 'Listo'}
    </button>
  );

  return (
    <Hoja titulo={titulos[pagina]} onCerrar={cerrar} onVolver={pagina > 0 ? () => setPagina(pagina - 1) : undefined} arriba={arriba}>
      <ProgresoPasos total={PAGINAS} hechos={pagina} actual={pagina} />
      {/* Alto parejo en las tres pantallas, así el título no cambia de lugar. */}
      <div className="flex flex-col gap-3 min-h-[330px]">

      {pagina === 0 && (
        <div className="flex flex-col gap-3">
          {r.hayDatos && (
            <div className="flex flex-col gap-0.5">
              <p className="font-mono tabular-nums text-[30px] font-bold leading-tight" style={{ color: COLORS.ink }}>
                {r.ingresos > 0 ? pesos(r.quedo) : pesos(r.gastado)}
              </p>
              <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>
                {r.ingresos === 0
                  ? `Gastaste en ${mes.nombre}`
                  : r.quedo >= 0 ? `Te quedó de lo que anotaste en ${mes.nombre}` : `Tus gastos superan lo que anotaste como ingreso en ${mes.nombre}`}
              </p>
            </div>
          )}
          <p className="text-[15px] font-semibold leading-snug rounded-2xl px-4 py-3" style={{ background: COLORS.brandFaint, color: COLORS.ink }}>
            {fraseDelMes(r, mes)}
          </p>
          {r.hayDatos && (
            <div className="flex flex-col">
              {r.ingresos > 0 && <DatoFila etiqueta="Ingresos" valor={pesos(r.ingresos)} />}
              <DatoFila etiqueta="Gastos" valor={pesos(r.gastado)} />
              {r.mayor && <DatoFila etiqueta="Lo que más se llevó" valor={`${r.mayor.nombre}, ${pesos(r.mayor.monto)}`} />}
              {r.gastadoMesAnterior !== null && <DatoFila etiqueta={`Gastos de ${mes.anterior.nombre}`} valor={pesos(r.gastadoMesAnterior)} />}
              <DatoFila etiqueta="Días con gastos anotados" valor={`${r.diasConGastos} de ${r.diasDelMes}`} />
            </div>
          )}
        </div>
      )}

      {pagina === 1 && (
        <div className="flex flex-col">
          {recs.length === 0 && (
            <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>Con más gastos anotados, acá vas a ver qué hacer el mes que viene.</p>
          )}
          {recs.map((rec) => (
            <div key={rec.texto} className="flex flex-col gap-2 py-3 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
              <p className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>{rec.texto}</p>
              <button type="button" onClick={() => hacer(rec)} className="v2-focus self-start min-h-[40px] px-4 rounded-full text-[13px] font-bold" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}>
                {rec.accion.tipo === 'tope' ? 'Poner el tope' : rec.accion.tipo === 'objetivo' ? 'Ir al objetivo' : rec.accion.tipo === 'nuevo-objetivo' ? 'Crear un objetivo' : 'Anotar ingresos'}
              </button>
            </div>
          ))}
        </div>
      )}

      {pagina === 2 && (
        <div className="flex flex-col gap-3">
          {fijos.length > 0 ? (
            <div className="flex flex-col">
              {fijos.slice(0, FIJOS_VISIBLES).map((f, i) => (
                <DatoFila key={`${f.descripcion}-${f.fecha}-${i}`} etiqueta={`${f.descripcion}, ${fechaDisplay(Date.parse(`${f.fecha}T12:00:00-03:00`)).toLowerCase()}`} valor={pesos(f.montoArs)} />
              ))}
              {fijos.length > FIJOS_VISIBLES && <DatoFila etiqueta={`Y ${fijos.length - FIJOS_VISIBLES} más`} valor="" />}
              <DatoFila etiqueta={`Ya anotado para ${mes.siguiente.nombre}`} valor={pesos(totalFijos)} />
            </div>
          ) : (
            <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>Todavía no anotaste nada para {mes.siguiente.nombre}.</p>
          )}
          <p className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>
            Anotá lo que ya sabés que vas a gastar, como un cumpleaños, un feriado o una actividad. Así ves en qué se va tu plata antes de gastarla.
          </p>
          <div className="flex flex-wrap gap-2">
            {IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => anotarQueSeViene(idea)}
                className="v2-focus min-h-[40px] px-4 rounded-full text-[13px] font-semibold"
                style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      )}
      </div>
    </Hoja>
  );
}
