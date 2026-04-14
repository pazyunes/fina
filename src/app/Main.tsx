import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Splash } from './components/Splash';
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
import { UserData, FinancialAnalysis } from './types';
import { analyzeFinances } from './utils/financialAnalyzer';
import { DEBUG_MODE } from './config';

export function Main() {
  const location = useLocation();
  const navigate = useNavigate();

  const [userData, setUserData] = useState<Partial<UserData>>({
    name: '',
    age: '',
    email: '',
    livesAlone: false,
    worksOrStudies: 'works',
    monthlyIncome: 0,
    banks: [],
    expenses: {
      housing: 0,
      health: 0,
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
    gender: 'prefiero_no_decir',
    knowsLastMonthExpenses: false,
    saves: false,
    invests: false,
    goals: [],
    specificGoals: [],
  });

  const [analysis, setAnalysis] = useState<FinancialAnalysis | null>(null);

  useEffect(() => {
    // Redirect to splash on initial load
    if (location.pathname === '/') {
      navigate('/splash');
    }
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
  };

  const handleContext = (data: { livesAlone: boolean }) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  const handleActivity = (data: { worksOrStudies: 'works' | 'studies' | 'both' | 'neither'; monthlyIncome: number }) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  const handleBank = (data: { banks: string[] }) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  const handleExpensesFixed = (data: {
    housing: number;
    health: number;
    transportDetails: {
      hasCar: boolean;
      insurance: number;
      fuel: number;
      insuranceNotPaying: boolean;
      hasPublicTransport: boolean;
      publicTransportTrips: number;
      publicTransportCostPerTrip: number;
      hasRideApps: boolean;
      rideAppTrips: number;
      rideAppCostPerTrip: number;
    };
    installments: Array<{
      name: string;
      monthlyAmount: number;
      remainingInstallments: number;
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
        transport: totalTransportCost,
      },
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
  };

  // Render appropriate component based on route
  switch (location.pathname) {
    case '/splash':
      return <Splash />;
    case '/personal-data':
      return <PersonalData onComplete={handlePersonalData} />;
    case '/context':
      return <Context gender={userData.gender} onComplete={handleContext} />;
    case '/activity':
      return <Activity onComplete={handleActivity} />;
    case '/bank':
      return <Bank onComplete={handleBank} />;
    case '/expenses-fixed':
      return <ExpensesFixed monthlyIncome={userData.monthlyIncome || 0} onComplete={handleExpensesFixed} />;
    case '/expenses-services':
      return <ExpensesServices onComplete={handleExpensesServices} />;
    case '/habits':
      return <Habits onComplete={handleHabits} />;
    case '/goals':
      return <Goals onComplete={handleGoals} />;
    case '/ai-reasoning':
      return analysis ? <AIReasoning analysis={analysis} /> : <Splash />;
    case '/result':
      return analysis ? <Result analysis={analysis} /> : <Splash />;
    default:
      return <Splash />;
  }
}