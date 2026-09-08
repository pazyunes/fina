import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { COLORS, Face, Grupo, Titulo, crearGrupoDemo, invitarAGrupo, loadV2Grupo, saveV2Grupo } from './shared';
import { IconChevron } from './FinaIcons';

// REDISEÑO v2 — Grupos: competir con amigas por actividad (cuánto
// registraste) y, en Objetivos, armar metas grupales. Todavía no hay
// cuentas ni backend real (esto es 100% localStorage de este navegador),
// así que las compañeras de grupo son un EJEMPLO para probar la idea —
// se avisa explícito abajo, nunca se hace pasar por datos reales.
//
// Invitar SÍ es real: comparte (o copia) el código con el share sheet
// nativo del celular — lo que no hay todavía es el otro lado (que una
// amiga entre con ese código desde su propio teléfono y sincronice).

// Check propio (currentColor) — el color lo pone el contenedor para
// respetar el contraste (§3.3: sobre relleno, tinta; nunca blanco sobre lima).
function Check({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * (11 / 14))} viewBox="0 0 14 11" fill="none" aria-hidden>
      <path d="M1 5.5L5 9.5L13 1.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GruposV2() {
  const navigate = useNavigate();
  const location = useLocation();
  // Grupos no está en el menú de abajo: siempre se llega desde otra pantalla
  // (Objetivos, Perfil, Home). Quien navega hasta acá deja escrito de dónde
  // vino, así el volver devuelve al lugar real y no a un default arbitrario.
  const origen = (location.state as { from?: string } | null)?.from ?? '/onboarding-v2/home';

  const [grupo, setGrupo] = useState<Grupo | null>(() => loadV2Grupo());
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [codigoTxt, setCodigoTxt] = useState('');
  const [modo, setModo] = useState<'elegir' | 'crear' | 'unirse'>('elegir');
  const [copiado, setCopiado] = useState(false);

  function crear() {
    if (!nombreGrupo.trim()) return;
    const g = crearGrupoDemo(nombreGrupo.trim());
    setGrupo(g);
    saveV2Grupo(g);
  }

  function unirse() {
    if (!codigoTxt.trim()) return;
    // Demo: cualquier código te mete al mismo grupo de ejemplo.
    const g = crearGrupoDemo('Ahorrando juntas');
    setGrupo(g);
    saveV2Grupo(g);
  }

  function salir() {
    if (!window.confirm('¿Salir del grupo?')) return;
    setGrupo(null);
    saveV2Grupo(null);
  }

  async function invitar() {
    if (!grupo) return;
    const resultado = await invitarAGrupo(grupo);
    if (resultado === 'copiado') {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    }
  }

  // Botón "Volver" — sin flecha de plantilla (§2): chevron del set propio,
  // girado, con target táctil de 44px. Es JERÁRQUICO: desde "crear"/"unirse"
  // retrocede al selector, y desde el selector sale a la pantalla de la que
  // viniste. Antes el único volver era el de adentro de "crear" y solo llegaba
  // al selector, así que ahí la pantalla se volvía un callejón sin salida.
  function Volver() {
    const enSubpaso = modo !== 'elegir';
    return (
      <button
        type="button"
        aria-label={enSubpaso ? 'Volver a elegir' : 'Volver a la pantalla anterior'}
        className="v2-focus inline-flex items-center gap-1.5 self-start min-h-[44px] text-[15px] font-semibold rounded-full py-2 pr-3 pl-1 -ml-1"
        style={{ color: COLORS.inkSoft }}
        onClick={() => (enSubpaso ? setModo('elegir') : navigate(origen))}
      >
        <span className="rotate-180"><IconChevron size={18} /></span>
        Volver
      </button>
    );
  }

  if (!grupo) {
    return (
      <div className="px-6 pt-6 flex flex-col gap-4">
        <Volver />
        <Titulo>Grupos</Titulo>

        {/* Vidriera vacía = promesa (§10): mostramos qué va a haber acá y una
            acción clara para empezar. Fini (la estrella) sí puede acompañar un
            estado vacío — no hay ningún dato al lado. */}
        {modo === 'elegir' && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-3">
              <div className="shrink-0"><Face color={COLORS.star} size={56} mood="happy" /></div>
              <div className="min-w-0">
                <p className="font-bold text-[18px] leading-tight" style={{ color: COLORS.ink }}>Armá tu primer grupo</p>
                <p className="text-[15px] mt-1" style={{ color: COLORS.inkSoft }}>Con amigas y amigos para verse la actividad de la semana y motivarse entre todas.</p>
              </div>
            </div>
            {/* Preview de "así se va a ver" en estado por-descubrir: contorno
                tenue, sin relleno — no son datos reales, son la promesa. */}
            <div className="flex flex-col gap-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0"
                    style={{ border: `1.5px dashed ${COLORS.lineStrong}`, color: COLORS.inkFaint }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="flex-1 h-1.5 rounded-full"
                    style={{ border: `1.5px dashed ${COLORS.lineStrong}`, opacity: 0.7 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {modo === 'elegir' && (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setModo('crear')}
              className="v2-focus w-full text-left min-h-[60px] py-3.5 border-b transition-all duration-100 active:scale-[0.99]"
              style={{ borderColor: COLORS.line }}
            >
              <p className="font-semibold text-[18px]" style={{ color: COLORS.ink }}>Crear un grupo</p>
              <p className="text-[14px] mt-0.5" style={{ color: COLORS.inkSoft }}>Le ponés nombre e invitás con un código.</p>
            </button>
            <button
              type="button"
              onClick={() => setModo('unirse')}
              className="v2-focus w-full text-left min-h-[60px] py-3.5 border-b transition-all duration-100 active:scale-[0.99]"
              style={{ borderColor: COLORS.line }}
            >
              <p className="font-semibold text-[18px]" style={{ color: COLORS.ink }}>Unirme con un código</p>
              <p className="text-[14px] mt-0.5" style={{ color: COLORS.inkSoft }}>Si una amiga ya te invitó.</p>
            </button>
          </div>
        )}

        {modo === 'crear' && (
          <div className="flex flex-col gap-2.5">
            <label htmlFor="grupo-nombre" className="text-[15px] font-semibold" style={{ color: COLORS.inkSoft }}>Nombre del grupo</label>
            <input
              id="grupo-nombre"
              autoFocus
              className="v2-focus rounded-2xl px-4 py-3 text-[18px] outline-none transition-colors"
              style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}`, color: COLORS.ink }}
              placeholder="Ej: Ahorrando juntas"
              value={nombreGrupo}
              onChange={(e) => setNombreGrupo(e.target.value)}
            />
            <button
              type="button"
              onClick={crear}
              disabled={!nombreGrupo.trim()}
              className="v2-focus rounded-2xl py-3.5 font-bold v2-disabled transition-all duration-100 active:scale-[0.98]"
              style={{ background: COLORS.brand, color: COLORS.surface }}
            >
              Crear grupo
            </button>
          </div>
        )}

        {modo === 'unirse' && (
          <div className="flex flex-col gap-2.5">
            <label htmlFor="grupo-codigo" className="text-[15px] font-semibold" style={{ color: COLORS.inkSoft }}>Código del grupo</label>
            <input
              id="grupo-codigo"
              autoFocus
              className="v2-focus rounded-2xl px-4 py-3 text-[18px] outline-none transition-colors uppercase"
              style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}`, color: COLORS.ink }}
              placeholder="Ej: FINA-AB12C"
              value={codigoTxt}
              onChange={(e) => setCodigoTxt(e.target.value)}
            />
            <button
              type="button"
              onClick={unirse}
              disabled={!codigoTxt.trim()}
              className="v2-focus rounded-2xl py-3.5 font-bold v2-disabled transition-all duration-100 active:scale-[0.98]"
              style={{ background: COLORS.brand, color: COLORS.surface }}
            >
              Unirme
            </button>
          </div>
        )}
      </div>
    );
  }

  const ordenados = [...grupo.miembros].sort((a, b) => b.actividad - a.actividad);
  const max = Math.max(...ordenados.map((m) => m.actividad), 1);

  return (
    <div className="px-6 pt-6 flex flex-col gap-4 pb-4">
      <Volver />
      <div className="flex items-center justify-between gap-3">
        <Titulo>{grupo.nombre}</Titulo>
        <button type="button" onClick={salir} className="v2-focus text-[14px] font-semibold underline rounded-full px-2 py-2" style={{ color: COLORS.inkSoft }}>Salir</button>
      </div>

      <button
        type="button"
        onClick={invitar}
        className="v2-focus flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 transition-all duration-100 active:scale-[0.99]"
        style={{ background: COLORS.brandSoft }}
      >
        {copiado ? (
          <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold" style={{ color: COLORS.brandDark }}>
            <Check size={13} /> Código copiado
          </span>
        ) : (
          <span className="min-w-0 text-left">
            <span className="block text-[15px] font-semibold" style={{ color: COLORS.brandDark }}>Invitar amigas</span>
            <span className="block text-[14px] font-mono tabular-nums truncate" style={{ color: COLORS.inkSoft }}>{grupo.codigo}</span>
          </span>
        )}
        <span className="text-[15px] font-bold shrink-0" style={{ color: COLORS.brandDark }}>
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? 'Compartir' : 'Copiar'}
        </span>
      </button>

      <div className="flex flex-col gap-2.5">
        <p className="text-[14px] font-bold" style={{ color: COLORS.inkSoft }}>Actividad de la semana</p>
        {ordenados.map((m, i) => (
          <div
            key={m.nombre}
            className="flex items-center gap-3 rounded-2xl p-3.5"
            style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}`, ...(m.sosVos ? { outline: `2px solid ${COLORS.brand}` } : null) }}
          >
            {/* Ranking = secuencia real, la numeración sí es válida (§2). El 1º
                resalta con star + tinta; el resto, hueco + tinta-media. */}
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0" style={{ background: i === 0 ? COLORS.star : COLORS.tint, color: i === 0 ? COLORS.ink : COLORS.inkSoft }}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[16px] truncate" style={{ color: COLORS.ink }}>{m.nombre}{m.sosVos ? ' (vos)' : ''}</p>
              {/* Barra de ACTIVIDAD (registros de la semana), no de plata. */}
              <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: COLORS.tint }}>
                <div className="h-full rounded-full" style={{ width: `${(m.actividad / max) * 100}%`, background: m.sosVos ? COLORS.brand : COLORS.star }} />
              </div>
            </div>
            <span className="text-[15px] font-bold shrink-0 tabular-nums" style={{ color: COLORS.ink }}>{m.actividad}</span>
          </div>
        ))}
      </div>

      <p className="text-[14px] leading-snug pl-3.5 border-l-2" style={{ color: COLORS.inkSoft, borderColor: COLORS.brandSoft }}>
        Esto es una vista de ejemplo para probar la idea — cuando conectemos cuentas reales, acá vas a ver la actividad real de cada una.
      </p>
    </div>
  );
}
