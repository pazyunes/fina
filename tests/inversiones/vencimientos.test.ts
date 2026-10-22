import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avisoDeInversionQueVence } from '../../api/_notificaciones/inversiones.js';

const HOY = '2026-10-22';
const MANANA = '2026-10-23';
const pf = { kind: 'plazo_fijo', provider: 'Banco Galicia', amount: 500000, currency: 'ARS' };

test('sin inversiones que venzan no hay aviso', () => {
  assert.equal(avisoDeInversionQueVence([], HOY, MANANA), null);
  assert.equal(avisoDeInversionQueVence([{ ...pf, end_date: '2026-10-30' }], HOY, MANANA), null);
});

test('un plazo fijo que vence mañana avisa el día anterior', () => {
  const a = avisoDeInversionQueVence([{ ...pf, end_date: MANANA }], HOY, MANANA);
  assert.ok(a);
  assert.match(a.title, /^Mañana vence tu plazo fijo en Banco Galicia$/);
  assert.match(a.body, /\$500\.000/);
});

test('el mismo día dice "Hoy" y lo que ya pasó no insiste', () => {
  const a = avisoDeInversionQueVence([{ ...pf, end_date: HOY }], HOY, MANANA);
  assert.match(a!.title, /^Hoy vence/);
  assert.equal(avisoDeInversionQueVence([{ ...pf, end_date: '2026-10-21' }], HOY, MANANA), null);
});

test('si vencen varias el mismo día se juntan en un solo aviso', () => {
  const a = avisoDeInversionQueVence([
    { ...pf, end_date: HOY },
    { kind: 'letra', provider: 'Cocos Capital', amount: 300000, currency: 'ARS', end_date: HOY },
  ], HOY, MANANA);
  assert.match(a!.title, /^Hoy vencen 2 inversiones/);
  assert.match(a!.body, /letra en Cocos Capital/);
});

test('con las de hoy y las de mañana, avisa primero las de hoy', () => {
  const a = avisoDeInversionQueVence([{ ...pf, end_date: MANANA }, { ...pf, provider: 'Banco Nación', end_date: HOY }], HOY, MANANA);
  assert.match(a!.title, /^Hoy vence tu plazo fijo en Banco Nación/);
});

test('en dólares muestra US$ y el texto no da órdenes', () => {
  const a = avisoDeInversionQueVence([{ kind: 'plazo_fijo_uva', provider: 'Banco X', amount: 1000, currency: 'USD', end_date: HOY }], HOY, MANANA);
  assert.match(a!.body, /US\$1\.000/);
  assert.doesNotMatch(a!.body, /deberías|tenés que|no te olvides/i);
});

test('el aviso dice qué pasa según si se renueva solo o no (lo que la persona respondió al registrar)', () => {
  const si = avisoDeInversionQueVence([{ ...pf, end_date: MANANA, details: { renuevaSolo: true } }], HOY, MANANA);
  assert.match(si!.body, /Se renueva solo\. Si no querés que se renueve, tenés que avisarle al banco antes/);
  const no = avisoDeInversionQueVence([{ ...pf, end_date: MANANA, details: { renuevaSolo: false } }], HOY, MANANA);
  assert.match(no!.body, /No se renueva solo: la plata vuelve a tu cuenta/);
  const sinDato = avisoDeInversionQueVence([{ ...pf, end_date: MANANA, details: {} }], HOY, MANANA);
  assert.doesNotMatch(sinDato!.body, /renueva/);
});
