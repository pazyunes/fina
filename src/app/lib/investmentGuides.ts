// PR — Contenido de los instructivos "¿Cómo lo hago?" para cada inversión que
// FINA recomienda. El analyzer devuelve ~9 strings distintos (con paréntesis,
// combos, etc.) pero todos caen en 5 tipos canónicos. resolveInvestmentGuide()
// normaliza cualquier nombre a su guía, así el instructivo funciona para TODAS
// las recomendaciones sin importar el wording exacto.

export interface InvestmentGuide {
  key: string;
  title: string;
  // Paso 1 — qué es, en palabras fáciles, con el riesgo explicado.
  what: string;
  risk: { level: 'Bajo' | 'Medio' | 'Alto'; note: string };
  // Paso 2 — plataformas donde se puede hacer esta inversión.
  apps: string[];
  // Paso 3 — paso a paso detallado.
  steps: string[];
  reassurance: string;
}

const fci: InvestmentGuide = {
  key: 'fci',
  title: 'Fondo Común de Inversión',
  what:
    'Es como juntar tu plata con la de muchas otras personas para que un equipo de expertos la invierta por vos en un montón de cosas a la vez (bonos, acciones, plazos fijos). Vos comprás una “partecita” del fondo y listo: no tenés que decidir nada más. Hay de varios tipos: los Money Market son los más tranquilos (riesgo muy bajo y podés sacar la plata cuando quieras), los mixtos tienen algo más de riesgo, y los de acciones son los que más pueden crecer… pero también bajar. Para arrancar, los Money Market son los más recomendados.',
  risk: { level: 'Bajo', note: 'Muy bajo en Money Market; sube si elegís uno mixto o de acciones.' },
  apps: ['Mercado Pago', 'Ualá', 'Naranja X', 'Cocos Capital', 'Balanz', 'IOL Invertir Online'],
  steps: [
    'Descargá la app que elijas.',
    'Creá tu cuenta (te van a pedir tu DNI y una selfie).',
    'Ingresá dinero: transferí a tu CVU/CBU desde tu banco o billetera.',
    'Andá a la sección “Inversiones”.',
    'Buscá donde diga “Fondo Común de Inversión” (o “FCI” / “Rendimientos”).',
    'Elegí el monto y confirmá. ¡Ya estás invirtiendo!',
  ],
  reassurance: 'Tranqui 😌 cada app ya tiene su propio paso a paso que te va guiando. ¡Lo vas a lograr!',
};

const cuentaRemunerada: InvestmentGuide = {
  key: 'cuenta-remunerada',
  title: 'Cuenta remunerada',
  what:
    'Es una cuenta donde la plata que tenés guardada genera intereses todos los días, sola, sin que hagas nada. La podés usar y retirar cuando quieras. Es la opción más simple y segura de todas: prácticamente sin riesgo. Ideal para tu “colchón” o fondo de emergencia.',
  risk: { level: 'Bajo', note: 'Casi sin riesgo y tu plata queda siempre disponible.' },
  apps: ['Mercado Pago', 'Ualá', 'Brubank', 'Naranja X', 'Personal Pay'],
  steps: [
    'Descargá la app que elijas.',
    'Creá tu cuenta (DNI + selfie).',
    'Ingresá dinero a la cuenta.',
    'Activá la opción de “Rendimientos” o “Cuenta remunerada”.',
    'Listo: tu saldo empieza a generar intereses todos los días.',
  ],
  reassurance: 'Tranqui 😌 es de lo más fácil que hay: una vez activado, funciona solo. ¡Lo vas a lograr!',
};

