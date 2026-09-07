import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnalisisCard, Arco, ArmarGrupoBtn, Chip, COLORS, Face, datosBienestar, fmtMoney, formatThousands, loadV2Foto, loadV2GastosState, loadV2Nombre, loadV2NivelFinanciero, loadV2ObjetivosState, loadV2Reserva, parseMoneyInput, saveV2Foto, saveV2Nombre, saveV2NivelFinanciero, saveV2Reserva } from './shared';

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

  // "Tu progreso" — se mudó acá desde Home (bienestar + análisis).
  const b = datosBienestar();
  const hayBienestar = b.gastosPct !== null || b.objetivosPct !== null || b.inversionPct !== null;
  const analisis = [
    { titulo: 'Gastos', valor: b.gastosPct !== null ? `${b.gastosPct}%` : '—', sub: b.gastosTexto || 'Poné topes en Gastos para ver este análisis.', color: COLORS.coral },
    { titulo: 'Objetivos', valor: b.objetivosPct !== null ? `${b.objetivosPct}%` : '—', sub: b.objetivosTexto || 'Cargá un objetivo con monto para ver el progreso.', color: COLORS.gold },
    { titulo: 'Inversiones', valor: b.inversionPct !== null ? (b.inversionPct >= 100 ? '✓' : '~') : '—', sub: b.inversionTexto || 'Sumá un aporte en Inversiones para ver este análisis.', color: COLORS.green },
  ];

  // Reservas ("alcancía") — se mudó acá desde Home.
  const [reserva, setReserva] = useState(() => loadV2Reserva());
  const [reservaOpen, setReservaOpen] = useState(false);
  const [reservaVal, setReservaVal] = useState('');
  function guardarReserva() {
    const n = parseMoneyInput(reservaVal);
    if (!n) return;
    const nuevo = reserva + n;
    setReserva(nuevo);
    saveV2Reserva(nuevo);
    setReservaVal('');
    setReservaOpen(false);
  }

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
    <div className="px-[22px] pt-8 flex flex-col gap-6 lg:max-w-2xl lg:mx-auto">
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

      {/* Reservas (alcancía) — plata que apartás para no gastarla */}
      <div className="bg-white rounded-2xl p-4 shadow-[0_2px_18px_rgba(31,27,46,0.07)]">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.goldSoft }}>🔒</span>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-semibold" style={{ color: COLORS.ink }}>Reservas</p>
            <p className="text-[11.5px]" style={{ color: COLORS.inkSoft }}>{reserva > 0 ? `Tenés ${fmtMoney(reserva)} apartados` : 'Apartá plata para no gastarla — tipo alcancía.'}</p>
          </div>
          <button type="button" onClick={() => setReservaOpen((o) => !o)} className="text-[13px] font-semibold underline shrink-0" style={{ color: COLORS.brand }}>
            {reserva > 0 ? 'Sumar' : 'Reservar'}
          </button>
        </div>
        {reservaOpen && (
          <div className="mt-3 pt-3 border-t border-dashed flex gap-2" style={{ borderColor: 'rgba(31,27,46,0.14)' }}>
            <input
              autoFocus
              className="flex-1 min-w-0 border border-[rgba(31,27,46,0.16)] rounded-xl px-3 py-2 text-[13.5px] outline-none focus:border-[#7626B3] transition-colors"
              placeholder="¿Cuánto querés reservar?"
              inputMode="numeric"
              value={reservaVal}
              onChange={(e) => setReservaVal(formatThousands(e.target.value))}
            />
            <button type="button" onClick={guardarReserva} className="rounded-xl px-3.5 text-[12.5px] font-bold text-white transition-all duration-100 active:scale-95 shrink-0" style={{ background: COLORS.brand }}>
              Guardar
            </button>
          </div>
        )}
      </div>

      {/* Tu progreso — bienestar + análisis (se mudó desde Home) */}
      {hayBienestar && (
        <div className="flex flex-col gap-3">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Tu progreso</p>
          <div className="bg-white rounded-2xl p-4 shadow-[0_2px_18px_rgba(31,27,46,0.07)] flex gap-4 items-center">
            <svg viewBox="0 0 120 120" className="w-[92px] h-[92px] shrink-0">
              <Arco radius={50} pct={b.gastosPct} color={COLORS.coral} />
              <Arco radius={38} pct={b.objetivosPct} color={COLORS.gold} />
              <Arco radius={26} pct={b.inversionPct} color={COLORS.green} />
            </svg>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <p className="text-[12px] font-bold uppercase tracking-wide mb-0.5" style={{ color: COLORS.inkSoft }}>Tu bienestar financiero</p>
              {b.gastosPct !== null && (
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.ink }}><span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS.coral }} />{b.gastosTexto}</span>
              )}
              {b.objetivosPct !== null && (
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.ink }}><span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS.gold }} />{b.objetivosTexto}</span>
              )}
              {b.inversionPct !== null && (
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.ink }}><span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS.green }} />{b.inversionTexto}</span>
              )}
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto -mx-[22px] px-[22px] pb-1 lg:mx-0 lg:px-0 lg:overflow-visible lg:flex-wrap" style={{ scrollbarWidth: 'none' }}>
            {analisis.map((a) => (
              <AnalisisCard key={a.titulo} titulo={a.titulo} valor={a.valor} sub={a.sub} color={a.color} />
            ))}
          </div>
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
