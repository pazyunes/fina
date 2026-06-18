import { UserData, FinancialAnalysis, GoalAnalysis, ReducibleExpense } from '../types';
import { g } from './gender';

export function analyzeFinances(userData: UserData): FinancialAnalysis {
  const totalIncome = userData.monthlyIncome;
  
  // Calculate monthly expenses from new data structure
  const monthlyEntertainment = userData.entertainmentFrequency * userData.entertainmentAmount * 4.33;
  const monthlyDelivery = userData.deliveryFrequency * userData.deliveryAmount * 4.33;
  const monthlySupermarket = (userData.supermarketFrequency || 0) * (userData.supermarketAmount || 0) * 4.33;
  // PR6 — cafeterías/restaurantes. Opcional para compat con informes pre-PR6
  // (los campos pueden no estar presentes en user_data jsonb antiguo).
  const monthlyCafeterias = (userData.cafeteriasFrequency || 0) * (userData.cafeteriasAmount || 0) * 4.33;
  const monthlyRestaurants = (userData.restaurantsFrequency || 0) * (userData.restaurantsAmount || 0) * 4.33;
  const subscriptionsCost = userData.subscriptions.reduce((sum, sub) => sum + sub.cost, 0);
  const installmentsCost = userData.installments.reduce((sum, inst) => sum + inst.monthlyAmount, 0);
  // Gastos ocasionales amortizados a mensual: cada gasto aporta amount/everyMonths.
  const monthlyOccasional = (userData.occasionalExpenses ?? []).reduce(
    (sum, e) => sum + (e.everyMonths > 0 ? e.amount / e.everyMonths : 0),
    0
  );

  // Calculate total expenses using new fields
  const totalExpenses =
    userData.expenses.housing +
    userData.expenses.health +
    userData.expenses.beauty +
    userData.expenses.therapy +
    userData.expenses.gym +
    (userData.expenses.estudios ?? 0) +
    userData.expenses.transport +
    subscriptionsCost +
    monthlyDelivery +
    monthlyEntertainment +
    monthlySupermarket +
    monthlyCafeterias +
    monthlyRestaurants +
    monthlyOccasional +
    installmentsCost;
    
  const available = totalIncome - totalExpenses;

  // Determine financial level
  const financialLevel = determineFinancialLevel(userData);

  // Generate insights
  const insights = generateInsights(userData, totalIncome, totalExpenses, monthlyDelivery, monthlyEntertainment, subscriptionsCost);

  // Calculate reducible percentage
  const reduciblePercentage = calculateReduciblePercentage(monthlyDelivery, monthlyEntertainment, subscriptionsCost, userData.expenses.transport, totalExpenses);

  // Analyze multiple goals
  const goalsAnalysis = userData.specificGoals
    ? analyzeGoals(userData.specificGoals, available)
    : [];

  // Generate reducible expenses with detailed info
  const reducibleExpenses = generateReducibleExpenses(userData, totalIncome, monthlyDelivery, monthlyEntertainment, subscriptionsCost);

  // Calculate total savings potential
  const totalSavingsPotential = reducibleExpenses.reduce((sum, exp) => sum + exp.savingsAmount, 0);

  // Recommend investments
  const avgTimeframe = userData.specificGoals && userData.specificGoals.length > 0
    ? Math.round(userData.specificGoals.reduce((sum, g) => sum + g.timeframe, 0) / userData.specificGoals.length)
    : 12;
  const recommendedInvestments = recommendInvestments(avgTimeframe);

  // Generate action plan
  const actionPlan = generateActionPlan(userData, insights, goalsAnalysis);

  return {
    userData,
    totalIncome,
    totalExpenses,
    available,
    financialLevel,
    insights,
    reduciblePercentage,
    goalsAnalysis,
    reducibleExpenses,
    totalSavingsPotential,
    recommendedInvestments,
    actionPlan
  };
}

function determineFinancialLevel(userData: UserData): string {
  const hasBanks = userData.banks.length > 0 && !userData.banks.includes('No uso banco');
  const hasControl = userData.knowsLastMonthExpenses;
  const saves = userData.saves;
  const invests = userData.invests;
  
  const gender = userData.gender;
  if (!hasBanks) return 'Sin bancarizar';
  if (!hasControl && !saves) return `${g(gender, 'Bancarizada', 'Bancarizado')}, sin control`;
  if (hasControl && saves && !invests) return 'Con ahorro, sin inversión';
  if (invests) return `${g(gender, 'Inversora', 'Inversor')} ${g(gender, 'activa', 'activo')}`;

  return 'En construcción';
}

