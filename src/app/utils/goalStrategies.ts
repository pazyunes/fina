import { FinancialAnalysis } from '../types';
import { formatArs } from '../lib/currency';

// PR — Generador de estrategias para llegar al objetivo. Personalizado con lo
// que la usuaria cargó en el onboarding:
//   - Gastos reales (solo aparecen recortes que aplican).
//   - Disposición a recortar (cut_willingness): NO sugerimos cortar lo que dijo
//     que no toca, y priorizamos lo que sí está dispuesta a ajustar.
//   - Su banco/app para "cuenta que rinda".
//   - El impacto se expresa como "≈ X meses menos" para su objetivo (motivador),
//     con fallback a "+$X/mes" si todavía no cargó un objetivo.
//
// El texto de cada estrategia es de UNA línea (menos abrumador).

export interface GoalStrategy {
  emoji: string;
  title: string;
  subtitle: string;
  impact: string; // "≈ 2 meses menos" / "+$30.000/mes" / "+$120.000 una vez" / "variable"
  category?: string; // slug de gasto (interno) para cruzar con cut_willingness
}

const W = 4.33;
// Apps que ofrecen cuenta remunerada (para "mover tu ahorro a algo que rinda").
const YIELD_APPS = ['Mercado Pago', 'Ualá', 'Brubank', 'Naranja X', 'Personal Pay'];

