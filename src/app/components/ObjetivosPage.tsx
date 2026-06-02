import { FinancialAnalysis } from '../types';
import { BottomNav } from './BottomNav';

// PR7 — Stub. El contenido real se arma en el commit siguiente.
interface ObjetivosPageProps {
  analysis: FinancialAnalysis;
}

export function ObjetivosPage({ analysis: _analysis }: ObjetivosPageProps) {
  return (
    <div className="min-h-screen bg-[#FBEAF0] pb-20">
      <div className="bg-[#D4537E] text-white px-5 py-5">
        <h1 className="text-lg" style={{ fontFamily: 'var(--font-sans)' }}>Mis objetivos</h1>
        <p className="text-xs text-white/80 mt-0.5">Seguí tu avance y tus próximos pasos</p>
      </div>
      <div className="p-4 text-sm text-gray-500">Próximamente.</div>
      <BottomNav />
    </div>
  );
}
