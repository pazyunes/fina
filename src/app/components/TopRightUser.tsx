import { useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../lib/auth';

// PR — Chip de cuenta en la esquina superior derecha (solo desktop). Reemplaza
// al bloque de usuario que vivía en el pie del Sidebar. Clic → /perfil.
export function TopRightUser() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const initials = (profile.name || user?.email || '?').slice(0, 2).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => navigate('/perfil')}
      className="hidden lg:flex fixed top-4 right-6 z-40 items-center gap-2 bg-white border border-[#F4C0D1] rounded-full pl-1.5 pr-3 py-1.5 shadow-sm hover:border-[#D4537E] transition-colors"
      title="Ir a tu perfil"
    >
      <span className="w-8 h-8 rounded-full bg-[#D4537E] text-white text-xs font-semibold flex items-center justify-center">
        {initials}
      </span>
      <span className="text-sm font-medium text-gray-700 max-w-[160px] truncate">
        {profile.name || 'Mi cuenta'}
      </span>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}
