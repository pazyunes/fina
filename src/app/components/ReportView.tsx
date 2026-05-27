import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Result } from './Result';
import { fetchReportById, StoredReport } from '../lib/reports';

// Abre un informe guardado en modo lectura. Renderiza el mismo Result a partir
// del snapshot (analysis incluye userData y la cotización del día en que se
// generó), así los montos originales y el cambio quedan congelados.
export function ReportView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<StoredReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!id) {
      setLoading(false);
      return;
    }
    fetchReportById(id).then((r) => {
      if (active) {
        setReport(r);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex items-center justify-center">
        <p className="text-gray-500" style={{ fontFamily: 'var(--font-sans)' }}>Cargando informe…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-gray-600 mb-4" style={{ fontFamily: 'var(--font-sans)' }}>
          No encontramos este informe.
        </p>
        <button
          type="button"
          onClick={() => navigate('/perfil')}
          className="text-[#D4537E] hover:underline"
        >
          Volver al historial
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => navigate('/perfil')}
        className="fixed top-4 left-4 z-50 flex items-center gap-1 bg-white/90 backdrop-blur px-3 py-2 rounded-full shadow-sm text-sm text-gray-700 hover:text-[#D4537E]"
      >
        <ArrowLeft className="w-4 h-4" />
        Historial
      </button>
      <Result analysis={report.analysis} />
    </div>
  );
}
