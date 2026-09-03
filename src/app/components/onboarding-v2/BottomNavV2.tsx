import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Home, Receipt, MessageCircle, Target, TrendingUp } from 'lucide-react';
import { WHATSAPP_URL } from '../WhatsAppFab';
import { COLORS } from './shared';

// REDISEÑO v2 — menú de abajo pedido explícitamente: Home, Gastos, Chat
// (resaltado con colores invertidos, no es una pantalla — abre el bot de
// WhatsApp real, mismo WHATSAPP_URL que ya usa el resto de la app), Objetivos
// e Inversiones. Nav blanca con sombra suave (sin borde negro grueso).
//
// El botón del chat se tiene que entender SOLO, sin cartel de texto —
// tiene forma de globo de diálogo (MessageCircle) y, hasta que se toca por
// primera vez, un pulso alrededor que llama la atención sin explicar nada.

const TABS = [
  { to: '/onboarding-v2/home', label: 'Home', icon: Home },
  { to: '/onboarding-v2/gastos', label: 'Gastos', icon: Receipt },
  { to: '/onboarding-v2/objetivos', label: 'Objetivos', icon: Target },
  { to: '/onboarding-v2/inversiones', label: 'Inversiones', icon: TrendingUp },
];

const LS_FAB_VISTO = 'fina_v2_fab_bot_tocado';
function fabVisto(): boolean {
  try { return localStorage.getItem(LS_FAB_VISTO) === '1'; } catch { return true; }
}
function marcarFabVisto() {
  try { localStorage.setItem(LS_FAB_VISTO, '1'); } catch { /* no crítico */ }
}

export function BottomNavV2() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pulsar, setPulsar] = useState(() => !fabVisto());

  return (
    <nav
      className="shrink-0 flex items-stretch justify-around bg-white px-1 shadow-[0_-2px_20px_rgba(31,27,46,0.06)]"
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
            className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors duration-150"
            style={{ color: active ? COLORS.brand : COLORS.inkFaint }}
          >
            <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
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
          onClick={() => { if (pulsar) { marcarFabVisto(); setPulsar(false); } }}
          className="relative -mt-5 w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-transform duration-100 active:scale-95"
          style={{ background: COLORS.ink, boxShadow: '0 8px 20px -4px rgba(31,27,46,0.45)' }}
        >
          {pulsar && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: COLORS.ink, opacity: 0.4 }} />}
          <MessageCircle className="w-6 h-6 relative" style={{ color: COLORS.onDark }} strokeWidth={2.4} />
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
            className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors duration-150"
            style={{ color: active ? COLORS.brand : COLORS.inkFaint }}
          >
            <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
            <span className="text-[10.5px] font-semibold">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
