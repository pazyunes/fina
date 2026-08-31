import { useNavigate, useLocation } from 'react-router';
import { Home, Receipt, MessageCircle, Target, TrendingUp } from 'lucide-react';
import { WHATSAPP_URL } from '../WhatsAppFab';
import { COLORS } from './shared';

// REDISEÑO v2 — menú de abajo pedido explícitamente: Home, Gastos, Chat
// (resaltado con colores invertidos, no es una pantalla — abre el bot de
// WhatsApp real, mismo WHATSAPP_URL que ya usa el resto de la app), Objetivos
// e Inversiones.

const TABS = [
  { to: '/onboarding-v2/home', label: 'Home', icon: Home },
  { to: '/onboarding-v2/gastos', label: 'Gastos', icon: Receipt },
  { to: '/onboarding-v2/objetivos', label: 'Objetivos', icon: Target },
  { to: '/onboarding-v2/inversiones', label: 'Inversiones', icon: TrendingUp },
];

export function BottomNavV2() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-stretch justify-around bg-white border-t-[2.5px] border-[#1E1E1E] z-50 px-1"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.slice(0, 2).map((tab) => {
        const active = pathname === tab.to;
        const Icon = tab.icon;
        return (
          <button
            key={tab.to}
            type="button"
            onClick={() => navigate(tab.to)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 ${active ? 'text-[#1E1E1E]' : 'text-[#a8a394]'}`}
          >
            <Icon className="w-5 h-5" strokeWidth={active ? 2.6 : 2} />
            <span className="text-[10.5px] font-semibold">{tab.label}</span>
          </button>
        );
      })}

      {/* Chat — más marcado, colores invertidos (fondo tinta, ícono claro), lleva al bot real de WhatsApp */}
      <div className="flex-1 flex justify-center">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Hablar con FINA por WhatsApp"
          className="-mt-5 w-14 h-14 rounded-full flex items-center justify-center border-[2.5px] shrink-0"
          style={{ background: COLORS.ink, borderColor: COLORS.ink, boxShadow: `3px 3px 0 ${COLORS.mint}` }}
        >
          <MessageCircle className="w-6 h-6" style={{ color: COLORS.cream }} strokeWidth={2.4} />
        </a>
      </div>

      {TABS.slice(2).map((tab) => {
        const active = pathname === tab.to;
        const Icon = tab.icon;
        return (
          <button
            key={tab.to}
            type="button"
            onClick={() => navigate(tab.to)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 ${active ? 'text-[#1E1E1E]' : 'text-[#a8a394]'}`}
          >
            <Icon className="w-5 h-5" strokeWidth={active ? 2.6 : 2} />
            <span className="text-[10.5px] font-semibold">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
