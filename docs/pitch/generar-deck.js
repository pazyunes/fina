// Pitch deck de FINA — borrador editable (.pptx)
const pptxgen = require('pptxgenjs');

const A = '/Users/mariapazyunes/Documents/GitHub/fina1/Fina';
const S = '/private/tmp/claude-501/-Users-mariapazyunes-Documents-GitHub-fina1/73a39020-d12a-4d49-8078-c2d45b61291f/scratchpad/video';
const SALIDA = `${A}/docs/pitch/FINA-pitch.pptx`;

// Paleta de FINA
const INK = '2B2118';      // tinta — fondo oscuro
const PAPEL = 'FAF7F2';    // papel — fondo claro
const BRAND = '7626B3';    // violeta de marca
const LILA = 'E4D5F5';
const LIMA = 'B0E150';
const STAR = 'FFC457';
const BLANCO = 'FFFFFF';
const CLARO = 'EDE5D9';    // texto sobre tinta
const TENUE = 'A2937E';    // texto secundario sobre tinta
const INKSOFT = '6B5B48';  // texto secundario sobre papel

const TITULO = 'Arial';
const CUERPO = 'Arial';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.author = 'FINA';
pres.title = 'FINA — Pitch';

const W = 13.333;
const H = 7.5;

function slide(fondo) {
  const s = pres.addSlide();
  s.background = { color: fondo };
  return s;
}

/** Estrellita de marca, el motivo que se repite arriba a la izquierda. */
function marca(s, claro) {
  s.addImage({ path: `${A}/docs/marca/estrella-transparente.png`, x: 0.6, y: 0.42, w: 0.48, h: 0.4 });
  s.addText('FINA', {
    x: 1.12, y: 0.45, w: 2, h: 0.42, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 14, bold: true, color: claro ? INK : CLARO, valign: 'middle', charSpacing: 2,
  });
}

function etiqueta(s, texto, claro, y = 1.5) {
  s.addText(texto.toUpperCase(), {
    x: 0.9, y, w: 8, h: 0.3, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 13, bold: true, charSpacing: 3,
    color: claro ? BRAND : STAR,
  });
}

// ── 1. Portada ───────────────────────────────────────────────────────────
{
  const s = slide(INK);
  s.addImage({ path: `${A}/public/marca/fina-logo-blanco.png`, x: 4.93, y: 1.85, w: 3.47, h: 1.4 });
  s.addText('Tu plata empieza a trabajar para vos.', {
    x: 1.5, y: 3.5, w: 10.33, h: 0.7, isTextBox: true, align: 'center',
    fontFace: TITULO, fontSize: 30, bold: true, color: BLANCO,
  });
  s.addText('La primera app que te enseña a manejar tu plata practicando con la tuya.', {
    x: 1.5, y: 4.25, w: 10.33, h: 0.5, isTextBox: true, align: 'center',
    fontFace: CUERPO, fontSize: 17, color: TENUE,
  });
  s.addText('somosfina.com.ar', {
    x: 1.5, y: 6.3, w: 10.33, h: 0.4, isTextBox: true, align: 'center',
    fontFace: CUERPO, fontSize: 14, bold: true, color: STAR, charSpacing: 2,
  });
  s.addNotes('Apertura. Presentarse y arrancar con la historia: “Estoy segura de que conocen a alguien que cobró su primer sueldo y no supo bien qué hacer con él”.');
}

