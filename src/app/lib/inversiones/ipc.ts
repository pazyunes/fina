// Los índices de precios del INDEC por rubro y por región, y cómo se conectan con
// las secciones de gasto de FINA. Con esto se calcula la inflación de cada
// persona en lugar de usar sólo el promedio del país.
//
// Los índices se bajan de la API de series de tiempo de datos.gob.ar, que es donde
// el INDEC publica sus series. Cada serie tiene un ID fijo; se buscaron una vez
// (la búsqueda de la API es poco confiable) y viven acá.

export type RubroId =
  | 'general' | 'alimentos' | 'prendas' | 'vivienda' | 'equipamiento' | 'salud'
  | 'transporte' | 'comunicacion' | 'recreacion' | 'educacion' | 'restaurantes' | 'varios';
export type RegionIpc = 'nacional' | 'gba';

export const RUBROS: { id: RubroId; nombre: string }[] = [
  { id: 'general', nombre: 'Nivel general' },
  { id: 'alimentos', nombre: 'Alimentos y bebidas' },
  { id: 'prendas', nombre: 'Ropa y calzado' },
  { id: 'vivienda', nombre: 'Vivienda, servicios y alquiler' },
  { id: 'equipamiento', nombre: 'Equipamiento del hogar' },
  { id: 'salud', nombre: 'Salud' },
  { id: 'transporte', nombre: 'Transporte' },
  { id: 'comunicacion', nombre: 'Comunicación' },
  { id: 'recreacion', nombre: 'Recreación y cultura' },
  { id: 'educacion', nombre: 'Educación' },
  { id: 'restaurantes', nombre: 'Restaurantes y comidas afuera' },
  { id: 'varios', nombre: 'Cuidado personal y otros' },
];

export const SERIES_IPC: Record<RegionIpc, Record<RubroId, string>> = {
  nacional: {
    general: '148.3_INIVELNAL_DICI_M_26',
    alimentos: '146.3_IALIMENNAL_DICI_M_45',
    prendas: '146.3_IPRENDANAL_DICI_M_35',
    vivienda: '146.3_IVIVIENNAL_DICI_M_52',
    equipamiento: '146.3_IEQUIPANAL_DICI_M_46',
    salud: '146.3_ISALUDNAL_DICI_M_18',
    transporte: '146.3_ITRANSPNAL_DICI_M_23',
    comunicacion: '146.3_ICOMUNINAL_DICI_M_27',
    recreacion: '146.3_IRECREANAL_DICI_M_31',
    educacion: '146.3_IEDUCACNAL_DICI_M_22',
    restaurantes: '146.3_IRESTAUNAL_DICI_M_33',
    varios: '146.3_IBIENESNAL_DICI_M_36',
  },
  gba: {
    general: '148.3_INIVELGBA_DICI_M_21',
    alimentos: '146.3_IALIMENGBA_DICI_M_40',
    prendas: '146.3_IPRENDAGBA_DICI_M_30',
    vivienda: '146.3_IVIVIENGBA_DICI_M_47',
    equipamiento: '146.3_IEQUIPAGBA_DICI_M_41',
    salud: '146.3_ISALUDGBA_DICI_M_13',
    transporte: '146.3_ITRANSPGBA_DICI_M_18',
    comunicacion: '146.3_ICOMUNIGBA_DICI_M_22',
    recreacion: '146.3_IRECREAGBA_DICI_M_26',
    educacion: '146.3_IEDUCACGBA_DICI_M_17',
    restaurantes: '146.3_IRESTAUGBA_DICI_M_28',
    varios: '146.3_IBIENESGBA_DICI_M_31',
  },
};

const sinTildes = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Palabras que, en el nombre de una sección de gasto, la ubican en un rubro del
// INDEC. Si nada coincide, el gasto cuenta como "nivel general": no se inventa un
// rubro. El orden importa: lo más específico va primero.
const PALABRAS: { rubro: RubroId; patron: RegExp }[] = [
  { rubro: 'restaurantes', patron: /delivery|restaurante|cafeter|\bbar\b|comer afuera|salida a comer|panader|helader/ },
  { rubro: 'alimentos', patron: /supermercado|almacen|verdul|carnicer|dietetic|comida|mercado|feria|super\b/ },
  { rubro: 'transporte', patron: /transporte|nafta|combustible|colectivo|subte|\bsube\b|uber|cabify|auto\b|peaje|cochera|taxi|moto|bici/ },
  { rubro: 'salud', patron: /farmacia|salud|medic|prepaga|obra social|dentist|terapia|psicolog|oculista|analisis/ },
  { rubro: 'prendas', patron: /\bropa\b|calzado|indumentaria|zapatill|vestimenta/ },
  { rubro: 'comunicacion', patron: /celular|internet|telefon|cable|wifi|linea movil/ },
  { rubro: 'educacion', patron: /educacion|curso|colegio|universidad|escuela|cuota del colegio|idioma|clases/ },
  { rubro: 'vivienda', patron: /alquiler|expensas|\bluz\b|\bgas\b|\bagua\b|electricidad|servicios del hogar|abl|impuesto inmobiliario/ },
  { rubro: 'equipamiento', patron: /hogar|mueble|limpieza|electrodomestic|ferreteria|decoracion/ },
  { rubro: 'recreacion', patron: /salidas|entretenimiento|suscripci|streaming|netflix|spotify|deporte|gimnasio|gym|cine|viaje|libro|juego|hobby|recreacion|vacaciones/ },
  { rubro: 'varios', patron: /belleza|cuidado personal|peluquer|regalo|mascota|veterinari/ },
];

/** A qué rubro del INDEC corresponde una sección de gasto. */
export function rubroDeSeccion(nombre: string | null | undefined): RubroId {
  if (!nombre) return 'general';
  const n = sinTildes(nombre);
  return PALABRAS.find((p) => p.patron.test(n))?.rubro ?? 'general';
}

/** CABA y GBA tienen su propio índice; el resto del país usa el nacional. */
export function regionDeZona(zona: string | null | undefined): RegionIpc {
  return zona === 'CABA' || zona === 'GBA' ? 'gba' : 'nacional';
}
