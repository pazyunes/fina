import { useState } from 'react';
import { BotonVolver, COLORS, Titulo, useVolver } from './shared';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { FilaIngreso } from './IngresosVsGastos';

// Todos tus ingresos, de todos los períodos. Se llega desde "Ver todos" en
// Gastos, que muestra sólo los últimos 5, igual que con los gastos. Editar y
// borrar se abren en el mismo renglón.
export function TodosLosIngresos() {
  const volver = useVolver('/onboarding-v2/gastos');
  const { estado: db } = useAlmacen();
  const ingresos = [...db.ingresos].sort((a, b) => b.ts - a.ts);
  // Lo desplegado para borrar, de a un ingreso por vez.
  const [borrando, setBorrando] = useState<string | null>(null);

  return (
    <div className="px-[22px] pt-4 flex flex-col gap-3 pb-4 lg:max-w-2xl lg:mx-auto lg:pt-6">
      <header className="flex flex-col gap-1">
        <BotonVolver onClick={volver} />
        <Titulo>Todos tus ingresos</Titulo>
      </header>

      <div className="flex flex-col">
        {ingresos.length === 0 && <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste ingresos.</p>}
        {ingresos.map((i) => (
          <FilaIngreso
            key={i.id}
            ingreso={i}
            abierto={borrando === i.id}
            onAbrir={() => setBorrando(borrando === i.id ? null : i.id)}
            onCerrar={() => setBorrando(null)}
          />
        ))}
      </div>
    </div>
  );
}
