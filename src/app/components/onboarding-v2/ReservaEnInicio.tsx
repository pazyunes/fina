import { useState } from 'react';
import { COLORS, EstadoConfianza, Fila, Monto, formatThousands, loadV2Reserva, parseMoneyInput, saveV2Reserva } from './shared';
import { IconReserva } from './FinaIcons';
import { Hoja } from './Hoja';

// La reserva ("alcancía"): plata que la persona apartó para no gastarla. Antes
// era una tarjeta en Inicio con el formulario desplegado debajo; ahora es una
// fila que abre una hoja aparte para sumar (regla 12). Hace lo mismo que antes:
// lo que se escribe se suma a lo que ya había.
//
// El monto lo cargó la persona: es un dato declarado (frontend.md §5.1).
export function ReservaEnInicio() {
  const reserva = loadV2Reserva();
  const [abierta, setAbierta] = useState(false);
  const [valor, setValor] = useState('');

  function cerrar() {
    setValor('');
    setAbierta(false);
  }

  function guardar() {
    const n = parseMoneyInput(valor);
    if (!n) return;
    saveV2Reserva(reserva + n);
    cerrar();
  }

  return (
    <>
      <Fila
        icon={<IconReserva size={18} />}
        label="Reservas"
        detalle={reserva > 0
          ? (
            <span className="flex flex-col gap-1">
              <span>Tenés <Monto value={reserva} className="text-[14px]" /> apartados</span>
              <EstadoConfianza estado="declarado" />
            </span>
          )
          : 'Apartá plata para no gastarla, como en una alcancía.'}
        onClick={() => setAbierta(true)}
      />
      {abierta && (
        <Hoja titulo="Reservas" onCerrar={cerrar}>
          <div className="flex flex-col gap-3">
            <input
              autoFocus
              className="v2-focus w-full rounded-xl px-3 py-2 min-h-[44px] text-[16px] outline-none"
              style={{ border: `1.5px solid ${COLORS.lineStrong}`, color: COLORS.ink, background: COLORS.surface }}
              placeholder="¿Cuánto querés reservar?"
              inputMode="decimal"
              aria-label="Monto a reservar"
              value={valor}
              onChange={(e) => setValor(formatThousands(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
            />
            <button
              type="button"
              onClick={guardar}
              disabled={!parseMoneyInput(valor)}
              className="v2-focus w-full rounded-2xl min-h-[48px] text-[16px] font-bold transition-all duration-100 active:scale-[0.99] disabled:opacity-50"
              style={{ background: COLORS.brand, color: COLORS.surface }}
            >
              Guardar
            </button>
          </div>
        </Hoja>
      )}
    </>
  );
}
