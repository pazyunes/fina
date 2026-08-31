import { useState } from 'react';
import { Chip, Cta, COLORS } from './shared';

// REDISEÑO v2 — Inversiones: arranca con la tarjeta "Averiguar mi perfil de
// inversor" (boceto), lleva a un mini-quiz con el stepper de puntitos, y al
// final pregunta bancos/métodos de pago + cuánto riesgo banca, para saber
// qué recomendar. Nunca ejecuta la inversión — solo visualiza/orienta.

type Paso = 'intro' | 'q1' | 'q2' | 'bancos' | 'resultado';

const PREGUNTAS = ['q1', 'q2', 'bancos'] as const;

const BANCOS = ['Mercado Pago', 'Uala', 'Naranja X', 'Banco tradicional', 'Otro'];

export function InversionesV2() {
  const [paso, setPaso] = useState<Paso>('intro');
  const [porQue, setPorQue] = useState<string | null>(null);
  const [reaccion, setReaccion] = useState<string | null>(null);
  const [bancos, setBancos] = useState<string[]>([]);

  const stepIndex = PREGUNTAS.indexOf(paso as any);

  function next() {
    const order: Paso[] = ['q1', 'q2', 'bancos', 'resultado'];
    const i = order.indexOf(paso);
    setPaso(order[Math.min(i + 1, order.length - 1)]);
  }

  const toggleBanco = (b: string) => setBancos((v) => v.includes(b) ? v.filter((x) => x !== b) : [...v, b]);

  if (paso === 'intro') {
    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4">
        <h1 className="font-['Baloo_2'] text-[22px] font-bold text-[#1E1E1E]">Inversiones</h1>
        <button
          type="button"
          onClick={() => setPaso('q1')}
          className="text-left bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-5 shadow-[4px_4px_0_#1E1E1E] flex flex-col gap-2"
        >
          <span className="font-['Baloo_2'] text-[18px] font-bold text-[#1E1E1E]">Averiguá tu perfil de inversor</span>
          <span className="text-[13.5px] text-[#5b5b52]">Esto te ayuda a ver qué inversiones te convienen — sin comprometerte a nada.</span>
          <span className="self-end text-[20px]">→</span>
        </button>
      </div>
    );
  }

  if (paso === 'resultado') {
    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4">
        <span className="self-start rounded-full border-2 border-[#1E1E1E] px-3 py-1 text-[12px] font-bold" style={{ background: COLORS.mintLight }}>
          🌿 Perfil neutro
        </span>
        <h1 className="font-['Baloo_2'] text-[20px] font-bold text-[#1E1E1E]">Esto ayuda a pensar qué inversiones te convienen</h1>
        <div className="flex flex-col gap-3">
          {[
            { name: 'Plazo fijo tradicional', tag: 'Bajo riesgo', body: 'Sabés exactamente cuánto te devuelve.' },
            { name: 'Fondo común de inversión', tag: 'Riesgo moderado', body: 'Combina instrumentos, gestionado por profesionales.' },
            { name: 'Dólar MEP', tag: 'Cobertura', body: 'Protegés lo ahorrado de la devaluación.' },
          ].map((o) => (
            <div key={o.name} className="bg-white border-[2px] border-[#1E1E1E] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-[14.5px] text-[#1E1E1E]">{o.name}</p>
                <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5" style={{ background: COLORS.yellowSoft }}>{o.tag}</span>
              </div>
              <p className="text-[12.5px] text-[#5b5b52] mt-1">{o.body}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // q1 / q2 / bancos comparten el layout del stepper
  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4">
      <div className="flex justify-center gap-2">
        {PREGUNTAS.map((_, i) => (
          <span key={i} className="w-2.5 h-2.5 rounded-full border-2 border-[#1E1E1E]" style={{ background: i <= stepIndex ? COLORS.mint : '#fff' }} />
        ))}
      </div>

      {paso === 'q1' && (
        <>
          <h1 className="font-['Baloo_2'] text-[20px] font-bold text-[#1E1E1E]">¿Por qué querés invertir?</h1>
          <div className="flex flex-wrap gap-2.5">
            {['Para sacarla pronto', 'Para mantenerla en otro lado'].map((o) => (
              <Chip key={o} on={porQue === o} onClick={() => setPorQue(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'q2' && (
        <>
          <h1 className="font-['Baloo_2'] text-[20px] font-bold text-[#1E1E1E]">Si lo que invertiste baja 20%, ¿qué hacés?</h1>
          <div className="flex flex-wrap gap-2.5">
            {['Lo saco todo', 'Lo dejo y espero', 'Pongo más'].map((o) => (
              <Chip key={o} on={reaccion === o} onClick={() => setReaccion(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'bancos' && (
        <>
          <h1 className="font-['Baloo_2'] text-[20px] font-bold text-[#1E1E1E]">¿Qué bancos o métodos de pago usás?</h1>
          <p className="text-[13px] text-[#5b5b52]">Así sabemos qué recomendarte concretamente.</p>
          <div className="flex flex-wrap gap-2.5">
            {BANCOS.map((b) => (
              <Chip key={b} on={bancos.includes(b)} onClick={() => toggleBanco(b)}>{b}</Chip>
            ))}
          </div>
        </>
      )}

      <Cta label={paso === 'bancos' ? 'Ver mi resultado' : 'Continuar'} onClick={next} />
    </div>
  );
}
