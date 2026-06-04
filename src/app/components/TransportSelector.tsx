import { motion } from 'motion/react';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Car, Bus, Smartphone } from 'lucide-react';
import { AMOUNT_FIELD_CLASS } from '../onboarding/ui';
import { TransportData } from '../types';

interface TransportSelectorProps {
  value: TransportData;
  onChange: (data: TransportData) => void;
  showValidation?: boolean;
}

// Export helper to validate transport data
export function isTransportDataValid(data: TransportData): boolean {
  const isCarValid = !data.hasCar || (data.insuranceNotPaying || data.insurance > 0) && (data.fuelNotPaying || data.fuel > 0);
  const isPublicTransportValid = !data.hasPublicTransport || (data.publicTransportTrips > 0 && data.publicTransportCostPerTrip > 0);
  const isRideAppsValid = !data.hasRideApps || (data.rideAppTrips > 0 && data.rideAppCostPerTrip > 0);
  return isCarValid && isPublicTransportValid && isRideAppsValid;
}

export function TransportSelector({ value, onChange, showValidation = false }: TransportSelectorProps) {
  const formatCurrency = (val: number) => {
    return val > 0 ? `$${val.toLocaleString('es-AR').replace(/,/g, '.')}` : '';
  };

  const parseCurrency = (val: string) => {
    const num = parseInt(val.replace(/\D/g, '')) || 0;
    return Math.max(0, num);
  };

  const updateData = (updates: Partial<TransportData>) => {
    onChange({ ...value, ...updates });
  };

  // Calculate costs
  const publicTransportMonthlyCost = Math.round(value.publicTransportTrips * value.publicTransportCostPerTrip * 4.33);
  const rideAppMonthlyCost = Math.round(value.rideAppTrips * value.rideAppCostPerTrip * 4.33);

  const carInsuranceCost = value.insuranceNotPaying ? 0 : value.insurance;
  const carFuelCost = value.fuelNotPaying ? 0 : value.fuel;
  const carMonthlyCost = carInsuranceCost + carFuelCost;
  const totalTransportCost = carMonthlyCost + publicTransportMonthlyCost + rideAppMonthlyCost;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <h3 className="text-lg mb-4 text-[#7E2EA8]" style={{ fontFamily: 'var(--font-sans)' }}>
          ¿Cómo te movés?
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Podés seleccionar más de una opción
        </p>

        <div className="space-y-6">
          {/* Option A: Car/Motorcycle */}
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <Checkbox
                id="transport-car"
                checked={value.hasCar}
                onCheckedChange={(checked) =>
                  updateData({
                    hasCar: !!checked,
                    insurance: checked ? value.insurance : 0,
                    fuel: checked ? value.fuel : 0
                  })
                }
              />
              <label
                htmlFor="transport-car"
                className="flex items-center gap-3 cursor-pointer flex-1"
              >
                <div className="w-10 h-10 rounded-full bg-[#9C7AA5]/20 flex items-center justify-center">
                  <Car className="w-5 h-5 text-[#9C7AA5]" />
                </div>
                <span className="text-gray-700 font-medium">Auto o moto</span>
              </label>
            </div>

            {value.hasCar && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3 ml-11"
              >
                <div>
                  <Label className="text-sm text-gray-600 mb-2 block">Seguro ($/mes)</Label>
                  <div className="flex items-center gap-2 mb-2">
                    <Switch
                      checked={value.insuranceNotPaying}
                      onCheckedChange={(checked) => {
                        updateData({
                          insuranceNotPaying: checked,
                          insurance: checked ? 0 : value.insurance
                        });
                      }}
                      className="data-[state=checked]:bg-[#7E2EA8]"
                    />
                    <span className="text-sm text-gray-500">No lo pago yo</span>
                  </div>
                  {value.insuranceNotPaying && (
                    <div className="mb-2 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                      <span className="text-xs text-gray-600">Cubierto por otro</span>
                    </div>
                  )}
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formatCurrency(value.insurance)}
                    onChange={(e) => updateData({ insurance: parseCurrency(e.target.value) })}
                    placeholder="$0"
                    className={`mt-1 ${AMOUNT_FIELD_CLASS} ${showValidation && !value.insuranceNotPaying && value.insurance === 0 ? 'border-red-500' : ''}`}
                    disabled={value.insuranceNotPaying}
                    style={{
                      opacity: value.insuranceNotPaying ? 0.4 : 1,
                      backgroundColor: value.insuranceNotPaying ? '#f3f3f5' : undefined
                    }}
                  />
                  {showValidation && !value.insuranceNotPaying && value.insurance === 0 && (
                    <p className="text-red-500 text-sm mt-1">Completá este campo para continuar.</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-600 mb-2 block">Nafta ($/mes)</Label>
                  <div className="flex items-center gap-2 mb-2">
                    <Switch
                      checked={value.fuelNotPaying}
                      onCheckedChange={(checked) => {
                        updateData({
                          fuelNotPaying: checked,
                          fuel: checked ? 0 : value.fuel
                        });
                      }}
                      className="data-[state=checked]:bg-[#7E2EA8]"
                    />
                    <span className="text-sm text-gray-500">No lo pago yo</span>
                  </div>
                  {value.fuelNotPaying && (
                    <div className="mb-2 px-3 py-1.5 bg-gray-100 rounded-lg inline-block">
                      <span className="text-xs text-gray-600">Cubierto por otro</span>
                    </div>
                  )}
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formatCurrency(value.fuel)}
                    onChange={(e) => updateData({ fuel: parseCurrency(e.target.value) })}
                    placeholder="$0"
                    className={`mt-1 ${AMOUNT_FIELD_CLASS} ${showValidation && !value.fuelNotPaying && value.fuel === 0 ? 'border-red-500' : ''}`}
                    disabled={value.fuelNotPaying}
                    style={{
                      opacity: value.fuelNotPaying ? 0.4 : 1,
                      backgroundColor: value.fuelNotPaying ? '#f3f3f5' : undefined
                    }}
                  />
                  {showValidation && !value.fuelNotPaying && value.fuel === 0 && (
                    <p className="text-red-500 text-sm mt-1">Completá este campo para continuar.</p>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Option B: Public Transport */}
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <Checkbox
                id="transport-public"
                checked={value.hasPublicTransport}
                onCheckedChange={(checked) =>
                  updateData({
                    hasPublicTransport: !!checked,
                    publicTransportTrips: checked ? value.publicTransportTrips : 0
                  })
                }
              />
              <label
                htmlFor="transport-public"
                className="flex items-center gap-3 cursor-pointer flex-1"
              >
                <div className="w-10 h-10 rounded-full bg-[#3B6D11]/20 flex items-center justify-center">
                  <Bus className="w-5 h-5 text-[#3B6D11]" />
                </div>
                <span className="text-gray-700 font-medium">Transporte público</span>
              </label>
            </div>

            {value.hasPublicTransport && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="ml-11 space-y-3"
              >
                <div>
                  <Label className="text-sm text-gray-600">¿Cuántos viajes por semana?</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="1"
                    max="50"
                    step="1"
                    value={value.publicTransportTrips || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if ((val >= 1 && val <= 50) || e.target.value === '') {
                        updateData({ publicTransportTrips: val || 0 });
                      }
                    }}
                    placeholder="Ej: 10"
                    className={`mt-1 ${showValidation && value.publicTransportTrips === 0 ? 'border-red-500' : ''}`}
                  />
                  {showValidation && value.publicTransportTrips === 0 && (
                    <p className="text-red-500 text-sm mt-1">Completá este campo para continuar.</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm text-gray-600">Costo promedio por viaje</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formatCurrency(value.publicTransportCostPerTrip)}
                    onChange={(e) => {
                      const num = parseCurrency(e.target.value);
                      updateData({ publicTransportCostPerTrip: num });
                    }}
                    placeholder="$400"
                    className={`mt-1 ${AMOUNT_FIELD_CLASS}`}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Valor de referencia. Editalo según tu tarifa real.
                  </p>
                  {value.publicTransportCostPerTrip === 0 && (
                    <p className="text-red-500 text-xs mt-1">El costo no puede ser 0</p>
                  )}
                </div>

                {value.publicTransportTrips > 0 && value.publicTransportCostPerTrip > 0 && (
                  <div className="pt-2">
                    <p className="text-sm text-gray-700 font-medium">
                      ≈ ${publicTransportMonthlyCost.toLocaleString('es-AR').replace(/,/g, '.')}/mes estimado
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Usamos 4.33 semanas por mes en promedio. Podés ajustar el costo por viaje si tu tarifa es diferente.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Option C: Ride Apps */}
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <Checkbox
                id="transport-apps"
                checked={value.hasRideApps}
                onCheckedChange={(checked) =>
                  updateData({
                    hasRideApps: !!checked,
                    rideAppTrips: checked ? value.rideAppTrips : 0
                  })
                }
              />
              <label
                htmlFor="transport-apps"
                className="flex items-center gap-3 cursor-pointer flex-1"
              >
                <div className="w-10 h-10 rounded-full bg-[#D85A30]/20 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-[#D85A30]" />
                </div>
                <span className="text-gray-700 font-medium">Remis o app (Uber, Cabify, etc.)</span>
              </label>
            </div>

            {value.hasRideApps && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="ml-11 space-y-3"
              >
                <div>
                  <Label className="text-sm text-gray-600">¿Cuántos viajes por semana?</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="1"
                    max="50"
                    step="0.5"
                    value={value.rideAppTrips || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if ((val >= 1 && val <= 50) || e.target.value === '') {
                        updateData({ rideAppTrips: val || 0 });
                      }
                    }}
                    placeholder="Ej: 2"
                    className={`mt-1 ${showValidation && value.rideAppTrips === 0 ? 'border-red-500' : ''}`}
                  />
                  {showValidation && value.rideAppTrips === 0 && (
                    <p className="text-red-500 text-sm mt-1">Completá este campo para continuar.</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm text-gray-600">Costo promedio por viaje</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formatCurrency(value.rideAppCostPerTrip)}
                    onChange={(e) => {
                      const num = parseCurrency(e.target.value);
                      updateData({ rideAppCostPerTrip: num });
                    }}
                    placeholder="$4.000"
                    className={`mt-1 ${AMOUNT_FIELD_CLASS}`}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Valor de referencia. Editalo según tu tarifa real.
                  </p>
                  {value.rideAppCostPerTrip === 0 && (
                    <p className="text-red-500 text-xs mt-1">El costo no puede ser 0</p>
                  )}
                </div>

                {value.rideAppTrips > 0 && value.rideAppCostPerTrip > 0 && (
                  <div className="pt-2">
                    <p className="text-sm text-gray-700 font-medium">
                      ≈ ${rideAppMonthlyCost.toLocaleString('es-AR').replace(/,/g, '.')}/mes estimado
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Calculado con 4.33 semanas por mes en promedio.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Total Transport Cost */}
        {totalTransportCost > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 pt-6 border-t-2 border-gray-200"
          >
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-gray-700">
                Total movilidad:
              </span>
              <span className="text-2xl font-medium text-[#7E2EA8]">
                ${totalTransportCost.toLocaleString('es-AR').replace(/,/g, '.')}/mes
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
