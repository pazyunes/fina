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

// El glosario común. Cada inversión toma de acá las palabras que usa, así una
// palabra técnica se explica siempre igual. Además, en los textos cada palabra
// técnica lleva su aclaración entre paréntesis la primera vez que aparece.
const G: Record<string, Termino> = {
  tna: { termino: 'TNA', significado: 'Tasa nominal anual: cuánto rinde en un año. Para saber lo que rinde por mes, dividila por 12: una TNA de 20% es cerca de 1,6% por mes.' },
  inflacion: { termino: 'Inflación', significado: 'Cuánto suben los precios. Si tu plata rinde menos que la inflación, con el tiempo podés comprar menos aunque tengas más pesos.' },
  tope: { termino: 'Tope', significado: 'Hasta qué saldo te pagan esa tasa. Lo que pasa de ese monto rinde menos o nada.' },
  broker: { termino: 'Broker', significado: 'Una app o empresa autorizada donde comprás y vendés inversiones (por ejemplo Cocos o Balanz). Lo que comprás queda a tu nombre.' },
  comitente: { termino: 'Cuenta comitente', significado: 'La cuenta que tenés en el broker, a tu nombre, donde se guardan tus inversiones.' },
  fci: { termino: 'Fondo común de inversión (FCI)', significado: 'Una “bolsa” de plata de muchas personas que maneja un profesional para invertirla.' },
  cuotaparte: { termino: 'Cuotaparte', significado: 'Cada pedacito de un fondo. Cuando su valor sube, ganás.' },
  moneyMarket: { termino: 'Money market', significado: 'Un fondo que presta a muy corto plazo. Es el más estable y el que más rápido se puede sacar.' },
  rescate: { termino: 'Rescate', significado: 'Pedir que te devuelvan tu plata: se venden tus cuotapartes y el dinero llega a tu cuenta.' },
  custodio: { termino: 'Custodio', significado: 'El banco que guarda lo que compró el fondo, separado de la empresa que lo administra.' },
  cnv: { termino: 'CNV', significado: 'Comisión Nacional de Valores: el organismo del Estado que controla las inversiones.' },
  segDepositos: { termino: 'Seguro de depósitos', significado: 'Si un banco quiebra, el Estado te devuelve tu plata hasta un tope. Cubre plazos fijos y cuentas de bancos.' },
  vencimiento: { termino: 'Vencimiento', significado: 'El día en que termina el plazo y el banco te devuelve la plata.' },
  precancelable: { termino: 'Precancelable', significado: 'Se puede retirar antes del vencimiento, pero cobrando menos interés.' },
  uva: { termino: 'UVA', significado: 'Un número que sube con la inflación. Si la UVA sube 2%, tu plata sube 2%.' },
  mep: { termino: 'Dólar MEP', significado: 'La forma legal de comprar dólares desde un broker, sin pasar por el cupo del banco. Su precio es distinto al del dólar oficial.' },
  brecha: { termino: 'Brecha', significado: 'Cuánto más caro está el dólar MEP que el oficial.' },
  cedear: { termino: 'CEDEAR', significado: 'Un papel en pesos que representa un pedacito de una empresa del exterior (como Apple). Se compra desde un broker.' },
  etf: { termino: 'ETF', significado: 'Un “paquete” que reúne muchas empresas en una sola compra. Por ejemplo, SPY reúne a las 500 más grandes de EE.UU.' },
  ticker: { termino: 'Ticker', significado: 'El código corto de cada inversión, como un apodo. Por ejemplo, SPY es el de las 500 empresas más grandes de EE.UU.' },
  accion: { termino: 'Acción', significado: 'Un pedacito de una empresa. Si a la empresa le va bien, tu pedacito vale más.' },
  diversificar: { termino: 'Diversificar', significado: 'No poner toda la plata en el mismo lugar: si uno cae, no caés vos.' },
  volatilidad: { termino: 'Volatilidad', significado: 'Cuánto sube y baja el precio. Más vaivén, más riesgo.' },
  letra: { termino: 'Letra del Tesoro', significado: 'Un préstamo que le hacés al Estado por unos meses: pagás hoy y en una fecha fija te devuelve más.' },
  habil: { termino: 'Día hábil', significado: 'Un día de semana que no es feriado.' },
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
    queEs: 'Una cuenta de tu billetera virtual (la app donde tenés tu plata, como Ualá o Mercado Pago) en la que el saldo que dejás quieto genera intereses todos los días. La seguís usando como siempre.',
    dondeQuedaTuPlata: 'La billetera presta tu plata por períodos muy cortos (a bancos y al Estado) y te paga una parte de lo que gana. En varias, detrás hay un fondo común de inversión de dinero (un fondo que junta la plata de muchas personas y la presta a muy corto plazo).',
    riesgoTexto: 'Casi no se mueve: lo que cambia es el interés (la tasa) que te pagan.',
    cuandoLaSacas: 'Cuando quieras, en el momento.',
    garantia: 'Depende de la billetera. Si queda en un fondo de inversión, no tiene el seguro de depósitos (la protección que tienen las cuentas de los bancos).',
    glosario: [G.tna, G.tope, G.inflacion, G.segDepositos],
  },

  fci: {
    id: 'fci',
    nombre: 'Fondo común de inversión',
    resumen: 'Una bolsa de plata de muchas personas que maneja un profesional. Se puede empezar con poco.',
    rol: 'caja',
    riesgo: 'Bajo',
    horizonteMinimoMeses: 0,
    plazoMinimoDias: null,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs: 'Una “bolsa” de plata de muchas personas (un fondo común de inversión, o FCI) que maneja un profesional. Vos tenés cuotapartes (pedacitos de esa bolsa). Acá hablamos del más conservador, el “money market” (un fondo que presta a muy corto plazo). Se compra desde un broker (una app o empresa donde comprás inversiones).',
    dondeQuedaTuPlata: 'El fondo presta a muy corto plazo (a bancos y al Estado) y cada día sube un poquito el valor de tu cuotaparte. Lo que compró el fondo lo guarda un banco aparte (el custodio), no la empresa que lo administra.',
    riesgoTexto: 'Casi no baja. Si un fondo promete mucho más que el resto, preguntá qué riesgo toma.',
    cuandoLaSacas: 'Entre el mismo día y 2 días hábiles (días de semana sin feriados), según el fondo.',
    garantia: 'No tiene seguro de depósitos (la protección de las cuentas de los bancos), pero lo controla la CNV (el organismo del Estado que regula las inversiones) y la plata del fondo está separada de la de la empresa que lo administra.',
    glosario: [G.broker, G.fci, G.cuotaparte, G.moneyMarket, G.rescate, G.custodio, G.cnv, G.tna],
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
    riesgoTexto: 'Cobrás lo pactado. El riesgo es que la inflación (lo que suben los precios) sea mayor que tu interés y con esa plata compres menos.',
    cuandoLaSacas: 'Al vencimiento (el día en que termina el plazo). Antes, solo si es precancelable (se puede retirar antes) y con menos interés.',
    garantia: 'Sí: los depósitos en bancos tienen seguro de depósitos (si el banco quiebra, el Estado te devuelve la plata hasta un tope, o sea un monto máximo, por persona y por banco).',
    glosario: [G.tna, G.vencimiento, G.precancelable, G.inflacion, G.segDepositos],
  },

  plazo_fijo_uva: {
    id: 'plazo_fijo_uva',
    nombre: 'Plazo fijo UVA',
    resumen: 'Un plazo fijo que se actualiza con la inflación (lo que suben los precios), para no perder poder de compra.',
    rol: 'ahorro',
    riesgo: 'Bajo',
    horizonteMinimoMeses: 3,
    plazoMinimoDias: 90,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs: 'Un plazo fijo donde tu plata se actualiza con la inflación (lo que suben los precios) a través de la UVA (un número del BCRA que sube cuando suben los precios), más un interés chico. Protege lo que ahorraste; no está pensado para ganarle por mucho a la inflación.',
    dondeQuedaTuPlata: 'En el banco, durante todo el plazo. El mínimo es de 90 días.',
    riesgoTexto: 'Si la inflación (lo que suben los precios) sube, cobrás más pesos; si baja, cobrás menos. Siempre cobrás en pesos.',
    cuandoLaSacas: 'Al vencimiento (el día en que termina el plazo), como mínimo a los 90 días.',
    garantia: 'Sí: es un depósito en un banco, con seguro de depósitos (el Estado te devuelve la plata hasta un tope, o sea un monto máximo, si el banco quiebra).',
    glosario: [G.uva, G.vencimiento, G.inflacion, G.segDepositos],
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
    queEs: 'Un préstamo que le hacés al Estado por unos meses. Pagás hoy un precio y en una fecha fija te devuelve un monto mayor. Se compra desde un broker (una app o empresa donde comprás inversiones).',
    dondeQuedaTuPlata: 'En el Tesoro Nacional. Lo que comprás queda a tu nombre en tu cuenta del broker (la plataforma donde lo comprás).',
    riesgoTexto: 'Si esperás hasta el vencimiento cobrás lo que figuraba; si vendés antes, el precio puede ser menor.',
    cuandoLaSacas: 'Al vencimiento, o antes vendiéndola (se acredita en 1 o 2 días hábiles).',
    garantia: 'No tiene seguro de depósitos: el respaldo es el compromiso de pago del Estado.',
    glosario: [G.broker, G.letra, G.vencimiento, G.tna],
  },

  dolar: {
    id: 'dolar',
    nombre: 'Dólar MEP',
    resumen: 'Comprar dólares legalmente, para cuidar tus ahorros de una suba del dólar.',
    rol: 'ahorro',
    riesgo: 'Medio',
    horizonteMinimoMeses: 3,
    plazoMinimoDias: null,
    perfiles: ['moderado', 'arriesgado'],
    queEs: 'Comprar dólares de forma legal desde un broker (una app o empresa donde comprás inversiones) para cuidar tus ahorros si el dólar sube. Se llama dólar MEP (es el nombre de esta forma de comprarlos).',
    dondeQuedaTuPlata: 'Los dólares quedan a tu nombre en tu cuenta del broker (la plataforma donde los compraste). Los podés pasar a una cuenta en dólares de tu banco.',
    riesgoTexto: 'No genera intereses y lo que valen en pesos sube o baja con el dólar. Sirve para cuidar tus ahorros, no para que crezcan.',
    cuandoLaSacas: 'Cuando quieras: vendés los dólares y los pesos llegan en 1 o 2 días hábiles (días de semana sin feriados).',
    garantia: 'Ninguna sobre su valor: el dólar puede subir o bajar.',
    glosario: [G.broker, G.mep, G.brecha, G.habil],
  },

  cedear: {
    id: 'cedear',
    nombre: 'CEDEARs',
    resumen: 'Pedacitos de empresas grandes del exterior. Para dejar varios años, no para retirar ya.',
    rol: 'crecimiento',
    riesgo: 'Alto',
    horizonteMinimoMeses: 36,
    plazoMinimoDias: null,
    perfiles: ['arriesgado'],
    queEs: 'Un CEDEAR es un papel en pesos que representa un pedacito de una empresa del exterior (como Apple). Se compra desde un broker (una app o empresa donde comprás inversiones). Un ETF como SPY (un “paquete” que reúne a las 500 empresas más grandes de EE.UU.) te evita elegir una sola. Este tipo de inversión se suele dejar a largo plazo, por varios años: así es como puede crecer. No es para retirar pronto.',
    dondeQuedaTuPlata: 'Está respaldado por acciones reales (pedacitos de empresas) que guarda un banco en el exterior. Queda a tu nombre en tu cuenta del broker (la “cuenta comitente”).',
    riesgoTexto: 'Sube y baja todos los días y puede haber años de pérdida. Por eso es para plata que no vas a necesitar en 3 años o más.',
    cuandoLaSacas: 'Cuando quieras, pero solo cuando el mercado está abierto (de lunes a viernes, más o menos de 11 a 17 hs). La plata llega en 1 o 2 días hábiles (de lunes a viernes, sin feriados). Si vendés cuando el precio está bajo, perdés.',
    garantia: 'Ninguna.',
    glosario: [G.broker, G.cedear, G.etf, G.ticker, G.accion, G.comitente, G.diversificar, G.volatilidad],
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
    paraEmpezar: 'Una cuenta de inversión con tu DNI, una selfie y un breve test de perfil de inversor (unas preguntas para saber cuánto riesgo aceptás).',
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
    paraEmpezar: 'Una cuenta de inversión con tu DNI, una selfie y un breve test de perfil de inversor (unas preguntas para saber cuánto riesgo aceptás).',
  },
  banco: {
    id: 'banco',
    nombre: 'Tu banco',
    tipo: 'banco',
    productos: { plazo_fijo: { tipo: 'plazo' }, plazo_fijo_uva: { tipo: 'plazo' } },
    paraEmpezar: 'Tener cuenta en un banco y poder entrar a su app o a su web.',
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
