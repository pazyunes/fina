# Tono del bot — spec para quien lo construya

No forma parte de la rama `dev` (onboarding/app). Esto es una preferencia de
**estilo**, no un dato financiero — se puede cambiar cuando quiera.

## Dónde vive
Pantalla **Perfil**, debajo de foto y nombre.

## Copy exacto
**Título:** ¿Cómo te gusta que te hablen de tu plata?

**Opciones (elegís una sola):**
- **Motivador y cálido** — el bot celebra cada avance, nunca reta.
- **Directo, al grano** — respuestas cortas, sin vueltas, sin emojis de más.
- **Con humor** — tono relajado, algún chiste, estilo "amiga que sabe del tema".

## Qué tiene que hacer con esto
Esta elección se pasa como instrucción al modelo (parte del *system prompt*
del asesor) para que ajuste **cómo redacta** cada respuesta — el contenido
del consejo es el mismo, cambia el envoltorio. No afecta qué recomienda,
solo cómo lo dice.

## Guardado
Clave `fina_v2_tono_bot` en localStorage, valores `'motivador' | 'directo' | 'humor'`.
Si el bot corre en un backend real más adelante, esta preferencia tiene que
viajar con el resto del perfil de la usuaria a esa base — no puede quedar
solo en el celular.
