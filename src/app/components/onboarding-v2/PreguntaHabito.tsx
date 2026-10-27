import { activarNotificaciones, notificacionesActivas, soporteNotificaciones } from '../../api/v2/notificaciones';
import { avisarConfirmacion } from '../../api/v2/almacen';
import { diasEnTexto, nombreDelDia, type SugerenciaHabito } from '../../lib/habitos';
import { marcarHabitoPreguntado } from '../../lib/habitosLocal';
import { Hoja } from './Hoja';
import { COLORS } from './shared';

// Después de anotar dos o tres veces el mismo gasto el mismo día de la semana:
// se pregunta si quiere que se lo recordemos. Con el sí, además, se piden los
// avisos del celular si todavía no los tiene (es lo que hace que le llegue en el
// momento justo). Se pregunta una sola vez por gasto.

export function PreguntaHabito({ habito, onCerrar }: { habito: SugerenciaHabito; onCerrar: () => void }) {
  function cerrar() {
    marcarHabitoPreguntado(habito.clave);
    onCerrar();
  }

  async function aceptar() {
    marcarHabitoPreguntado(habito.clave);
    // Si el celular puede recibir avisos y todavía no los tiene, es el momento de pedirlos.
    if (soporteNotificaciones() === 'si' && !(await notificacionesActivas())) await activarNotificaciones();
    else avisarConfirmacion('Listo, te lo vamos a recordar.');
    onCerrar();
  }

  return (
    <Hoja titulo="¿Te lo recordamos?" onCerrar={cerrar}>
      <div className="flex flex-col gap-3 pt-1">
        <p className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>
          Anotaste {habito.descripcion} {habito.veces === 2 ? 'dos' : 'tres'} veces un {nombreDelDia(habito.dia)}. ¿Querés que {diasEnTexto([habito.dia])} te preguntemos si lo gastaste?
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={cerrar} className="v2-focus flex-1 rounded-xl py-2.5 min-h-[44px] text-[13px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}>
            Ahora no
          </button>
          <button type="button" onClick={() => void aceptar()} className="v2-focus flex-[2] rounded-xl py-2.5 min-h-[44px] text-[13px] font-bold transition-all duration-100 active:scale-95" style={{ background: COLORS.brand, color: COLORS.surface }}>
            Sí, recordame
          </button>
        </div>
      </div>
    </Hoja>
  );
}
