import { useMemo, useState } from 'react';
import { BotonVolver, COLORS, Titulo, useVolver } from './shared';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { FilaSeccion } from './FilaSeccion';
import { colorDeSeccion, gastosDeLaBase, inicioDelMes, seccionesDeLaBase } from './datosGasto';

// Tus secciones, todas. Se llega desde "Consultar todas" en Gastos, que
// muestra sólo las 5 donde más se gastó. Acá están también las que este mes
// no tienen gastos, y es el único lugar donde se renombran y se borran.

export function TodasLasSecciones() {
  const volver = useVolver('/onboarding-v2/gastos');
  const { estado: db } = useAlmacen();
  const { categorias, topes } = useMemo(() => seccionesDeLaBase(db), [db]);
  const gastos = useMemo(() => gastosDeLaBase(db), [db]);
  const [abiertaId, setAbiertaId] = useState<string | null>(null);

  // Lo gastado este mes: el mismo número que muestra Gastos por mes.
  const desde = inicioDelMes();
  const gastadoEn = (id: string) => gastos.filter((g) => g.categoriaId === id && g.ts >= desde).reduce((t, g) => t + g.montoArs, 0);
  const ordenadas = [...categorias].sort((a, b) => gastadoEn(b.id) - gastadoEn(a.id));

  return (
    <div className="px-[22px] pt-4 flex flex-col gap-3 pb-4 lg:max-w-2xl lg:mx-auto lg:pt-6">
      <header className="flex flex-col gap-1">
        <BotonVolver onClick={volver} />
        <Titulo>Tus secciones</Titulo>
      </header>

      {categorias.length === 0 ? (
        <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
          Cuando registres tu primer gasto, cada sección aparece sola acá.
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
