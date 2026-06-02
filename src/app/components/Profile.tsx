import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { LogOut, CircleUserRound, Pencil } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth, Profile as ProfileData } from '../lib/auth';

const GENDER_OPTIONS: { value: ProfileData['gender']; label: string }[] = [
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

const genderLabel = (g: ProfileData['gender']) =>
  GENDER_OPTIONS.find((o) => o.value === g)?.label ?? 'Sin especificar';

export function Profile() {
  const navigate = useNavigate();
  const { user, profile, signOut, updateProfile } = useAuth();

  // Edición de datos del perfil.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: profile.name, age: profile.age, email: user?.email ?? '', gender: profile.gender });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const startEditing = () => {
    setForm({ name: profile.name, age: profile.age, email: user?.email ?? '', gender: profile.gender });
    setFeedback(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const { error, emailChangePending } = await updateProfile(form);
    setSaving(false);
    if (error) {
      setFeedback(error);
      return;
    }
    setEditing(false);
    if (emailChangePending) {
      setFeedback('Te enviamos un email a la nueva dirección para confirmar el cambio.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex flex-col">
      <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl text-[#D4537E]" style={{ fontFamily: 'var(--font-serif)' }}>
              Tu perfil
            </h1>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#D4537E]"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>

          {/* Tarjeta de datos del perfil con avatar predeterminado */}
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            <div className="flex items-center gap-4">
              <CircleUserRound className="w-16 h-16 text-[#D4537E] shrink-0" strokeWidth={1.25} />
              <div className="min-w-0 flex-1">
                <p className="text-lg text-gray-800 truncate">{profile.name || 'Sin nombre'}</p>
                <p className="text-sm text-gray-500 break-all">{user?.email}</p>
              </div>
              {!editing && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="flex items-center gap-1 text-sm text-[#D4537E] hover:underline shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>

            {!editing ? (
              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div>
                  <p className="text-gray-400">Edad</p>
                  <p className="text-gray-700">{profile.age || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Sexo</p>
                  <p className="text-gray-700">{genderLabel(profile.gender)}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="p-name" className="text-gray-700 text-sm">Nombre</Label>
                  <Input
                    id="p-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="p-email" className="text-gray-700 text-sm">Email</Label>
                  <Input
                    id="p-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 rounded-xl"
                  />
                  <p className="text-xs text-gray-400 mt-1">Cambiar el email pide confirmación por correo.</p>
                </div>
                <div>
                  <Label htmlFor="p-age" className="text-gray-700 text-sm">Edad</Label>
                  <Input
                    id="p-age"
                    type="number"
                    inputMode="numeric"
                    min="18"
                    max="100"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 text-sm">Sexo</Label>
                  <div className="mt-1 grid grid-cols-1 gap-2">
                    {GENDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, gender: opt.value })}
                        className={`text-left px-4 py-2.5 rounded-xl border-2 transition-all text-sm ${
                          form.gender === opt.value
                            ? 'border-[#D4537E] bg-[#FBEAF0] text-[#D4537E]'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-[#D4537E]/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSave}
                    disabled={saving || !form.name || !form.gender}
                    className="flex-1 bg-[#D4537E] hover:bg-[#C14870] text-white rounded-full disabled:opacity-50"
                  >
                    {saving ? 'Guardando…' : 'Guardar'}
                  </Button>
                  <Button
                    onClick={() => setEditing(false)}
                    variant="outline"
                    className="flex-1 rounded-full border-gray-200"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {feedback && <p className="text-xs text-[#3B6D11] mt-3">{feedback}</p>}
          </div>

          <Button
            onClick={() => navigate('/result')}
            className="w-full bg-[#D4537E] hover:bg-[#C14870] text-white py-5 rounded-full text-lg flex items-center justify-center gap-2"
          >
            Volver al informe
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
