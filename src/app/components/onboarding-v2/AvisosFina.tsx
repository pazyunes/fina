import { useEffect, useState } from 'react';
import { COLORS, TituloSeccion } from './shared';
import {
  activarNotificaciones, desactivarNotificaciones, guardarPreferenciasAvisos, leerPreferenciasAvisos,
  mandarAvisoDePrueba, notificacionesActivas, soporteNotificaciones, PREFERENCIAS_POR_DEFECTO, type PreferenciasAvisos,
} from '../../api/v2/notificaciones';

// Avisos de FINA en Perfil: activarlos en este dispositivo, elegir cuáles y
// mandarse uno de prueba.
//
// Son pocos a propósito (como mucho dos por día) y cada uno se apaga solo. Una
// app que avisa de más termina con las notificaciones desactivadas o
// desinstalada, y ahí se pierde el recordatorio que sí servía.

type Interruptor = 'paso' | 'racha' | 'separar' | 'resumen';

const AVISOS: { clave: Interruptor; titulo: string; detalle: string }[] = [
  { clave: 'paso', titulo: 'Tu paso del día', detalle: 'A las 19 hs, si todavía no lo hiciste.' },
  { clave: 'racha', titulo: 'Tu racha', detalle: 'A las 19 hs, si tenés una racha y ese día todavía no sumaste. Va en lugar del paso.' },
  { clave: 'separar', titulo: 'Día de separar', detalle: 'A las 10 hs del día que cobrás, para separar para tus objetivos apenas entra la plata.' },
  { clave: 'resumen', titulo: 'Resumen de la semana', detalle: 'Los lunes a las 10 hs, cómo te fue la semana anterior.' },
];

const DIAS_DEL_MES = Array.from({ length: 31 }, (_, i) => i + 1);

