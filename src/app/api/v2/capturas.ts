import { falla, ok, supabase, type Resultado } from './cliente';
import type { TipoPosicion } from './tipos';

// Lectura de capturas de pantalla de inversiones.
//
// La imagen (o el PDF) se achica en el dispositivo si hace falta, se manda a /api/leer-captura y se
// descarta: no se guarda en ningún lado. Lo que vuelve son los campos que se
// ven, para que la persona los revise antes de guardar nada.

export type LecturaCaptura = {
  tipo: TipoPosicion | null;
  proveedor: string | null;
  monto: number | null;
  tnaPorcentaje: number | null;
  plazoDias: number | null;
  fechaInicio: string | null;
  fechaVencimiento: string | null;
  ticker: string | null;
  fondo: string | null;
  clase: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
  notas: string;
};

export type ResultadoCaptura =
  | { estado: 'ok'; lectura: LecturaCaptura }
  | { estado: 'no_es_inversion' }
  | { estado: 'no_se_pudo' }
  | { estado: 'no_configurado' };

const LADO_MAX = 1400;
/** Un PDF no se achica: va tal cual. Vercel corta los cuerpos de más de 4,5 MB y el base64 pesa un tercio más. */
const MAX_PDF_BYTES = 3_200_000;

/** Achica la imagen y la pasa a JPEG: una captura de teléfono pesa varios MB y no hace falta tanto para leer texto. */
export async function achicar(archivo: File): Promise<{ base64: string; tipoMime: 'image/jpeg' }> {
  const bmp = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bmp.width * escala);
  lienzo.height = Math.round(bmp.height * escala);
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen');
  ctx.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  bmp.close();
  const url = lienzo.toDataURL('image/jpeg', 0.82);
  return { base64: url.slice(url.indexOf(',') + 1), tipoMime: 'image/jpeg' };
}

function esResultado(x: unknown): x is ResultadoCaptura {
  return typeof x === 'object' && x !== null && typeof (x as Record<string, unknown>).estado === 'string';
}

/** Un PDF a base64, sin tocarlo. */
export async function pdfABase64(archivo: File): Promise<{ base64: string; tipoMime: 'application/pdf' }> {
  if (archivo.size > MAX_PDF_BYTES) throw new Error('El PDF pesa demasiado: probá con una captura o con uno de menos de 3 MB');
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { base64: btoa(binario), tipoMime: 'application/pdf' };
}

const esPdf = (a: File): boolean => a.type === 'application/pdf' || /\.pdf$/i.test(a.name);

export async function leerCaptura(archivo: File): Promise<Resultado<ResultadoCaptura>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return falla<ResultadoCaptura>('sin sesión', 'leerCaptura');
    const { base64, tipoMime } = esPdf(archivo) ? await pdfABase64(archivo) : await achicar(archivo);
    const res = await fetch('/api/leer-captura', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ imagen: base64, tipoMime }),
    });
    const cuerpo: unknown = await res.json().catch(() => null);
    if (!res.ok || !esResultado(cuerpo)) {
      const msg = (cuerpo as { error?: string } | null)?.error ?? `respuesta ${res.status}`;
      return falla<ResultadoCaptura>(msg, 'leerCaptura');
    }
    return ok(cuerpo);
  } catch (e) {
    return falla<ResultadoCaptura>(e, 'leerCaptura');
  }
}
