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

export type ProveedorId = 'mercado_pago' | 'uala' | 'cocos' | 'balanz' | 'banco';
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
  dondeQuedaTuPlata: string[];
  quePuedePasar: string;
  cuandoLaSacas: string;
  garantia: string;
  glosario: Termino[];
};

export const PRODUCTOS: Record<ProductoId, Producto> = {
  cuenta_remunerada: {
    id: 'cuenta_remunerada',
    nombre: 'Cuenta remunerada',
    resumen: 'La plata que tenés quieta en tu billetera genera intereses todos los días.',
    rol: 'caja',
    riesgo: 'Bajo',
    horizonteMinimoMeses: 0,
    plazoMinimoDias: null,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs:
      'Es una cuenta de tu billetera donde el saldo que dejás quieto genera intereses todos los días, sin que hagas nada. La seguís usando como siempre.',
    dondeQuedaTuPlata: [
      'La billetera junta la plata de muchas personas y la usa en cosas de muy corto plazo: préstamos entre bancos, títulos del Estado a pocos días. Con lo que gana, te paga una parte como interés.',
      'En varias billeteras ese “rendimiento” viene de un fondo común de inversión de dinero (un “money market”) que está detrás de la cuenta. En la app podés ver cuál es.',
    ],
    quePuedePasar:
      'El saldo casi no se mueve: no suele bajar. Lo que sí cambia, seguido y a veces de un día para el otro, es la tasa que te pagan, y puede quedar por debajo de la inflación.',
    cuandoLaSacas: 'Cuando quieras: en el momento o, como mucho, en el día.',
    garantia:
      'Depende de la billetera. Si la plata queda en un fondo de inversión, no tiene la garantía de depósitos que sí tienen los bancos. Cada app lo aclara en su sección de rendimientos.',
    glosario: [
      { termino: 'TNA', significado: 'Tasa nominal anual: lo que rendiría en un año si la tasa de hoy se mantuviera. Es la forma más común de mostrar una tasa.' },
      { termino: 'Tope', significado: 'Hasta qué saldo te pagan esa tasa. Lo que pasa de ese monto rinde menos o nada.' },
    ],
  },

  fci: {
    id: 'fci',
    nombre: 'Fondo común de dinero',
    resumen: 'Una bolsa de plata de muchas personas que presta a muy corto plazo; la sacás en pocos días.',
    rol: 'caja',
    riesgo: 'Bajo',
    horizonteMinimoMeses: 0,
    plazoMinimoDias: null,
    perfiles: ['conservador', 'moderado', 'arriesgado'],
    queEs:
      'Un fondo común de inversión (FCI) es una “bolsa” de plata que arman muchas personas juntas. Una empresa autorizada por la CNV, la sociedad gerente, decide en qué se invierte. Vos comprás cuotapartes: pedacitos de esa bolsa. Acá hablamos del tipo más conservador, el “money market”.',
    dondeQuedaTuPlata: [
      'Los fondos money market prestan a muy corto plazo: depósitos en bancos, letras del Tesoro, préstamos de un día entre entidades. Cada día el fondo suma esos intereses y el valor de cada cuotaparte sube un poquito. Ese aumento es tu ganancia.',
      'Tu plata no queda en la empresa que administra el fondo. Un banco distinto, el custodio, guarda los activos del fondo por separado. Si la sociedad gerente tuviera problemas, el patrimonio del fondo sigue siendo de los inversores.',
    ],
    quePuedePasar:
      'En un money market el valor de la cuotaparte casi siempre sube día a día. No está garantizado: en fondos más arriesgados (de bonos o de acciones) puede bajar. Y lo que rindió ayer no asegura lo que rinda mañana.',
    cuandoLaSacas:
      'Pedís el rescate y la plata vuelve a tu cuenta en 0 a 2 días hábiles, según el fondo. Se muestra en la ficha de cada uno.',
    garantia:
      'No tiene garantía de depósitos. Sí está regulado por la CNV y el patrimonio del fondo está separado del de la empresa que lo administra.',
    glosario: [
      { termino: 'Cuotaparte', significado: 'Cada pedacito del fondo. Su valor cambia todos los días; cuando sube, ganás.' },
      { termino: 'Sociedad gerente', significado: 'La empresa que decide en qué invierte el fondo.' },
      { termino: 'Custodio', significado: 'El banco que guarda los activos del fondo, aparte de la gerente.' },
      { termino: 'Rescate', significado: 'Pedir que te devuelvan tu plata: se venden tus cuotapartes y el dinero llega a tu cuenta.' },
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
    queEs:
      'Le prestás tu plata al banco por un tiempo fijo (30, 60, 90 días…). Al vencimiento el banco te devuelve lo que prestaste más un interés que conocés desde el primer día.',
    dondeQuedaTuPlata: [
      'La plata queda en el banco. El banco la usa para dar créditos y paga tu interés con lo que cobra por prestarla.',
      'Durante el plazo no la podés usar. Algunos plazos fijos son “precancelables” y te dejan sacarla antes, pero con una tasa menor.',
    ],
    quePuedePasar:
      'Cobrás exactamente lo pactado. El riesgo es otro: si la inflación del período es mayor que tu interés, con esa plata comprás menos que antes aunque tengas más pesos.',
    cuandoLaSacas: 'Al vencimiento. Antes, sólo si es precancelable y con menos interés.',
    garantia:
      'Los depósitos en bancos están cubiertos por el seguro de depósitos hasta un tope por persona y por banco. El BCRA actualiza ese tope: conviene mirar el vigente.',
    glosario: [
      { termino: 'TNA', significado: 'Tasa nominal anual. Para saber cuánto cobrás en tu plazo: TNA × días ÷ 365.' },
      { termino: 'Vencimiento', significado: 'El día en que el banco te devuelve el capital y el interés.' },
      { termino: 'Precancelable', significado: 'Podés retirarlo antes del vencimiento, cobrando una tasa menor.' },
    ],
  },

  plazo_fijo_uva: {
    id: 'plazo_fijo_uva',
    nombre: 'Plazo fijo UVA',
    resumen: 'Un plazo fijo cuyo capital se actualiza con la inflación, para no perder poder de compra.',
    rol: 'ahorro',
    riesgo: 'Bajo',
    horizonteMinimoMeses: 3,
    plazoMinimoDias: 90,
    perfiles: ['conservador', 'moderado'],
    queEs:
      'Es un plazo fijo donde tu capital se ajusta por la inflación (el índice UVA) y además suma un interés chico. Está pensado para que tu plata no pierda valor, no para ganarle por mucho a la inflación.',
    dondeQuedaTuPlata: [
      'Igual que en un plazo fijo común: la plata queda en el banco durante todo el plazo, y el banco la usa para dar créditos.',
      'El plazo mínimo es de 90 días. Durante ese tiempo no la podés tocar.',
    ],
    quePuedePasar:
      'Cobrás tu capital actualizado por lo que subió la UVA, más el interés. Si la inflación sube, cobrás más pesos; si baja, cobrás menos. Siempre vas a cobrar en pesos y nunca menos que lo que puso el ajuste.',
    cuandoLaSacas: 'Al vencimiento, como mínimo a los 90 días.',
    garantia: 'Es un depósito en un banco, así que entra en el seguro de depósitos hasta el tope vigente.',
    glosario: [
      { termino: 'UVA', significado: 'Unidad de Valor Adquisitivo: un índice del BCRA que sigue a la inflación. Si la UVA sube 2%, tu capital sube 2%.' },
    ],
  },

  letra: {
    id: 'letra',
    nombre: 'Letras del Tesoro',
    resumen: 'Un préstamo al Estado por unos meses, con un monto fijo a cobrar en una fecha conocida.',
    rol: 'ahorro',
    riesgo: 'Medio',
    horizonteMinimoMeses: 1,
    plazoMinimoDias: null,
    perfiles: ['moderado', 'arriesgado'],
    queEs:
      'Una letra es un préstamo que le hacés al Estado nacional por unos meses. Pagás hoy un precio y en una fecha ya fijada el Estado te devuelve un monto mayor. La diferencia es tu ganancia, y se sabe cuánto es desde el día en que la comprás.',
    dondeQuedaTuPlata: [
      'Tu plata va al Tesoro Nacional, que la usa para financiarse. Vos no entregás plata a un banco: pagás por un título que queda registrado a tu nombre en tu cuenta comitente (el “depósito” de tus títulos), separado de la plata del broker.',
      'Se compran a través de un broker (Cocos, Balanz, etc.) y se ven en tu cartera como cualquier otra tenencia.',
    ],
    quePuedePasar:
      'Si la esperás hasta el vencimiento, cobrás lo que figuraba al comprarla. Si la vendés antes, el precio de mercado puede ser menor al que esperabas. El riesgo principal es que el Estado no pague: por eso conviene mirar el riesgo país.',
    cuandoLaSacas:
      'Al vencimiento, o antes vendiéndola en el mercado. La venta se acredita en uno o dos días hábiles.',
    garantia: 'No tiene garantía de depósitos. El respaldo es el compromiso de pago del Estado nacional.',
    glosario: [
      { termino: 'LECAP', significado: 'Letra capitalizable: no paga cupones, se cobra todo junto al final.' },
      { termino: 'Vencimiento', significado: 'La fecha en que el Estado te devuelve el monto fijado.' },
      { termino: 'TEM', significado: 'Tasa efectiva mensual: lo que rinde por mes. Es la más fácil de comparar con la inflación mensual.' },
      { termino: 'Cuenta comitente', significado: 'Tu cuenta en el broker donde se guardan tus títulos.' },
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
    queEs:
      'El dólar MEP es una forma legal de comprar dólares desde un broker: comprás un bono en pesos y lo vendés en dólares, sin pasar por el cupo del banco. Por eso su precio es distinto al oficial.',
    dondeQuedaTuPlata: [
      'Los dólares quedan en tu cuenta del broker, a tu nombre. Desde ahí los podés pasar a una cuenta en dólares de tu banco.',
      'No genera intereses: guardar dólares no rinde, protege.',
    ],
    quePuedePasar:
      'Lo que cambia es cuántos pesos valen tus dólares. Si el dólar sube más que la inflación, ganás poder de compra; si sube menos, perdés. Nadie sabe cuánto va a subir.',
    cuandoLaSacas: 'Cuando quieras: vendés los dólares y los pesos llegan en uno o dos días hábiles.',
    garantia: 'No hay garantía sobre el valor. El dólar puede subir o bajar.',
    glosario: [
      { termino: 'MEP', significado: 'Mercado Electrónico de Pagos: el mecanismo para comprar dólares con un bono.' },
      { termino: 'Brecha', significado: 'La diferencia entre el dólar MEP y el oficial, en porcentaje.' },
    ],
  },

  cedear: {
    id: 'cedear',
    nombre: 'CEDEARs',
    resumen: 'Pedacitos de empresas grandes del exterior (o de un índice), comprados en pesos.',
    rol: 'crecimiento',
    riesgo: 'Alto',
    horizonteMinimoMeses: 36,
    plazoMinimoDias: null,
    perfiles: ['arriesgado'],
    queEs:
      'Un CEDEAR es un certificado en pesos que representa un pedacito de una acción de una empresa del exterior (por ejemplo Apple) o de un grupo de ellas, como el índice S&P 500 (SPY).',
    dondeQuedaTuPlata: [
      'Comprás el certificado en el mercado argentino. Está respaldado por acciones reales que un banco guarda en el exterior. El CEDEAR queda a tu nombre en tu cuenta comitente del broker.',
      'Como la empresa cotiza en dólares, tu CEDEAR se mueve con dos cosas a la vez: el precio de la empresa y el dólar.',
    ],
    quePuedePasar:
      'El precio sube y baja todos los días y puede haber años enteros de pérdida. Históricamente el mercado de EE.UU. creció a lo largo de décadas, pero eso no asegura lo que pase en los próximos años.',
    cuandoLaSacas:
      'Lo vendés cuando quieras en horario de mercado y los pesos llegan en uno o dos días hábiles. Pero si vendés cuando el precio está bajo, la pérdida se concreta.',
    garantia: 'Ninguna garantía sobre el valor.',
    glosario: [
      { termino: 'Acción', significado: 'Una parte de una empresa. Si la empresa vale más, tu parte vale más.' },
      { termino: 'Índice', significado: 'Un conjunto de empresas juntas; SPY sigue a las 500 más grandes de EE.UU.' },
      { termino: 'Volatilidad', significado: 'Cuánto sube y baja el precio. Alta volatilidad = más vaivén.' },
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

export const ORDEN_PRODUCTOS: ProductoId[] = ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva', 'letra', 'dolar', 'cedear'];

/** Los nombres con los que la persona dice que usa cada proveedor (campo "bancos" del perfil inversor). */
export const ALIAS_PROVEEDOR: Record<string, ProveedorId> = {
  'Mercado Pago': 'mercado_pago',
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
