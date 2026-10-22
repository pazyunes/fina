// El catálogo de inversiones de FINA: qué productos hay, dónde se pueden hacer y
// cómo se explican. Es la ÚNICA lista: las recomendaciones, el detalle, el paso
// a paso y el registro leen de acá.
//
// Cada explicación responde las preguntas que de verdad frenan a alguien que
// nunca invirtió, en este orden:
//   · ¿Qué es?
//   · ¿DÓNDE queda mi plata? (la que más se omite, y la más importante)
//   · ¿Qué le puede pasar?
//   · ¿Cuándo la puedo sacar?
//   · ¿Alguien me la garantiza?
// "Un equipo profesional invierte por vos" no responde ninguna: acá cada una
// tiene su propio párrafo.

export type ProductoId =
  | 'cuenta_remunerada'
  | 'fci'
  | 'plazo_fijo'
  | 'plazo_fijo_uva'
  | 'letra'
  | 'dolar'
  | 'cedear';

export type ProveedorId = 'mercado_pago' | 'uala' | 'naranja_x' | 'cocos' | 'balanz' | 'banco';
export type PerfilRiesgo = 'conservador' | 'moderado' | 'arriesgado';
export type Riesgo = 'Bajo' | 'Medio' | 'Alto';

/**
 * Para qué sirve en la vida de la persona:
 *  · caja: plata que necesitás tener a mano (fondo de emergencia, gastos de los próximos meses)
 *  · ahorro: plata que no vas a usar ya y querés que no pierda valor
 *  · crecimiento: plata para varios años, que aguanta altibajos
 */
export type Rol = 'caja' | 'ahorro' | 'crecimiento';

export type Termino = { termino: string; significado: string };

/**
 * La ficha de cada inversión. Es contenido FIJO y corto, siempre en el mismo
 * orden: qué es, cuánto rinde (eso sí se calcula con datos de hoy, ver
 * `describirRinde`), dónde queda tu plata, riesgo, cuándo la sacás, si alguien
 * la garantiza, y un glosario al final.
 */
export type Producto = {
  id: ProductoId;
  nombre: string;
  /** Una línea, para la lista. */
  resumen: string;
  rol: Rol;
  riesgo: Riesgo;
  /** Cuántos meses mínimo tiene sentido dejarla (para no sugerirla a quien la necesita antes). */
  horizonteMinimoMeses: number;
  /** Plazo mínimo que impone el producto mismo, en días. null = no hay. */
  plazoMinimoDias: number | null;
  perfiles: PerfilRiesgo[];
  queEs: string;
  dondeQuedaTuPlata: string;
  /** Una línea: cuánto se mueve y por qué. */
  riesgoTexto: string;
  cuandoLaSacas: string;
  garantia: string;
  glosario: Termino[];
};

const TNA: Termino = {
  termino: 'TNA',
  significado: 'Tasa nominal anual: cuánto rinde en un año. Para saber lo que rinde por mes, dividila por 12: una TNA de 20% es cerca de 1,6% por mes.',
};

