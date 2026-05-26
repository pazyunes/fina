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
  monthlyIncome: number; // Valor usado en cálculos (monto exacto, o punto medio del rango)
  incomeRange?: string; // Etiqueta del rango elegido, o 'Monto exacto' si cargó un valor preciso

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

  // Transport details
  transportDetails: TransportData;

  // Fixed expenses details - Installments (múltiples cuotas)
  installments: Array<{
    name: string; // Nombre / descripción de la cuota
    monthlyAmount: number; // Monto mensual de esta cuota
    remainingInstallments: number; // Cantidad de cuotas restantes
  }>;

  // Services/Subscriptions
  subscriptions: Array<{
    name: string;
    cost: number;
    isCustom: boolean;
  }>;

  // Consumption habits
  entertainmentFrequency: number; // veces por semana
  entertainmentAmount: number; // gasto por salida
  deliveryFrequency: number; // veces por semana
  deliveryAmount: number; // gasto por pedido
  supermarketFrequency: number; // veces por semana que va al super
  supermarketAmount: number; // gasto por visita al super

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
    amount: number;
    timeframe: number; // months
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