// ── 2. Gancho ────────────────────────────────────────────────────────────
{
  const s = slide(INK);
  marca(s, false);
  s.addText('Conocés a alguien\nque cobró su primer sueldo\ny no supo qué hacer con él.', {
    x: 0.9, y: 1.6, w: 8.2, h: 2.6, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 40, bold: true, color: BLANCO, lineSpacing: 46,
  });
  const casos = [
    'Ahorró meses para un viaje y la gastó antes de llegar.',
    'Le va bien, pero no sabe en qué se le va la plata.',
    'Quiere invertir y no sabe por dónde empezar.',
  ];
  casos.forEach((t, i) => {
    const y = 4.5 + i * 0.72;
    s.addShape(pres.ShapeType.ellipse, { x: 0.92, y: y + 0.13, w: 0.16, h: 0.16, fill: { color: STAR } });
    s.addText(t, {
      x: 1.35, y, w: 7.6, h: 0.45, isTextBox: true, margin: 0,
      fontFace: CUERPO, fontSize: 17, color: CLARO, valign: 'middle',
    });
  });
  s.addImage({ path: `${A}/public/marca/fini.png`, x: 9.7, y: 3.1, w: 2.6, h: 2.6 });
  s.addNotes('A nadie le gusta admitir que no sabe por dónde empezar. No son casos aislados: nos pasa a nosotras y le pasa a la mayoría.');
}

// ── 3. Los números de la apertura ────────────────────────────────────────
{
  const s = slide(INK);
  marca(s, false);
  etiqueta(s, 'El punto de partida', false);
  s.addText('Manejan plata sin que nadie\nles haya enseñado cómo.', {
    x: 0.9, y: 1.95, w: 11.5, h: 1.3, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 32, bold: true, color: BLANCO, lineSpacing: 38,
  });
  const datos = [
    { n: '8 de cada 10', t: 'jóvenes en Argentina ya manejan su propia plata', c: LIMA },
    { n: '2 de cada 10', t: 'recibieron alguna vez educación financiera formal', c: STAR },
  ];
  datos.forEach((d, i) => {
    const x = 0.9 + i * 6.1;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 3.7, w: 5.5, h: 2.5, rectRadius: 0.2,
      fill: { color: '3A2E22' },
    });
    s.addText(d.n, {
      x: x + 0.5, y: 4.05, w: 4.5, h: 1, isTextBox: true, margin: 0,
      fontFace: TITULO, fontSize: 40, bold: true, color: d.c,
    });
    s.addText(d.t, {
      x: x + 0.5, y: 5.1, w: 4.6, h: 0.9, isTextBox: true, margin: 0,
      fontFace: CUERPO, fontSize: 16, color: CLARO,
    });
  });
  s.addNotes('Hoy 8 de cada 10 jóvenes en Argentina manejan su propia plata, pero solo 2 de cada 10 recibieron alguna vez educación financiera formal.');
}

// ── 4. Problema ──────────────────────────────────────────────────────────
{
  const s = slide(INK);
  marca(s, false);
  etiqueta(s, 'El problema', false);
  s.addText('La intención está.\nEl hábito no.', {
    x: 0.9, y: 1.95, w: 11.5, h: 1.3, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 32, bold: true, color: BLANCO, lineSpacing: 38,
  });
  const stats = [
    { n: '53%', t: 'de los jóvenes logra ahorrar', c: LIMA },
    { n: '15%', t: 'invierte', c: STAR },
    { n: '61%', t: 'declara ansiedad financiera (18 a 35 años)', c: LILA },
  ];
  stats.forEach((d, i) => {
    const x = 0.9 + i * 4.05;
    s.addText(d.n, {
      x, y: 3.7, w: 3.6, h: 1.2, isTextBox: true, margin: 0,
      fontFace: TITULO, fontSize: 60, bold: true, color: d.c,
    });
    s.addText(d.t, {
      x, y: 5.0, w: 3.6, h: 1, isTextBox: true, margin: 0,
      fontFace: CUERPO, fontSize: 16, color: CLARO,
    });
  });
  s.addText('Hablar de plata sigue siendo tabú.', {
    x: 0.9, y: 6.4, w: 11.5, h: 0.4, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 16, italic: true, color: TENUE,
  });
  s.addNotes('Esto se arrastra hace años y ya lo normalizamos. La intención está, pero pocos lo sostienen. Y a todos nos atraviesa: adolescentes que empiezan y adultos que ya laburan hace tiempo.');
}

