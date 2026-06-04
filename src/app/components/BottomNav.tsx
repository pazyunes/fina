import { useNavigate, useLocation } from 'react-router';
import { FileText, Target, TrendingUp, CircleUserRound } from 'lucide-react';

// PR7 — Bottom navigation con 4 tabs. Vive abajo en /result, /objetivos,
// /inversiones y /perfil. La pestaña activa se determina por pathname.
//
// El layout asume que cada página tiene padding-bottom suficiente como para
// no quedar tapada por la nav (~64px). Las páginas wrappean su contenido en
// un div con `pb-20` o similar.
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

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2C4EA] flex items-stretch z-50 pb-safe">
      {TABS.map((tab) => {
        const active = pathname === tab.to;
        const Icon = tab.icon;
        return (
          <button
            key={tab.to}
            type="button"
            onClick={() => navigate(tab.to)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors ${
              active ? 'text-[#9A3D9E]' : 'text-gray-400 hover:text-[#9A3D9E]/70'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]" style={{ fontFamily: 'var(--font-sans)' }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
