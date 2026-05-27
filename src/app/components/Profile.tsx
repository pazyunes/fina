import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Heart, LogOut, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../lib/auth';
import { fetchUserReports, ReportSummary } from '../lib/reports';
import { formatArs } from '../lib/currency';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

export function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchUserReports().then((data) => {
      if (active) {
        setReports(data);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex flex-col">
      <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4537E] flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 text-white fill-white" />
              </div>
              <div>
                <h1 className="text-2xl text-[#D4537E] leading-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                  Tu perfil
                </h1>
                <p className="text-xs text-gray-500 break-all">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#D4537E]"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>

          <Button
            onClick={() => navigate('/splash')}
            className="w-full bg-[#D4537E] hover:bg-[#C14870] text-white py-5 rounded-full text-lg mb-8 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Generar informe nuevamente
          </Button>

          <h2 className="text-lg text-gray-700 mb-3" style={{ fontFamily: 'var(--font-sans)' }}>
            Historial
          </h2>

          {loading ? (
            <p className="text-sm text-gray-400">Cargando tus informes…</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-gray-400">
              Todavía no generaste ningún informe. Tocá “Generar informe nuevamente”.
            </p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/report/${r.id}`)}
                  className="w-full text-left bg-white rounded-2xl shadow-sm px-5 py-4 flex items-center justify-between hover:bg-[#FBEAF0]/40 transition-colors"
                >
                  <div>
                    <p className="text-sm text-gray-700">{formatDate(r.createdAt)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Ingreso {formatArs(r.monthlyIncome)} · Balance {formatArs(r.available)}/mes
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
