import { useState } from 'react';
import type { TipoPosicion } from '../../../api/v2/tipos';
import { nombreProducto, ORDEN_PRODUCTOS } from '../../../lib/inversiones/catalogo';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import type { Valores } from '../../../lib/inversiones/registro';
import { COLORS, OpcionesGrid, TituloSeccion } from '../shared';
import { Felicitaciones } from './Felicitaciones';
import { FormularioRegistro } from './FormularioRegistro';
import { Hoja } from './Hoja';

// Anotar una inversión que ya hiciste, desde "Mis inversiones" (o desde el paso a paso, que usa el mismo formulario
// adentro de su último paso). Cada tipo pide sólo lo que se ve en la app después de invertir. También se puede subir
// una captura o un PDF: lo leemos y la persona revisa antes de guardar. El archivo no se guarda.
export function RegistroPosicion({
  tipoInicial, previos, mercado, onCerrar, onVolver, onVerMias,
}: {
  tipoInicial?: TipoPosicion;
  previos?: Partial<Valores>;
  mercado: Mercado | null;
  onCerrar: () => void;
  /** Si se llegó desde el paso a paso: vuelve a los pasos, sin perder lo hecho. */
  onVolver?: () => void;
  onVerMias?: () => void;
}) {
  const [tipo, setTipo] = useState<TipoPosicion | null>(tipoInicial ?? null);
  const [datos, setDatos] = useState<{ previos?: Partial<Valores>; leidos: string[]; clave: number }>({ previos, leidos: [], clave: 0 });
  const [guardado, setGuardado] = useState(false);

  const titulo = tipo ? `Registrar: ${nombreProducto(tipo)}` : 'Registrar una inversión';

  return (
    <Hoja titulo={titulo} onCerrar={onCerrar} ancho={460} onVolver={guardado ? undefined : (tipo && !tipoInicial ? () => setTipo(null) : onVolver)}>
      {guardado && tipo ? (
        <Felicitaciones nombre={nombreProducto(tipo).toLowerCase()} onListo={() => { onCerrar(); onVerMias?.(); }} />
      ) : (
        <>
          {!tipo && (
            <div className="flex flex-col gap-2.5">
              <TituloSeccion>¿Qué hiciste?</TituloSeccion>
              <OpcionesGrid
                opciones={ORDEN_PRODUCTOS.map((id) => ({ id, label: nombreProducto(id) }))}
                valor={null}
                onElegir={(t) => { setTipo(t); setDatos({ previos, leidos: [], clave: datos.clave + 1 }); }}
              />
            </div>
          )}
          {tipo && (
            <>
              <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>Es solo anotar lo que ya hiciste en tu app: FINA no mueve ni toca tu plata.</p>
              <FormularioRegistro
                key={`${tipo}-${datos.clave}`}
                tipo={tipo}
                previos={datos.previos}
                leidosIniciales={datos.leidos}
                mercado={mercado}
                onCambiarTipo={(t, valores, leidos) => { setTipo(t); setDatos({ previos: valores, leidos, clave: datos.clave + 1 }); }}
                onGuardado={() => setGuardado(true)}
              />
            </>
          )}
        </>
      )}
    </Hoja>
  );
}
