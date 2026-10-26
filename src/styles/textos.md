# FINA: reglas de UX writing y voz

> Leer antes de escribir o cambiar cualquier texto de la app: títulos, botones, descripciones,
> consejos, avisos, lo que genera la IA. Es la regla 13 de `CLAUDE.md`. Donde esta guía y
> `frontend.md` §5.4 digan cosas distintas sobre textos, manda esta.

**Prioridad de producto:** la claridad y la utilidad están por encima de la cantidad de texto, la creatividad y la simpatía. No tenés que escribir algo para cada componente de la interfaz. Tenés que decidir qué merece ser escrito. Si una pantalla funciona mejor sin un subtítulo o una descripción, dejalos afuera. Nunca agregues texto solo para hacer la interfaz más cálida, completa o atractiva.

**Jerarquía de decisiones:**
1. ¿Hace falta texto?
2. Si hace falta, ¿qué necesita entender el usuario?
3. ¿Cuál es la forma más corta de explicarlo con claridad?
4. ¿La información es verdadera según el funcionamiento de FINA?
5. ¿Suena natural en Argentina?

## REGLAS DE UX WRITING Y VOZ DE FINA

Tu objetivo es escribir textos de interfaz claros, naturales y útiles. No busques que cada pantalla suene simpática o tenga una descripción. Buscá que el usuario entienda qué está viendo, qué puede hacer y qué significa para su plata, sin tener que releer.

### 1. Regla principal: menos texto, más claridad

- No agregues subtítulos, descripciones ni explicaciones por defecto.
- Antes de escribir un texto, preguntate: ¿esta información ayuda al usuario a entender algo que todavía no entiende?
- Si el título y el contexto visual ya explican la función, no agregues una descripción.
- Si un texto no aporta información nueva, eliminalo.
- No confundas brevedad con falta de contexto. Si una función puede resultar confusa, explicala en una frase simple y concreta.
- Priorizá que el texto se entienda en una sola lectura.

### 2. Cuándo explicar una función

Agregá una descripción cuando sea necesaria para:
- Explicar para qué sirve una función.
- Aclarar qué debe hacer el usuario.
- Mostrar cómo una acción afecta su dinero disponible, sus objetivos o sus registros.
- Evitar una confusión importante sobre cómo funciona FINA.

Cuando expliques una función, usá esta estructura como referencia:

**Qué puede hacer el usuario + para qué le sirve.**

Por ejemplo:

Título: Gastos planificados.

Descripción: Anotá los gastos que sabés que vas a tener, como una cuota, un regalo o una consulta. Así podés organizarte con tiempo y tener en cuenta esa plata antes de gastarla en otra cosa.

No uses esta estructura mecánicamente. Si el título ya explica la función o el beneficio es evidente, no agregues una descripción.

### 3. Voz y tono

FINA habla en español rioplatense, con voseo natural. Es cercana, clara y respetuosa, pero no intenta ser graciosa o simpática en cada frase.

- Usá expresiones naturales de Argentina: anotá, elegí, ahorrá, tenés, podés.
- Mantené un tono adulto, humano y directo.
- Evitá el lenguaje corporativo, excesivamente formal o artificial.
- No fuerces expresiones coloquiales para darle personalidad a cada texto.
- No infantilices al usuario ni lo trates como si necesitara que le expliquen todo.
- No juzgues sus gastos ni generes culpa.

### 4. Evitá estos patrones

No escribas textos que:
- Repitan el título con otras palabras.
- Expliquen algo que ya resulta evidente por el diseño.
- Agreguen frases de relleno para que la pantalla parezca más completa.
- Usen expresiones vagas como «un poco menos», «formas de llegar antes» o «¿qué se viene?» cuando se puede decir algo más concreto.
- Incluyan introducciones innecesarias como «Un consejo», «Tip» o «Recordá que» si no aportan valor.
- Prometan resultados o plazos sin fundamento.
- Utilicen frases artificiales, ambiguas o que suenen traducidas o generadas automáticamente.
- Incluyan preguntas retóricas solo para hacer más atractivo un título.
- Repitan una misma idea en el título, el subtítulo y el botón.

### 5. Claridad antes que creatividad

Preferí:
- «La fecha ya pasó» antes que «La fecha que le pusiste ya pasó».
- «Elegí una nueva fecha» antes que «Si querés, le ponés una nueva».
- «Ahorrá para la patente» antes que «Sumale a La patente», salvo que esta última expresión tenga un significado claro y consistente dentro del producto.
- «Ingresos y gastos» antes que una variante más larga que no agregue información.
- «Anotá los gastos que se vienen» antes que una descripción genérica sobre planificación.

Estos ejemplos son referencias, no textos obligatorios. Elegí siempre la alternativa que mejor explique la función real.

### 6. No inventes información

No inventes ni des por supuestos:
- Cómo se calcula el dinero disponible.
- Si un gasto planificado ya está descontado del saldo.
- Cuánto puede ahorrar una persona o cuánto tardará en alcanzar un objetivo.
- Qué significan los importes, porcentajes o indicadores si no conocés su cálculo.

Si el funcionamiento no está claro, verificá la lógica existente antes de escribir. Si no podés verificarla, no afirmes nada que dependa de esa información.

### 7. Consistencia en todo el producto

Usá siempre la misma palabra para un mismo concepto. No alternes sin motivo entre «plata disponible», «te queda», «saldo» y «dinero disponible».

Mantené una terminología consistente para:
- Ingresos.
- Gastos.
- Dinero disponible.
- Gastos planificados.
- Objetivos de ahorro.
- Categorías de gastos.

Los botones deben describir acciones concretas. Los títulos deben identificar la sección. Las descripciones deben aportar contexto, no repetir el título.

### 8. Revisión obligatoria antes de entregar textos

Antes de dar por terminado cualquier texto de FINA, revisá cada frase y preguntate:

1. ¿Se entiende en una sola lectura?
2. ¿Aporta información nueva?
3. ¿Es necesaria para usar la función?
4. ¿Repite algo que ya aparece en pantalla?
5. ¿Suena natural para una persona de Argentina?
6. ¿Estoy afirmando algo sobre el dinero o el funcionamiento de la app que no verifiqué?
7. ¿Puedo eliminar palabras sin perder claridad?

Si una frase no aporta valor, eliminála. Si resulta ambigua, reescribila. Si necesita contexto para entenderse, agregá solo el contexto necesario.

**Regla final:** no agregues texto para llenar espacio ni para demostrar que entendiste la función. Escribí lo mínimo necesario para que el usuario la entienda y pueda usarla con confianza.