// ── 5. El problema nuevo ─────────────────────────────────────────────────
{
  const s = slide(INK);
  marca(s, false);
  etiqueta(s, 'Y crece uno nuevo', false);
  s.addText('9 de cada 10', {
    x: 0.9, y: 2.2, w: 6.4, h: 1.4, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 62, bold: true, color: STAR,
  });
  s.addText('jóvenes que tomaron un crédito se endeudaron antes de conseguir su primer empleo formal.', {
    x: 0.95, y: 3.9, w: 6.1, h: 1.5, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 20, color: CLARO, lineSpacing: 28,
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: 7.8, y: 2.0, w: 4.6, h: 3.6, rectRadius: 0.2, fill: { color: '3A2E22' },
  });
  s.addText('Endeudamiento juvenil temprano', {
    x: 8.2, y: 2.4, w: 3.8, h: 0.9, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 20, bold: true, color: BLANCO,
  });
  s.addText('Primero la deuda, después el primer sueldo. Se arranca la vida financiera en rojo, sin haber aprendido nada antes.', {
    x: 8.2, y: 3.4, w: 3.8, h: 1.8, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 15, color: CLARO, lineSpacing: 22,
  });
  s.addNotes('El endeudamiento juvenil temprano: 9 de cada 10 jóvenes que tomaron un crédito se endeudaron antes de conseguir su primer empleo formal.');
}

// ── 6. Oportunidad ───────────────────────────────────────────────────────
{
  const s = slide(INK);
  marca(s, false);
  etiqueta(s, 'La oportunidad', false);
  s.addText('No es un problema de acceso.\nEs un problema de traducción.', {
    x: 0.9, y: 1.95, w: 11.5, h: 1.3, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 32, bold: true, color: BLANCO, lineSpacing: 38,
  });
  s.addText('+15,3%', {
    x: 0.9, y: 3.6, w: 4, h: 1.1, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 52, bold: true, color: LIMA,
  });
  s.addText('crece por año el ecosistema fintech local. La infraestructura ya está.', {
    x: 0.9, y: 4.8, w: 4.3, h: 1.2, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 16, color: CLARO, lineSpacing: 24,
  });
  s.addText('Pero las apps que enseñan a manejar plata:', {
    x: 5.9, y: 3.6, w: 6.5, h: 0.4, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 16, bold: true, color: TENUE,
  });
  const gaps = ['Están en inglés.', 'Asumen que ya sabés.', 'No conectan la teoría con tu situación real.'];
  gaps.forEach((t, i) => {
    const y = 4.2 + i * 0.7;
    s.addShape(pres.ShapeType.ellipse, { x: 5.92, y: y + 0.14, w: 0.16, h: 0.16, fill: { color: STAR } });
    s.addText(t, {
      x: 6.35, y, w: 6, h: 0.45, isTextBox: true, margin: 0,
      fontFace: CUERPO, fontSize: 17, color: CLARO, valign: 'middle',
    });
  });
  s.addText('Ese es el gap que vimos y vivimos.', {
    x: 5.9, y: 6.4, w: 6.5, h: 0.4, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 16, italic: true, color: TENUE,
  });
  s.addNotes('El ecosistema fintech local crece 15,3% anual. La infraestructura está, pero las apps lo hacen en inglés, asumen que ya sabés o no conectan con tu situación real.');
}

