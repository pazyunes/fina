import { useState } from 'react';
import { COLORS, Grupo, loadV2Grupo, loadV2Nombre, saveV2Grupo } from './shared';

// REDISEÑO v2 — Grupos: competir con amigas por actividad (cuánto
// registraste) y, en Objetivos, armar metas grupales. Todavía no hay
// cuentas ni backend real (esto es 100% localStorage de este navegador),
// así que las compañeras de grupo son un EJEMPLO para probar la idea —
// se avisa explícito abajo, nunca se hace pasar por datos reales.

const MEDALLAS = ['🥇', '🥈', '🥉'];

function codigoAlAzar(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return `FINA-${c}`;
}

function grupoDemo(nombreGrupo: string): Grupo {
  const yo = loadV2Nombre() || 'Vos';
  return {
    nombre: nombreGrupo,
    codigo: codigoAlAzar(),
    miembros: [
      { nombre: 'Caro', actividad: 6 },
      { nombre: yo, actividad: 3, sosVos: true },
      { nombre: 'Male', actividad: 2 },
      { nombre: 'Juli', actividad: 1 },
    ],
  };
}

export function GruposV2() {
  const [grupo, setGrupo] = useState<Grupo | null>(() => loadV2Grupo());
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [codigoTxt, setCodigoTxt] = useState('');
  const [modo, setModo] = useState<'elegir' | 'crear' | 'unirse'>('elegir');

  function crear() {
    if (!nombreGrupo.trim()) return;
    const g = grupoDemo(nombreGrupo.trim());
    setGrupo(g);
    saveV2Grupo(g);
  }

  function unirse() {
    if (!codigoTxt.trim()) return;
    // Demo: cualquier código te mete al mismo grupo de ejemplo.
    const g = grupoDemo('Ahorrando juntas');
    setGrupo(g);
    saveV2Grupo(g);
  }

  function salir() {
    if (!window.confirm('¿Salir del grupo?')) return;
    setGrupo(null);
    saveV2Grupo(null);
  }

  if (!grupo) {
    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4">
        <h1 className="text-[22px] font-bold" style={{ color: COLORS.ink }}>Grupos</h1>
        <p className="text-[13.5px]" style={{ color: COLORS.inkSoft }}>
          Armá un grupo con amigas para verse la actividad entre todas y motivarse — y más adelante, armar objetivos en conjunto.
        </p>

        {modo === 'elegir' && (
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setModo('crear')}
              className="w-full text-left bg-white rounded-2xl p-4 shadow-[0_2px_18px_rgba(31,27,46,0.07)] transition-all duration-100 active:scale-[0.99]"
            >
              <p className="font-bold text-[15px]" style={{ color: COLORS.ink }}>Crear un grupo</p>
              <p className="text-[12.5px] mt-0.5" style={{ color: COLORS.inkSoft }}>Le ponés nombre y invitás con un código.</p>
            </button>
            <button
              type="button"
              onClick={() => setModo('unirse')}
              className="w-full text-left bg-white rounded-2xl p-4 shadow-[0_2px_18px_rgba(31,27,46,0.07)] transition-all duration-100 active:scale-[0.99]"
            >
              <p className="font-bold text-[15px]" style={{ color: COLORS.ink }}>Unirme con un código</p>
              <p className="text-[12.5px] mt-0.5" style={{ color: COLORS.inkSoft }}>Si una amiga ya te invitó.</p>
            </button>
          </div>
        )}

        {modo === 'crear' && (
          <div className="flex flex-col gap-2.5">
            <button type="button" className="text-[13px] font-semibold self-start" style={{ color: COLORS.inkSoft }} onClick={() => setModo('elegir')}>← Volver</button>
            <input
              autoFocus
              className="border border-[rgba(31,27,46,0.16)] focus:border-[#7626B3] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none transition-colors"
              placeholder="Nombre del grupo (ej: Ahorrando juntas)"
              value={nombreGrupo}
              onChange={(e) => setNombreGrupo(e.target.value)}
            />
            <button
              type="button"
              onClick={crear}
              disabled={!nombreGrupo.trim()}
              className="rounded-2xl py-3.5 font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-[0.98]"
              style={{ background: COLORS.brand }}
            >
              Crear grupo
            </button>
          </div>
        )}

        {modo === 'unirse' && (
          <div className="flex flex-col gap-2.5">
            <button type="button" className="text-[13px] font-semibold self-start" style={{ color: COLORS.inkSoft }} onClick={() => setModo('elegir')}>← Volver</button>
            <input
              autoFocus
              className="border border-[rgba(31,27,46,0.16)] focus:border-[#7626B3] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none transition-colors uppercase"
              placeholder="Código (ej: FINA-AB12C)"
              value={codigoTxt}
              onChange={(e) => setCodigoTxt(e.target.value)}
            />
            <button
              type="button"
              onClick={unirse}
              disabled={!codigoTxt.trim()}
              className="rounded-2xl py-3.5 font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-[0.98]"
              style={{ background: COLORS.brand }}
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
    <div className="px-[22px] pt-8 flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold" style={{ color: COLORS.ink }}>{grupo.nombre}</h1>
        <button type="button" onClick={salir} className="text-[12.5px] font-semibold underline" style={{ color: COLORS.inkSoft }}>Salir</button>
      </div>
      <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>Código para invitar: <strong style={{ color: COLORS.ink }}>{grupo.codigo}</strong></p>

      <div className="flex flex-col gap-2.5">
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Actividad de la semana</p>
        {ordenados.map((m, i) => (
          <div
            key={m.nombre}
            className="flex items-center gap-3 bg-white rounded-2xl p-3.5 shadow-[0_2px_18px_rgba(31,27,46,0.07)]"
            style={m.sosVos ? { outline: `2px solid ${COLORS.brand}` } : undefined}
          >
            <span className="text-[18px] w-6 text-center shrink-0">{MEDALLAS[i] ?? i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[14.5px] truncate" style={{ color: COLORS.ink }}>{m.nombre}{m.sosVos ? ' (vos)' : ''}</p>
              <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'rgba(31,27,46,0.08)' }}>
                <div className="h-full rounded-full" style={{ width: `${(m.actividad / max) * 100}%`, background: m.sosVos ? COLORS.brand : COLORS.gold }} />
              </div>
            </div>
            <span className="text-[13px] font-bold shrink-0" style={{ color: COLORS.ink }}>{m.actividad}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.tint, color: COLORS.inkSoft }}>
        Esto es una vista de ejemplo para probar la idea — cuando conectemos cuentas reales, acá vas a ver la actividad real de cada una.
      </div>
    </div>
  );
}
