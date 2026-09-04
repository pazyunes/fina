import { useNavigate, useLocation } from 'react-router';
import { Home, Receipt, MessageCircle, Target, TrendingUp } from 'lucide-react';
import { WHATSAPP_URL } from '../WhatsAppFab';
import { COLORS } from './shared';

// REDISEÑO v2 — menú LATERAL para desktop (lg+). En mobile no se muestra
// (hidden lg:flex): ahí sigue el BottomNavV2. Mismas 4 secciones + el chat
// que abre el bot real de WhatsApp, igual que el menú de abajo.
const TABS = [
  { to: '/onboarding-v2/home', label: 'Home', icon: Home },
  { to: '/onboarding-v2/gastos', label: 'Gastos', icon: Receipt },
  { to: '/onboarding-v2/objetivos', label: 'Objetivos', icon: Target },
  { to: '/onboarding-v2/inversiones', label: 'Inversiones', icon: TrendingUp },
];

export function SidebarV2() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside
      className="hidden lg:flex lg:flex-col w-60 shrink-0 h-full px-4 py-6 border-r"
      style={{ background: COLORS.surface, borderColor: COLORS.line }}
    >
      <div className="px-2 mb-8">
        <span className="text-2xl font-bold" style={{ color: COLORS.brand, fontFamily: 'var(--font-sans)' }}>
          FINA
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.to;
          const Icon = tab.icon;
          return (
            <button
              key={tab.to}
              type="button"
              onClick={() => navigate(tab.to)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors"
              style={{
                background: active ? COLORS.brandSoft : 'transparent',
                color: active ? COLORS.brand : COLORS.inkSoft,
              }}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hablar con FINA por WhatsApp"
        className="mt-auto flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-bold transition-transform active:scale-95"
        style={{ background: COLORS.ink, color: COLORS.onDark }}
      >
        <MessageCircle className="w-5 h-5" strokeWidth={2.4} />
        Hablar con FINA
      </a>
    </aside>
  );
}