// ── 7. Solución ──────────────────────────────────────────────────────────
{
  const s = slide(PAPEL);
  marca(s, true);
  etiqueta(s, 'La solución', true);
  s.addText('FINA te acompaña\ncon tu plata de verdad.', {
    x: 0.9, y: 1.95, w: 7, h: 1.4, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 32, bold: true, color: INK, lineSpacing: 38,
  });
  s.addText('Registrás lo que entra y lo que sale, ponés objetivos y FINA te devuelve un paso chiquito por día. Se aprende practicando, con tus números.', {
    x: 0.9, y: 3.4, w: 6.6, h: 1.2, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 17, color: INKSOFT, lineSpacing: 26,
  });
  const pilares = [
    { t: 'Registrás', d: 'Gastos e ingresos, en la app o hablándole a Fini por WhatsApp.' },
    { t: 'Entendés', d: 'En qué se te va, cuánto te queda y qué podés cambiar.' },
    { t: 'Lográs', d: 'Objetivos con un plan semanal y un paso por día.' },
  ];
  pilares.forEach((p, i) => {
    const y = 4.75 + i * 0.85;
    s.addShape(pres.ShapeType.ellipse, { x: 0.9, y, w: 0.5, h: 0.5, fill: { color: BRAND } });
    s.addText(String(i + 1), {
      x: 0.9, y, w: 0.5, h: 0.5, isTextBox: true, margin: 0, align: 'center', valign: 'middle',
      fontFace: TITULO, fontSize: 18, bold: true, color: BLANCO,
    });
    s.addText([
      { text: `${p.t}. `, options: { bold: true, color: INK } },
      { text: p.d, options: { color: INKSOFT } },
    ], {
      x: 1.6, y, w: 6.2, h: 0.5, isTextBox: true, margin: 0, valign: 'middle',
      fontFace: CUERPO, fontSize: 15,
    });
  });
  s.addImage({ path: `${S}/app-onboarding.png`, x: 9.15, y: 1.0, w: 2.9, h: 5.8 });
  s.addNotes('Creamos FINA: una web app donde, a partir de registrar gastos e ingresos y fijar objetivos, te acompaña, te guía y te aconseja. Genera el hábito de acciones chiquitas todos los días.');
}

// ── 8. Fini por WhatsApp ─────────────────────────────────────────────────
{
  const s = slide(PAPEL);
  marca(s, true);
  etiqueta(s, 'El registro no puede ser tedioso', true);
  s.addText('Se lo contás a Fini\ncomo se lo contarías a una amiga.', {
    x: 0.9, y: 1.95, w: 6.8, h: 1.4, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 30, bold: true, color: INK, lineSpacing: 36,
  });
  s.addText('Fini es nuestro bot de WhatsApp: le escribís el gasto o el ingreso con tus palabras y queda registrado en la app en el momento. También te da un resumen cuando se lo pedís.', {
    x: 0.9, y: 3.5, w: 6.6, h: 1.5, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 17, color: INKSOFT, lineSpacing: 26,
  });
  s.addImage({ path: `${A}/public/marca/fini.png`, x: 0.9, y: 5.1, w: 1.5, h: 1.5 });
  s.addText('Sin abrir la app,\nsin planillas, sin categorías.', {
    x: 2.6, y: 5.35, w: 4.8, h: 1, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 16, italic: true, color: INKSOFT, valign: 'middle', lineSpacing: 24,
  });

  // Mock de chat
  s.addShape(pres.ShapeType.roundRect, { x: 8.3, y: 1.1, w: 4.1, h: 5.6, rectRadius: 0.3, fill: { color: 'FFFFFF' }, line: { color: 'D6CBB8', width: 1 } });
  const burbujas = [
    { txt: 'gasté 8.500 en el súper', mia: true },
    { txt: '¡Anotado! $8.500 en Supermercado, con Mercado Pago. 💜', mia: false },
    { txt: '¿cuánto llevo este mes?', mia: true },
    { txt: 'Van $112.300 este mes. El mes pasado, a esta altura, ibas $128.000.', mia: false },
  ];
  let y = 1.5;
  burbujas.forEach((b) => {
    const alto = b.txt.length > 45 ? 1.05 : b.txt.length > 25 ? 0.75 : 0.5;
    const ancho = b.txt.length > 25 ? 3.3 : 2.4;
    const x = b.mia ? 12.1 - ancho : 8.55;
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: ancho, h: alto, rectRadius: 0.15,
      fill: { color: b.mia ? LIMA : 'F1EBDF' },
    });
    s.addText(b.txt, {
      x: x + 0.15, y: y + 0.08, w: ancho - 0.3, h: alto - 0.16, isTextBox: true, margin: 0,
      fontFace: CUERPO, fontSize: 12, color: INK, valign: 'middle',
    });
    y += alto + 0.35;
  });
  s.addNotes('Como sabemos que anotar todo es tedioso, está Fini: nuestro bot de WhatsApp al que le pedís un informe o le decís el gasto con tus palabras, y lo registra en la app en tiempo real.');
}

