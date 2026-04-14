import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { listReports, ReportRow } from '../lib/reports';
import { useAuth } from '../hooks/useAuth';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const formatMoney = (n: number) =>
  n.toLocaleString('es-AR').replace(/,/g, '.');

export function History() {
  const navigate = useNavigate();
  const { session, loading, signOut } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate('/login', { replace: true });
      return;
    }
    listReports().then(({ rows, error }) => {
      if (error) setError(error);
      else setRows(rows);
      setFetching(false);
    });
  }, [loading, session]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl text-[#D4537E]" style={{ fontFamily: 'var(--font-serif)' }}>
            Tu historial
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/splash')}>
              Nuevo informe
            </Button>
            <Button variant="ghost" onClick={async () => { await signOut(); navigate('/login'); }}>
              Cerrar sesión
            </Button>
          </div>
        </div>

        {fetching && <p className="text-gray-600">Cargando...</p>}
        {error && <p className="text-[#C0392B]">Error: {error}</p>}
        {!fetching && !error && rows.length === 0 && (
          <div className="bg-white rounded-3xl p-8 shadow-md text-center">
            <p className="text-gray-600 mb-4">Todavía no tenés informes guardados.</p>
            <Button onClick={() => navigate('/splash')} className="bg-[#D4537E] hover:bg-[#C14870] text-white">
              Empezar mi primer informe
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {rows.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-3xl p-6 shadow-md"
            >
              <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                <div>
                  <p className="text-sm text-gray-500" style={{ fontFamily: 'var(--font-sans)' }}>
                    {formatDate(r.created_at)}
                  </p>
                  <p className="text-xl text-[#D4537E]" style={{ fontFamily: 'var(--font-serif)' }}>
                    {r.analysis.financialLevel}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <p className="text-xs text-gray-500">Ingresos</p>
                  <p className="text-lg">${formatMoney(r.analysis.totalIncome)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Egresos</p>
                  <p className="text-lg">${formatMoney(r.analysis.totalExpenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Disponible</p>
                  <p className={`text-lg ${r.analysis.available < 0 ? 'text-[#C0392B]' : 'text-[#3B6D11]'}`}>
                    ${formatMoney(r.analysis.available)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
