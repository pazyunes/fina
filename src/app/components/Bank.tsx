import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { BackButton } from './BackButton';
import { OnboardingAside } from './OnboardingAside';
import { OnboardingProgress } from './OnboardingProgress';
import { UserData } from '../types';

interface BankProps {
  initial?: Partial<UserData>;
  onComplete: (data: { banks: string[] }) => void;
}

const BANKS = [
  'Mercado Pago',
  'Galicia',
  'Santander',
  'BBVA',
  'Banco Nación',
  'Banco Provincia',
  'Naranja X',
  'Brubank',
  'Ualá',
  'ICBC',
  'Efectivo',
  'Otro',
  'No uso banco'
];

export function Bank({ initial, onComplete }: BankProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Cualquier banco guardado que no esté en la lista es un "Otro" custom.
  const initialBanks = initial?.banks ?? [];
  const customInit = initialBanks.find((b) => !BANKS.includes(b));
  const [selectedBanks, setSelectedBanks] = useState<string[]>(
    customInit ? [...initialBanks.filter((b) => BANKS.includes(b)), 'Otro'] : initialBanks
  );
  const [otherText, setOtherText] = useState(customInit ?? '');

  const toggleBank = (bank: string) => {
    if (bank === 'No uso banco') {
      setSelectedBanks(selectedBanks.includes(bank) ? [] : [bank]);
    } else {
      setSelectedBanks(prev => {
        const filtered = prev.filter(b => b !== 'No uso banco');
        if (prev.includes(bank)) {
          return filtered.filter(b => b !== bank);
        } else {
          return [...filtered, bank];
        }
      });
    }
  };

  const otherSelected = selectedBanks.includes('Otro');
  const canContinue = selectedBanks.length > 0 && (!otherSelected || otherText.trim() !== '');

  const handleSubmit = () => {
    if (!canContinue) return;
    // Reemplazamos 'Otro' por el texto que escribió la usuaria.
    const banks = otherSelected && otherText.trim()
      ? [...selectedBanks.filter((b) => b !== 'Otro'), otherText.trim()]
      : selectedBanks;
    onComplete({ banks });
    navigate('/expenses-fixed');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#F0E7FA] flex flex-col lg:pl-72">
      <OnboardingAside currentPath={pathname} />
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md lg:max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <BackButton currentPath={pathname} />

          <div className="mb-6">
            <h2
              className="text-3xl mb-2 text-[#7626B3]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              ¿Dónde tenés tu plata?
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              Elegí los bancos o billeteras que uses. Podés marcar varios
            </p>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {BANKS.map(bank => (
              <div
                key={bank}
                onClick={() => toggleBank(bank)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedBanks.includes(bank)
                    ? 'border-[#7626B3] bg-[#F0E7FA]'
                    : 'border-gray-200 bg-white hover:border-[#7626B3]/50'
                }`}
              >
                <Checkbox
                  checked={selectedBanks.includes(bank)}
                  onCheckedChange={() => toggleBank(bank)}
                  className="data-[state=checked]:bg-[#7626B3] data-[state=checked]:border-[#7626B3]"
                />
                <span className="text-gray-700">{bank}</span>
              </div>
            ))}
          </div>

          {otherSelected && (
            <Input
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="¿Cuál? Escribilo acá"
              className="mt-3 rounded-xl"
              autoFocus
            />
          )}

          <Button
            onClick={handleSubmit}
            disabled={!canContinue}
            className="w-full bg-[#059669] hover:bg-[#047857] text-white py-5 rounded-full text-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continuar
          </Button>
        </motion.div>
      </div>

      <div className="p-4">
        <OnboardingProgress currentPath={pathname} />
      </div>
    </div>
  );
}
