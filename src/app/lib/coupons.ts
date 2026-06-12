// PR — Cupones de descuento para la usuaria. Por ahora estáticos; el catálogo
// puede venir de DB más adelante. El isologo: si hay archivo en /public lo
// usamos (logo), si no caemos a un badge con inicial + color de marca.

export interface Coupon {
  id: string;
  brand: string;
  discount: string;   // ej "15%"
  code: string;       // ej "FINA15"
  url: string;
  message: string;
  color: string;      // color de marca para el badge
  logo?: string;      // ruta opcional al isologo (ej "/coupons/nutriveg.svg")
}

export const COUPONS: Coupon[] = [
  {
    id: 'nutriveg',
    brand: 'Nutriveg',
    discount: '15%',
    code: 'FINA15',
    url: 'https://nutriveg.com.ar/',
    message:
      'Comprá productos saludables y veganos en Nutriveg con 15% de descuento usando el código FINA15 en el checkout.',
    color: '#3B6D11',
    logo: '/coupons/nutriveg.jpeg',
  },
  {
    id: 'cloe',
    brand: 'Cloe Cosmética',
    discount: '10%',
    code: 'FINA10',
    url: 'https://www.cloecosmetica.com.ar/',
    message:
      'Cuidá tu piel con cosmética natural de Cloe y llevate 10% de descuento usando el código FINA10 en el checkout.',
    color: '#B86A86',
    logo: '/coupons/cloe.jpeg',
  },
];
