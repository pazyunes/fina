import { useMemo, useState } from 'react';
import { BotonVolver, COLORS, Titulo, useVolver } from './shared';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { FilaSeccion } from './FilaSeccion';
import { colorDeSeccion, gastosDeLaBase, inicioDelMes, seccionesDeLaBase, ultimoGasto } from './datosGasto';

// Tus secciones, todas. Se llega desde "Ver todas" en Gastos, que muestra sólo
// las 5 con gastos más recientes. Acá están también las que este mes no tienen
// gastos, y es el único lugar donde se renombran y se borran. Van de la del
// gasto más reciente a la del más viejo, igual que en Gastos.

export function TodasLasSecciones() {
  const volver = useVolver('/onboarding-v2/gastos');
  const { estado: db } = useAlmacen();
  const { categorias, topes } = useMemo(() => seccionesDeLaBase(db), [db]);
  const gastos = useMemo(() => gastosDeLaBase(db), [db]);
  const [abiertaId, setAbiertaId] = useState<string | null>(null);

  // Lo gastado este mes: el mismo número que muestra Gastos por mes.
  const desde = inicioDelMes();
  const gastadoEn = (id: string) => gastos.filter((g) => g.categoriaId === id && g.ts >= desde).reduce((t, g) => t + g.montoArs, 0);
  const ultimo = ultimoGasto(gastos, (g) => [g.categoriaId]);
  const ordenadas = [...categorias].sort((a, b) => (ultimo.get(b.id) ?? 0) - (ultimo.get(a.id) ?? 0));

  return (
    <div className="px-[22px] pt-4 flex flex-col gap-3 pb-4 lg:max-w-2xl lg:mx-auto lg:pt-6">
      <header className="flex flex-col gap-1">
        <BotonVolver onClick={volver} />
        <Titulo>Tus categorías</Titulo>
      </header>

      {categorias.length === 0 ? (
        <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>
          Las categorías aparecen cuando registrás gastos.
        </p>
      ) : (
        <div className="flex flex-col">
          {ordenadas.map((c) => (
            <FilaSeccion
              key={c.id}
              cat={c}
              color={colorDeSeccion(c.id, categorias)}
              gastado={gastadoEn(c.id)}
              referencia="este mes"
              tope={topes[c.id]}
              cantGastos={gastos.filter((g) => g.categoriaId === c.id).length}
              abierta={abiertaId === c.id}
              onAbrir={(abrir) => setAbiertaId(abrir ? c.id : null)}
              conEdicion
            />
          ))}
        </div>
      )}
    </div>
  );
}
