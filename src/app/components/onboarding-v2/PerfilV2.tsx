import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArmarGrupoBtn, Chip, COLORS, Face, loadV2Foto, loadV2GastosState, loadV2Nombre, loadV2NivelFinanciero, loadV2ObjetivosState, saveV2Foto, saveV2Nombre, saveV2NivelFinanciero } from './shared';

// Checklist de "Completá tu perfil" — normal, sin puntos ni gamificación
// (esa idea se descartó a propósito). Se calcula con datos reales ya
// persistidos, nunca con un contador inventado. El nivel de conocimiento
// financiero vive ACÁ adentro (no como cartel aparte arriba de todo en
// Home, que no se entendía) — Home solo tiene la entrada a esta pantalla.
const NIVELES_FINANCIEROS = ['Recién estoy arrancando', 'Sé lo básico, quiero mejorar', 'Me manejo bastante bien', 'Soy bastante experta/o en esto'];
type GastosLite = { gastos: unknown[]; topes: Record<string, unknown> };
type ObjetivoLite = { montoTotal: number };
function itemsPerfil() {
  const g = loadV2GastosState<GastosLite>();
  const objetivos = loadV2ObjetivosState<ObjetivoLite[]>() ?? [];
  return [
    { label: 'Agregá tu primer gasto', hecho: !!g && g.gastos.length > 0, to: '/onboarding-v2/gastos' },
    { label: 'Definí un tope para recortar algo', hecho: !!g && Object.keys(g.topes).length > 0, to: '/onboarding-v2/gastos' },
    { label: 'Sumá un objetivo', hecho: objetivos.length > 0, to: '/onboarding-v2/objetivos' },
  ];
}

// REDISEÑO v2 — Perfil: foto (de verdad, se guarda en este navegador) +
// nombre editable, checklist de "completá tu perfil", y la puerta de
// entrada a "Mis grupos". Se llega tocando el avatar en Home.
export function PerfilV2() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<string | null>(() => loadV2Foto());
  const [nombre, setNombre] = useState(() => loadV2Nombre());
  const [guardado, setGuardado] = useState(false);
  const [nivel, setNivel] = useState<string | null>(() => loadV2NivelFinanciero());
  const [abriendoNivel, setAbriendoNivel] = useState(false);
  const items = itemsPerfil();
  const faltan = items.filter((i) => !i.hecho);
  const faltaNivel = !nivel;
  // Progreso del perfil (checklist + nivel financiero) → barra 0-100%.
  const totalChecklist = items.length + 1;
  const hechosChecklist = items.filter((i) => i.hecho).length + (nivel ? 1 : 0);
  const pctPerfil = Math.round((hechosChecklist / totalChecklist) * 100);

  function elegirFoto() {
    fileRef.current?.click();
  }

  function onFotoElegida(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setFoto(dataUrl);
      saveV2Foto(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function guardarNombre() {
    saveV2Nombre(nombre.trim());
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1500);
  }

  return (
    <div className="px-[22px] pt-8 flex flex-col gap-6">
      <h1 className="text-[22px] font-bold" style={{ color: COLORS.ink }}>Tu perfil</h1>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={elegirFoto}
          className="relative w-24 h-24 rounded-full overflow-hidden shrink-0 shadow-[0_2px_14px_rgba(31,27,46,0.12)] transition-transform duration-100 active:scale-95"
          aria-label="Cambiar foto de perfil"
        >
          {foto ? (
            <img src={foto} alt="Tu foto de perfil" className="w-full h-full object-cover" />
          ) : (
            <Face color={COLORS.brand} size={96} mood="happy" />
          )}
          <span
            className="absolute bottom-0 left-0 right-0 text-center text-[10px] font-bold py-1"
            style={{ background: 'rgba(31,27,46,0.55)', color: '#fff' }}
          >
            Cambiar
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFotoElegida} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>Tu nombre</label>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-[rgba(31,27,46,0.16)] focus:border-[#7626B3] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none transition-colors"
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <button
            type="button"
            onClick={guardarNombre}
            disabled={!nombre.trim()}
            className="rounded-2xl px-4 font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-95 shrink-0"
            style={{ background: guardado ? COLORS.green : COLORS.brand }}
          >
            {guardado ? '✓' : 'Guardar'}
          </button>
        </div>
      </div>

      {(faltan.length > 0 || faltaNivel) && (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Completá tu perfil</p>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: COLORS.tint }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pctPerfil}%`, background: COLORS.brand }} />
            </div>
            <span className="text-[12.5px] font-bold tabular-nums shrink-0" style={{ color: COLORS.brand }}>{pctPerfil}%</span>
          </div>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => navigate(it.to)}
              disabled={it.hecho}
              className="w-full flex items-center gap-3 text-left bg-white rounded-2xl px-4 py-3 shadow-[0_2px_14px_rgba(31,27,46,0.06)] transition-all duration-100 active:scale-[0.99] disabled:active:scale-100"
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                style={it.hecho ? { background: COLORS.green, color: '#fff' } : { border: '2px solid rgba(31,27,46,0.2)' }}
              >
                {it.hecho ? '✓' : ''}
              </span>
              <span className="flex-1 text-[13.5px] font-medium" style={{ color: it.hecho ? COLORS.inkFaint : COLORS.ink, textDecoration: it.hecho ? 'line-through' : 'none' }}>
                {it.label}
              </span>
            </button>
          ))}

          {/* Nivel de conocimiento financiero — mismo checklist, sin cartel aparte */}
          {!abriendoNivel ? (
            <button
              type="button"
              onClick={() => setAbriendoNivel(true)}
              className="w-full flex items-center gap-3 text-left bg-white rounded-2xl px-4 py-3 shadow-[0_2px_14px_rgba(31,27,46,0.06)] transition-all duration-100 active:scale-[0.99]"
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                style={nivel ? { background: COLORS.green, color: '#fff' } : { border: '2px solid rgba(31,27,46,0.2)' }}
              >
                {nivel ? '✓' : ''}
              </span>
              <span className="flex-1 text-[13.5px] font-medium" style={{ color: nivel ? COLORS.inkFaint : COLORS.ink, textDecoration: nivel ? 'line-through' : 'none' }}>
                Descubrí tu nivel de conocimiento financiero
              </span>
            </button>
          ) : (
            <div className="rounded-2xl p-4 flex flex-col gap-2.5" style={{ background: COLORS.skySoft }}>
              <p className="font-bold text-[14px]" style={{ color: COLORS.ink }}>¿Cómo describirías lo que sabés hoy?</p>
              <p className="text-[12px]" style={{ color: COLORS.inkSoft }}>Así las recomendaciones te van a hablar en tu idioma, sin sonar ni muy básico ni muy técnico.</p>
              <div className="flex flex-wrap gap-2">
                {NIVELES_FINANCIEROS.map((n) => (
                  <Chip key={n} on={nivel === n} onClick={() => { setNivel(n); saveV2NivelFinanciero(n); setAbriendoNivel(false); }}>{n}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ArmarGrupoBtn />

      <div className="flex flex-col gap-1 pt-1">
        {['Términos y condiciones', 'Política de privacidad', 'Enviar feedback'].map((txt) => (
          <button key={txt} type="button" className="text-left text-[13px] font-medium py-2" style={{ color: COLORS.inkSoft }}>
            {txt}
          </button>
        ))}
      </div>
    </div>
  );
}
