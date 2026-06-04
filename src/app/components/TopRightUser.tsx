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
      className="hidden lg:flex fixed top-4 right-6 z-40 items-center gap-2.5 bg-white border border-[#E2C4EA] rounded-full pl-2 pr-4 py-2 shadow-sm hover:border-[#9A3D9E] transition-colors"
      title="Ir a tu perfil"
    >
      <span className="w-11 h-11 rounded-full bg-[#9A3D9E] text-white text-base font-bold flex items-center justify-center">
        {initials}
      </span>
      <span className="text-sm font-semibold text-gray-700 max-w-[160px] truncate">
        {profile.name || 'Mi cuenta'}
      </span>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}
