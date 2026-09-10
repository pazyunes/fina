import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Fini } from './Fini';
import { ArmarGrupoBtn, COLORS, FONTS, OpcionesLista, Titulo, TituloSeccion, loadV2Foto, loadV2Nombre, loadV2NivelFinanciero, subirV2Foto, saveV2Nombre, saveV2NivelFinanciero, vistaGastos, vistaObjetivos } from './shared';

// Checklist de "Completá tu perfil" — normal, sin puntos ni gamificación
// (esa idea se descartó a propósito). Se calcula con datos reales ya
// persistidos, nunca con un contador inventado. El nivel de conocimiento
// financiero vive ACÁ adentro (no como cartel aparte arriba de todo en
// Home, que no se entendía) — Home solo tiene la entrada a esta pantalla.
const NIVELES_FINANCIEROS = ['Recién estoy arrancando', 'Sé lo básico, quiero mejorar', 'Me manejo bastante bien', 'Soy bastante experta/o en esto'];

// Check propio (currentColor) — el color lo pone el contenedor para respetar
// el contraste (§3.3: sobre relleno de color, tinta; nunca blanco sobre lima).
function Check({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * (11 / 14))} viewBox="0 0 14 11" fill="none" aria-hidden>
      <path d="M1 5.5L5 9.5L13 1.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function itemsPerfil() {
  const g = vistaGastos();
  const objetivos = vistaObjetivos();
  return [
    { label: 'Agregá tu primer gasto', hecho: g.gastos.length > 0, to: '/onboarding-v2/gastos' },
    { label: 'Definí un tope para recortar algo', hecho: Object.keys(g.topes).length > 0, to: '/onboarding-v2/gastos' },
    { label: 'Sumá un objetivo', hecho: objetivos.length > 0, to: '/onboarding-v2/objetivos' },
  ];
}