// ── 9. Diferencial ───────────────────────────────────────────────────────
{
  const s = slide(INK);
  marca(s, false);
  etiqueta(s, 'Por qué nosotras', false);
  s.addText('La herramienta se adapta a vos,\nno al revés.', {
    x: 0.9, y: 1.95, w: 11.5, h: 1.3, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 32, bold: true, color: BLANCO, lineSpacing: 38,
  });
  const cols = [
    { t: 'Nunca movemos tu plata', d: 'Registrar, invertir o lograr un objetivo: la decisión siempre es tuya.' },
    { t: 'Aprendés practicando', d: 'Con tus números, a tu ritmo, sin cursos ni teoría suelta.' },
    { t: 'Simplificamos al extremo', d: 'Detectamos tu mayor oportunidad de mejora y te damos un solo paso por día.' },
  ];
  cols.forEach((c, i) => {
    const x = 0.9 + i * 4.05;
    s.addShape(pres.ShapeType.roundRect, { x, y: 3.6, w: 3.6, h: 2.7, rectRadius: 0.2, fill: { color: '3A2E22' } });
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.4, y: 3.95, w: 0.35, h: 0.35, fill: { color: BRAND } });
    s.addText(c.t, {
      x: x + 0.4, y: 4.45, w: 2.9, h: 0.8, isTextBox: true, margin: 0,
      fontFace: TITULO, fontSize: 18, bold: true, color: BLANCO,
    });
    s.addText(c.d, {
      x: x + 0.4, y: 5.25, w: 2.9, h: 1, isTextBox: true, margin: 0,
      fontFace: CUERPO, fontSize: 14, color: CLARO, lineSpacing: 20,
    });
  });
  s.addText('Se terminó el Excel. Se terminó explicarle tu contexto a una IA para llegar a lo que querés.', {
    x: 0.9, y: 6.55, w: 11.5, h: 0.4, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 16, italic: true, color: TENUE,
  });
  s.addNotes('A diferencia de otras apps, con FINA aprendés desde la práctica y nunca movemos tu plata. Somos la primera app que trabaja sobre tus preferencias y tu conocimiento, detectando tu mayor oportunidad de mejora.');
}

// ── 10. MVP y validación ─────────────────────────────────────────────────
{
  const s = slide(INK);
  marca(s, false);
  etiqueta(s, 'MVP y validación', false);
  s.addText('Ya está en la calle.', {
    x: 0.9, y: 1.95, w: 7, h: 0.9, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 32, bold: true, color: BLANCO,
  });
  s.addText('casi 200', {
    x: 0.9, y: 3.0, w: 4, h: 1.1, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 52, bold: true, color: LIMA,
  });
  s.addText('usuarias y usuarios ya la probaron', {
    x: 0.95, y: 4.1, w: 4, h: 0.5, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 16, color: CLARO,
  });
  const hitos = [
    'Encuestas y entrevistas con usuarias reales',
    'Presentamos en el Club de Finanzas de Di Tella',
    'Seleccionadas en un taller de Finnegans',
    'Iteramos con lo que nos devuelve cada semana',
  ];
  hitos.forEach((t, i) => {
    const y = 3.05 + i * 0.75;
    s.addShape(pres.ShapeType.ellipse, { x: 5.32, y: y + 0.14, w: 0.16, h: 0.16, fill: { color: STAR } });
    s.addText(t, {
      x: 5.75, y, w: 4.2, h: 0.5, isTextBox: true, margin: 0,
      fontFace: CUERPO, fontSize: 15, color: CLARO, valign: 'middle',
    });
  });
  s.addShape(pres.ShapeType.roundRect, { x: 10.2, y: 2.6, w: 2.3, h: 2.9, rectRadius: 0.2, fill: { color: BLANCO } });
  s.addImage({ path: `${A}/docs/marca/qr-somosfina.png`, x: 10.4, y: 2.8, w: 1.9, h: 1.9 });
  s.addText('Probala ahora', {
    x: 10.2, y: 4.8, w: 2.3, h: 0.4, isTextBox: true, margin: 0, align: 'center',
    fontFace: CUERPO, fontSize: 14, bold: true, color: INK,
  });
  s.addNotes('La problemática y la idea ya están validadas. Estamos en fase de MVP y prueba de concepto: casi 200 usuarios, encuestas, entrevistas, el club de finanzas de Di Tella y un taller de Finnegans.');
}

