import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { BackButton } from './BackButton';
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
  'Otro',
  'No uso banco'
];

export function Bank({ initial, onComplete }: BankProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [selectedBanks, setSelectedBanks] = useState<string[]>(initial?.banks ?? []);

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

  const handleSubmit = () => {
    if (selectedBanks.length > 0) {
      onComplete({ banks: selectedBanks });
      navigate('/expenses-fixed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#F1E8F8] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <BackButton currentPath={pathname} />

          <div className="mb-6">
            <h2
              className="text-3xl mb-2 text-[#7E2EA8]"
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
                    ? 'border-[#7E2EA8] bg-[#F1E8F8]'
                    : 'border-gray-200 bg-white hover:border-[#7E2EA8]/50'
                }`}
              >
                <Checkbox
                  checked={selectedBanks.includes(bank)}
                  onCheckedChange={() => toggleBank(bank)}
                  className="data-[state=checked]:bg-[#7E2EA8] data-[state=checked]:border-[#7E2EA8]"
                />
                <span className="text-gray-700">{bank}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={selectedBanks.length === 0}
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
