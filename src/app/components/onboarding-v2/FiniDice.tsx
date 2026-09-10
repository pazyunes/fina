import { Fini, type FiniState } from './Fini';
import { COLORS, FONTS } from './shared';

// Fini con un globo de diálogo, para el ENCABEZADO de una pantalla.
//
// POR QUÉ ARRIBA Y NO ADENTRO DEL CONTENIDO. Antes el personaje era el primer
// elemento del bloque que se centra vertical y scrollea: en una pantalla con
// varias opciones quedaba arriba del scroll y había que subir para verlo. Un
// acompañante al que hay que ir a buscar no acompaña. Acá vive en una franja
// propia, fuera del área que scrollea, así que está siempre.
//
// POR QUÉ UN GLOBO Y NO UN PÁRRAFO GRIS. La línea de apoyo de cada pantalla ya
// existía, pero como texto auxiliar debajo del título. Puesta en un globo, la
// misma frase pasa de "letra chica" a "alguien te está hablando", que es todo
// lo que hace falta para que el flujo no se sienta un formulario.
//
// La pregunta sigue siendo el <h1> de la pantalla. El globo acompaña, no
// reemplaza: un título de 32px en Baloo 2 dentro de un globo, al lado de un
// personaje, en 375px de ancho, no entra sin achicar la tipografía — y la
// tipografía de los títulos es lo único que se conservó del diseño anterior.

export function FiniDice({
  dice,
  state = 'idle',
  size = 88,
}: {
  dice: React.ReactNode;
  state?: FiniState;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-2.5 w-full">
      <div className="shrink-0 -ml-2" style={{ width: size }}>
        <Fini state={state} size={size} />
      </div>
      {/* La punta del globo va del lado del personaje y a la altura de su
          cara: es lo que hace que se lea como que lo dice él. */}
      <div
        className="relative flex-1 min-w-0 rounded-[18px] rounded-bl-sm px-3.5 py-2.5"
        style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}` }}
      >
        <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft, fontFamily: FONTS.body }}>
          {dice}
        </p>
      </div>
    </div>
  );
}

// Variante para los momentos que NO son una pregunta: la bienvenida y el
// cierre. Ahí el personaje es el protagonista y va grande y centrado, con el
// globo arriba — como en la pantalla de llegada.
export function FiniPresenta({
  dice,
  state = 'saludo',
  size = 150,
}: {
  dice: React.ReactNode;
  state?: FiniState;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative rounded-[18px] rounded-br-sm px-4 py-2.5 max-w-[300px]"
        style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}` }}
      >
        <p className="text-[15px] leading-snug text-center" style={{ color: COLORS.inkSoft, fontFamily: FONTS.body }}>
          {dice}
        </p>
      </div>
      <Fini state={state} size={size} />
    </div>
  );
}
