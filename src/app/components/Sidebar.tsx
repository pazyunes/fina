import { useNavigate, useLocation } from 'react-router';
import { FileText, Target, TrendingUp, CircleUserRound } from 'lucide-react';

// PR — Navegación lateral para desktop (lg+). Reemplaza a la BottomNav, que
// pasa a ser solo-mobile. Mismo set de tabs. Sidebar rosa fijo a la izquierda
// con logo arriba, items en el medio y datos de la usuaria abajo, al estilo
// del mockup de referencia. Las páginas reservan el espacio con `lg:pl-56`.

interface Tab {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { to: '/result',      label: 'Informe',     icon: FileText },
  { to: '/objetivos',   label: 'Objetivos',   icon: Target },
  { to: '/inversiones', label: 'Inversiones', icon: TrendingUp },
  { to: '/perfil',      label: 'Perfil',      icon: CircleUserRound },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const monthLabel = new Date()
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-56 bg-[#9A3D9E] text-white flex-col z-40">
      <div className="px-5 pt-7 pb-6">
        <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-serif)' }}>FINA</p>
        <p className="text-xs text-white/60 mt-0.5">{monthLabel}</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {TABS.map((tab) => {
          const active = pathname === tab.to;
          const Icon = tab.icon;
          return (
            <button
              key={tab.to}
              type="button"
              onClick={() => navigate(tab.to)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? 'bg-white/20 text-white font-semibold' : 'text-white/75 hover:bg-white/10'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
