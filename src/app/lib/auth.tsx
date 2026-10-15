import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

// Datos de perfil guardados en el user_metadata de Supabase Auth.
export interface Profile {
  name: string;
  birthDate: string; // YYYY-MM-DD
  gender: 'femenino' | 'masculino' | 'prefiero_no_decir' | '';
  // Teléfono en E.164 (ej. +54XXXXXXXXXX). Vive en user_metadata.phone y se
  // espeja a user_profiles.phone.
  phone: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile;   // derivado de user.user_metadata
  loading: boolean; // true mientras se resuelve la sesión inicial
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  // needsConfirmation: true si Supabase pide confirmar el email antes de loguear.
  // phone (opcional, E.164) se guarda en user_metadata y un effect lo copia a
  // user_profiles.phone cuando aparece la sesión (cubre el caso confirmación).
  signUp: (email: string, password: string, phone?: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  // Envía el mail de recuperación de contraseña (link → /reset-password).
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  // Setea la contraseña nueva (durante la sesión de recovery).
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  // Actualiza nombre/fecha de nacimiento/sexo (metadata) y, si cambió, el email de acceso.
  // emailChangePending: true si el cambio de email espera confirmación.
  updateProfile: (data: Partial<Profile> & { email?: string }) => Promise<{ error: string | null; emailChangePending: boolean }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  const sendPasswordReset: AuthContextValue['sendPasswordReset'] = async (email) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return { error: error?.message ?? null };
  };

  const updatePassword: AuthContextValue['updatePassword'] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const user = session?.user ?? null;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const profile: Profile = {
    name: (meta.name as string) ?? '',
    birthDate: (meta.birthDate as string) ?? '',
    gender: (meta.gender as Profile['gender']) ?? '',
    phone: (meta.phone as string) ?? '',
  };

  const updateProfile: AuthContextValue['updateProfile'] = async ({ name, birthDate, gender, email, phone }) => {
    const payload: Parameters<typeof supabase.auth.updateUser>[0] = {
      data: { name, birthDate, gender, ...(phone !== undefined ? { phone } : {}) },
    };
    const emailChanged = !!email && email.trim() !== user?.email;
    if (emailChanged) payload.email = email!.trim();
    const { error } = await supabase.auth.updateUser(payload);
    // Espejamos el teléfono editado a user_profiles.phone (el effect de copia
    // solo actúa cuando está null; en una edición hay que escribirlo sí o sí).
    if (!error && phone !== undefined && user) {
      const { error: pErr } = await supabase
        .from('user_profiles')
        .update({ phone: phone.trim() || null })
        .eq('id', user.id);
      if (pErr) {
        // eslint-disable-next-line no-console
        console.error('[fina] update user_profiles.phone failed:', pErr.message);
      }
    }
    return { error: error?.message ?? null, emailChangePending: emailChanged && !error };
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, signIn, signUp, signOut, sendPasswordReset, updatePassword, updateProfile }}
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