export const PRODUCTOS: Record<ProductoId, Producto> = {
  cuenta_remunerada: {
    id: 'cuenta_remunerada',
    nombre: 'Cuenta remunerada',
    resumen: 'La plata que dejás quieta en tu billetera genera intereses todos los días.',
    rol: 'caja',
    riesgo: 'Bajo',
    horizonteMinimoMeses: 0,
    plazoMinimoDias: null,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs: 'Una cuenta de tu billetera donde la plata que dejás quieta genera intereses todos los días. La seguís usando como siempre.',
    dondeQuedaTuPlata: 'La billetera la presta a muy corto plazo (a bancos y al Estado) y te paga una parte. En varias, detrás hay un fondo de inversión de dinero.',
    riesgoTexto: 'Casi no se mueve: lo que cambia es la tasa que te pagan.',
    cuandoLaSacas: 'Cuando quieras, en el momento.',
    garantia: 'Depende de la billetera. Si queda en un fondo de inversión, no tiene el seguro de depósitos de los bancos.',
    glosario: [
      TNA,
      { termino: 'Tope', significado: 'Hasta qué saldo te pagan esa tasa. Lo que pasa de ese monto rinde menos o nada.' },
    ],
  },

  fci: {
    id: 'fci',
    nombre: 'Fondo común de inversión',
    resumen: 'Una bolsa de plata de muchas personas que maneja un profesional. Podés empezar con $1.000.',
    rol: 'caja',
    riesgo: 'Bajo',
    horizonteMinimoMeses: 0,
    plazoMinimoDias: null,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs: 'Una “bolsa” de plata de muchas personas que maneja un profesional (la sociedad gerente). Vos tenés cuotapartes: pedacitos de esa bolsa. Acá hablamos del más conservador, el “money market”.',
    dondeQuedaTuPlata: 'El fondo presta a muy corto plazo (bancos y Estado) y cada día sube un poquito el valor de tu cuotaparte. Los activos los guarda un banco aparte, el custodio, no la gerente.',
    riesgoTexto: 'Casi no baja. Si un fondo promete mucho más que el resto, preguntá qué riesgo toma.',
    cuandoLaSacas: 'Entre el mismo día y 2 días hábiles, según el fondo.',
    garantia: 'No tiene seguro de depósitos, pero está regulado por la CNV y la plata del fondo está separada de la de la gerente.',
    glosario: [
      { termino: 'Cuotaparte', significado: 'Cada pedacito del fondo. Cuando su valor sube, ganás.' },
      { termino: 'Money market', significado: 'Fondo que presta a muy corto plazo. Es el más estable y el más líquido.' },
      { termino: 'Rescate', significado: 'Pedir que te devuelvan tu plata: se venden tus cuotapartes y llega a tu cuenta.' },
      TNA,
    ],
  },

  plazo_fijo: {
    id: 'plazo_fijo',
    nombre: 'Plazo fijo',
    resumen: 'Le prestás plata al banco por un tiempo y sabés de antemano cuánto te devuelve.',
    rol: 'ahorro',
    riesgo: 'Bajo',
    horizonteMinimoMeses: 1,
    plazoMinimoDias: 30,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs: 'Le prestás plata al banco por un tiempo (30, 60, 90 días…) y sabés desde el primer día cuánto te devuelve.',
    dondeQuedaTuPlata: 'En el banco. Mientras dura el plazo no la podés usar.',
    riesgoTexto: 'Cobrás lo pactado. El riesgo es que la inflación sea mayor y con esa plata compres menos.',
    cuandoLaSacas: 'Al vencimiento. Antes, solo si es precancelable y con menos interés.',
    garantia: 'Sí: los depósitos en bancos tienen seguro de depósitos hasta un tope por persona y por banco.',
    glosario: [
      TNA,
      { termino: 'Vencimiento', significado: 'El día en que el banco te devuelve la plata más el interés.' },
      { termino: 'Precancelable', significado: 'Se puede retirar antes, cobrando una tasa menor.' },
    ],
  },

  plazo_fijo_uva: {
    id: 'plazo_fijo_uva',
    nombre: 'Plazo fijo UVA',
    resumen: 'Un plazo fijo que se actualiza con la inflación, para no perder poder de compra.',
    rol: 'ahorro',
    riesgo: 'Bajo',
    horizonteMinimoMeses: 3,
    plazoMinimoDias: 90,
    perfiles: ['conservador', 'moderado'],
    queEs: 'Un plazo fijo donde tu plata se actualiza con la inflación (la UVA), más un interés chico. Protege lo que ahorraste; no está pensado para ganarle por mucho a la inflación.',
    dondeQuedaTuPlata: 'En el banco, durante todo el plazo. Mínimo 90 días.',
    riesgoTexto: 'Si la inflación sube, cobrás más pesos; si baja, cobrás menos. Siempre cobrás en pesos.',
    cuandoLaSacas: 'Al vencimiento, como mínimo a los 90 días.',
    garantia: 'Sí: es un depósito en un banco, con seguro de depósitos hasta el tope vigente.',
    glosario: [
      { termino: 'UVA', significado: 'Un índice del BCRA que sigue a la inflación. Si la UVA sube 2%, tu plata sube 2%.' },
      { termino: 'Vencimiento', significado: 'El día en que el banco te devuelve la plata ajustada más el interés.' },
    ],
  },

  letra: {
    id: 'letra',
    nombre: 'Letras del Tesoro',
    resumen: 'Un préstamo al Estado por unos meses, con un monto fijo a cobrar en una fecha.',
    rol: 'ahorro',
    riesgo: 'Medio',
    horizonteMinimoMeses: 1,
    plazoMinimoDias: null,
    perfiles: ['moderado', 'arriesgado'],
    queEs: 'Un préstamo que le hacés al Estado por unos meses. Pagás hoy un precio y en una fecha fija te devuelve un monto mayor.',
    dondeQuedaTuPlata: 'En el Tesoro Nacional. Lo que comprás queda a tu nombre en tu cuenta del broker.',
    riesgoTexto: 'Si esperás al vencimiento cobrás lo que figuraba; si vendés antes, el precio puede ser menor.',
    cuandoLaSacas: 'Al vencimiento, o antes vendiéndola (se acredita en 1 o 2 días hábiles).',
    garantia: 'No tiene seguro de depósitos: el respaldo es el compromiso de pago del Estado.',
    glosario: [
      { termino: 'Vencimiento', significado: 'La fecha en que el Estado te devuelve la plata.' },
      TNA,
    ],
  },

  dolar: {
    id: 'dolar',
    nombre: 'Dólar MEP',
    resumen: 'Comprar dólares legalmente desde un broker, para cuidar tus ahorros de una suba del dólar.',
    rol: 'ahorro',
    riesgo: 'Medio',
    horizonteMinimoMeses: 3,
    plazoMinimoDias: null,
    perfiles: ['moderado', 'arriesgado'],
    queEs: 'Comprar dólares de forma legal desde un broker (se llama dólar MEP), para cuidar tus ahorros si el dólar sube.',
    dondeQuedaTuPlata: 'Los dólares quedan a tu nombre en tu cuenta del broker. Los podés pasar a una cuenta en dólares de tu banco.',
    riesgoTexto: 'No genera intereses y lo que valen en pesos sube o baja con el dólar.',
    cuandoLaSacas: 'Cuando quieras: vendés y los pesos llegan en 1 o 2 días hábiles.',
    garantia: 'Ninguna sobre su valor: el dólar puede subir o bajar.',
    glosario: [
      { termino: 'MEP', significado: 'La forma legal de comprar dólares con un bono, sin pasar por el cupo del banco.' },
      { termino: 'Brecha', significado: 'Cuánto más caro está el MEP que el dólar oficial.' },
    ],
  },

  cedear: {
    id: 'cedear',
    nombre: 'CEDEARs',
    resumen: 'Pedacitos de empresas grandes del exterior, comprados en pesos. Para largo plazo.',
    rol: 'crecimiento',
    riesgo: 'Alto',
    horizonteMinimoMeses: 36,
    plazoMinimoDias: null,
    perfiles: ['arriesgado'],
    queEs: 'Un pedacito de una empresa grande del exterior (como Apple), comprado en pesos. Un ETF como SPY reúne a las 500 más grandes de EE.UU. y te evita elegir una sola.',
    dondeQuedaTuPlata: 'Está respaldado por acciones reales que guarda un banco en el exterior. Queda a tu nombre en tu cuenta del broker.',
    riesgoTexto: 'Sube y baja todos los días y puede haber años de pérdida. Es para plata que no vas a necesitar en 3 años o más.',
    cuandoLaSacas: 'Cuando quieras en horario de mercado (1 o 2 días hábiles), pero si vendés cuando está bajo, perdés.',
    garantia: 'Ninguna.',
    glosario: [
      { termino: 'ETF', significado: 'Un “paquete” de muchas empresas en una sola compra.' },
      { termino: 'Diversificar', significado: 'No poner toda la plata en el mismo lugar: si uno cae, no caés vos.' },
      { termino: 'Volatilidad', significado: 'Cuánto sube y baja el precio. Más vaivén, más riesgo.' },
    ],
  },
};