const plazoFijo: InvestmentGuide = {
  key: 'plazo-fijo',
  title: 'Plazo fijo UVA',
  what:
    'Es dejar tu plata “quieta” por un tiempo (por ejemplo 90 días) y a cambio te pagan un interés. La versión UVA ajusta por inflación, así tu plata no pierde valor cuando los precios suben. El riesgo es muy bajo; lo único es que no podés tocar la plata hasta que termine el plazo.',
  risk: { level: 'Bajo', note: 'Muy seguro, pero la plata queda inmovilizada hasta el vencimiento.' },
  apps: ['Mercado Pago', 'Ualá', 'Brubank', 'Naranja X', 'El homebanking de tu banco'],
  steps: [
    'Descargá la app de tu banco o billetera.',
    'Ingresá a tu cuenta (o creala con DNI + selfie).',
    'Ingresá el dinero que querés invertir.',
    'Andá a la sección “Plazo fijo” y elegí la opción “UVA”.',
    'Elegí el monto y el plazo (mínimo 90 días para el UVA).',
    'Confirmá. Al terminar el plazo recuperás tu plata + intereses.',
  ],
  reassurance: 'Tranqui 😌 la app te muestra cuánto vas a cobrar antes de confirmar. ¡Lo vas a lograr!',
};

const cedears: InvestmentGuide = {
  key: 'cedears',
  title: 'CEDEARs',
  what:
    'Son una forma de comprar “pedacitos” de empresas grandes del exterior (como Apple, Coca-Cola o Google) pero en pesos y desde Argentina. Sirven para que tu plata quede atada al dólar y a empresas internacionales. Tienen más riesgo: su valor sube y baja todos los días, así que conviene pensarlos a largo plazo (varios años).',
  risk: { level: 'Alto', note: 'Su precio varía todos los días; ideal solo para el largo plazo.' },
  apps: ['Cocos Capital', 'Balanz', 'IOL Invertir Online', 'Bull Market', 'Mercado Pago'],
  steps: [
    'Descargá una app de inversiones (broker).',
    'Creá tu cuenta de inversión (DNI, selfie y un test de perfil de inversor).',
    'Ingresá dinero transfiriendo desde tu banco o billetera.',
    'Andá a la sección “CEDEARs” o “Acciones”.',
    'Buscá la empresa o el índice que te interese (por ej. “SPY” = las 500 empresas más grandes de EE.UU.).',
    'Elegí cuántos comprar y confirmá.',
  ],
  reassurance: 'Tranqui 😌 podés empezar con muy poquito para ir aprendiendo. ¡Lo vas a lograr!',
};

const bonos: InvestmentGuide = {
  key: 'bonos',
  title: 'Bonos',
  what:
    'Cuando comprás un bono, le estás prestando plata al Estado o a una empresa, y ellos te la devuelven con intereses. Los “Bonos CER” ajustan por inflación, así tu plata no pierde valor. Tienen un riesgo medio: su precio puede variar si los vendés antes de tiempo, pero si los mantenés hasta el final cobrás lo pactado.',
  risk: { level: 'Medio', note: 'Más estables que las acciones, pero su precio puede moverse en el camino.' },
  apps: ['Cocos Capital', 'Balanz', 'IOL Invertir Online', 'Bull Market'],
  steps: [
    'Descargá una app de inversiones (broker).',
    'Creá tu cuenta de inversión (DNI, selfie y test de perfil).',
    'Ingresá dinero desde tu banco o billetera.',
    'Andá a la sección “Bonos” o “Renta fija”.',
    'Buscá un bono CER (por ej. los que empiezan con “TX” o “TZX”).',
    'Elegí el monto y confirmá.',
  ],
  reassurance: 'Tranqui 😌 la app te indica el rendimiento estimado antes de comprar. ¡Lo vas a lograr!',
};

const GUIDES = { fci, cuentaRemunerada, plazoFijo, cedears, bonos };

// Mapea cualquier string de recomendación del analyzer a su guía canónica.
// El orden importa: chequeamos los más específicos primero.
export function resolveInvestmentGuide(name: string): InvestmentGuide {
  const n = name.toLowerCase();
  if (n.includes('cedear')) return cedears;
  if (n.includes('bono')) return bonos;
  if (n.includes('plazo fijo')) return plazoFijo;
  if (n.includes('fondo común') || n.includes('fondo comun') || n.includes('fci')) return fci;
  if (n.includes('remunerada')) return cuentaRemunerada;
  return fci; // fallback razonable
}

export { GUIDES };
