import { FinancialAnalysis } from '../types';
import { formatArs } from '../lib/currency';

// PR7d — Generador de estrategias para llegar al objetivo financiero.
// Cada estrategia tiene título corto + subtítulo concreto + impacto estimado
// (la mayoría en "+$X/mes"; algunas son "+$X una vez" o "variable").
//
// Las estrategias se calculan a partir de los gastos reales del informe;
// solo aparecen las que aplican a la usuaria (no spammeamos sugerencias
// irrelevantes).

export interface GoalStrategy {
  emoji: string;
  title: string;
  subtitle: string;
  impact: string; // p. ej. "+$30.000/mes" / "+$120.000 una vez" / "variable"
}

// Multiplicador usado para llevar frecuencia semanal × monto a mensual.
const W = 4.33;

export function buildGoalStrategies(analysis: FinancialAnalysis): GoalStrategy[] {
  const u = analysis.userData;
  const strategies: GoalStrategy[] = [];

  // Cálculos previos sobre las categorías reducibles.
  const monthlyDelivery     = u.deliveryFrequency * u.deliveryAmount * W;
  const monthlyCafeterias   = (u.cafeteriasFrequency || 0) * (u.cafeteriasAmount || 0) * W;
  const monthlyEntertainment = u.entertainmentFrequency * u.entertainmentAmount * W;
  const monthlySupermarket  = (u.supermarketFrequency || 0) * (u.supermarketAmount || 0) * W;
  const monthlySubs         = u.subscriptions.reduce((s, x) => s + x.cost, 0);

  // 1) Cortar delivery si pesa.
  if (monthlyDelivery >= 20000) {
    const save = Math.round(monthlyDelivery * 0.3);
    strategies.push({
      emoji: '🍕',
      title: 'Ajustar gastos en delivery',
      subtitle: `Hoy pedís ~${formatArs(Math.round(monthlyDelivery))}/mes. Cocinar 2 veces por semana en lugar de pedir te libera plata.`,
      impact: `+${formatArs(save)}/mes`,
    });
  }

  // 2) Cortar cafeterías / restaurantes.
  if (monthlyCafeterias >= 15000) {
    const save = Math.round(monthlyCafeterias * 0.3);
    strategies.push({
      emoji: '☕',
      title: 'Ajustar gastos en cafeterías y restaurantes',
      subtitle: `Hoy gastás ~${formatArs(Math.round(monthlyCafeterias))}/mes. Llevarte un termo o juntarte en casa unas veces hace una diferencia real.`,
      impact: `+${formatArs(save)}/mes`,
    });
  }

  // 3) Recortar salidas / ocio.
  if (monthlyEntertainment >= 25000) {
    const save = Math.round(monthlyEntertainment * 0.3);
    strategies.push({
      emoji: '🎉',
      title: 'Ajustar gastos en salidas / ocio',
      subtitle: 'Alterná salidas pagas con planes gratis (casa de amigos, parque, ciclos abiertos). Una salida menos por mes ya pesa.',
      impact: `+${formatArs(save)}/mes`,
    });
  }

  // 4) Revisar suscripciones.
  if (u.subscriptions.length >= 3 && monthlySubs >= 8000) {
    const save = Math.round(monthlySubs * 0.3);
    strategies.push({
      emoji: '📱',
      title: 'Revisar suscripciones que no usás',
      subtitle: `Tenés ${u.subscriptions.length} activas (~${formatArs(Math.round(monthlySubs))}/mes). Cancelar 1 o 2 que están de adorno suele bastar.`,
      impact: `+${formatArs(save)}/mes`,
    });
  }

  // 5) Optimizar el súper.
  if (monthlySupermarket >= 80000) {
    const save = Math.round(monthlySupermarket * 0.1);
    strategies.push({
      emoji: '🛒',
      title: 'Optimizar las compras del súper',
      subtitle: 'Ir con lista, mirar promos del día, comprar marcas blancas en lo que da igual. Un 10% menos es un mes de ocio para vos.',
      impact: `+${formatArs(save)}/mes`,
    });
  }

  // 6) Automatizar el ahorro (apenas hay disponible).
  if (analysis.available > 0) {
    const cuota = analysis.goalsAnalysis?.[0]?.monthlyRequired;
    const target = cuota && cuota < analysis.available ? cuota : analysis.available;
    strategies.push({
      emoji: '🤖',
      title: 'Automatizar el ahorro el día que cobrás',
      subtitle: 'Programá una transferencia recurrente a otra cuenta apenas entra el sueldo. "Lo que no ves, no lo gastás".',
      impact: `+${formatArs(Math.round(target))}/mes`,
    });
  }

  // 7) Cuenta remunerada / FCI — solo si todavía no invierte.
  if (!u.invests && analysis.available > 30000) {
    const monthlyBoost = Math.round(analysis.available * 0.06);
    strategies.push({
      emoji: '💰',
      title: 'Mover tu ahorro a una cuenta que rinda',
      subtitle: 'MP, Ualá o Brubank — sin compromiso, retiro inmediato. Mientras juntás para tu objetivo, tu plata trabaja sola.',
      impact: `+~${formatArs(monthlyBoost)}/mes`,
    });
  }

  // 8) Aguinaldo (solo si la usuaria trabaja en relación de dependencia,
  // aproximamos con 'works' o 'both').
  if (u.worksOrStudies === 'works' || u.worksOrStudies === 'both') {
    const aguinaldo = Math.round(analysis.totalIncome * 0.5);
    strategies.push({
      emoji: '🎁',
      title: 'Destinar el aguinaldo al objetivo',
      subtitle: `Si guardás el medio sueldo de junio o diciembre (~${formatArs(aguinaldo)}), tu meta da un salto grande sin esfuerzo mensual.`,
      impact: `+${formatArs(aguinaldo)} una vez`,
    });
  }

  // 9) Vender lo que no usás — siempre relevante, sin números porque no
  // podemos estimar.
  strategies.push({
    emoji: '📦',
    title: 'Vender cosas que no usás',
    subtitle: 'Marketplace, Facebook o MercadoLibre. Lo que junta polvo en un placard puede ser un mes de avance.',
    impact: 'extra una vez',
  });

  // 10) Sumar un ingreso extra — todos menos quienes eligieron "Ninguna".
  if (u.worksOrStudies !== 'neither') {
    strategies.push({
      emoji: '📈',
      title: 'Sumar un ingreso extra',
      subtitle: 'Clases particulares, freelance puntual, vender algo que sepas hacer. Cada peso extra va completito al objetivo.',
      impact: 'variable',
    });
  }

  // 11) Estirar el plazo si el primer objetivo no es alcanzable.
  const firstGoal = analysis.goalsAnalysis?.[0];
  if (firstGoal && firstGoal.status === 'not_possible' && analysis.available > 0) {
    const extendedMonths = Math.ceil(firstGoal.amount / Math.max(analysis.available * 0.7, 1));
    if (extendedMonths > firstGoal.timeframe) {
      strategies.push({
        emoji: '⏱️',
        title: 'Estirar el plazo del objetivo',
        subtitle: `Hoy tu meta pide ${formatArs(firstGoal.monthlyRequired)}/mes y no entra. Llevándola a ~${extendedMonths} meses, la cuota baja y se vuelve alcanzable.`,
        impact: 'lo hace posible',
      });
    }
  }

  return strategies;
}
