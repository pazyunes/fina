import { useEffect, useRef, useState } from 'react';
import { leerAprendidas, leerAprendidasLocal, marcarAprendida } from '../../../api/v2/aprendizaje';
import type { ProductoId } from '../../../lib/inversiones/catalogo';
import { aprendidasHoy, diaAR, LIMITE_DIARIO, META_DE_RACHA, ordenarTarjetas, puedeMarcarHoy, rachaDeAprendizaje, TARJETAS, type Aprendida, type Tarjeta } from '../../../lib/inversiones/aprender';
import { COLORS, TituloSeccion } from '../shared';

const ETIQUETA: Record<Tarjeta['clase'], string> = { diferencia: 'Diferencia', concepto: 'Concepto', mito: 'Mito', error: 'Error común' };

// Mini lecciones debajo de las recomendaciones: cards que se deslizan para el costado (se asoma
// la que sigue), cada una se marca con "Ya lo aprendí" y cada 5 aprendidas se completa una racha.
// El orden se arma al entrar y no se mueve después: si no, la card saltaría al marcarla.
export function AprendeCards({ recomendados }: { recomendados: ProductoId[] }) {
  const [aprendidas, setAprendidas] = useState<Aprendida[]>(() => leerAprendidasLocal());
  const [orden] = useState<Tarjeta[]>(() => ordenarTarjetas(TARJETAS, recomendados, leerAprendidasLocal().map((a) => a.id)));
  const carrusel = useRef<HTMLDivElement>(null);

  // Lo del dispositivo se ve al instante; después se actualiza con lo que hay guardado en la cuenta.
  useEffect(() => {
    let vivo = true;
    void leerAprendidas().then((ids) => { if (vivo) setAprendidas(ids); });
    return () => { vivo = false; };
  }, []);

  const ids = aprendidas.map((a) => a.id);
  const racha = rachaDeAprendizaje(ids);
  const hoy = diaAR();
  const marcadasHoy = aprendidasHoy(aprendidas, hoy);
  const cupoLleno = !puedeMarcarHoy(aprendidas, hoy);

  function marcar(t: Tarjeta, indice: number, aprendida: boolean) {
    if (aprendida && cupoLleno) return;
    setAprendidas((prev) => (aprendida ? [...prev.filter((x) => x.id !== t.id), { id: t.id, dia: hoy }] : prev.filter((x) => x.id !== t.id)));
    void marcarAprendida(t.id, aprendida, hoy);
    // Al marcarla, se pasa a la que sigue.
    if (aprendida) {
      const sigue = carrusel.current?.children[indice + 1];
      const quieto = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (sigue instanceof HTMLElement && carrusel.current) {
        carrusel.current.scrollTo({ left: sigue.offsetLeft - carrusel.current.offsetLeft - 22, behavior: quieto ? 'auto' : 'smooth' });
      }
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Mini lecciones">
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-bold leading-tight" style={{ color: COLORS.ink }}>Aprendé en una card</h2>
        <p className="text-[13px] leading-snug max-w-[62ch]" style={{ color: COLORS.inkSoft }}>
          Mini lecciones para entender las palabras y las opciones. Deslizá para ver la que sigue y marcá las que ya aprendiste: hasta {LIMITE_DIARIO} por día.
        </p>
      </div>

      <div className="flex items-center gap-3" role="status" aria-label={`${racha.aprendidas} de ${TARJETAS.length} aprendidas`}>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: META_DE_RACHA }, (_, i) => (
            <span key={i} className="w-3 h-3 rounded-full" style={{ background: i < racha.enCurso ? COLORS.lima : COLORS.tint, border: `1.5px solid ${i < racha.enCurso ? COLORS.lima : COLORS.lineStrong}` }} />
          ))}
        </div>
        <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
          <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{racha.aprendidas}</span> de {TARJETAS.length} aprendidas
          {racha.aprendidas === 0 ? ' · aprendé 5 para completar tu primera racha' : racha.faltan === 0
            ? ` · ¡completaste ${racha.completas === 1 ? 'una racha' : `${racha.completas} rachas`} de ${META_DE_RACHA}!`
            : ` · ${racha.faltan === 1 ? 'te falta 1' : `te faltan ${racha.faltan}`} para ${racha.completas === 0 ? 'tu primera racha' : 'la próxima racha'}`}
        </p>
      </div>
      <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }} role="status">
        Hoy: <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{marcadasHoy}</span> de {LIMITE_DIARIO}
        {cupoLleno ? '. Por hoy alcanza: mañana podés seguir con las que faltan.' : '.'}
      </p>

      <div
        ref={carrusel}
        role="group"
        aria-roledescription="carrusel"
        aria-label="Mini lecciones"
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-[22px] px-[22px] scroll-pl-[22px]"
        style={{ scrollbarWidth: 'none' }}
      >
        {orden.map((t, i) => {
          const aprendida = ids.includes(t.id);
          return (
            <article
              key={t.id}
              aria-label={`${t.titulo} (${i + 1} de ${orden.length})`}
              className="snap-start shrink-0 w-[82%] sm:w-[340px] rounded-[22px] p-4 flex flex-col gap-2.5"
              style={{ background: COLORS.surface, border: `2px solid ${aprendida ? COLORS.lima : COLORS.line}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkFaint }}>{ETIQUETA[t.clase]}</span>
                {aprendida && <span className="text-[12px] font-bold rounded-full px-2.5 py-0.5" style={{ background: COLORS.limaSoft, color: COLORS.limaText }}>Aprendida</span>}
              </div>
              <h3 className="text-[16px] leading-snug font-bold" style={{ color: COLORS.ink }}>{t.titulo}</h3>
              <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{t.idea}</p>
              {t.bloques.map((b) => (
                <div key={b.nombre} className="rounded-2xl px-3 py-2" style={{ background: COLORS.tint }}>
                  <p className="text-[13px] font-bold" style={{ color: COLORS.ink }}>{b.nombre}</p>
                  <p className="text-[13px] leading-snug mt-0.5" style={{ color: COLORS.inkSoft }}>{b.texto}</p>
                </div>
              ))}
              {t.ejemplo && <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>{t.ejemplo}</p>}
              <p className="text-[13px] leading-snug pl-3 border-l-2" style={{ borderColor: COLORS.lima, color: COLORS.ink }}>
                <span className="font-bold">Para quedarte con algo: </span>{t.retener}
              </p>
              <div className="mt-auto pt-1">
                {aprendida ? (
                  <button
                    type="button"
                    onClick={() => marcar(t, i, false)}
                    className="v2-focus w-full min-h-[44px] rounded-2xl text-[15px] font-semibold"
                    style={{ color: COLORS.inkSoft, border: `1.5px solid ${COLORS.line}` }}
                  >
                    Marcar como no aprendida
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => marcar(t, i, true)}
                    aria-disabled={cupoLleno || undefined}
                    className={`v2-focus w-full min-h-[44px] rounded-2xl text-[15px] font-bold transition-all duration-100 ${cupoLleno ? 'cursor-not-allowed' : 'active:scale-[0.98]'}`}
                    style={cupoLleno
                      ? { background: COLORS.tint, color: COLORS.inkSoft, border: `1.5px solid ${COLORS.lineStrong}` }
                      : { background: COLORS.brand, color: COLORS.surface }}
                  >
                    {cupoLleno ? 'Mañana seguís' : 'Ya lo aprendí'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
