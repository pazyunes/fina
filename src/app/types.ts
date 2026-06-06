export type Currency = 'ARS' | 'USD';

// Snapshot de cotización con el que se generó el informe. Se persiste para
// "anclar" los montos en USD al cambio del día (2.3d/e).
export interface ExchangeRate {
  id: string | null;       // FK a exchange_rates (null si no se pudo guardar)
  currency: string;        // 'USD_BLUE'
  rate: number;            // ARS por 1 USD (venta del blue)
  fetchedAt: string;       // ISO timestamp
  stale: boolean;          // true si dolarapi falló y se devolvió una vencida
}

export interface TransportData {
  hasCar: boolean;
  insurance: number;
  fuel: number;
  insuranceNotPaying: boolean;
  fuelNotPaying: boolean;
  hasPublicTransport: boolean;
  publicTransportTrips: number;
  publicTransportCostPerTrip: number;
  hasRideApps: boolean;
  rideAppTrips: number;
  rideAppCostPerTrip: number;
}

export interface UserData {
  // Personal data
  name: string;
  age: string;
  email: string;
  gender: 'femenino' | 'masculino' | 'prefiero_no_decir';

  // Context
  livesAlone: boolean;

  // Activity
  worksOrStudies: 'works' | 'studies' | 'both' | 'neither';
  monthlyIncome: number; // Valor usado en cálculos, SIEMPRE en ARS (convertido si se cargó en USD). Para freelance/both = fijo + promedio freelance.
  incomeRange?: string; // Etiqueta del rango elegido, o 'Monto exacto' si cargó un valor preciso (solo aplica al bloque fijo)
  incomeCurrency?: Currency; // Moneda en la que el usuario cargó el ingreso fijo
  incomeOriginalAmount?: number; // Monto original del fijo (USD si incomeCurrency === 'USD', si no ARS)

  // Tipo de ingreso (PR4). Si está ausente, se trata como 'fixed' (compat con informes viejos).
  incomeType?: 'fixed' | 'freelance' | 'both';

  // Detalle del ingreso freelance (PR4) — 3 últimos meses, mes1 = más reciente.
  // El exchange_rate_id se reusa del snapshot global del informe (userData.exchangeRate.id).
  freelanceIncome?: {
    month1: { amount: number; currency: Currency; ars: number }; // mes más reciente
    month2: { amount: number; currency: Currency; ars: number };
    month3: { amount: number; currency: Currency; ars: number };
    monthlyAvgArs: number; // (m1.ars + m2.ars + m3.ars) / 3
  };

  // Bank
  banks: string[];

  // Expenses
  expenses: {
    housing: number; // Alquiler (siempre en ARS, ya convertido si se cargó en USD)
    health: number; // Salud
    beauty: number; // Belleza y cuidado personal (peluquería, manicura, etc.)
    therapy: number; // Psicóloga / terapia
    gym: number; // Gimnasio
    transport: number; // Transporte / movilidad (calculated from transportDetails)
    services: number; // Deprecated - ahora se usa subscriptions
    food: number; // Deprecated - ahora se calcula desde delivery
    entertainment: number; // Deprecated - ahora se calcula desde entretenimiento
    creditCard: number; // Deprecated - ahora se usa installments
  };

  // Therapy details — el monto mensual (expenses.therapy) se calcula como
  // sessionPrice × sessionsPerMonth; guardamos los dos crudos para poder
  // re-mostrarlos si el usuario vuelve a este paso.
  therapyDetails?: {
    sessionPrice: number;
    sessionsPerMonth: number;
  };

  // Transport details
  transportDetails: TransportData;

  // Fixed expenses details - Installments (múltiples cuotas)
  installments: Array<{
    name: string; // Nombre / descripción de la cuota
    monthlyAmount: number; // Monto mensual de esta cuota (ARS, ya convertido)
    remainingInstallments: number; // Cantidad de cuotas restantes
    currency?: Currency;
    originalAmount?: number; // monto cargado por el usuario si fue en USD
  }>;

  // Services/Subscriptions
  subscriptions: Array<{
    name: string;
    cost: number; // ARS, ya convertido
    isCustom: boolean;
    currency?: Currency;
    originalCost?: number;
  }>;

  // Consumption habits
  entertainmentFrequency: number; // veces por semana
  entertainmentAmount: number; // gasto por salida
  deliveryFrequency: number; // veces por semana
  deliveryAmount: number; // gasto por pedido
  supermarketFrequency: number; // veces por semana que va al super
  supermarketAmount: number; // gasto por visita al super
  // PR6 — cafeterías/restaurantes (salidas, almuerzos afuera, café en la calle, etc.).
  // Opcional para compat con informes pre-PR6 — el analyzer trata undefined como 0.
  cafeteriasFrequency?: number; // veces por semana (cafeterías)
  cafeteriasAmount?: number; // gasto por visita (cafeterías)
  // PR — restaurantes separados de cafeterías.
  restaurantsFrequency?: number; // veces por semana (restaurantes)
  restaurantsAmount?: number; // gasto por visita (restaurantes)

  // Gastos ocasionales (no todos los meses): ropa, regalos, viajes cortos, etc.
  // everyMonths = cada cuántos meses ocurre; amount = cuánto gastás cada vez.
  // El analyzer los amortiza a mensual (amount / everyMonths). Opcional.
  occasionalExpenses?: Array<{ name: string; everyMonths: number; amount: number }>;

  // Habits
  knowsLastMonthExpenses: boolean;
  saves: boolean;
  invests: boolean;

  // Exchange rate snapshot used for any USD amounts in this flow
  exchangeRate?: ExchangeRate | null;

  // Alquiler cargado en USD (2.3): se guarda la moneda y el monto original;
  // expenses.housing queda en ARS para los cálculos.
  housingCurrency?: Currency;
  housingOriginalAmount?: number;

  // Goals
  goals: string[];
  specificGoals: Array<{
    title: string;
    amount: number; // ARS, ya convertido
    timeframe: number; // months
    currency?: Currency;
    originalAmount?: number;
  }>;
}

export interface GoalAnalysis {
  title: string;
  amount: number;
  timeframe: number;
  monthlyRequired: number;
  status: 'possible' | 'tight' | 'not_possible';
  insight: string;
  progress: number; // 0-100, siempre 0 en MVP inicial
}

export interface ReducibleExpense {
  category: string;
  emoji: string;
  currentAmount: number;
  description: string;
  savingsAmount: number;
  savingsMessage: string;
}

export interface FinancialAnalysis {
  userData: UserData;
  totalIncome: number;
  totalExpenses: number;
  available: number;
  financialLevel: string;
  insights: string[];
  reduciblePercentage: number;
  goalsAnalysis: GoalAnalysis[];
  reducibleExpenses: ReducibleExpense[];
  totalSavingsPotential: number;
  recommendedInvestments: string[];
  actionPlan: string[];
}