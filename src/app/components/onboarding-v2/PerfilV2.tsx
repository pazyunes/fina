import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ActionRow, COLORS, Face, loadV2Foto, loadV2Nombre, saveV2Foto, saveV2Nombre } from './shared';

// REDISEÑO v2 — Perfil: foto (de verdad, se guarda en este navegador) +
// nombre editable, y la puerta de entrada a "Mis grupos". Se llega
// tocando el avatar en Home.
export function PerfilV2() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<string | null>(() => loadV2Foto());
  const [nombre, setNombre] = useState(() => loadV2Nombre());
  const [guardado, setGuardado] = useState(false);

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

      <ActionRow
        icon={<span className="text-lg">👥</span>}
        label="Mis grupos"
        onClick={() => navigate('/onboarding-v2/grupos')}
      />
    </div>
  );
}
