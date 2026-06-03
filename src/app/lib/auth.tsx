import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { userHasReport, fetchUserReport } from './reports';
import type { FinancialAnalysis, UserData } from '../types';

// Datos de perfil guardados en el user_metadata de Supabase Auth.
export interface Profile {
  name: string;
  age: string;
  gender: 'femenino' | 'masculino' | 'prefiero_no_decir' | '';
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile;   // derivado de user.user_metadata
  loading: boolean; // true mientras se resuelve la sesión inicial
  // PR6 — ¿el usuario ya generó su informe? null mientras se resuelve, true|false
  // después. Lo consumen los gates de routing para decidir entre /result y el
  // flujo de onboarding sin tener que cada componente hacer su propia query.
  hasReport: boolean | null;
  // Permite a Result.tsx avisarle al provider que acaba de guardarse un informe
  // sin tener que esperar al próximo session change (que no llega).
  markHasReport: () => void;
  // PR8 — Informe cacheado al nivel del provider para que la navegación entre
  // tabs no muestre LoadingScreen. Se hidrata una sola vez cuando session +
  // hasReport=true. Main puede sobreescribirlo cuando regenera el informe.
  cachedReport: { userData: UserData; analysis: FinancialAnalysis } | null;
  setCachedReport: (data: { userData: UserData; analysis: FinancialAnalysis } | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  // needsConfirmation: true si Supabase pide confirmar el email antes de loguear.
  // phone (opcional, E.164) se guarda en user_metadata y un effect lo copia a
  // user_profiles.phone cuando aparece la sesión (cubre el caso confirmación).
  signUp: (email: string, password: string, phone?: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  // Actualiza nombre/edad/sexo (metadata) y, si cambió, el email de acceso.
  // emailChangePending: true si el cambio de email espera confirmación.
  updateProfile: (data: Partial<Profile> & { email?: string }) => Promise<{ error: string | null; emailChangePending: boolean }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // null = todavía no se resolvió la query (loading); true/false una vez resuelta.
  const [hasReport, setHasReport] = useState<boolean | null>(null);
  const markHasReport = useCallback(() => setHasReport(true), []);
  // PR8 — Cache del informe del usuario para que las navegaciones entre tabs no
  // disparen LoadingScreen.
  const [cachedReport, setCachedReport] = useState<{ userData: UserData; analysis: FinancialAnalysis } | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    // Sesión actual al cargar.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // Y nos suscribimos a cambios (login, logout, refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // PR6 — Cada vez que cambia el usuario logueado, consultamos si tiene su
  // informe. RLS garantiza que solo cuenta los propios. Cuando no hay sesión
  // se resetea a false (no relevante igual; el RootRedirect no lo mira).
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setHasReport(false);
      return;
    }
    const uid = session?.user?.id;
    if (!uid) {
      setHasReport(false);
      setCachedReport(null); // logout o cambio de usuario → tirar cache.
      return;
    }
    setHasReport(null);
    let active = true;
    userHasReport().then((has) => {
      if (active) setHasReport(has);
    });
    return () => { active = false; };
  }, [session?.user?.id]);

  // PR8 — Cuando se confirma que el usuario tiene informe, lo precargamos en
  // cache una sola vez. A partir de ahí cualquier navegación a /result,
  // /objetivos o /inversiones renderiza con datos en memoria, sin pasar por
  // LoadingScreen.
  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user || hasReport !== true || cachedReport) return;
    let active = true;
    fetchUserReport().then((r) => {
      if (active && r) setCachedReport(r);
    });
    return () => { active = false; };
  }, [session?.user?.id, hasReport, cachedReport]);

  // Cuando llega una sesión nueva, si el user_metadata trae phone y la fila
  // de user_profiles todavía no lo tiene seteado, lo copiamos. Cubre dos
  // casos: signup con sesión inmediata (write redundante pero idempotente)
  // y signup con confirmación por mail (el phone estuvo guardado en
  // metadata hasta que el usuario confirma y entra).
  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user) return;
    const phoneInMeta = (session.user.user_metadata?.phone as string | undefined)?.trim();
    if (!phoneInMeta) return;
    void supabase
      .from('user_profiles')
      .update({ phone: phoneInMeta })
      .eq('id', session.user.id)
      .is('phone', null)
      .then(({ error }) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[fina] copy phone to user_profiles failed:', error.message);
        }
      });
  }, [session?.user?.id]);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error?.message ?? null };
  };

  const signUp: AuthContextValue['signUp'] = async (email, password, phone) => {
    const trimmedPhone = phone?.trim();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // El teléfono va a user_metadata; el effect de abajo lo copia a
      // user_profiles.phone cuando llega la sesión, así también funciona si
      // la cuenta requiere confirmación por mail.
      options: trimmedPhone ? { data: { phone: trimmedPhone } } : undefined,
    });
    return { error: error?.message ?? null, needsConfirmation: !error && !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const user = session?.user ?? null;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const profile: Profile = {
    name: (meta.name as string) ?? '',
    age: (meta.age as string) ?? '',
    gender: (meta.gender as Profile['gender']) ?? '',
  };

  const updateProfile: AuthContextValue['updateProfile'] = async ({ name, age, gender, email }) => {
    const payload: Parameters<typeof supabase.auth.updateUser>[0] = {
      data: { name, age, gender },
    };
    const emailChanged = !!email && email.trim() !== user?.email;
    if (emailChanged) payload.email = email!.trim();
    const { error } = await supabase.auth.updateUser(payload);
    return { error: error?.message ?? null, emailChangePending: emailChanged && !error };
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, hasReport, markHasReport, cachedReport, setCachedReport, signIn, signUp, signOut, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
