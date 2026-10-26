import { BotonVolver, Titulo, useVolver } from './shared';
import { ListaGastosFijos } from './GastosFijos';

// Todos tus gastos fijos. Se llega desde "Ver todos" en Gastos, que muestra
// sólo los primeros 5, igual que con los ingresos. "Ya lo pagué" y borrar se
// abren en el mismo renglón.
export function TodosLosGastosFijos() {
  const volver = useVolver('/onboarding-v2/gastos');

  return (
    <div className="px-[22px] pt-4 flex flex-col gap-3 pb-4 lg:max-w-2xl lg:mx-auto lg:pt-6">
      <header className="flex flex-col gap-1">
        <BotonVolver onClick={volver} />
        <Titulo>Todos tus gastos fijos</Titulo>
      </header>
      <ListaGastosFijos completa />
    </div>
  );
}
