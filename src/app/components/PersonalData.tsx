import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { BackButton } from './BackButton';
import { OnboardingProgress } from './OnboardingProgress';
import { UserData } from '../types';

type Gender = 'femenino' | 'masculino' | 'prefiero_no_decir';

interface PersonalDataProps {
  initial?: Partial<UserData>;
  onComplete: (data: { name: string; age: string; email: string; gender: Gender }) => void;
}

export function PersonalData({ initial, onComplete }: PersonalDataProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // PR6c — Email se omite del form (ya se pidió en el signup; Main lo
  // prefille en userData.email desde session.user.email). Lo seguimos
  // pasando en onComplete porque el resto del flujo lo consume.
  const [formData, setFormData] = useState<{ name: string; age: string; gender: Gender | '' }>({
    name: initial?.name ?? '',
    age: initial?.age ?? '',
    gender: initial?.gender ?? ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.age && formData.gender) {
      onComplete({ ...formData, email: initial?.email ?? '', gender: formData.gender as Gender });
      navigate('/context');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#F3E9F8] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <BackButton currentPath={pathname} />

          <div className="mb-6">
            <h2
              className="text-3xl mb-2 text-[#9A3D9E]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Empecemos por conocernos
            </h2>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-sans)' }}>
              Solo necesitamos algunos datos básicos
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name" className="text-gray-700">
                ¿Cómo te llamás?
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Tu nombre"
                required
                className="mt-2 bg-white border-gray-200 focus:border-[#9A3D9E] focus:ring-[#9A3D9E] rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="age" className="text-gray-700">
                ¿Cuántos años tenés?
              </Label>
              <Input
                id="age"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.age}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 0 || e.target.value === '') {
                    setFormData({ ...formData, age: e.target.value });
                  }
                }}
                placeholder="Edad"
                required
                min="18"
                max="100"
                className="mt-2 bg-white border-gray-200 focus:border-[#9A3D9E] focus:ring-[#9A3D9E] rounded-xl"
              />
            </div>

            <div>
              <Label className="text-gray-700">
                ¿Con qué género te identificás?
              </Label>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {([
                  { value: 'femenino', label: 'Femenino' },
                  { value: 'masculino', label: 'Masculino' },
                  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
                ] as { value: Gender; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: opt.value })}
                    className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      formData.gender === opt.value
                        ? 'border-[#9A3D9E] bg-[#F3E9F8] text-[#9A3D9E]'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-[#9A3D9E]/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={!formData.name || !formData.age || !formData.gender}
              className="w-full bg-[#9A3D9E] hover:bg-[#7E3082] text-white py-5 rounded-full text-lg mt-6 disabled:opacity-50"
            >
              Continuar
            </Button>
          </form>
        </motion.div>
      </div>

      <div className="p-4">
        <OnboardingProgress currentPath={pathname} />
      </div>
    </div>
  );
}