// ── Proveedores ──────────────────────────────────────────────────────────
// Dónde se hace cada cosa. `datos` dice de qué serie de mercado sale el
// rendimiento de ese producto en ese proveedor.
export type FuenteDato =
  | { tipo: 'fondo'; id: string }
  | { tipo: 'cuenta'; id: string; extra?: string[] }
  | { tipo: 'plazo' }
  | { tipo: 'letras' }
  | { tipo: 'cedears' }
  | { tipo: 'dolar' };

export type Proveedor = {
  id: ProveedorId;
  nombre: string;
  tipo: 'billetera' | 'broker' | 'banco';
  productos: Partial<Record<ProductoId, FuenteDato>>;
  /** Qué te piden para empezar, en una línea. */
  paraEmpezar: string;
};

export const PROVEEDORES: Record<ProveedorId, Proveedor> = {
  mercado_pago: {
    id: 'mercado_pago',
    nombre: 'Mercado Pago',
    tipo: 'billetera',
    productos: { cuenta_remunerada: { tipo: 'fondo', id: 'Mercado Fondo - Clase A' } },
    paraEmpezar: 'Una cuenta con tu DNI y una selfie, y plata para ingresar.',
  },
  naranja_x: {
    id: 'naranja_x',
    nombre: 'Naranja X',
    tipo: 'billetera',
    productos: { cuenta_remunerada: { tipo: 'cuenta', id: 'NARANJA X' } },
    paraEmpezar: 'Una cuenta con tu DNI y una selfie, y plata para ingresar.',
  },
  uala: {
    id: 'uala',
    nombre: 'Ualá',
    tipo: 'billetera',
    productos: { cuenta_remunerada: { tipo: 'cuenta', id: 'UALA', extra: ['UALA PLUS 1', 'UALA PLUS 2'] } },
    paraEmpezar: 'Una cuenta con tu DNI y una selfie, y plata para ingresar.',
  },
  cocos: {
    id: 'cocos',
    nombre: 'Cocos Capital',
    tipo: 'broker',
    productos: {
      fci: { tipo: 'fondo', id: 'Cocos Ahorro - Clase A' },
      letra: { tipo: 'letras' },
      dolar: { tipo: 'dolar' },
      cedear: { tipo: 'cedears' },
    },
    paraEmpezar: 'Una cuenta de inversión con tu DNI, una selfie y un breve test de perfil de inversor.',
  },
  balanz: {
    id: 'balanz',
    nombre: 'Balanz',
    tipo: 'broker',
    productos: {
      fci: { tipo: 'fondo', id: 'Balanz Capital Money Market - Clase A' },
      letra: { tipo: 'letras' },
      dolar: { tipo: 'dolar' },
      cedear: { tipo: 'cedears' },
    },
    paraEmpezar: 'Una cuenta de inversión con tu DNI, una selfie y un breve test de perfil de inversor.',
  },
  banco: {
    id: 'banco',
    nombre: 'Tu banco',
    tipo: 'banco',
    productos: { plazo_fijo: { tipo: 'plazo' }, plazo_fijo_uva: { tipo: 'plazo' } },
    paraEmpezar: 'Tener cuenta en un banco y entrar a su home banking o app.',
  },
};

