import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { BottomNavV2 } from './BottomNavV2';
import { SidebarV2 } from './SidebarV2';
import { COLOR_VARS, COLORS, FONT_VARS, Cta, Titulo, Apoyo, subirPendientesLocales } from './shared';
import { Fini } from './Fini';
import { useAuth } from '../../lib/auth';
import { AlmacenProvider, useAlmacen } from '../../api/v2/AlmacenProvider';

// REDISEÑO v2 — layout compartido por Home/Gastos/Objetivos/Inversiones.
// RESPONSIVE:
//   - Mobile: pantalla completa + menú abajo (BottomNavV2). El contenido lleva
//     padding-bottom para que la última tarjeta no quede tapada por el botón
//     flotante del chat.
//   - Desktop (lg+): menú LATERAL (SidebarV2) a la izquierda + contenido ancho
//     centrado. Se deja atrás el "marco de teléfono". El menú de abajo se oculta.
// Puerta de entrada a las pantallas de adentro.
//
// Sin sesión no hay nada que mostrar: las policies de Supabase no devuelven ni
// una fila sin `auth.uid()`. Antes estas pantallas se podían abrir sueltas
// porque el estado era todo local; ahora, sin cuenta, lo único honesto es
// mandar a hacer el onboarding.
function Puerta({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const { listo, error, recargar } = useAlmacen();

  // Si el onboarding terminó sin sesión (Supabase pidió confirmar el mail),
  // las respuestas quedaron en la copia local. Se suben la primera vez que
  // entra con su cuenta.
  useEffect(() => { if (listo) subirPendientesLocales(); }, [listo]);

  // Mientras se resuelve la sesión no se decide nada: si redirigiéramos acá,
  // recargar la página con sesión válida te echaría al onboarding.
  if (loading) return <Cargando />;
  if (!session) return <Navigate to="/onboarding-v2" replace />;

  if (error !== null) {
    return (
      <div className="min-h-full grid place-items-center px-6 py-16">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <Fini state="error" size={130} />
          <Titulo>No pudimos traer tus datos</Titulo>
          <Apoyo>{error}</Apoyo>
          <div className="w-full pt-2"><Cta label="Probar de nuevo" onClick={() => void recargar()} /></div>
        </div>
      </div>
    );
  }

  if (!listo) return <Cargando />;
  return <>{children}</>;
}

// Cartel de "esto no se guardó".
//
// Va acá, arriba de todo y en todas las pantallas, y no en cada pantalla por
// separado: una escritura encolada puede fallar después de que la persona ya
// se fue a otra pantalla, y ahí el aviso tiene que seguirla. Se queda hasta
// que la escritura salga bien — no se va solo, porque irse solo es volver a
// dejarle creer que el número que ve está guardado.
function AvisoGuardado() {
  const { guardado, recargar } = useAlmacen();
  if (guardado.tipo !== 'error') return null;
  return (
    <div
      role="alert"
      className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
      style={{ background: COLORS.coralSoft, color: COLORS.coralDark }}
    >
      <span className="text-[14px] font-semibold">
        Algo no se guardó: {guardado.mensaje}
      </span>
      <button
        type="button"
        onClick={() => void recargar()}
        className="v2-focus text-[14px] font-bold underline shrink-0"
      >
        Volver a cargar
      </button>
    </div>
  );
}

// Fini esperando en vez de un spinner: es el único momento de la app donde hay
// que esperar sin poder hacer nada, y el personaje ya existe para eso.
function Cargando() {
  return (
    <div className="min-h-full grid place-items-center px-6 py-16">
      <div className="flex flex-col items-center gap-3">
        <Fini state="pensando" size={120} />
        <p className="text-[16px]" style={{ color: COLORS.inkSoft }}>Trayendo tus datos…</p>
      </div>
    </div>
  );
}

export function V2Layout() {
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Al cambiar de pantalla, volver SIEMPRE al principio. El scroll vive en
  // este contenedor (no en window), así que hay que resetearlo a mano — si no,
  // al entrar a Gastos/Objetivos aparecías a la mitad (posición de la anterior).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return (
    <AlmacenProvider>
    <div
      className="h-screen supports-[height:100dvh]:h-[100dvh] w-full flex flex-col lg:flex-row overflow-hidden"
      style={{ background: COLORS.paper, ...FONT_VARS, ...COLOR_VARS }}
    >
      {/* Menú lateral — solo desktop */}
      <SidebarV2 />

      {/* Contenido — lienzo ancho en desktop. Cada pantalla decide su propio
          layout adentro (Home usa varias columnas; las demás se centran en una
          columna legible con lg:max-w-2xl lg:mx-auto en su propio contenedor). */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <AvisoGuardado />
        {/* El botón de chat sobresale 20px por encima de la barra (-mt-5), así
            que el contenido necesita ese despeje extra o la última fila queda
            tapada por el círculo. */}
        <div className="mx-auto w-full lg:max-w-[1120px] pb-16 lg:pb-12">
          <Puerta><Outlet /></Puerta>
        </div>
      </div>

      {/* Menú de abajo — solo mobile */}
      <div className="lg:hidden shrink-0">
        <BottomNavV2 />
      </div>
    </div>
    </AlmacenProvider>
  );
}
