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
  | 'bono_cer'
  | 'dolar'
  | 'cedear';

export type ProveedorId = 'mercado_pago' | 'uala' | 'naranja_x' | 'otra_cuenta' | 'cocos' | 'balanz' | 'iol' | 'galicia_securities' | 'ppi' | 'ieb' | 'banco';

/** Los brokers (plataformas donde se compran fondos, CEDEARs, letras y dólares). */
export type BrokerId = 'cocos' | 'balanz' | 'iol' | 'galicia_securities' | 'ppi' | 'ieb';
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
  /** ¿Puede bajar la plata que pusiste? Una respuesta corta y sincera. */
  puedeBajar: string;
  /** Lo que hay que saber antes de invertir en esto, en puntos cortos. */
  antesDeInvertir: string[];
  /** Cuándo conviene vender, cuándo no y por qué (sólo en lo que se puede vender antes). */
  cuandoVender?: { si: string; no: string; porque: string };
  /** Sólo las palabras difíciles: la inversión misma se explica en "¿Qué es?", no acá. */
  glosario: Termino[];
};

/**
 * Hasta cuánto garantiza el seguro de depósitos, por persona y por banco, en pesos. Lo fija el BCRA y se
 * actualiza de a poco: hoy es el de la Comunicación "A" 8407 (05/03/2026), vigente desde el 01/04/2026.
 * Si cambia, se cambia acá y se actualizan todos los textos.
 */
