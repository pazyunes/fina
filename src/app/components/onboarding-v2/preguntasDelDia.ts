// El banco de la pregunta del día (DEBT R1). Una por día, la misma para todo el
// mundo ese día, y no suma ni resta a la racha: es algo para hacer cuando no hay
// nada pendiente.
//
// Reglas del banco: contexto argentino, tres opciones, una correcta, y una
// explicación de una o dos oraciones. Es educación general: explica qué es cada
// cosa, no le dice a nadie en qué poner su plata. Sin montos redondos de
// fantasía cuando el número importa, sin moralizar el consumo.
//
// El `id` no cambia nunca aunque se edite el texto: es lo que se guarda como
// respondido. Para sumar preguntas, agregarlas al final con un id nuevo.

export type Pregunta = {
  id: string;
  pregunta: string;
  opciones: [string, string, string];
  /** Índice de la opción correcta. */
  correcta: 0 | 1 | 2;
  explicacion: string;
};

export const PREGUNTAS: Pregunta[] = [
  {
    id: 'inflacion-sueldo',
    pregunta: 'Si en el año la inflación fue 30% y tu sueldo subió 20%, ¿qué pasó con lo que podés comprar?',
    opciones: ['Puedo comprar más', 'Puedo comprar menos', 'Puedo comprar lo mismo'],
    correcta: 1,
    explicacion: 'Los precios subieron más que tu sueldo, así que con la misma plata te alcanza para menos. Eso se llama perder poder adquisitivo.',
  },
  {
    id: 'plazo-fijo-retiro',
    pregunta: 'En un plazo fijo tradicional, ¿cuándo podés sacar la plata con sus intereses?',
    opciones: ['Cuando quieras', 'Al terminar el plazo que elegiste', 'Solo a fin de mes'],
    correcta: 1,
    explicacion: 'La plata queda quieta hasta el vencimiento, por ejemplo 30 días. Al terminar te devuelven lo que pusiste más los intereses.',
  },
  {
    id: 'cuotas-sin-interes',
    pregunta: 'Con inflación, una compra en cuotas sin interés al mismo precio que de contado...',
    opciones: ['Sale más cara que de contado', 'Sale igual o más barata en términos reales', 'Siempre tiene un costo escondido'],
    correcta: 1,
    explicacion: 'Si el precio es el mismo, cada cuota futura vale menos por la inflación. Igual usa sueldos que todavía no cobraste, por eso sirve sumar todas las cuotas que tenés.',
  },
  {
    id: 'cft',
    pregunta: '¿Qué te dice el CFT de un préstamo?',
    opciones: ['Solo la tasa de interés', 'El costo total, con intereses, impuestos y comisiones', 'Cuánto es cada cuota'],
    correcta: 1,
    explicacion: 'El CFT (costo financiero total) suma todo lo que pagás de más. Es el número para comparar dos préstamos, no la cuota ni la tasa sola.',
  },
  {
    id: 'tna-tea',
    pregunta: 'Si renovás un plazo fijo a 30 días todo el año con los intereses adentro, ¿qué tasa es más alta?',
    opciones: ['La TNA', 'La TEA', 'Son iguales'],
    correcta: 1,
    explicacion: 'La TEA (tasa efectiva anual) suma el efecto de reinvertir los intereses cada mes. Por eso da más que la TNA cuando los intereses se capitalizan.',
  },
  {
    id: 'interes-compuesto',
    pregunta: 'Ponés $100.000 al 10% anual y dejás los intereses adentro. ¿Cuánto tenés a los 2 años?',
    opciones: ['$120.000', '$121.000', '$110.000'],
    correcta: 1,
    explicacion: 'El primer año ganás $10.000. El segundo ganás el 10% de $110.000, o sea $11.000: eso es el interés compuesto, interés sobre interés.',
  },
  {
    id: 'money-market',
    pregunta: '¿Qué caracteriza a un fondo money market?',
    opciones: ['En general podés retirar la plata en el día', 'Tiene un rendimiento garantizado', 'Invierte sobre todo en acciones'],
    correcta: 0,
    explicacion: 'Invierte en cosas de muy corto plazo y en general la plata se retira en el momento. El rendimiento no está garantizado y cambia día a día.',
  },
  {
    id: 'aguinaldo-cuando',
    pregunta: '¿Cómo se cobra el aguinaldo en Argentina?',
    opciones: ['Una vez al año, en diciembre', 'En dos cuotas, a mitad y a fin de año', 'Cada tres meses'],
    correcta: 1,
    explicacion: 'El aguinaldo (SAC) se paga en dos cuotas: la primera hasta el 30 de junio y la segunda hasta el 18 de diciembre.',
  },
  {
    id: 'aguinaldo-cuanto',
    pregunta: 'Si tu mejor sueldo del semestre fue $600.000, ¿cuánto es esa cuota del aguinaldo?',
    opciones: ['$600.000', '$300.000', '$50.000'],
    correcta: 1,
    explicacion: 'Cada cuota es la mitad del mejor sueldo mensual del semestre. Si no trabajaste el semestre entero, se calcula proporcional.',
  },
  {
    id: 'presupuesto',
    pregunta: '¿Para qué sirve armar un presupuesto?',
    opciones: ['Para gastar menos sí o sí', 'Para decidir antes a dónde va la plata', 'Para que el banco te preste más'],
    correcta: 1,
    explicacion: 'Un presupuesto no es una prohibición: es decidir con tiempo cuánto va a cada cosa, así lo que te importa no queda para el final del mes.',
  },
  {
    id: 'fondo-emergencia',
    pregunta: '¿Qué es un fondo de emergencia?',
    opciones: ['Plata apartada para imprevistos', 'Un seguro que da el banco', 'Un préstamo rápido'],
    correcta: 0,
    explicacion: 'Es una reserva para lo que no planeaste, como un arreglo o quedarte sin trabajo. Se suele medir en meses de gastos fijos.',
  },
  {
    id: 'pago-minimo',
    pregunta: 'Si pagás solo el mínimo de la tarjeta de crédito, ¿qué pasa con el resto?',
    opciones: ['Se perdona', 'Pasa al mes siguiente con intereses', 'Se descuenta solo del sueldo'],
    correcta: 1,
    explicacion: 'Lo que no pagás pasa al próximo resumen con intereses de financiación, que suelen ser altos. Pagar el total evita esos intereses.',
  },
  {
    id: 'dolar-blue',
    pregunta: '¿Qué es el dólar blue?',
    opciones: ['El que vende el Banco Central', 'El que se compra y vende en el mercado informal', 'Un dólar digital'],
    correcta: 1,
    explicacion: 'Es la cotización del mercado paralelo, fuera de los bancos. Suele ser distinta de la oficial.',
  },
  {
    id: 'dolar-mep',
    pregunta: '¿Cómo se consigue el dólar MEP?',
    opciones: ['Comprando un bono en pesos y vendiéndolo en dólares', 'Solo en una casa de cambio', 'Pagando con tarjeta de crédito'],
    correcta: 0,
    explicacion: 'Se hace con un bono a través de un banco o una sociedad de bolsa. Es una forma legal de pasar pesos a dólares.',
  },
  {
    id: 'tasa-real',
    pregunta: 'Si algo te paga 3% por mes y la inflación es 4% por mes, ¿tu plata gana o pierde?',
    opciones: ['Gana', 'Pierde', 'Queda igual'],
    correcta: 1,
    explicacion: 'Al final tenés más pesos, pero compran menos. Lo que importa es la tasa comparada con la inflación.',
  },
  {
    id: 'cuotas-comprometidas',
    pregunta: 'Comprás algo en 12 cuotas de $10.000. ¿Cuánto de tus próximos sueldos ya está usado?',
    opciones: ['$10.000', '$120.000', 'Nada, son sin interés'],
    correcta: 1,
    explicacion: 'Cada cuota sale de un sueldo futuro. Sumar las cuotas que tenés te dice cuánto de tus próximos meses ya está comprometido.',
  },
  {
    id: 'gasto-fijo',
    pregunta: '¿Cuál de estos es un gasto fijo?',
    opciones: ['El alquiler', 'Una salida con amigas', 'Un regalo de cumpleaños'],
    correcta: 0,
    explicacion: 'Un gasto fijo se repite todos los meses con un monto parecido. Conocerlos te dice cuánto margen te queda para decidir.',
  },
  {
    id: 'pagarte-primero',
    pregunta: '¿Qué quiere decir "pagarte primero"?',
    opciones: ['Separar una parte apenas cobrás', 'Darte un gusto antes de pagar las cuentas', 'Cobrar antes que el resto'],
    correcta: 0,
    explicacion: 'Es apartar algo para tus objetivos apenas entra la plata, antes de empezar a gastar. Lo automático funciona mejor que la fuerza de voluntad.',
  },
  {
    id: 'diversificar',
    pregunta: '¿Qué quiere decir diversificar?',
    opciones: ['Poner toda la plata en una sola cosa', 'Repartir la plata en distintas opciones', 'Cambiar de banco seguido'],
    correcta: 1,
    explicacion: 'Repartir baja el riesgo: si a una opción le va mal, no te afecta todo lo que tenés.',
  },
  {
    id: 'riesgo-rendimiento',
    pregunta: 'En general, una inversión que promete más rendimiento...',
    opciones: ['Tiene menos riesgo', 'Tiene más riesgo', 'No tiene riesgo'],
    correcta: 1,
    explicacion: 'Más rendimiento posible suele venir con más riesgo. Si alguien promete mucho y sin riesgo, es una señal para desconfiar.',
  },
  {
    id: 'estafa',
    pregunta: 'Te ofrecen duplicar tu plata en un mes, garantizado. ¿Qué es lo más probable?',
    opciones: ['Una oportunidad única', 'Una estafa', 'Un plazo fijo especial'],
    correcta: 1,
    explicacion: 'Ninguna inversión legal garantiza algo así. Las promesas de ganancias altas y seguras son la marca de las estafas piramidales.',
  },
  {
    id: 'cnv',
    pregunta: '¿Qué organismo registra a quienes ofrecen inversiones en Argentina?',
    opciones: ['La CNV', 'ARCA', 'El ENACOM'],
    correcta: 0,
    explicacion: 'La Comisión Nacional de Valores registra a quienes pueden ofrecer inversiones. Antes de invertir con alguien, podés chequear en su sitio que esté registrado.',
  },
  {
    id: 'monotributo',
    pregunta: '¿Qué es el monotributo?',
    opciones: ['Un régimen simple de impuestos para quien trabaja por su cuenta', 'Un impuesto a las compras con tarjeta', 'Un plan de ahorro del Estado'],
    correcta: 0,
    explicacion: 'Junta en una cuota mensual los impuestos, la jubilación y la obra social de quien trabaja de forma independiente, hasta ciertos ingresos.',
  },
  {
    id: 'neto-bruto',
    pregunta: 'En tu recibo de sueldo, ¿cuál es el que te depositan?',
    opciones: ['El bruto', 'El neto', 'El básico'],
    correcta: 1,
    explicacion: 'El neto es lo que cobrás después de los descuentos, como jubilación y obra social. El bruto es antes de esos descuentos.',
  },
  {
    id: 'cvu',
    pregunta: '¿Para qué sirve el CVU?',
    opciones: ['Para recibir transferencias en una billetera virtual', 'Para pedir un préstamo', 'Para pagar impuestos'],
    correcta: 0,
    explicacion: 'El CVU es como el CBU, pero de las billeteras virtuales. Con él o con su alias te pueden transferir plata.',
  },
  {
    id: 'billetera-remunerada',
    pregunta: 'Si una billetera virtual "remunera" tu saldo, ¿qué significa?',
    opciones: ['Te paga un rendimiento por la plata que dejás ahí', 'Te cobra por guardarla', 'La pasa a dólares'],
    correcta: 0,
    explicacion: 'En general invierte tu saldo en un fondo y te paga un rendimiento cada día. No está garantizado y cambia con las tasas.',
  },
  {
    id: 'pesos-quietos',
    pregunta: 'Tenés $100.000 guardados en un cajón y la inflación del año es 25%. A fin de año...',
    opciones: ['Tenés $100.000 que compran lo mismo', 'Tenés $100.000 que compran menos', 'Tenés $125.000'],
    correcta: 1,
    explicacion: 'La cantidad de billetes no cambia, pero los precios subieron. Con la misma plata te alcanza para menos cosas.',
  },
  {
    id: 'interes-prestamo',
    pregunta: 'Pedís $100.000 y en un año devolvés $130.000. ¿Qué interés pagaste?',
    opciones: ['13%', '30%', '130%'],
    correcta: 1,
    explicacion: 'Pagaste $30.000 de más sobre $100.000, o sea 30%. Mirar cuánto devolvés en total es la forma más clara de ver el costo.',
  },
  {
    id: 'gasto-diario',
    pregunta: 'Un gasto de $3.000 todos los días, en un mes suma más o menos...',
    opciones: ['$30.000', '$90.000', '$3.000'],
    correcta: 1,
    explicacion: 'Treinta días por $3.000 son $90.000. Lo chico que se repite pesa más de lo que parece, y saberlo te deja decidir si lo vale.',
  },
  {
    id: 'debito-credito',
    pregunta: 'Si pagás con tarjeta de débito, ¿de dónde sale la plata?',
    opciones: ['De tu cuenta, en el momento', 'Del banco, y la pagás el mes que viene', 'De tus puntos'],
    correcta: 0,
    explicacion: 'El débito descuenta de tu cuenta en el acto. El crédito te presta y lo pagás cuando llega el resumen.',
  },
  {
    id: 'cierre-tarjeta',
    pregunta: 'En el resumen de la tarjeta, ¿qué es la fecha de cierre?',
    opciones: ['El último día para pagar', 'El día en que se dejan de sumar compras a ese resumen', 'El día en que vence el plástico'],
    correcta: 1,
    explicacion: 'Lo que comprás después del cierre va al resumen siguiente. El vencimiento es otra fecha: la última para pagar.',
  },
  {
    id: 'credito-uva',
    pregunta: '¿Qué tiene de particular un crédito UVA?',
    opciones: ['La cuota se ajusta por inflación', 'La cuota nunca cambia', 'No cobra intereses'],
    correcta: 0,
    explicacion: 'Las UVA siguen a la inflación, así que la cuota en pesos sube con ella. Por eso importa cómo vienen tus ingresos.',
  },
  {
    id: 'reintegro-tope',
    pregunta: 'Una promo da 30% de reintegro con tope de $5.000. Si gastás $40.000, ¿cuánto te devuelven?',
    opciones: ['$12.000', '$5.000', '$40.000'],
    correcta: 1,
    explicacion: 'El 30% de $40.000 serían $12.000, pero el tope corta en $5.000. Pasados unos $16.700 de compra, el reintegro ya no crece.',
  },
  {
    id: 'liquidez',
    pregunta: '¿Qué significa que una inversión tenga liquidez?',
    opciones: ['Que se puede pasar a plata rápido', 'Que no tiene riesgo', 'Que paga intereses todos los días'],
    correcta: 0,
    explicacion: 'Liquidez es qué tan rápido y fácil recuperás tu plata. Un fondo de emergencia necesita mucha.',
  },
  {
    id: 'tasa-tarjeta-adelanto',
    pregunta: 'Sacar efectivo con la tarjeta de crédito (un adelanto) en general...',
    opciones: ['No tiene costo', 'Cobra intereses desde el primer día', 'Se paga en cuotas sin interés'],
    correcta: 1,
    explicacion: 'El adelanto en efectivo suele cobrar intereses desde que lo sacás, más una comisión. Es de las formas más caras de conseguir plata.',
  },
];

/** La pregunta de un día: la misma para todo el mundo, y va rotando. */
export function preguntaDelDia(dia: string): Pregunta {
  const n = Math.floor(Date.parse(`${dia}T12:00:00Z`) / 86_400_000);
  return PREGUNTAS[((n % PREGUNTAS.length) + PREGUNTAS.length) % PREGUNTAS.length];
}
