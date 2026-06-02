import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PersonalData } from './components/PersonalData';
import { Context } from './components/Context';
import { Activity } from './components/Activity';
import { Bank } from './components/Bank';
import { ExpensesFixed } from './components/ExpensesFixed';
import { ExpensesServices } from './components/ExpensesServices';
import { Habits } from './components/Habits';
import { Goals } from './components/Goals';
import { AIReasoning } from './components/AIReasoning';
import { Result } from './components/Result';
import {
  WelcomeScreen,
  MessageIngresos,
  MessageGastosFijos,
  MessageGastosVariables,
  LoadingScreen,
} from './components/OnboardingMessages';
import { UserData, FinancialAnalysis, TransportData } from './types';
import { analyzeFinances } from './utils/financialAnalyzer';
import { DEBUG_MODE } from './config';
import { saveReport, fetchUserReport } from './lib/reports';
import { fetchExchangeRate } from './lib/exchangeRate';
import { useAuth } from './lib/auth';

export function Main() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, updateProfile, hasReport, markHasReport } = useAuth();

  const [userData, setUserData] = useState<Partial<UserData>>({
    name: '',
    age: '',
    email: '',
    monthlyIncome: 0,
    banks: [],
    expenses: {
      housing: 0,
      health: 0,
      beauty: 0,
      therapy: 0,
      gym: 0,
      transport: 0,
      services: 0,
      food: 0,
      entertainment: 0,
      creditCard: 0,
    },
    transportDetails: {
      hasCar: false,
      insurance: 0,
      fuel: 0,
      insuranceNotPaying: false,
      fuelNotPaying: false,
      hasPublicTransport: false,
      publicTransportTrips: 0,
      publicTransportCostPerTrip: 400,
      hasRideApps: false,
      rideAppTrips: 0,
      rideAppCostPerTrip: 4000,
    },
    installments: [],
    subscriptions: [],
    entertainmentFrequency: 0,
    entertainmentAmount: 0,
    deliveryFrequency: 0,
    deliveryAmount: 0,
    supermarketFrequency: 0,
    supermarketAmount: 0,
    cafeteriasFrequency: 0,
    cafeteriasAmount: 0,
    goals: [],
    specificGoals: [],
  });

  const [analysis, setAnalysis] = useState<FinancialAnalysis | null>(null);

  // PR6 — la lógica de "qué se muestra en /" la maneja RootRedirect ahora;
  // Main solo se monta en step routes / informe. Si por algún motivo se carga
  // en `/` lo dejamos en manos del router (Main no debería ni montarse acá).

  // Pre-fill personal data from the saved profile (auth metadata + email) so a
  // returning user can skip PersonalData and start the flow at /context, while
  // the report still carries their name/age/email/gender.
  useEffect(() => {
    if (!user) return;
    setUserData(prev => ({
      ...prev,
      name: prev.name || profile.name,
      age: prev.age || profile.age,
      gender: prev.gender || (profile.gender || undefined),
      email: prev.email || user.email || '',
    }));
  }, [user, profile.name, profile.age, profile.gender]);

  // Fetch the USD blue rate once and snapshot it into userData, so every USD
  // amount in this flow uses the same rate and the report stays anchored to it.
  useEffect(() => {
    let active = true;
    fetchExchangeRate().then((rate) => {
      if (active && rate) {
        setUserData(prev => ({ ...prev, exchangeRate: rate }));
      }
    });
    return () => { active = false; };
  }, []);

  // Scroll to top whenever the route (section) changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    // Also reset any internal scroll containers the pages may use
    document.querySelectorAll('.overflow-y-auto').forEach((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
  }, [location.pathname]);

  const handlePersonalData = (data: { name: string; age: string; email: string; gender: 'femenino' | 'masculino' | 'prefiero_no_decir' }) => {
    setUserData(prev => ({ ...prev, ...data }));
    // Persistimos al perfil para que las próximas veces se pre-cargue y se
    // pueda saltear este paso.
    void updateProfile({ name: data.name, age: data.age, gender: data.gender });
  };

  const handleContext = (data: { livesAlone: boolean }) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  const handleActivity = (data: {
    worksOrStudies: 'works' | 'studies' | 'both' | 'neither';
    monthlyIncome: number;
    incomeRange?: string;
    incomeCurrency: 'ARS' | 'USD';
    incomeOriginalAmount: number;
    incomeType: 'fixed' | 'freelance' | 'both';
    freelanceIncome?: UserData['freelanceIncome'];
  }) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  const handleBank = (data: { banks: string[] }) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  const handleExpensesFixed = (data: {
    housing: number;
    health: number;
    beauty: number;
    therapy: number;
    gym: number;
    housingCurrency: 'ARS' | 'USD';
    housingOriginalAmount: number;
    therapyDetails: { sessionPrice: number; sessionsPerMonth: number };
    transportDetails: TransportData;
    installments: Array<{
      name: string;
      monthlyAmount: number;
      remainingInstallments: number;
      currency: 'ARS' | 'USD';
      originalAmount: number;
    }>;
  }) => {
    // Calculate total transport cost from transportDetails
    const publicTransportMonthlyCost = Math.round(
      data.transportDetails.publicTransportTrips *
      data.transportDetails.publicTransportCostPerTrip *
      4.33
    );

    const rideAppMonthlyCost = Math.round(
      data.transportDetails.rideAppTrips *
      data.transportDetails.rideAppCostPerTrip *
      4.33
    );

    const carInsuranceCost = data.transportDetails.insuranceNotPaying ? 0 : data.transportDetails.insurance;
    const carFuelCost = data.transportDetails.fuelNotPaying ? 0 : data.transportDetails.fuel;
    const carMonthlyCost = carInsuranceCost + carFuelCost;
    const totalTransportCost = carMonthlyCost + publicTransportMonthlyCost + rideAppMonthlyCost;

    setUserData(prev => ({
      ...prev,
      expenses: {
        ...prev.expenses!,
        housing: data.housing,
        health: data.health,
        beauty: data.beauty,
        therapy: data.therapy,
        gym: data.gym,
        transport: totalTransportCost,
      },
      housingCurrency: data.housingCurrency,
      housingOriginalAmount: data.housingOriginalAmount,
      therapyDetails: data.therapyDetails,
      transportDetails: data.transportDetails,
      installments: data.installments,
    }));
  };

  const handleExpensesServices = (data: {
    subscriptions: Array<{
      name: string;
      cost: number;
      isCustom: boolean;
    }>;
    entertainmentFrequency: number;
    entertainmentAmount: number;
    deliveryFrequency: number;
    deliveryAmount: number;
    supermarketFrequency: number;
    supermarketAmount: number;
    cafeteriasFrequency: number;
    cafeteriasAmount: number;
  }) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  const handleHabits = (data: { knowsLastMonthExpenses: boolean; saves: boolean; invests: boolean }) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  const handleGoals = (data: { goals: string[]; specificGoals: UserData['specificGoals'] }) => {
    const completeData = { ...userData, ...data } as UserData;
    setUserData(completeData);

    // Generate analysis
    const financialAnalysis = analyzeFinances(completeData);
    setAnalysis(financialAnalysis);

    // Silently persist the finished flow to Supabase. PR6: marca hasReport=true
    // localmente para que OnboardingGate empiece a redirigir las rutas de
    // onboarding sin esperar al próximo refetch.
    void saveReport(completeData, financialAnalysis).then(() => markHasReport());
  };

  // PR6 — Hidratación de /result desde DB. Si el usuario aterriza acá tras
  // un refresh (RootRedirect → /result porque hasReport=true), el state
  // in-memory está vacío. Cargamos su único informe (UNIQUE en reports.user_id
  // garantiza que es uno solo) y lo dejamos en analysis para que el switch
  // de abajo renderice. AIReasoning se hidrata igual porque comparte estado.
  const needsHydration =
    !analysis &&
    (location.pathname === '/result' || location.pathname === '/ai-reasoning') &&
    !!user &&
    hasReport === true;
  useEffect(() => {
    if (!needsHydration) return;
    let active = true;
    fetchUserReport().then((r) => {
      if (active && r) {
        setUserData(r.userData);
        setAnalysis(r.analysis);
      }
    });
    return () => { active = false; };
  }, [needsHydration]);

  // Render appropriate component based on route
  switch (location.pathname) {
    case '/welcome':
      return <WelcomeScreen />;
    case '/personal-data':
      return <PersonalData initial={userData} onComplete={handlePersonalData} />;
    case '/context':
      return <Context initial={userData} gender={userData.gender} onComplete={handleContext} />;
    case '/mensaje/ingresos':
      return <MessageIngresos />;
    case '/activity':
      return <Activity initial={userData} onComplete={handleActivity} />;
    case '/bank':
      return <Bank initial={userData} onComplete={handleBank} />;
    case '/mensaje/gastos-fijos':
      return <MessageGastosFijos />;
    case '/expenses-fixed':
      return <ExpensesFixed initial={userData} monthlyIncome={userData.monthlyIncome || 0} onComplete={handleExpensesFixed} />;
    case '/mensaje/gastos-variables':
      return <MessageGastosVariables />;
    case '/expenses-services':
      return <ExpensesServices initial={userData} onComplete={handleExpensesServices} />;
    case '/habits':
      return <Habits initial={userData} onComplete={handleHabits} />;
    case '/goals':
      return <Goals initial={userData} onComplete={handleGoals} />;
    case '/loading':
      return <LoadingScreen />;
    case '/ai-reasoning':
      return analysis ? <AIReasoning analysis={analysis} /> : <LoadingScreen />;
    case '/result':
      return analysis ? <Result analysis={analysis} /> : <LoadingScreen />;
    default:
      return <WelcomeScreen />;
  }
}