export const TOPE_SEGURO_DEPOSITOS = 50_000_000;
const TOPE_TEXTO = `$${TOPE_SEGURO_DEPOSITOS.toLocaleString('es-AR')}`;

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
  segDepositos: { termino: 'Seguro de depósitos', significado: `Si un banco quiebra, te devuelven tu plata hasta un tope: hoy ${TOPE_TEXTO} por persona y por banco (lo fija el BCRA). Cubre plazos fijos y cuentas de bancos.` },
  vencimiento: { termino: 'Vencimiento', significado: 'El día en que termina el plazo y te devuelven la plata.' },
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
  cer: { termino: 'CER', significado: 'Un índice que sigue a la inflación. Un bono “CER” te paga la inflación más un extra.' },
  bono: { termino: 'Bono', significado: 'Un préstamo que le hacés al Estado por un tiempo más largo que una letra. Te devuelve el capital ajustado más un extra, y su precio sube y baja hasta el vencimiento.' },
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
    queEs: 'Una cuenta de tu billetera o banco donde el saldo que dejás quieto genera intereses todos los días. La seguís usando como siempre.',
    dondeQuedaTuPlata: 'La billetera o el banco presta tu plata por períodos muy cortos y te paga una parte de lo que gana. En varias, detrás hay un fondo de dinero.',
    riesgoTexto: 'Casi no se mueve: lo que cambia es la tasa que te pagan, y puede cambiar cualquier día.',
    cuandoLaSacas: 'Cuando quieras, en el momento.',
    garantia: 'Depende: en un banco, el seguro de depósitos; en una billetera con fondo de inversión, no.',
    puedeBajar: 'No: lo que tenés en pesos no baja, sólo suma intereses. Cambia la tasa que te pagan, y tu saldo, que sube y baja con lo que cobrás y pagás.',
    antesDeInvertir: [
      'La tasa puede cambiar de un día para el otro.',
      'Casi todas tienen un tope: lo que pasa de cierto saldo rinde menos o nada.',
      'Algunas piden condiciones para pagar la tasa más alta.',
    ],
    glosario: [G.tna, G.tope, G.segDepositos],
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
    queEs: 'Una bolsa de plata de muchas personas que maneja un profesional. Vos tenés cuotapartes, pedacitos de esa bolsa. Acá hablamos del money market, el más conservador. Se compra desde un broker.',
    dondeQuedaTuPlata: 'El fondo presta a muy corto plazo y cada día sube un poquito el valor de tu cuotaparte. Lo que compró el fondo lo guarda un banco aparte.',
    riesgoTexto: 'Casi no baja. Si un fondo promete mucho más que el resto, preguntá qué riesgo toma.',
    cuandoLaSacas: 'Entre el mismo día y 2 días hábiles, según el fondo.',
    garantia: 'No tiene seguro de depósitos, pero lo controla la CNV y la plata del fondo está separada de la de la empresa que lo administra.',
    puedeBajar: 'El money market casi nunca baja: cada día suma un poquito. Ojo: hay fondos de renta fija (bonos) y de renta variable (acciones) que sí pueden bajar, y mucho.',
    antesDeInvertir: [
      'Fijate el plazo de rescate: cuánto tarda en volver tu plata.',
      'La clase del fondo (A, B…) cambia las comisiones, no lo que rinde.',
      'El valor de la cuotaparte sube casi todos los días, pero no está garantizado.',
    ],
    glosario: [G.broker, G.cuotaparte, G.moneyMarket, G.rescate, G.cnv, G.habil],
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
    riesgoTexto: 'Cobrás lo pactado. El riesgo es que la inflación sea mayor que tu interés y con esa plata compres menos.',
    cuandoLaSacas: 'Al vencimiento. Antes, solo si es precancelable y con menos interés.',
    garantia: `Sí: está garantizado por el BCRA a través del seguro de depósitos, hasta ${TOPE_TEXTO} por persona y por banco. Lo que pase de ahí no está cubierto.`,
    puedeBajar: 'No: cobrás lo pactado. El riesgo es que los precios suban más que tu interés, no que pierdas lo que pusiste.',
    antesDeInvertir: [
      'Tiene un vencimiento: hasta ese día no podés usar la plata.',
      'Si no se renueva solo, decidís de nuevo con la tasa del momento.',
      'Las tasas que ves son para clientes del banco.',
    ],
    glosario: [G.tna, G.vencimiento, G.precancelable, G.segDepositos],
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
    queEs: 'Un plazo fijo donde tu plata se actualiza con la inflación a través de la UVA, más un interés chico. Protege lo que ahorraste; no busca ganarle por mucho.',
    dondeQuedaTuPlata: 'En el banco, durante todo el plazo. El mínimo es de 90 días.',
    riesgoTexto: 'Si la inflación sube, cobrás más pesos; si baja, cobrás menos. Siempre cobrás en pesos.',
    cuandoLaSacas: 'Al vencimiento, como mínimo a los 90 días.',
    garantia: `Sí: es un depósito en un banco, garantizado por el BCRA a través del seguro de depósitos hasta ${TOPE_TEXTO} por persona y por banco. Cubre también lo que se actualiza por la UVA.`,
    puedeBajar: 'No: en pesos tu capital no baja, se actualiza con la inflación. Lo que no sabés de antemano es cuántos pesos vas a cobrar.',
    antesDeInvertir: [
      'Mínimo 90 días, y tiene vencimiento.',
      'No sabés cuántos pesos vas a cobrar hasta el final.',
      'Algunos bancos suman un extra sobre la inflación (“UVA + 2”: ese 2 es el extra) y a veces limitan este producto.',
    ],
    glosario: [G.uva, G.vencimiento, G.segDepositos],
  },

  letra: {
    id: 'letra',
    nombre: 'Letras del Tesoro',
    resumen: 'Un préstamo al Estado por unos meses, con un monto fijo a cobrar en una fecha. Se puede vender antes.',
    rol: 'ahorro',
    riesgo: 'Medio',
    horizonteMinimoMeses: 1,
    plazoMinimoDias: null,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs: 'Un préstamo que le hacés al Estado por unos meses. Pagás hoy un precio y en una fecha fija te devuelve un monto mayor. Se compra desde un broker.',
    dondeQuedaTuPlata: 'En el Tesoro Nacional. Queda a tu nombre en tu cuenta del broker.',
    riesgoTexto: 'Si esperás hasta el vencimiento cobrás lo que figuraba; si vendés antes, el precio puede ser menor.',
    cuandoLaSacas: 'Al vencimiento, o antes vendiéndola: se acredita en 1 o 2 días hábiles.',
    garantia: 'No tiene seguro de depósitos. Está garantizada por el Tesoro de la Nación: el respaldo es el compromiso de pago del Estado argentino.',
    puedeBajar: 'Si esperás al vencimiento, no: cobrás lo que figuraba al comprar. Si la vendés antes, el precio puede ser menor y ahí sí perdés.',
    antesDeInvertir: [
      'Tiene vencimiento: elegí uno que coincida con cuándo vas a usar la plata.',
      'Se puede vender antes, pero el precio puede ser menor.',
      'Mirá que se opere seguido: si no, cuesta venderla.',
    ],
    cuandoVender: {
      si: 'Al vencimiento (el Estado paga solo) o si necesitás la plata antes.',
      no: 'Si no la necesitás: vender antes suele dar menos de lo que cobrarías esperando.',
      porque: 'Tu ganancia está fijada para el vencimiento; antes de esa fecha el precio sube y baja.',
    },
    glosario: [G.broker, G.vencimiento, G.tna, G.habil],
  },

  bono_cer: {
    id: 'bono_cer',
    nombre: 'Bonos CER',
    resumen: 'Un préstamo al Estado a varios meses que sigue a la inflación más un extra. Se pueden vender antes.',
    rol: 'ahorro',
    riesgo: 'Medio',
    horizonteMinimoMeses: 3,
    plazoMinimoDias: null,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs: 'Un préstamo que le hacés al Estado por varios meses o años. Tu capital se ajusta con la inflación y encima te paga un extra. Se compra desde un broker.',
    dondeQuedaTuPlata: 'En el Tesoro Nacional. Queda a tu nombre en tu cuenta del broker.',
    riesgoTexto: 'Si esperás hasta el vencimiento, cobrás la inflación más el extra que figuraba al comprar. Si lo vendés antes, el precio puede ser menor.',
    cuandoLaSacas: 'Al vencimiento, o antes vendiéndolo: se acredita en 1 o 2 días hábiles. Algunos casi no se operan y cuesta venderlos.',
    garantia: 'No tiene seguro de depósitos. Lo respalda el Tesoro de la Nación: el compromiso de pago del Estado argentino.',
    puedeBajar: 'Sí, según el plazo: si lo vendés antes del vencimiento, el precio puede estar más bajo y perdés. Cuanto más largo el bono, más se mueve su precio.',
    antesDeInvertir: [
      'Tiene vencimiento: elegí uno que coincida con cuándo vas a usar la plata.',
      'Si lo vendés antes, el precio puede ser menor.',
      'Mirá cuánto se opera: si casi no se opera, cuesta venderlo.',
    ],
    cuandoVender: {
      si: 'Al vencimiento (el Estado paga solo) o si necesitás la plata antes.',
      no: 'Si no la necesitás: vender antes puede darte menos que esperar.',
      porque: 'La inflación y el extra se cobran completos al vencimiento; en el medio el precio sube y baja.',
    },
    glosario: [G.broker, G.cer, G.vencimiento, G.habil],
  },

  dolar: {
    id: 'dolar',
    nombre: 'Dólar MEP',
    resumen: 'Comprar dólares no es una inversión: no rinde. Sirve si vas a necesitar dólares.',
    rol: 'ahorro',
    riesgo: 'Medio',
    horizonteMinimoMeses: 3,
    plazoMinimoDias: null,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs: 'Comprar dólares no es una inversión: es tener dólares guardados. Sirve si necesitás dólares más adelante. Para plata de corto plazo suelen convenir los pesos, y para largo plazo, los dólares. Se compra desde un broker.',
    dondeQuedaTuPlata: 'Los dólares quedan a tu nombre en tu cuenta del broker. Los podés pasar a una cuenta en dólares de tu banco.',
    riesgoTexto: 'No genera intereses y lo que valen en pesos sube o baja con el dólar.',
    cuandoLaSacas: 'Cuando quieras: vendés los dólares y los pesos llegan en 1 o 2 días hábiles.',
    garantia: 'Ninguna sobre su valor: el dólar puede subir o bajar.',
    puedeBajar: 'Sí: lo que valen tus dólares en pesos sube y baja con el precio del dólar.',
    antesDeInvertir: [
      'No genera interés: sirve para guardar valor en dólares, no para que tu plata crezca.',
      'Su precio en pesos sube y baja.',
      'El dólar MEP cuesta distinto al oficial: esa diferencia es la brecha.',
    ],
    glosario: [G.broker, G.mep, G.brecha, G.habil],
  },

  cedear: {
    id: 'cedear',
    nombre: 'CEDEARs',
    resumen: 'Pedacitos de empresas grandes del exterior (también hay acciones argentinas).',
    rol: 'crecimiento',
    riesgo: 'Alto',
    horizonteMinimoMeses: 12,
    plazoMinimoDias: null,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs: 'Un papel en pesos que representa un pedacito de una empresa del exterior, como Apple. Se compra desde un broker. También hay CEDEARs de ETF, como SPY, que reúnen muchas empresas en una sola compra.',
    dondeQuedaTuPlata: 'Está respaldado por acciones reales que guarda un banco en el exterior. Queda a tu nombre en tu cuenta comitente.',
    riesgoTexto: 'Sube y baja todos los días y puede haber años de pérdida. Es para dejar varios años.',
    cuandoLaSacas: 'Cuando quieras, pero solo con el mercado abierto (de lunes a viernes, de 11 a 17 hs más o menos). La plata llega en 1 o 2 días hábiles.',
    garantia: 'Nadie te garantiza que su precio suba: puede bajar. Lo que comprás queda a tu nombre en tu cuenta comitente.',
    puedeBajar: 'Sí, y puede bajar bastante: hay años de pérdida. Por eso no conviene vender con miedo cuando cae.',
    antesDeInvertir: [
      'Se piensa a varios años: no es para plata que necesitás pronto.',
      'Sube y baja todos los días, y es normal.',
      'Pagás una comisión (un % de lo que operás) al comprar y al vender.',
    ],
    cuandoVender: {
      si: 'Cuando necesitás la plata, cuando llegaste a tu objetivo o cuando cambió lo que te hizo comprar (la empresa ya no es la misma).',
      no: 'Solo porque bajó, ni porque subió y querés “asegurar”.',
      porque: 'Vender con el precio bajo concreta la pérdida; con tiempo, el precio suele recuperarse. Y mover seguido suma comisiones.',
    },
    glosario: [G.broker, G.etf, G.ticker, G.accion, G.comitente, G.diversificar, G.volatilidad, G.habil],
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
  | { tipo: 'bonosCer' }
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

const PARA_EMPEZAR_BROKER = 'Una cuenta de inversión con tu DNI, una selfie y un breve test de perfil de inversor (unas preguntas para saber cuánto riesgo aceptás).';

/** Los brokers, en el orden en que se ofrecen. Los precios del mercado son los mismos en todos: cambian las comisiones. */
export const BROKERS: BrokerId[] = ['cocos', 'balanz', 'iol', 'galicia_securities', 'ppi', 'ieb'];

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
      bono_cer: { tipo: 'bonosCer' },
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
      bono_cer: { tipo: 'bonosCer' },
      dolar: { tipo: 'dolar' },
      cedear: { tipo: 'cedears' },
    },
    paraEmpezar: 'Una cuenta de inversión con tu DNI, una selfie y un breve test de perfil de inversor (unas preguntas para saber cuánto riesgo aceptás).',
  },
  iol: {
    id: 'iol',
    nombre: 'IOL (InvertirOnline)',
    tipo: 'broker',
    productos: { letra: { tipo: 'letras' }, bono_cer: { tipo: 'bonosCer' }, dolar: { tipo: 'dolar' }, cedear: { tipo: 'cedears' } },
    paraEmpezar: PARA_EMPEZAR_BROKER,
  },
  galicia_securities: {
    id: 'galicia_securities',
    nombre: 'Galicia Securities',
    tipo: 'broker',
    productos: { letra: { tipo: 'letras' }, bono_cer: { tipo: 'bonosCer' }, dolar: { tipo: 'dolar' }, cedear: { tipo: 'cedears' } },
    paraEmpezar: PARA_EMPEZAR_BROKER,
  },
  ppi: {
    id: 'ppi',
    nombre: 'PPI (Portfolio Personal)',
    tipo: 'broker',
    productos: { letra: { tipo: 'letras' }, bono_cer: { tipo: 'bonosCer' }, dolar: { tipo: 'dolar' }, cedear: { tipo: 'cedears' } },
    paraEmpezar: PARA_EMPEZAR_BROKER,
  },
  ieb: {
    id: 'ieb',
    nombre: 'IEB',
    tipo: 'broker',
    productos: { letra: { tipo: 'letras' }, bono_cer: { tipo: 'bonosCer' }, dolar: { tipo: 'dolar' }, cedear: { tipo: 'cedears' } },
    paraEmpezar: PARA_EMPEZAR_BROKER,
  },
  // Cualquier otra billetera o banco con cuenta remunerada (Brubank, BNA, Belo…): se arma con los datos de mercado, no tiene catálogo propio.
  otra_cuenta: {
    id: 'otra_cuenta',
    nombre: 'Otra cuenta',
    tipo: 'billetera',
    productos: {},
    paraEmpezar: 'Una cuenta con tu DNI y una selfie, y plata para ingresar.',
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
 * Lo que se muestra y se puede registrar, empezando por lo conocido. Las letras del Tesoro
 * se ofrecen en los mismos casos que el plazo fijo: son parecidas, se pueden vender antes
 * y a veces pagan una tasa mejor.
 */
export const ORDEN_PRODUCTOS: ProductoId[] = ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva', 'letra', 'bono_cer', 'dolar', 'cedear'];

/** Los nombres con los que la persona dice que usa cada proveedor (campo "bancos" del perfil inversor). */
export const ALIAS_PROVEEDOR: Record<string, ProveedorId> = {
  'Mercado Pago': 'mercado_pago',
  'Naranja X': 'naranja_x',
  Ualá: 'uala',
  'Cocos Capital': 'cocos',
  Cocos: 'cocos',
  Balanz: 'balanz',
  IOL: 'iol',
  InvertirOnline: 'iol',
  'Galicia Securities': 'galicia_securities',
  PPI: 'ppi',
  IEB: 'ieb',
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
