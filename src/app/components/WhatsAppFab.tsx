import { MessageCircle } from 'lucide-react';

// PR — Botón flotante de chat (desktop). Abre el WhatsApp de FINA. No usa el
// ícono típico de WhatsApp a propósito: usamos un globo de chat genérico.
// En mobile el acceso vive en el centro de la BottomNav (ver BottomNav.tsx).
export const WHATSAPP_URL = 'https://wa.me/542212002451';

export function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden lg:flex fixed bottom-6 right-6 z-40 items-center gap-2 bg-[#7626B3] hover:bg-[#5F1F94] text-white rounded-full pl-4 pr-5 py-3 shadow-lg shadow-[#7626B3]/30 transition-colors"
      title="Registrá tus gastos diarios por chat"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="text-sm font-semibold">Registrá tus gastos diarios</span>
    </a>
  );
}
