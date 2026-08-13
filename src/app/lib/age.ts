// Deriva la edad a partir de la fecha de nacimiento (YYYY-MM-DD) en vez de
// pedirla directamente, así se mantiene actualizada sola cuando cumple años.

export function calculateAge(birthDate: string | undefined | null): number | null {
  if (!birthDate) return null;
  const dob = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Límites para el <input type="date">: entre `maxAge` y `minAge` años atrás.
export function birthDateBounds(minAge = 18, maxAge = 100): { min: string; max: string } {
  const today = new Date();
  const toISODate = (d: Date) => d.toISOString().slice(0, 10);
  return {
    min: toISODate(new Date(today.getFullYear() - maxAge, today.getMonth(), today.getDate())),
    max: toISODate(new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate())),
  };
}