function generateInsights(userData: UserData, totalIncome: number, totalExpenses: number, monthlyDelivery: number, monthlyEntertainment: number, subscriptionsCost: number): string[] {
  const insights: string[] = [];
  const { expenses } = userData;
  
  // Food/Delivery insight
  if (monthlyDelivery > totalIncome * 0.25) {
    const savingsPerMonth = Math.round((monthlyDelivery - totalIncome * 0.20) * 0.7);
    insights.push(`Si reducís el delivery y cocinás 3 veces por semana, podés ahorrar $${savingsPerMonth.toLocaleString('es-AR').replace(/,/g, '.')} al mes. Eso es un viaje, una inversión, o tu fondo de emergencia.`);
  }
  
  // Entertainment insight
  if (monthlyEntertainment > totalIncome * 0.15) {
    const savingsPerMonth = Math.round((monthlyEntertainment - totalIncome * 0.10) * 0.5);
    insights.push(`Tus salidas están consumiendo mucho presupuesto. Probá alternar salidas pagas con planes gratis: picnic, caminatas, juntadas en casa. Ahorro estimado: $${savingsPerMonth.toLocaleString('es-AR').replace(/,/g, '.')}/mes.`);
  }
  
  // Services/Subscriptions insight
  if (subscriptionsCost > totalIncome * 0.12) {
    insights.push(`Tenés muchas suscripciones activas. Revisá cuáles realmente usás. Netflix, Spotify, gym que no pisás... cada una suma. Cancelar 2 o 3 puede liberarte $${Math.round(subscriptionsCost * 0.3).toLocaleString('es-AR').replace(/,/g, '.')}/mes.`);
  }
  
  // Credit card insight
  if (expenses.creditCard > totalIncome * 0.30) {
    insights.push(`Tu tarjeta de crédito está pesando demasiado. Esto te está limitando. Intentá pagar más del mínimo, reducí compras en cuotas, y usala solo para emergencias por 2 meses.`);
  }
  
  // Transport insight
  if (expenses.transport > totalIncome * 0.15) {
    const savingsPerMonth = Math.round(expenses.transport * 0.25);
    insights.push(`El transporte te está costando mucho. ¿Podés compartir viajes, usar bici algunos días, o trabajar remoto 1-2 veces por semana? Ahorro potencial: $${savingsPerMonth.toLocaleString('es-AR').replace(/,/g, '.')}/mes.`);
  }
  
  // General saving insight
  if (!userData.saves) {
    insights.push(`No estás ahorrando. Empezá con poco: $${Math.round(totalIncome * 0.05).toLocaleString('es-AR').replace(/,/g, '.')} al mes (5% de tus ingresos). Automatizalo el día que cobrás. Vas a ver la diferencia en 3 meses.`);
  }
  
  return insights.slice(0, 3); // Max 3 insights
}

function calculateReduciblePercentage(monthlyDelivery: number, monthlyEntertainment: number, subscriptionsCost: number, transport: number, totalExpenses: number): number {
  // Estimate which expenses are reducible
  const reducible = 
    monthlyDelivery * 0.3 +           // 30% of food is reducible
    monthlyEntertainment * 0.5 +  // 50% of entertainment
    subscriptionsCost * 0.3 +       // 30% of subscriptions
    transport * 0.2;       // 20% of transport
  
  return Math.round((reducible / totalExpenses) * 100);
}

function analyzeGoals(goals: Array<{ title: string; amount: number; timeframe: number }>, available: number): GoalAnalysis[] {
  return goals.map(goal => {
    const monthlyRequired = Math.round(goal.amount / goal.timeframe);

    let status: 'possible' | 'tight' | 'not_possible';
    let insight: string;

    if (monthlyRequired <= available * 0.5) {
      status = 'possible';
      insight = `Si ahorrás $${monthlyRequired.toLocaleString('es-AR').replace(/,/g, '.')} por mes durante ${goal.timeframe} meses, llegás exactamente a tu objetivo. Lo tenés más que cubierto.`;
    } else if (monthlyRequired <= available * 0.8) {
      status = 'tight';
      insight = `Necesitás ahorrar $${monthlyRequired.toLocaleString('es-AR').replace(/,/g, '.')} al mes. Es ajustado pero alcanzable con disciplina y reduciendo algunos gastos.`;
    } else {
      status = 'tight'; // Cambiado de 'not_possible' a 'tight' para el display
      const extendedMonths = Math.ceil(goal.amount / (available * 0.8));
      const deficit = monthlyRequired - available;
      insight = `Este objetivo requiere $${monthlyRequired.toLocaleString('es-AR').replace(/,/g, '.')}/mes. Te recomendamos extender el plazo a ${extendedMonths} meses o reducir gastos para liberar $${deficit.toLocaleString('es-AR').replace(/,/g, '.')}/mes más. ¡Es alcanzable con ajustes!`;
    }

    return {
      title: goal.title,
      amount: goal.amount,
      timeframe: goal.timeframe,
      monthlyRequired,
      status,
      insight,
      progress: 0, // Siempre 0 en MVP inicial
    };
  });
}

