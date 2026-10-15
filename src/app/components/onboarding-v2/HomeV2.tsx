import { useEffect, useRef, useState } from 'react';
import { Fini } from './Fini';
import { MisVisualizaciones } from './MisVisualizaciones';
import { Recomendaciones } from './Recomendaciones';
import { AvisoVencimientoHome } from './GastosFijos';
import { InvitacionAvisos } from './InvitacionAvisos';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { useNavigate } from 'react-router';
import { COLORS, consumirFiniAterriza, FONTS, Fila, Titulo, TituloSeccion, fechaDisplay, loadV2Foto, loadV2Nombre, saludoDelDia } from './shared';
import { IconFuego, IconPerfil } from './FinaIcons';
import { usePasoDelDia } from '../../api/v2/PasoDelDiaProvider';
import { pasoPorClave } from '../../api/v2/pasos';
import { LinkWhatsApp } from './LinkWhatsApp';


// El paso del día y la racha salen de PasoDelDiaProvider (api/v2). Antes Home
// calculaba los dos acá: el "próximo paso" era siempre el mismo hasta hacerlo,
// y la racha contaba días con gastos. Ahora toca un paso distinto cada día, y
// la racha cuenta los días en que se cumplió.


// REDISEÑO v2 — Home, según el boceto: perfil arriba + 3 acciones grandes
// para arrancar, y — si hay un grupo armado — una vista chica de la
// actividad del grupo debajo del dashboard (no mezclada con los accesos
// principales). Si todavía no armó uno, un único CTA para armarlo.
//
// Saluda por nombre y según la hora (mismo detalle que Headspace/Cleo) —
// es lo que más cambia que esto se sienta "alguien te habla" y no un
// formulario. El avatar lleva a Perfil (foto + nombre + grupos).
//
// "Tu potencial" — a diferencia del anillo de bienestar (que solo aparece
// con USO real), esto se arma con lo que la persona ya contó en el
// onboarding (autopercepción de ahorro/inversión/control) y aparece desde
// el primer segundo — le da algo de valor apenas entra, sin esperar a que
// use la app.
export function HomeV2() {
  const navigate = useNavigate();
  const gastosRegistrados = useAlmacen().estado.gastos.length;
  const nombre = loadV2Nombre();
  const foto = loadV2Foto();
  const { paso, cumplido, racha } = usePasoDelDia();
  const [rachaAbierta, setRachaAbierta] = useState(false);

  // PRUEBA — "Fini aterriza en el avatar", estilo Netflix. La animación la
  // hace Home y no el onboarding, porque el destino es ESTE avatar y solo acá
  // se puede medir dónde cae de verdad: en desktop el sidebar mide 240px y el
  // contenido va centrado, así que cualquier coordenada calculada desde la
  // pantalla anterior erraba.
  const avatarRef = useRef<HTMLButtonElement>(null);
  const [aterrizando, setAterrizando] = useState(false);
  const [vuelo, setVuelo] = useState<{ left: number; top: number; lado: number; dx: number; dy: number; escala: number } | null>(null);

  useEffect(() => {
    if (!consumirFiniAterriza()) return;
    const el = avatarRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const desde = 190; // tamaño de salida, parecido al de la pantalla final
    setVuelo({
      left: r.left,
      top: r.top,
      lado: r.width,
      // Se arranca en el centro de la pantalla y se termina exactamente sobre
      // el avatar, así el aterrizaje calza al pixel en cualquier viewport.
      dx: window.innerWidth / 2 - (r.left + r.width / 2),
      dy: window.innerHeight / 2 - (r.top + r.height / 2),
      escala: desde / r.width,
    });
    setAterrizando(true);
  }, []);

  return (
    // DIRECCIÓN C — Home des-encajonado. Antes casi todo elemento vivía dentro
    // de su propio contenedor redondeado y tintado: banda lila, fila, divisor,
    // fila, tres fichas de color, otra caja. Como los tintes estaban todos
    // entre 1.07 y 1.24 de contraste, ninguna de esas cajas separaba nada —
    // solo sumaban contornos. Ahora el contenido se apoya directo sobre el
    // papel y se separa por aire y por hairline; la ÚNICA tarjeta elevada de
    // toda la app es "tu próximo paso", que es lo que de verdad tiene prioridad.
    <div className="px-6 pt-8 pb-4 flex flex-col gap-8 lg:max-w-2xl lg:mx-auto lg:pt-10">
      {/* Fini aterrizando en el avatar. Sale del centro en grande y termina
          justo sobre el avatar, en su tamaño. */}
      {aterrizando && vuelo && (
        <div
          className="fixed z-40 pointer-events-none v2-fini-aterriza"
          style={{
            left: vuelo.left,
            top: vuelo.top,
            width: vuelo.lado,
            height: vuelo.lado,
            ['--fini-dx' as string]: `${vuelo.dx}px`,
            ['--fini-dy' as string]: `${vuelo.dy}px`,
            ['--fini-k' as string]: String(vuelo.escala),
          }}
          onAnimationEnd={() => setAterrizando(false)}
          aria-hidden
        >
          <Fini state="idle" size="100%" />
        </div>
      )}

      {/* Saludo. El nombre pasa a ser el título de la pantalla, en Baloo 2:
          antes decía "Tu FINA" en 19px y el nombre iba arriba en gris chico,
          o sea que lo genérico pesaba más que lo personal. */}
      <header data-franja className="mb-2 flex items-center gap-3.5">
        <button
          type="button"
          ref={avatarRef}
          onClick={() => navigate('/onboarding-v2/perfil')}
          className="v2-focus w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center transition-transform duration-100 active:scale-95"
          style={foto ? undefined : { background: COLORS.starSoft }}
          aria-label="Ver tu perfil"
        >
          {foto
            ? <img src={foto} alt="" className="w-full h-full object-cover" />
            // Mientras Fini está volando el avatar va vacío, así no se ve dos
            // veces al mismo personaje.
            : <span style={{ opacity: aterrizando ? 0 : 1 }}><Fini state="idle" size={40} /></span>}
        </button>
        <div className="flex-1 min-w-0">
          {/* Saludo y nombre en una sola línea. "Tu FINA" era el fallback sin
              nombre y terminaba siendo lo que veías: genérico donde tendría
              que estar lo personal. */}
          <Titulo className="!text-[24px] lg:!text-[28px]">
            {saludoDelDia()}{nombre ? `, ${nombre}` : ''}
          </Titulo>
        </div>
        {/* Racha. Con 0 días todavía no es un dato: se muestra tenue como
            invitación (por-descubrir), no como un cero que parece un error. */}
        {racha.dias > 0 ? (
          <button
            type="button"
            data-racha-destino
            onClick={() => setRachaAbierta((v) => !v)}
            aria-expanded={rachaAbierta}
            className="v2-focus flex flex-col items-center shrink-0 min-h-[44px] px-1 rounded-xl"
            style={{ color: COLORS.brand }}
          >
            <span data-racha-numero className="flex items-center gap-1.5 text-[26px] font-bold leading-none"><IconFuego size={28} /> <span className="font-mono tabular-nums">{racha.dias}</span></span>
            <span className="text-[13px] font-semibold mt-0.5" style={{ color: COLORS.inkSoft }}>{racha.dias === 1 ? 'día' : 'días'}</span>
          </button>
        ) : (
          <div data-racha-destino className="flex flex-col items-center shrink-0" style={{ color: COLORS.inkFaint }} aria-label="Todavía no arrancaste tu racha">
            <IconFuego size={28} />
            <span className="text-[13px] font-semibold leading-none mt-1">Racha</span>
          </div>
        )}
      </header>

      {/* Detalle de la racha: qué sumó cada día. Un número que no se puede
          abrir es un puntaje; abriéndolo es un dato. */}
      {rachaAbierta && racha.dias > 0 && (
        <section className="flex flex-col gap-2 -mt-4">
          <TituloSeccion>Tu racha, día por día</TituloSeccion>
          {/* El comodín se explica acá y no en un tutorial: es donde la persona
              lo ve funcionar. */}
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            {racha.comodinDisponible
              ? 'Tenés un comodín esta semana: si se te pasa un día, te lo salva solo.'
              : 'Ya usaste el comodín de esta semana. El lunes tenés otro.'}
          </p>
          <div className="flex flex-col">
            {racha.detalle.map((d) => (
              <div key={d.dia} className="flex items-baseline gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
                <span className="w-16 shrink-0 text-[14px] font-semibold" style={{ color: COLORS.ink }}>
                  {fechaDisplay(Date.parse(`${d.dia}T12:00:00-03:00`))}
                </span>
                <span className="flex-1 min-w-0 text-[14px]" style={{ color: d.tipo === 'comodin' ? COLORS.inkFaint : COLORS.inkSoft }}>
                  {d.tipo === 'paso' && (pasoPorClave(d.paso ?? '')?.titulo ?? 'Cumpliste tu paso')}
                  {d.tipo === 'whatsapp' && 'Le contaste un gasto a FINA por WhatsApp'}
                  {d.tipo === 'comodin' && 'El comodín te salvó el día'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LA tarjeta elevada de la app. Es la única, y por eso funciona: cuando
          todo era tarjeta, ser tarjeta no significaba nada. */}
      {/* PRUEBA — el próximo paso lo dice Fini, no una tarjeta. Se saca el
          contorno y el ícono de chispita: queda el personaje, lo que hay que
          hacer, y el botón. El CTA va en LIMA, que es el color que la guía
          reserva para el momento de valor (§3.3) — y como el lima tiene 1.43
          de contraste sobre el papel, el texto encima va en TINTA, nunca en
          blanco: sobre relleno de color el texto es tinta (§3.3). */}
      {/* Fini grande (92 → 132 → 164) y alineado con el globo, no con el botón.
          A 92 quedaba del tamaño de un ícono al lado de un cartel de 19px: se
          leía como una decoración pegada al borde y no como el personaje que te
          está hablando. Es el segundo elemento en peso de la pantalla, después
          del saludo. Como a este tamaño se lleva casi la mitad del ancho en un
          celular, el globo se aprieta un poco menos: gap más chico y el
          personaje sale del margen izquierdo. */}
      {/* EL PASO DE HOY. Uno por día, distinto cada día. Se cumple solo
          cuando los datos lo muestran: no hay botón de "listo", porque con uno
          la racha se inflaría tocándolo. */}
      <section className="flex items-start gap-1 pt-1">
        {/* Fini sólo en desktop. En el celular, a 164px, se llevaba casi la
            mitad del ancho y empujaba el texto del paso a cuatro líneas, sin
            decir nada que el globo no dijera. */}
        <div className="hidden lg:block shrink-0 -ml-4 -mt-4">
          {/* Fini festeja cuando está cumplido. `logro` es de una pasada: salta
              una vez y vuelve a quedarse quieto, no queda saltando al lado de
              algo que ya pasó. */}
          <Fini state={cumplido ? 'logro' : paso ? 'idle' : 'pensando'} size={164} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3 lg:pt-3">
          <div
            className="relative rounded-[20px] lg:rounded-tl-md px-4 py-3.5"
            style={{ background: cumplido ? COLORS.limaSoft : COLORS.surface, border: `1.5px solid ${cumplido ? COLORS.lima : COLORS.line}` }}
          >
            {/* Sin bajada explicativa (frontend.md §5.4): el título del paso y
                el botón dicen qué hacer. El mensaje de la IA y el texto del
                catálogo siguen en pasos.ts por si se usan en otro lado. */}
            <p className="text-[14px] font-semibold" style={{ color: cumplido ? COLORS.limaText : COLORS.inkSoft }}>
              {cumplido ? 'Paso de hoy listo' : 'Tu paso de hoy'}
            </p>
            {!paso ? (
              <p className="text-[15px] leading-snug mt-1" style={{ color: COLORS.inkSoft }}>Preparando tu paso de hoy...</p>
            ) : cumplido ? (
              <p className="font-bold text-[21px] leading-tight mt-1" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>Listo por hoy, mañana te toca otro</p>
            ) : (
              <>
                <p className="font-bold text-[21px] leading-tight mt-1" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{paso.titulo}</p>
                {/* Un gasto por WhatsApp salva el día aunque el paso sea otro.
                    Se dice, para que no parezca que la racha depende sólo de
                    este paso — y sin empujar a no hacerlo. */}
                {racha.hoyCumplido && (
                  <p className="text-[14px] leading-snug mt-2 font-semibold" style={{ color: COLORS.limaText }}>
                    Tu racha de hoy ya está a salvo por WhatsApp.
                  </p>
                )}
              </>
            )}
          </div>
          {paso && !cumplido && (
            paso.destino === 'whatsapp' ? (
              <LinkWhatsApp
                className="v2-focus w-full rounded-2xl py-3.5 text-[18px] font-bold text-center transition-transform duration-100 active:scale-[0.99]"
                style={{ background: COLORS.lima, color: COLORS.ink }}
              >
                {paso.cta}
              </LinkWhatsApp>
            ) : (
              <button
                type="button"
                onClick={() => navigate(paso.destino, paso.abrir ? { state: { abrir: paso.abrir, from: '/onboarding-v2/home' } } : undefined)}
                className="v2-focus w-full rounded-2xl py-3.5 text-[18px] font-bold transition-transform duration-100 active:scale-[0.99]"
                style={{ background: COLORS.lima, color: COLORS.ink }}
              >
                {paso.cta}
              </button>
            )
          )}
        </div>
      </section>

      {/* Se fue "Tus secciones" (Gastos / Objetivos / Inversiones en tres
          fichas): repetía el menú de abajo, que ya lleva a las mismas tres
          pantallas y está siempre a la vista. */}
      {/* Un gasto fijo que vence en estos días. */}
      <AvisoVencimientoHome />
      <InvitacionAvisos momento="home" gastosRegistrados={gastosRegistrados} />


      <MisVisualizaciones />

      {/* UNA recomendación, como mensaje y debajo de los gráficos: no es una
          tarea ni lo central de la pantalla (DEBT I10). Hace también la llamada
          diaria a la IA que elige el paso de mañana y arma los planes de
          objetivos. */}
      <Recomendaciones />

      {/* Se fueron Tu plata guardada y Mis competencias (DEBT I8 e I9). La
          reserva sólo vivía acá y en el navegador (loadV2Reserva): deja de verse
          hasta decidir si vuelve, y dónde. */}
      <Fila
        icon={<IconPerfil size={18} />}
        label="Completá tu perfil"
        onClick={() => navigate('/onboarding-v2/perfil')}
      />
    </div>
  );
}