export function buildGoalStrategies(
  analysis: FinancialAnalysis,
  opts?: { cutWillingness?: Record<string, number> },
): GoalStrategy[] {
  const u = analysis.userData;
  const willing = opts?.cutWillingness ?? {};

  // Objetivo principal para framear el impacto en "meses menos".
  const g = analysis.goalsAnalysis?.[0];
  const gMonthly = g?.monthlyRequired ?? 0;
  const gAmount = g?.amount ?? 0;
  const gMonths = g?.timeframe ?? 0;
  const hasGoal = gMonthly > 0 && gAmount > 0 && gMonths > 0;

  // Ahorro mensual X → "≈ N meses menos" (si hay objetivo), si no "+$X/mes".
  const monthlyImpact = (x: number): string => {
    if (hasGoal) {
      const saved = gMonths - Math.ceil(gAmount / (gMonthly + x));
      if (saved >= 1) return `≈ ${saved} ${saved === 1 ? 'mes' : 'meses'} menos`;
    }
    return `+${formatArs(Math.round(x))}/mes`;
  };
  const onceImpact = (y: number): string => {
    if (hasGoal) {
      const saved = Math.floor(y / gMonthly);
      if (saved >= 1) return `≈ ${saved} ${saved === 1 ? 'mes' : 'meses'} menos`;
    }
    return `+${formatArs(Math.round(y))} una vez`;
  };

  type Cand = GoalStrategy & { _score: number; _cut?: boolean };
  const cands: Cand[] = [];

  const monthlyDelivery = u.deliveryFrequency * u.deliveryAmount * W;
  const monthlyCafeterias = (u.cafeteriasFrequency || 0) * (u.cafeteriasAmount || 0) * W;
  const monthlyEntertainment = u.entertainmentFrequency * u.entertainmentAmount * W;
  const monthlySupermarket = (u.supermarketFrequency || 0) * (u.supermarketAmount || 0) * W;
  const monthlySubs = u.subscriptions.reduce((s, x) => s + x.cost, 0);

  // ── Recortes (se cruzan con la disposición a recortar) ──
  if (monthlyDelivery >= 20000) {
    const save = Math.round(monthlyDelivery * 0.3);
    cands.push({ emoji: '🍕', title: 'Menos delivery', category: 'delivery', _cut: true, _score: save,
      subtitle: `Pedís ~${formatArs(Math.round(monthlyDelivery))}/mes. Cociná un par de veces más.`, impact: monthlyImpact(save) });
  }
  if (monthlyCafeterias >= 15000) {
    const save = Math.round(monthlyCafeterias * 0.3);
    cands.push({ emoji: '☕', title: 'Menos café y restó afuera', category: 'cafeterias', _cut: true, _score: save,
      subtitle: `Gastás ~${formatArs(Math.round(monthlyCafeterias))}/mes. Un termo o juntada en casa.`, impact: monthlyImpact(save) });
  }
  if (monthlyEntertainment >= 25000) {
    const save = Math.round(monthlyEntertainment * 0.3);
    cands.push({ emoji: '🎉', title: 'Una salida paga menos', category: 'entertainment', _cut: true, _score: save,
      subtitle: 'Cambiá una salida por un plan gratis (parque, casa de amigas).', impact: monthlyImpact(save) });
  }
  if (u.subscriptions.length >= 3 && monthlySubs >= 8000) {
    const save = Math.round(monthlySubs * 0.3);
    cands.push({ emoji: '📱', title: 'Revisar suscripciones', category: 'subscriptions', _cut: true, _score: save,
      subtitle: `Tenés ${u.subscriptions.length} activas. Cancelá 1-2 que no usás.`, impact: monthlyImpact(save) });
  }
  if (monthlySupermarket >= 80000) {
    const save = Math.round(monthlySupermarket * 0.1);
    cands.push({ emoji: '🛒', title: 'Optimizar el súper', category: 'supermarket', _cut: true, _score: save,
      subtitle: 'Con lista y marcas blancas bajás ~10% sin que se note.', impact: monthlyImpact(save) });
  }

  // ── Acciones sin recorte de categoría ──
  if (analysis.available > 0) {
    const target = gMonthly && gMonthly < analysis.available ? gMonthly : analysis.available;
    cands.push({ emoji: '🤖', title: 'Automatizar el ahorro', _score: target,
      subtitle: 'Programá una transferencia apenas cobrás. Lo que no ves, no lo gastás.', impact: monthlyImpact(target) });
  }
  if (!u.invests && analysis.available > 30000) {
    const boost = Math.round(analysis.available * 0.06);
    const bank = (u.banks ?? []).find((b) => YIELD_APPS.includes(b));
    cands.push({ emoji: '💰', title: 'Que tu ahorro rinda', _score: boost,
      subtitle: bank
        ? `Movelo a una cuenta remunerada en tu ${bank}. Rinde mientras juntás.`
        : 'Ponelo en una cuenta remunerada (MP, Ualá, Brubank). Rinde solo.',
      impact: monthlyImpact(boost) });
  }
  if (u.worksOrStudies === 'works' || u.worksOrStudies === 'both') {
    const aguinaldo = Math.round(analysis.totalIncome * 0.5);
    cands.push({ emoji: '🎁', title: 'Usar el aguinaldo', _score: aguinaldo / 6,
      subtitle: `Guardá el medio sueldo de junio o diciembre (~${formatArs(aguinaldo)}).`, impact: onceImpact(aguinaldo) });
  }
  cands.push({ emoji: '📦', title: 'Vender lo que no usás', _score: 6000,
    subtitle: 'Marketplace o MercadoLibre: lo que junta polvo suma.', impact: 'extra una vez' });
  if (u.worksOrStudies !== 'neither') {
    cands.push({ emoji: '📈', title: 'Sumar un ingreso extra', _score: 5000,
      subtitle: 'Clases, freelance puntual: cada peso va completito al objetivo.', impact: 'variable' });
  }

  // Filtrar los recortes que la usuaria dijo que NO está dispuesta a hacer (1).
  const filtered = cands.filter((c) => !(c._cut && c.category && willing[c.category] === 1));

  // Priorizar: los recortes se ponderan por la disposición (4 = re dispuesta).
  // Los recortes con disposición 1 ya se filtraron; 2 baja, 4 sube.
  const score = (c: Cand) => (c._cut && c.category ? c._score * ((willing[c.category] ?? 3) / 3) : c._score);
  filtered.sort((a, b) => score(b) - score(a));

  return filtered.map(({ _score, _cut, ...s }) => s);
}