// REDISEÑO v2 — Perfil: foto (se sube a Supabase Storage) +
// nombre editable, checklist de "completá tu perfil", y la puerta de
// entrada a "Mis grupos". Se llega tocando el avatar en Home.
export function PerfilV2() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<string | null>(() => loadV2Foto());
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
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

  async function onFotoElegida(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Vista previa local mientras sube, para que el toque tenga respuesta
    // inmediata. Si la subida falla se vuelve a la foto anterior: dejar la
    // previa puesta haría creer que quedó guardada.
    const anterior = foto;
    setFoto(URL.createObjectURL(file));
    setSubiendoFoto(true);
    setErrorFoto(null);

    const r = await subirV2Foto(file);
    setSubiendoFoto(false);
    if (r.error !== null) { setFoto(anterior); setErrorFoto('No pudimos subir la foto. Probá de nuevo.'); return; }
    setFoto(r.url);
  }

  function guardarNombre() {
    saveV2Nombre(nombre.trim());
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1500);
  }

  return (
    // DIRECCIÓN C — sin banda editorial y sin tarjeta por ítem. La banda
    // full-bleed violeta era el recurso de la dirección B; acá el título ya
    // ordena la pantalla solo. Los ítems del checklist eran tarjetas con
    // contorno propio: como lista con hairline se leen como lo que son, una
    // secuencia de cosas pendientes.
    <div className="px-6 pt-8 pb-4 flex flex-col gap-8 lg:max-w-2xl lg:mx-auto lg:pt-10">
      <header className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <Titulo>Tu perfil</Titulo>
          <p className="text-[16px] mt-2" style={{ color: COLORS.inkSoft }}>Tu foto, tu nombre y lo que falta para completar tu FINA.</p>
        </div>
      </header>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={elegirFoto}
          className="v2-focus relative w-24 h-24 rounded-full overflow-hidden shrink-0 transition-transform duration-100 active:scale-95"
          style={{ border: `1.5px solid ${COLORS.line}` }}
          aria-label="Cambiar foto de perfil"
        >
          {foto ? (
            <img src={foto} alt="Tu foto de perfil" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center" style={{ background: COLORS.starSoft }}>
              <Fini state="idle" size={80} />
            </span>
          )}
          {/* Scrim de tinta sobre la foto para que la etiqueta se lea (media
              overlay, no decoración de color). */}
          <span
            className="absolute bottom-0 left-0 right-0 text-center text-[12px] font-bold py-1"
            style={{ background: 'rgba(43,33,24,0.6)', color: COLORS.surface }}
          >
            Cambiar
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Elegir foto de perfil" onChange={(e) => void onFotoElegida(e)} />
        {subiendoFoto && (
          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Subiendo tu foto…</p>
        )}
        {errorFoto && (
          <p role="alert" className="text-[14px] font-semibold" style={{ color: COLORS.coralDark }}>{errorFoto}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="perfil-nombre" className="text-[15px] font-semibold" style={{ color: COLORS.inkSoft }}>Tu nombre</label>
        <div className="flex gap-2">
          <input
            id="perfil-nombre"
            className="v2-focus flex-1 min-w-0 rounded-2xl px-4 py-3 text-[18px] outline-none transition-colors"
            style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}`, color: COLORS.ink }}
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <button
            type="button"
            onClick={guardarNombre}
            disabled={!nombre.trim()}
            aria-label={guardado ? 'Nombre guardado' : 'Guardar nombre'}
            className="v2-focus rounded-2xl px-5 font-bold v2-disabled transition-all duration-100 active:scale-95 shrink-0 inline-flex items-center justify-center"
            style={{ background: guardado ? COLORS.lima : COLORS.brand, color: guardado ? COLORS.ink : COLORS.surface }}
          >
            {guardado ? <Check size={15} /> : 'Guardar'}
          </button>
        </div>
      </div>

      {faltan.length === 0 && !faltaNivel && (
        <section className="flex flex-col items-center gap-2 py-2">
          <Fini state="logro" size={124} />
          <p className="text-[16px] font-bold text-center" style={{ color: COLORS.ink }}>Tu perfil está completo</p>
          <p className="text-[14px] text-center" style={{ color: COLORS.inkSoft }}>Con esto las recomendaciones te van a hablar en tu idioma.</p>
        </section>
      )}

      {(faltan.length > 0 || faltaNivel) && (
        <section className="flex flex-col gap-3">
          <TituloSeccion>Completá tu perfil</TituloSeccion>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pctPerfil}%`, background: COLORS.brand }} />
            </div>
            <span className="text-[14px] font-bold tabular-nums shrink-0" style={{ color: COLORS.brand, fontFamily: FONTS.mono }}>{pctPerfil}%</span>
          </div>

          <div className="flex flex-col">
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                onClick={() => navigate(it.to)}
                disabled={it.hecho}
                className="v2-focus w-full flex items-center gap-3 text-left min-h-[52px] py-3 border-b transition-all duration-100 active:scale-[0.99] disabled:active:scale-100"
                style={{ borderColor: COLORS.line }}
              >
                <span
                  aria-label={it.hecho ? 'Hecho' : 'Pendiente'}
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={it.hecho ? { background: COLORS.lima, color: COLORS.ink } : { border: `2px solid ${COLORS.lineStrong}` }}
                >
                  {it.hecho ? <Check size={11} /> : null}
                </span>
                <span className="flex-1 text-[16px] font-medium" style={{ color: it.hecho ? COLORS.inkFaint : COLORS.ink, textDecoration: it.hecho ? 'line-through' : 'none' }}>
                  {it.label}
                </span>
              </button>
            ))}

            {/* Nivel de conocimiento financiero — mismo checklist, sin cartel aparte */}
            {!abriendoNivel && (
              <button
                type="button"
                onClick={() => setAbriendoNivel(true)}
                className="v2-focus w-full flex items-center gap-3 text-left min-h-[52px] py-3 transition-all duration-100 active:scale-[0.99]"
              >
                <span
                  aria-label={nivel ? 'Hecho' : 'Pendiente'}
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={nivel ? { background: COLORS.lima, color: COLORS.ink } : { border: `2px solid ${COLORS.lineStrong}` }}
                >
                  {nivel ? <Check size={11} /> : null}
                </span>
                <span className="flex-1 text-[16px] font-medium" style={{ color: nivel ? COLORS.inkFaint : COLORS.ink, textDecoration: nivel ? 'line-through' : 'none' }}>
                  Descubrí tu nivel de conocimiento financiero
                </span>
              </button>
            )}
          </div>

          {/* Al abrirse, la pregunta se comporta como una pantalla del
              onboarding: mismo título, misma lista de opciones. Antes era una
              cajita celeste con chips adentro — otro sistema visual distinto
              para la misma interacción. */}
          {abriendoNivel && (
            <div className="flex flex-col gap-3 pt-1">
              <TituloSeccion>¿Cómo describirías lo que sabés hoy?</TituloSeccion>
              <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
                Así las recomendaciones te van a hablar en tu idioma, sin sonar ni muy básico ni muy técnico.
              </p>
              <OpcionesLista
                opciones={NIVELES_FINANCIEROS.map((n) => ({ id: n, label: n }))}
                valor={nivel}
                onElegir={(n) => { setNivel(n); saveV2NivelFinanciero(n); setAbriendoNivel(false); }}
              />
            </div>
          )}
        </section>
      )}

      <ArmarGrupoBtn />

      <div className="flex flex-col">
        {['Términos y condiciones', 'Política de privacidad', 'Enviar feedback'].map((txt) => (
          <button key={txt} type="button" className="v2-focus text-left text-[15px] font-medium min-h-[48px] py-3 border-b last:border-b-0" style={{ color: COLORS.inkSoft, borderColor: COLORS.line }}>
            {txt}
          </button>
        ))}
      </div>
    </div>
  );
}
