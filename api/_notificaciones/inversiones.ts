import type { Aviso } from './enviar.js';

// Aviso de "tu inversión vence": un plazo fijo, una letra o lo que tenga fecha de fin.
// Es una función pura (recibe las filas y devuelve el aviso) para poder probarla sin base.
//
// Tono: avisa y deja la decisión a la persona. No dice qué hacer con la plata.

export type InversionQueVence = {
  kind: string;
  provider: string;
  amount: number;
  currency: string;
  end_date: string;
  /** Lo propio de cada tipo; acá interesa `renuevaSolo` (plazo fijo). */
  details?: { renuevaSolo?: boolean } | null;
};

const NOMBRE: Record<string, string> = {
  plazo_fijo: 'plazo fijo',
  plazo_fijo_uva: 'plazo fijo UVA',
  letra: 'letra',
};

const monto = (n: number, moneda: string) => `${moneda === 'USD' ? 'US$' : '$'}${Math.round(n).toLocaleString('es-AR')}`;

/**
 * `filas` ya viene filtrado por la base (activas, con fin hoy o mañana); acá se arma el texto.
 * Se avisa el día anterior y el mismo día, igual que los gastos fijos.
 */
export function avisoDeInversionQueVence(filas: InversionQueVence[], hoy: string, manana: string): Aviso | null {
  const vigentes = filas.filter((f) => f.end_date === hoy || f.end_date === manana).sort((a, b) => a.end_date.localeCompare(b.end_date));
  if (vigentes.length === 0) return null;

  const cuando = vigentes[0].end_date === hoy ? 'Hoy' : 'Mañana';
  const delDia = vigentes.filter((f) => f.end_date === vigentes[0].end_date);

  if (delDia.length === 1) {
    const f = delDia[0];
    const que = NOMBRE[f.kind] ?? 'inversión';
    // Qué pasa ese día depende de si se renueva solo: lo que la persona respondió al registrarlo.
    const renueva = f.details?.renuevaSolo;
    const queSigue = renueva === true
      ? 'Se renueva solo. Si no querés que se renueve, tenés que avisarle al banco antes.'
      : renueva === false
        ? 'No se renueva solo: la plata vuelve a tu cuenta y ahí decidís qué hacer.'
        : 'Fijate qué querés hacer con esa plata y, cuando la muevas, actualizalo en FINA.';
    return {
      title: `${cuando} vence tu ${que} en ${f.provider}`,
      body: `Tenías ${monto(f.amount, f.currency)}. ${queSigue}`.slice(0, 180),
      url: '/onboarding-v2/inversiones',
      tag: 'fina-vencimiento-inversion',
    };
  }
  return {
    title: `${cuando} vencen ${delDia.length} inversiones tuyas`,
    body: `${delDia.map((f) => `${NOMBRE[f.kind] ?? 'inversión'} en ${f.provider} (${monto(f.amount, f.currency)})`).join(', ')}.`.slice(0, 180),
    url: '/onboarding-v2/inversiones',
    tag: 'fina-vencimiento-inversion',
  };
}