function generateReducibleExpenses(userData: UserData, totalIncome: number, monthlyDelivery: number, monthlyEntertainment: number, subscriptionsCost: number): ReducibleExpense[] {
  const expenses: ReducibleExpense[] = [];
  const { expenses: userExpenses } = userData;

  // Delivery / Comida - VARIABLE EXPENSE (always safe to suggest)
  if (monthlyDelivery > totalIncome * 0.20) {
    const savingsAmount = Math.round((monthlyDelivery - totalIncome * 0.20) * 0.6);
    expenses.push({
      category: 'Delivery',
      emoji: '🍕',
      currentAmount: monthlyDelivery,
      description: `Gastás aproximadamente **$${monthlyDelivery.toLocaleString('es-AR').replace(/,/g, '.')}/mes** en comida. Ese es el costo de no cocinar. **Una salida menos por semana** te hace ahorrar sin renunciar al placer. Sin privarte, solo eligiendo mejor.`,
      savingsAmount,
      savingsMessage: `$${savingsPreviewMessage(savingsAmount, 3)}`,
    });
  }

  // Salidas / Entertainment - VARIABLE EXPENSE (always safe to suggest)
  if (monthlyEntertainment > totalIncome * 0.12) {
    const savingsAmount = Math.round((monthlyEntertainment - totalIncome * 0.10) * 0.5);
    expenses.push({
      category: 'Salidas',
      emoji: '🍻',
      currentAmount: monthlyEntertainment,
      description: `Tu ocio está en **$${monthlyEntertainment.toLocaleString('es-AR').replace(/,/g, '.')}/mes**. No se trata de dejar de salir, sino de **alternar planes pagos con planes gratis**: picnic, caminatas, juntadas en casa. Seguís disfrutando, gastás menos.`,
      savingsAmount,
      savingsMessage: `$${savingsPreviewMessage(savingsAmount, 3)}`,
    });
  }

  // Supermercado - puntos de compra / hábitos de consumo
  const monthlySupermarket = (userData.supermarketFrequency || 0) * (userData.supermarketAmount || 0) * 4.33;
  if (monthlySupermarket > totalIncome * 0.15) {
    const savingsAmount = Math.round(monthlySupermarket * 0.2);
    expenses.push({
      category: 'Supermercado',
      emoji: '🛒',
      currentAmount: monthlySupermarket,
      description: `Gastás **$${monthlySupermarket.toLocaleString('es-AR').replace(/,/g, '.')}/mes** en el súper. Cambiando dónde comprás (mayoristas como Maxiconsumo o Diarco, o días de descuento con tu banco) podés **bajar el ticket 15–25%**. Aprovechá programas de puntos (Carrefour+, Jumbo Más) y hacé lista antes de ir.`,
      savingsAmount,
      savingsMessage: `$${savingsPreviewMessage(savingsAmount, 3)}`,
    });
  }

  // Servicios / Suscripciones - VARIABLE EXPENSE (only if 3+ subscriptions)
  const subscriptionCount = userData.subscriptions.length;
  if (subscriptionsCost > totalIncome * 0.10 && subscriptionCount >= 3) {
    const savingsAmount = Math.round(subscriptionsCost * 0.35);
    expenses.push({
      category: 'Suscripciones',
      emoji: '📺',
      currentAmount: subscriptionsCost,
      description: `Estás pagando **$${subscriptionsCost.toLocaleString('es-AR').replace(/,/g, '.')}/mes** en servicios. Netflix, Spotify, el gym que no pisás... **Cancelar 2 o 3 que no usás** no cambia tu vida, pero libera plata real cada mes.`,
      savingsAmount,
      savingsMessage: `$${savingsPreviewMessage(savingsAmount, 3)}`,
    });
  }

  // NOTE: Transport is considered VARIABLE only for optional expenses like ride apps
  // We don't suggest cutting transport in deficit scenarios as it might be essential
  // Only suggest when there's surplus and it's genuinely excessive
  if (userExpenses.transport > totalIncome * 0.20 && totalIncome - userExpenses.housing - userExpenses.health - userExpenses.transport - subscriptionsCost - monthlyDelivery - monthlyEntertainment > 0) {
    const savingsAmount = Math.round(userExpenses.transport * 0.25);
    expenses.push({
      category: 'Transporte / movilidad',
      emoji: '🚗',
      currentAmount: userExpenses.transport,
      description: `El transporte te cuesta **$${userExpenses.transport.toLocaleString('es-AR').replace(/,/g, '.')}/mes**. ¿Podés **compartir viajes, usar bici algunos días**, o trabajar remoto 1-2 veces por semana? No es sacrificio, es estrategia.`,
      savingsAmount,
      savingsMessage: `$${savingsPreviewMessage(savingsAmount, 3)}`,
    });
  }

  return expenses.slice(0, 3); // Máximo 3 gastos más relevantes
}