/**
 * Lo que se recomienda y se puede registrar, empezando por lo conocido. Las
 * letras del Tesoro siguen en el catálogo (el motor las sabe evaluar) pero no se
 * ofrecen: nadie las conoce, y para empezar alcanza con lo de abajo.
 */
export const ORDEN_PRODUCTOS: ProductoId[] = ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva', 'dolar', 'cedear'];

/** Los nombres con los que la persona dice que usa cada proveedor (campo "bancos" del perfil inversor). */
export const ALIAS_PROVEEDOR: Record<string, ProveedorId> = {
  'Mercado Pago': 'mercado_pago',
  'Naranja X': 'naranja_x',
  Ualá: 'uala',
  'Cocos Capital': 'cocos',
  Cocos: 'cocos',
  Balanz: 'balanz',
  'Banco tradicional': 'banco',
};

export function proveedoresDe(producto: ProductoId): Proveedor[] {
  return Object.values(PROVEEDORES).filter((p) => p.productos[producto]);
}

/** Productos con los que la persona ya dijo que invierte (campo "enQue" del perfil inversor). */
export const EN_QUE_A_PRODUCTO: Record<string, ProductoId[]> = {
  'Plazo fijo': ['plazo_fijo', 'plazo_fijo_uva'],
  'Fondo común (FCI)': ['fci'],
  Dólar: ['dolar'],
  'CEDEARs / acciones': ['cedear'],
};

export function nombreProducto(id: string): string {
  return (PRODUCTOS as Record<string, Producto | undefined>)[id]?.nombre ?? 'Otra inversión';
}
