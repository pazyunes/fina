import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { LogOut, CircleUserRound, Pencil, Wallet, Home, Coffee, Target, ChevronRight, Ticket } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth, Profile as ProfileData } from '../lib/auth';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopRightUser } from './TopRightUser';
import { WhatsAppFab } from './WhatsAppFab';
import { CouponsModal } from './CouponsModal';

const GENDER_OPTIONS: { value: ProfileData['gender']; label: string }[] = [
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

const genderLabel = (g: ProfileData['gender']) =>
  GENDER_OPTIONS.find((o) => o.value === g)?.label ?? 'Sin especificar';

export function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, updateProfile } = useAuth();

  // Pop-up "Mis cupones". Se abre desde el cupón del informe (via state) o acá.
  const [showCoupons, setShowCoupons] = useState(false);
  const [couponInitialId, setCouponInitialId] = useState<string | null>(null);
  useEffect(() => {
    const st = location.state as { openCoupons?: boolean; couponId?: string } | null;
    if (st?.openCoupons) {
      setCouponInitialId(st.couponId ?? null);
      setShowCoupons(true);
    }
  }, [location.state]);

  // Edición de datos del perfil.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: profile.name, age: profile.age, email: user?.email ?? '', gender: profile.gender, phoneDigits: (profile.phone || '').replace(/^\+54/, '') });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const startEditing = () => {
    setForm({ name: profile.name, age: profile.age, email: user?.email ?? '', gender: profile.gender, phoneDigits: (profile.phone || '').replace(/^\+54/, '') });
    setFeedback(null);
    setEditing(true);
  };

  // Teléfono: 8-13 dígitos o vacío (igual que el signup). Vacío = borrar.
  // AR: 10 dígitos (área + número); el 9 de celular es opcional → lo normalizamos.
  const phoneNormalized = (() => {
    let n = form.phoneDigits.replace(/\D/g, '');
    if (n.startsWith('0')) n = n.slice(1);
    if (n.length === 11 && n.startsWith('9')) n = n.slice(1);
    return n;
  })();
  const phoneValid = form.phoneDigits === '' || phoneNormalized.length === 10;

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const phoneE164 = phoneNormalized.length === 10 ? `+54${phoneNormalized}` : '';
    const { error, emailChangePending } = await updateProfile({
      name: form.name,
      age: form.age,
      email: form.email,
      gender: form.gender,
      phone: phoneE164,
    });
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
    <div className="min-h-screen bg-white flex flex-col pb-24 lg:pb-8 lg:pl-56">
      <Sidebar />
      <TopRightUser />
      <WhatsAppFab />
      <div className="flex-1 flex flex-col p-6 lg:pt-20 max-w-md lg:max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl text-[#7626B3]" style={{ fontFamily: 'var(--font-serif)' }}>
              Tu perfil
            </h1>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#7626B3]"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>

          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
          {/* DATOS PERSONALES */}
          <div className="mb-6 lg:mb-0">
            <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-2">Datos personales</p>
            <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#F0E7FA] flex items-center justify-center shrink-0">
                <CircleUserRound className="w-10 h-10 text-[#7626B3]" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-gray-800 truncate">{profile.name || 'Sin nombre'}</p>
                <p className="text-sm text-gray-500 break-all">{user?.email}</p>
              </div>
              {!editing && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="flex items-center gap-1 text-sm text-[#7626B3] border border-[#D7C2EF] rounded-lg px-3 py-1.5 hover:bg-[#F0E7FA] shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>

            {!editing ? (
              <div className="mt-4 pt-4 border-t border-[#D7C2EF]/50">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400">Edad</p>
                    <p className="text-gray-700">{profile.age || '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Sexo</p>
                    <p className="text-gray-700">{genderLabel(profile.gender)}</p>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <p className="text-gray-400">Teléfono</p>
                  <p className="text-gray-700">{profile.phone || '—'}</p>
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
                            ? 'border-[#7626B3] bg-[#F0E7FA] text-[#7626B3]'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-[#7626B3]/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
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
                  <Label htmlFor="p-phone" className="text-gray-700 text-sm">Teléfono</Label>
                  <div className="mt-1 flex items-stretch rounded-xl border border-gray-200 focus-within:border-[#7626B3] overflow-hidden bg-white">
                    <span className="px-3 flex items-center text-sm text-gray-600 bg-gray-50 border-r border-gray-200 select-none">+54</span>
                    <Input
                      id="p-phone"
                      type="tel"
                      inputMode="numeric"
                      value={form.phoneDigits}
                      onChange={(e) => setForm({ ...form, phoneDigits: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                      placeholder="Ej: 11 1234 5678"
                      className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                    />
                  </div>
                  {form.phoneDigits !== '' && !phoneValid && (
                    <p className="text-xs text-[#7626B3] mt-1">Tienen que ser 10 dígitos (área + número). El 9 de celular es opcional.</p>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSave}
                    disabled={saving || !form.name || !form.gender || !phoneValid}
                    className="flex-1 bg-[#059669] hover:bg-[#047857] text-white rounded-full disabled:opacity-50"
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
          </div>

          {/* PR8 — Sección de edición de datos del informe */}
          <div className="mb-6 lg:mb-0">
            <p className="text-xs font-bold text-[#7626B3] uppercase tracking-wider mb-2">Mis datos financieros</p>
            <p className="text-sm text-gray-500 mb-3">
              Actualizá lo que cambió y el informe se recalcula al toque.
            </p>
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-[#D7C2EF]/50 overflow-hidden">
              <EditRow icon={Wallet} label="Mis ingresos" to="/editar/ingresos" navigate={navigate} />
              <EditRow icon={Home} label="Mis gastos fijos" to="/editar/gastos-fijos" navigate={navigate} />
              <EditRow icon={Coffee} label="Mis gastos variables" to="/editar/gastos-variables" navigate={navigate} />
              <EditRow icon={Target} label="Mis objetivos" to="/editar/objetivos" navigate={navigate} />
            </div>

            <button
              type="button"
              onClick={() => { setCouponInitialId(null); setShowCoupons(true); }}
              className="mt-3 w-full flex items-center gap-3 bg-white rounded-2xl shadow-sm px-4 py-3.5 hover:bg-[#F0E7FA]/40 transition-colors text-left"
            >
              <Ticket className="w-5 h-5 text-[#7626B3]" />
              <span className="flex-1 text-base font-medium text-gray-700">Mis cupones</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          </div>

          </div>

          <Button
            onClick={() => navigate('/result')}
            className="w-full lg:w-auto lg:self-start lg:px-10 bg-[#059669] hover:bg-[#047857] text-white py-5 rounded-full text-lg flex items-center justify-center gap-2 lg:mt-6"
          >
            Volver al informe
          </Button>
        </motion.div>
      </div>
      <BottomNav />

      {showCoupons && <CouponsModal initialId={couponInitialId} onClose={() => setShowCoupons(false)} />}
    </div>
  );
}

// Fila clickeable para editar una sección de datos financieros del informe.
function EditRow({
  icon: Icon,
  label,
  to,
  navigate,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#F0E7FA]/40 transition-colors"
    >
      <Icon className="w-5 h-5 text-[#7626B3]" />
      <span className="flex-1 text-base font-medium text-gray-700">{label}</span>
      <ChevronRight className="w-4 h-4 text-gray-300" />
    </button>
  );
}