function savingsPreviewMessage(monthlyAmount: number, months: number): string {
  const total = monthlyAmount * months;
  return `${monthlyAmount.toLocaleString('es-AR').replace(/,/g, '.')}/mes = en ${months} meses juntás $${total.toLocaleString('es-AR').replace(/,/g, '.')}`;
}

function recommendInvestments(timeframe: number): string[] {
  if (timeframe <= 6) {
    return [
      'Plazo fijo UVA (bajo riesgo, liquidez media)',
      'Fondo común de inversión Money Market',
      'Cuenta remunerada'
    ];
  } else if (timeframe <= 12) {
    return [
      'Fondo común de inversión mixto',
      'Bonos CER (ajuste por inflación)',
      'Plazo fijo UVA + FCI'
    ];
  } else {
    return [
      'Fondo común de inversión acciones',
      'CEDEARs diversificados',
      'Bonos largos + acciones (70/30)'
    ];
  }
}

function generateActionPlan(userData: UserData, insights: string[], goalsAnalysis: GoalAnalysis[]): string[] {
  const plan: string[] = [];

  // Step 1: Track expenses
  if (!userData.knowsLastMonthExpenses) {
    plan.push('Anotá todos tus gastos durante 30 días. Lo más fácil: registralos al toque desde el chatbot de WhatsApp de FINA y tu informe se mantiene al día solo. Sin esto, no hay plan que funcione.');
  }

  // Step 2: Automate savings
  if (!userData.saves) {
    plan.push('Automatizá un ahorro el día que cobrás. Aunque sean $5.000, que vayan directo a otra cuenta. "Lo que no ves, no lo gastás".');
  }

  // Step 3: Reduce main expense
  if (insights.length > 0) {
    const mainIssue = insights[0];
    if (mainIssue.includes('delivery') || mainIssue.includes('reducís')) {
      plan.push('Cociná 3 veces por semana este mes. Hacé batch cooking los domingos. Tu billetera y tu salud te lo van a agradecer.');
    } else if (mainIssue.includes('salidas') || mainIssue.includes('Tus salidas')) {
      plan.push('Alterná salidas pagas con planes gratis. Una semana sí, una no. O limitá el presupuesto semanal para ocio.');
    } else if (mainIssue.includes('suscripciones') || mainIssue.includes('Tenés muchas')) {
      plan.push('Cancelá al menos 2 suscripciones que no usás. Revisá extractos y sorprendete con lo que estás pagando sin darte cuenta.');
    } else if (mainIssue.includes('tarjeta')) {
      plan.push('Pagá más del mínimo en la tarjeta. Intentá saldarla en 3-6 meses. Mientras tanto: cero compras en cuotas nuevas.');
    }
  }

  // Step 3b: Supermarket-specific advice (mejorar puntos de compra)
  const monthlySuper = (userData.supermarketFrequency || 0) * (userData.supermarketAmount || 0) * 4.33;
  const totalIncome = userData.monthlyIncome || 1;
  if (monthlySuper / totalIncome > 0.12) {
    plan.push('Cambiá dónde hacés las compras: comparar precios entre Día, Coto, Carrefour y mayoristas como Maxiconsumo o Diarco puede bajar tu ticket un 15–25%. Aprovechá los días de descuento de tu banco y programas de puntos (ej: Carrefour+, Jumbo Más).');
  }

  // Step 4: Goal-specific action
  if (goalsAnalysis.length > 0) {
    const firstGoal = goalsAnalysis[0];
    plan.push(`Abrí una cuenta separada para "${firstGoal.title}". Transferí $${firstGoal.monthlyRequired.toLocaleString('es-AR').replace(/,/g, '.')} por mes automáticamente.`);
  }

  return plan.slice(0, 4); // Max 4 steps
}