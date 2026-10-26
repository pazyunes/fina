// Un mercado de mentira pero realista (los números son los del 21/10/2026), fijo
// para que los tests den siempre lo mismo y se puedan calcular a mano.

import type { Mercado } from '../../src/app/lib/inversiones/mercadoTipos';

export const AHORA = new Date('2026-10-21T15:00:00-03:00').getTime();

export function mercadoFixture(cambios: Partial<Mercado> = {}): Mercado {
  const base: Mercado = {
    generadoEn: '2026-10-21T18:00:00.000Z',
    desactualizado: false,
    inflacion: {
      meses: [
        { fecha: '2025-10-31', valor: 2.3 }, { fecha: '2025-11-30', valor: 2.5 }, { fecha: '2025-12-31', valor: 2.8 },
        { fecha: '2026-01-31', valor: 2.9 }, { fecha: '2026-02-28', valor: 2.6 }, { fecha: '2026-03-31', valor: 3.0 },
        { fecha: '2026-04-30', valor: 2.4 }, { fecha: '2026-05-31', valor: 2.2 }, { fecha: '2026-06-30', valor: 1.9 },
        { fecha: '2026-07-31', valor: 2.1 }, { fecha: '2026-08-31', valor: 1.7 }, { fecha: '2026-09-30', valor: 1.9 },
      ],
      esperada12m: { valor: 21.1, fecha: '2026-09-30', fuente: 'REM, BCRA' },
      uva30d: { valor: 1.84, fecha: '2026-10-21', fuente: 'UVA, BCRA' },
      interanual: 33.3,
      control: [
        { fecha: '2026-06-01', valor: 1.89 }, { fecha: '2026-07-01', valor: 2.11 }, { fecha: '2026-08-01', valor: 1.66 },
      ],
    },
    tasas: {
      tamar: { valor: 24.0, fecha: '2026-10-19', fuente: 'BCRA' },
      badlar: { valor: 22.06, fecha: '2026-10-19', fuente: 'BCRA' },
    },
    plazoFijo: {
      valor: [
        { entidad: 'BANCO DE LA NACION ARGENTINA', tnaClientes: 0.1925, tasas: [{ plazoMinDias: 30, plazoMaxDias: 30, tna: 0.1925 }, { plazoMinDias: 60, plazoMaxDias: 60, tna: 0.2 }, { plazoMinDias: 90, plazoMaxDias: 90, tna: 0.2025 }] },
        { entidad: 'BANCO DE GALICIA Y BUENOS AIRES S.A.', tnaClientes: 0.1825, tasas: [] },
        { entidad: 'BANCO BBVA ARGENTINA S.A.', tnaClientes: 0.19, tasas: [] },
        { entidad: 'BANCO MERIDIAN S.A.', tnaClientes: 0.2375, tasas: [] },
        { entidad: 'REBA COMPAÑIA FINANCIERA S.A.', tnaClientes: 0.24, tasas: [] },
      ],
      fecha: '2026-10-21', fuente: 'BCRA',
    },
    cuentas: {
      valor: [
        { id: 'UALA', tna: 0.19, tea: 0.2092, tope: 1_000_000, condiciones: 'Si tenés entre $10.000 y $1.000.000 en tu cuenta rinden 19% TNA sin hacer nada.', fecha: '2026-10-21' },
        { id: 'UALA PLUS 1', tna: 0.2, tea: 0.2213, tope: 1_000_000, condiciones: 'Si acumulás $50.000 en ciertas operaciones este mes, tu tasa sube hasta 20% TNA.', fecha: '2026-10-21' },
        { id: 'UALA PLUS 2', tna: 0.24, tea: 0.2711, tope: 1_000_000, condiciones: 'Si sumás $500.000 sube hasta 24% TNA.', fecha: '2026-10-21' },
        { id: 'NARANJA X', tna: 0.2, tea: 0.2213, tope: 1_000_000, condiciones: '', fecha: '2026-10-21' },
      ],
      fecha: '2026-10-21', fuente: 'tasas publicadas',
    },
    fondos: {
      valor: [
        { id: 'Mercado Fondo - Clase A', fecha: '2026-10-20', vcp: 26085.036, tna1: 0.189, tna7: null, tna30: null },
        { id: 'Cocos Ahorro - Clase A', fecha: '2026-10-20', vcp: 2428.729, tna1: 0.183, tna7: null, tna30: null },
        { id: 'Balanz Capital Money Market - Clase A', fecha: '2026-10-20', vcp: 12707.54, tna1: 0.19, tna7: null, tna30: null },
      ],
      fecha: '2026-10-20', fuente: 'CAFCI',
    },
    letras: null,
    plazoFijoUva: {
      valor: [{ entidad: 'Banco de la Nación Argentina', tasas: [{ plazoMinDias: 90, plazoMaxDias: 119, tna: 0.0225 }, { plazoMinDias: 120, plazoMaxDias: 179, tna: 0.025 }] }],
      fecha: '2026-10-21', fuente: 'plazos fijos UVA',
    },
    bonosCer: {
      valor: [
        { ticker: 'TZXD6', precio: 312.75, tir: 0.0236, vencimiento: '2026-12-15', dias: 55, volumen: 346_000_000 },
        { ticker: 'X29E7', precio: 103.8, tir: 0.0186, vencimiento: '2027-01-29', dias: 99, volumen: 90_000_000 },
        { ticker: 'TZXM7', precio: 233.15, tir: 0.0224, vencimiento: '2027-03-31', dias: 161, volumen: 249_000_000 },
        { ticker: 'TZX28', precio: 364.4, tir: 0.0945, vencimiento: '2028-06-30', dias: 617, volumen: 111_000_000 },
        { ticker: 'TXMD9', precio: 88.15, tir: 0.07, vencimiento: '2029-12-14', dias: 1149, volumen: 311_000_000 },
        { ticker: 'TX31', precio: 1478.5, tir: 0.1116, vencimiento: '2031-12-01', dias: 1866, volumen: 45_000_000 },
      ],
      fecha: '2026-10-21', fuente: 'bonos CER',
    },
    cedears: {
      valor: [
        { simbolo: 'SPY', precio: 21000, variacionDia: -0.4 },
        { simbolo: 'AAPL', precio: 28280, variacionDia: 1.2 },
        { simbolo: 'QQQ', precio: 58700, variacionDia: 0.8 },
      ],
      fecha: '2026-10-21', fuente: 'BYMA',
    },
    dolar: {
      oficial: { valor: 1545, fecha: '2026-10-21', fuente: 'DolarAPI' },
      mep: { valor: 1548, fecha: '2026-10-21', fuente: 'DolarAPI' },
      ccl: { valor: 1634, fecha: '2026-10-21', fuente: 'DolarAPI' },
      blue: { valor: 1565, fecha: '2026-10-21', fuente: 'DolarAPI' },
      brechaMep: 0.2, mep30d: 1.1,
    },
    riesgoPais: { valor: 672, fecha: '2026-10-20', fuente: 'ArgentinaDatos' },
    spy: { valor: { precioUsd: 762, anualizado10a: 15.0, peorAnio: -18.2 }, fecha: '2026-10-21', fuente: 'Yahoo' },
    ipc: null,
    declaradas: {},
    alertas: [],
    fallas: [],
  };
  return { ...base, ...cambios };
}