// ── 11. Modelo de negocio ────────────────────────────────────────────────
{
  const s = slide(PAPEL);
  marca(s, true);
  etiqueta(s, 'Modelo de negocio', true);
  s.addText('Gratis para vos.\nLo pagan las empresas.', {
    x: 0.9, y: 1.95, w: 11.5, h: 1.3, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 32, bold: true, color: INK, lineSpacing: 38,
  });
  s.addText('B2B2C: gimnasios, gastronomía y beauty pagan por aparecer recomendados dentro de la app, más un porcentaje por conversión.', {
    x: 0.9, y: 3.35, w: 8.5, h: 0.9, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 17, color: INKSOFT, lineSpacing: 26,
  });
  const cajas = [
    { t: 'La usuaria', d: 'Usa FINA gratis y encuentra descuentos elegidos según lo que ya gasta.', c: LIMA },
    { t: 'FINA', d: 'Conecta a las dos partes con los datos que la usuaria decide compartir.', c: BRAND },
    { t: 'La empresa', d: 'Paga por aparecer y por cada cliente nuevo que llega.', c: STAR },
  ];
  cajas.forEach((c, i) => {
    const x = 0.9 + i * 4.05;
    s.addShape(pres.ShapeType.roundRect, { x, y: 4.5, w: 3.6, h: 2.1, rectRadius: 0.2, fill: { color: 'FFFFFF' }, line: { color: 'D6CBB8', width: 1 } });
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.35, y: 4.8, w: 0.3, h: 0.3, fill: { color: c.c } });
    s.addText(c.t, {
      x: x + 0.8, y: 4.78, w: 2.6, h: 0.35, isTextBox: true, margin: 0, valign: 'middle',
      fontFace: TITULO, fontSize: 17, bold: true, color: INK,
    });
    s.addText(c.d, {
      x: x + 0.35, y: 5.3, w: 2.9, h: 1.1, isTextBox: true, margin: 0,
      fontFace: CUERPO, fontSize: 14, color: INKSOFT, lineSpacing: 20,
    });
    if (i < 2) {
      s.addText('→', {
        x: x + 3.6, y: 5.2, w: 0.45, h: 0.5, isTextBox: true, margin: 0, align: 'center',
        fontFace: CUERPO, fontSize: 22, bold: true, color: BRAND,
      });
    }
  });
  s.addNotes('El usuario tiene acceso gratuito: no somos un gasto más. Monetizamos B2B2C. Estamos definiendo a qué perfil quiere llegar cada empresa, y somos el canal.');
}