export function AvisosFina() {
  const soporte = soporteNotificaciones();
  const [activas, setActivas] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<PreferenciasAvisos>(PREFERENCIAS_POR_DEFECTO);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void notificacionesActivas().then((a) => { if (vivo) setActivas(a); });
    void leerPreferenciasAvisos().then((p) => { if (vivo) setPrefs(p); });
    return () => { vivo = false; };
  }, []);

  async function activar() {
    setTrabajando(true);
    setMensaje(null);
    const r = await activarNotificaciones();
    setTrabajando(false);
    if (r.resultado === 'activadas') { setActivas(true); return; }
    setMensaje(
      r.resultado === 'permiso-denegado'
        ? 'El navegador tiene los avisos bloqueados para FINA. Para activarlos, entrá a los ajustes del sitio (el candadito al lado de la dirección) y permití las notificaciones.'
        : 'No pudimos activar los avisos. Probá de nuevo en un rato.',
    );
  }

  async function desactivar() {
    setTrabajando(true);
    const r = await desactivarNotificaciones();
    setTrabajando(false);
    if (r.error === null) setActivas(false);
  }

  async function guardar(nuevo: PreferenciasAvisos) {
    const previo = prefs;
    setPrefs(nuevo);
    const r = await guardarPreferenciasAvisos(nuevo);
    if (r.error !== null) setPrefs(previo);
  }
  const cambiar = (clave: Interruptor) => guardar({ ...prefs, [clave]: !prefs[clave] });

  async function probar() {
    setTrabajando(true);
    setMensaje(null);
    const r = await mandarAvisoDePrueba();
    setTrabajando(false);
    setMensaje(r.error !== null
      ? 'No pudimos mandar el aviso de prueba. Probá de nuevo en un rato.'
      : r.data > 0 ? 'Te mandamos uno. Si no aparece en unos segundos, fijate que el celular no esté en modo "No molestar".' : 'No encontramos este dispositivo anotado. Desactivá y volvé a activar los avisos.');
  }

  // Sin las claves configuradas en el servidor, la sección no se muestra: un
  // "todavía no disponible" en Perfil no le sirve a nadie.
  if (soporte === 'no-configurado') return null;

  return (
    <section className="flex flex-col gap-3">
      <TituloSeccion>Avisos</TituloSeccion>
      <p className="text-[16px] leading-snug" style={{ color: COLORS.inkSoft }}>
        Pocos y útiles: como mucho, dos avisos por día.
      </p>

      {soporte === 'iphone-sin-instalar' && (
        <p className="text-[15px] leading-snug pl-3.5 border-l-2" style={{ color: COLORS.ink, borderColor: COLORS.brandSoft }}>
          En iPhone, los avisos funcionan con FINA en tu pantalla de inicio: en Safari tocá <strong>Compartir</strong> → <strong>Agregar a inicio</strong>, abrí FINA desde ese ícono y activalos acá.
        </p>
      )}
      {soporte === 'no' && (
        <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
          Este navegador no permite avisos. Probá desde Chrome en Android, o con FINA agregada a la pantalla de inicio del iPhone.
        </p>
      )}

      {soporte === 'si' && activas === false && (
        <button
          type="button"
          onClick={() => void activar()}
          disabled={trabajando}
          className="v2-focus rounded-2xl py-3.5 text-[17px] font-bold v2-disabled transition-all duration-100 active:scale-[0.98]"
          style={{ background: COLORS.brand, color: COLORS.surface }}
        >
          {trabajando ? 'Activando…' : 'Activar avisos'}
        </button>
      )}

      {soporte === 'si' && activas && (
        <>
          <div className="flex flex-col">
            {AVISOS.map((a) => (
              <div key={a.clave} className="flex items-center gap-3 py-3 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>{a.titulo}</p>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>{a.detalle}</p>
                  {/* Sin el día de cobro no hay cuándo mandar el de separar: se
                      pregunta acá mismo, al lado del interruptor. */}
                  {a.clave === 'separar' && prefs.separar && (
                    <div className="mt-2 flex items-center gap-2">
                      <label htmlFor="dia-cobro" className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>¿Qué día del mes cobrás?</label>
                      <select
                        id="dia-cobro"
                        value={prefs.diaCobro ?? ''}
                        onChange={(e) => void guardar({ ...prefs, diaCobro: e.target.value ? Number(e.target.value) : null })}
                        className="v2-focus rounded-xl px-2.5 min-h-[40px] text-[16px]"
                        style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                      >
                        <option value="">Elegí</option>
                        {DIAS_DEL_MES.map((d) => <option key={d} value={d}>{d === 31 ? '31 / último día' : d}</option>)}
                      </select>
                    </div>
                  )}
                  {a.clave === 'separar' && prefs.separar && !prefs.diaCobro && (
                    <p className="text-[13px] mt-1" style={{ color: COLORS.inkFaint }}>Hasta que lo elijas, este aviso no se manda.</p>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[a.clave]}
                  aria-label={a.titulo}
                  onClick={() => void cambiar(a.clave)}
                  className="v2-focus relative w-[52px] h-[32px] rounded-full shrink-0 transition-colors"
                  style={{ background: prefs[a.clave] ? COLORS.brand : COLORS.lineStrong }}
                >
                  <span
                    className="absolute top-[3px] w-[26px] h-[26px] rounded-full transition-all"
                    style={{ left: prefs[a.clave] ? 23 : 3, background: COLORS.surface }}
                  />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={() => void probar()}
              disabled={trabajando}
              className="v2-focus min-h-[44px] px-4 rounded-full text-[15px] font-bold v2-disabled"
              style={{ color: COLORS.brand, border: `1.5px solid ${COLORS.brandSoft}` }}
            >
              Mandarme uno de prueba
            </button>
            <button
              type="button"
              onClick={() => void desactivar()}
              disabled={trabajando}
              className="v2-focus min-h-[44px] text-[15px] font-semibold underline v2-disabled"
              style={{ color: COLORS.inkSoft }}
            >
              Desactivar en este dispositivo
            </button>
          </div>
        </>
      )}

      {mensaje && <p role="status" className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{mensaje}</p>}
    </section>
  );
}
