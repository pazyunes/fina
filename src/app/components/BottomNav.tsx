import { useNavigate, useLocation } from 'react-router';
import { FileText, Target, TrendingUp, CircleUserRound, MessageCircle } from 'lucide-react';
import { WHATSAPP_URL } from './WhatsAppFab';

// PR7 — Bottom navigation con 4 tabs. Vive abajo en /result, /objetivos,
// /inversiones y /perfil. La pestaña activa se determina por pathname.
//
// PR — Botón central elevado (FAB) que abre el WhatsApp de FINA, al estilo del
// botón QR de Mercado Pago. Parte las 4 tabs en 2 + 2 con el FAB al medio.
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

  const renderTab = (tab: Tab) => {
    const active = pathname === tab.to;
    const Icon = tab.icon;
    return (
      <button
        key={tab.to}
        type="button"
        onClick={() => navigate(tab.to)}
        className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors ${
          active ? 'text-[#7626B3]' : 'text-gray-400 hover:text-[#7626B3]/70'
        }`}
        aria-current={active ? 'page' : undefined}
      >
        <Icon className="w-5 h-5" />
        <span className="text-xs" style={{ fontFamily: 'var(--font-sans)' }}>
          {tab.label}
        </span>
      </button>
    );
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#F4C0D1] flex items-stretch z-50 pb-safe">
      {TABS.slice(0, 2).map(renderTab)}

      {/* FAB central → WhatsApp */}
      <div className="flex-1 flex justify-center">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Registrá tus gastos diarios por chat"
          className="-mt-7 w-16 h-16 rounded-full bg-[#7626B3] text-white flex items-center justify-center shadow-lg shadow-[#7626B3]/40 ring-4 ring-[#F0E7FA] active:scale-95 transition-transform"
        >
          <MessageCircle className="w-7 h-7" />
        </a>
      </div>

      {TABS.slice(2).map(renderTab)}
    </nav>
  );
}