// ── 12. Financials ───────────────────────────────────────────────────────
{
  const s = slide(INK);
  marca(s, false);
  etiqueta(s, 'Financials', false);
  s.addText('Levantamos una ronda pre-seed\nde USD 120.000.', {
    x: 0.9, y: 1.95, w: 11.5, h: 1.3, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 32, bold: true, color: BLANCO, lineSpacing: 38,
  });
  const cifras = [
    { n: '4 M', t: 'usuarios activos proyectados al año 8', c: LIMA },
    { n: '240 mil', t: 'empresas alcanzables en Argentina', c: STAR },
    { n: 'USD 284 M', t: 'terminal value estimado', c: LILA },
    { n: '12x', t: 'MOIC proyectado', c: BLANCO },
  ];
  cifras.forEach((d, i) => {
    const x = 0.9 + i * 3.0;
    s.addText(d.n, {
      x, y: 3.7, w: 2.8, h: 0.9, isTextBox: true, margin: 0,
      fontFace: TITULO, fontSize: 36, bold: true, color: d.c,
    });
    s.addText(d.t, {
      x, y: 4.7, w: 2.7, h: 1.1, isTextBox: true, margin: 0,
      fontFace: CUERPO, fontSize: 15, color: CLARO, lineSpacing: 21,
    });
  });
  s.addText('Argentina primero, después LATAM.', {
    x: 0.9, y: 6.3, w: 11.5, h: 0.4, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 16, italic: true, color: TENUE,
  });
  s.addNotes('Hoy estamos levantando nuestra ronda pre-seed de USD 120 mil. Para el año 8 proyectamos casi 4 millones de usuarios activos y 240.000 empresas interesadas en Argentina, con expansión a LATAM: terminal value de 284 millones y MOIC de 12.');
}

// ── 13. Impacto ──────────────────────────────────────────────────────────
{
  const s = slide(BRAND);
  s.addText('Esto no es sólo una app.', {
    x: 1.2, y: 2.2, w: 10.9, h: 0.8, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 22, color: LILA,
  });
  s.addText('Es previsibilidad, confianza\ny acompañamiento para dejar\nde posponer tu plata.', {
    x: 1.2, y: 3.0, w: 10.9, h: 2.2, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 38, bold: true, color: BLANCO, lineSpacing: 46,
  });
  s.addText('La respuesta a la ansiedad financiera y a la vergüenza por no saber.', {
    x: 1.2, y: 5.4, w: 10.9, h: 0.5, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 18, color: LILA,
  });
  s.addNotes('Es la solución a la ansiedad financiera, a la vergüenza por no saber. Es generar un hábito para dejar de posponer ocuparse de la plata.');
}

// ── 14. Cierre ───────────────────────────────────────────────────────────
{
  const s = slide(INK);
  s.addImage({ path: `${A}/public/marca/fina-logo-blanco.png`, x: 0.9, y: 1.5, w: 2.6, h: 1.05 });
  s.addText('Sea mujer o varón, tenga 16, 30 o 50:\ncon FINA tu plata empieza a trabajar para vos.', {
    x: 0.9, y: 3.0, w: 7.6, h: 2, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 30, bold: true, color: BLANCO, lineSpacing: 40,
  });
  s.addText('La que cobrás, la que ahorrás y la que todavía no sabés cómo hacer crecer.', {
    x: 0.9, y: 5.05, w: 7.4, h: 0.65, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 17, color: TENUE,
  });
  s.addText('somosfina.com.ar', {
    x: 0.9, y: 5.9, w: 7.4, h: 0.5, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 18, bold: true, color: STAR, charSpacing: 2,
  });
  s.addShape(pres.ShapeType.roundRect, { x: 9.2, y: 1.9, w: 3.2, h: 3.8, rectRadius: 0.2, fill: { color: BLANCO } });
  s.addImage({ path: `${A}/docs/marca/qr-somosfina.png`, x: 9.5, y: 2.2, w: 2.6, h: 2.6 });
  s.addText('Escaneá y probá FINA', {
    x: 9.2, y: 4.95, w: 3.2, h: 0.4, isTextBox: true, margin: 0, align: 'center',
    fontFace: CUERPO, fontSize: 14, bold: true, color: INK,
  });
  s.addNotes('Cierre. FINA es la solución para esa persona que cobró su primer sueldo y no supo qué hacer con él, que ahorró meses sin poder sostenerlo o que le va bien pero no entiende en qué se le va la plata.');
}

pres.writeFile({ fileName: SALIDA }).then(() => console.log('escrito:', SALIDA));
