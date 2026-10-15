import { COLORS, FONTS } from './shared';
import { CONTACTO_DATOS } from '../../lib/legales';

// Términos y condiciones + política de privacidad de FINA (Ley 25.326).
//
// Escrito sobre lo que la app hace HOY — si se agrega algo que toque datos o
// cambia cómo se usan, se actualiza acá y se sube TERMINOS_VIGENTES_DESDE en
// lib/legales.ts para que todas las personas lo vuelvan a aceptar.
//
// Lenguaje simple a propósito: un consentimiento sólo es "informado" (art. 5)
// si se entiende. Cada bloque arranca con "En simple" y después viene el
// detalle.

function Bloque({ id, titulo, children }: { id?: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-2 scroll-mt-4">
      <h3 className="text-[15px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{titulo}</h3>
      <div className="flex flex-col gap-2 text-[14px] leading-relaxed" style={{ color: COLORS.ink }}>{children}</div>
    </section>
  );
}

function EnSimple({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl px-4 py-3.5" style={{ background: COLORS.brandSoft }}>
      <p className="text-[14px] font-bold mb-1" style={{ color: COLORS.brandDark }}>En simple</p>
      <p className="text-[14px] leading-snug" style={{ color: COLORS.brandDark }}>{children}</p>
    </div>
  );
}

function Lista({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5 list-disc pl-5">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

export function TextoLegal() {
  const mail = <a href={`mailto:${CONTACTO_DATOS}`} className="underline font-semibold">{CONTACTO_DATOS}</a>;
  return (
    <div className="flex flex-col gap-8">
      {/* ───────────── TÉRMINOS ───────────── */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-[19px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>Términos y condiciones</h2>
          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>En vigencia desde el 15 de octubre de 2026.</p>
        </div>

        <EnSimple>
          FINA te ayuda a ver tu plata. No la mueve, no la administra y no te da asesoramiento financiero: vos decidís qué cargás y qué hacés con lo que ves.
        </EnSimple>

        <Bloque titulo="1. Qué es FINA">
          <p>
            FINA es una app de finanzas personales para ordenar y entender tus gastos, tus ingresos, tus objetivos y tus
            inversiones, con avisos, recomendaciones y un bot de WhatsApp. La ofrece el equipo de FINA (“nosotras”). Podés
            escribirnos a {mail}.
          </p>
        </Bloque>

        <Bloque titulo="2. Quién puede usarla">
          <Lista items={[
            'Tenés que tener 16 años o más. Si sos menor de 18, usala con el acompañamiento de una persona adulta responsable.',
            'Una cuenta es de una sola persona. Los datos que cargues tienen que ser tuyos y verdaderos.',
            'Cuidá tu mail, tu contraseña y tu PIN: lo que se haga con tu cuenta lo hacemos pasar por tuyo.',
          ]} />
        </Bloque>

        <Bloque titulo="3. Qué hace FINA y qué no">
          <p>FINA muestra y ordena lo que vos cargás en la app o le contás al bot. Por eso:</p>
          <Lista items={[
            'No se conecta a tus bancos ni a tus billeteras, y nunca te pedimos claves bancarias, CBU ni datos de tarjetas.',
            'No mueve tu plata, no paga por vos y no compra ni vende inversiones.',
            'Los saldos, totales y topes son lo que registraste: pueden no coincidir con tu plata real si falta cargar algo.',
            'Los valores en dólares usan una cotización de referencia (dólar blue) congelada al día del movimiento. Es orientativa.',
          ]} />
        </Bloque>

        <Bloque titulo="4. Recomendaciones: no son asesoramiento">
          <p>
            Las recomendaciones, pasos del día y sugerencias de FINA son informativas y educativas, y se arman con lo que
            cargaste y respondiste. <strong>No son asesoramiento financiero, de inversión, impositivo ni legal</strong>, y FINA
            no es una asesora de inversión registrada.
          </p>
          <p>
            Invertir tiene riesgo: el valor puede subir o bajar, y un rendimiento pasado no garantiza uno futuro. Las
            decisiones sobre tu plata son siempre tuyas.
          </p>
        </Bloque>

        <Bloque titulo="5. El bot de WhatsApp">
          <Lista items={[
            'Es opcional. Para vincularlo verificás tu teléfono con un código de un solo uso que vence a los 15 minutos.',
            'Los mensajes que le mandás los procesan WhatsApp (Meta) y los proveedores que usamos para que el bot entienda tu gasto o ingreso.',
            'No le mandes claves, números de tarjeta ni datos que no quieras compartir. Para registrar un gasto alcanza con el monto y de qué fue.',
          ]} />
        </Bloque>

        <Bloque titulo="6. PIN y Face ID / Touch ID">
          <p>
            Son opcionales y se guardan solo en tu dispositivo (el PIN, cifrado de forma irreversible). Nosotras no podemos
            ver ni recuperar tu PIN: si lo olvidás, cerrás sesión y volvés a entrar con tu mail y contraseña.
          </p>
        </Bloque>

        <Bloque titulo="7. Tus datos son tuyos">
          <p>
            Lo que cargás en FINA te pertenece. Nos das permiso para usarlo únicamente para que la app funcione y para darte
            sugerencias a vos. No vendemos tus datos. El detalle está en la Política de privacidad, más abajo.
          </p>
        </Bloque>

        <Bloque titulo="8. Grupos y competencias">
          <p>
            Si armás o te sumás a un grupo, sus miembros ven tu nombre de pila, tu participación en la competencia (cuánto
            registrás, nunca cuánto gastás) y lo que cargues como gasto en conjunto. Lo demás sigue siendo solo tuyo. Podés
            salir del grupo cuando quieras.
          </p>
        </Bloque>

        <Bloque titulo="9. Uso adecuado">
          <Lista items={[
            'No uses FINA para nada ilegal.',
            'No intentes entrar a datos de otras personas, ni vulnerar la seguridad de la app, ni usarla de forma automática o abusiva.',
            'Tratá bien a las demás personas de tus grupos.',
          ]} />
        </Bloque>

        <Bloque titulo="10. Cambios y disponibilidad">
          <p>
            FINA está en desarrollo y va a seguir cambiando. Podemos mejorar, modificar o interrumpir funciones, y no
            garantizamos que esté disponible sin interrupciones. Si cambiamos algo importante de estos textos, te lo
            avisamos y te pedimos que los vuelvas a aceptar para seguir usando la app.
          </p>
        </Bloque>

        <Bloque titulo="11. Responsabilidad">
          <p>
            FINA se ofrece tal como está. No nos hacemos responsables por decisiones que tomes en base a lo que ves en la
            app, ni por errores en datos que se hayan cargado mal, salvo en lo que la ley no permita excluir (por ejemplo,
            tus derechos como consumidora o consumidor según la Ley 24.240).
          </p>
        </Bloque>

        <Bloque titulo="12. Dejar de usar FINA">
          <p>
            Podés dejar de usarla cuando quieras y pedir que borremos tu cuenta escribiendo a {mail}. Podemos suspender una
            cuenta que incumpla estos términos.
          </p>
        </Bloque>

        <Bloque titulo="13. Ley aplicable">
          <p>
            Rige la ley argentina. Si sos consumidora o consumidor, podés acudir a los tribunales de tu domicilio.
          </p>
        </Bloque>
      </div>

      <hr style={{ borderColor: COLORS.line }} />

      {/* ───────────── PRIVACIDAD ───────────── */}
      <div id="privacidad" className="flex flex-col gap-5 scroll-mt-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[19px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>Política de privacidad</h2>
          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>
            Según la Ley 25.326 de Protección de los Datos Personales. En vigencia desde el 15 de octubre de 2026.
          </p>
        </div>

        <EnSimple>
          Pedimos lo mínimo, no vendemos ni cedemos tus datos, solo vos ves lo tuyo, y podés ver, corregir o borrar lo que
          cargaste cuando quieras.
        </EnSimple>

        <Bloque titulo="1. Quién es responsable de tus datos">
          <p>
            El equipo de FINA es la responsable del tratamiento. Para cualquier consulta o para ejercer tus derechos:
            {' '}{mail}.
          </p>
        </Bloque>

        <Bloque titulo="2. Qué datos tratamos y para qué">
          <p><strong>Los que nos das:</strong></p>
          <Lista items={[
            'Tu cuenta: mail y contraseña. La contraseña la maneja el proveedor de acceso con cifrado irreversible: nosotras nunca la vemos.',
            'Tu nombre, para hablarte por tu nombre.',
            'Tu teléfono (opcional), para que el bot de WhatsApp te reconozca.',
            'Datos de perfil opcionales: rango de edad, género, zona, con quién convivís, de dónde te entra la plata y cuánto sabés de finanzas. Sirven para personalizar el acompañamiento.',
            'Tus movimientos: gastos e ingresos con monto, moneda, descripción, medio de pago, sección, tipo y fecha, y los saldos por medio de pago.',
            'Tus secciones y topes, objetivos y lo que juntaste, gastos fijos y sus vencimientos, perfil inversor y aportes de inversión.',
            'Tus grupos y tu participación, y tu foto de perfil (opcional).',
          ]} />
          <p><strong>Los que se generan solos:</strong> el paso del día y tu racha, las recomendaciones que te armamos y cuáles marcaste como hechas, tu suscripción a los avisos del navegador y sus preferencias, y los códigos e intentos de verificación del teléfono.</p>
          <p><strong>Lo que no pedimos:</strong> DNI, domicilio, CBU, claves bancarias ni acceso a tus cuentas.</p>
        </Bloque>

        <Bloque titulo="3. Datos delicados y texto libre">
          <p>
            No pedimos datos sensibles (origen étnico, opiniones políticas, religión, salud, vida sexual). Pero tu plata
            cuenta cosas íntimas, y en las descripciones y en los campos de “otro” podés escribir lo que quieras.
            Escribí solo lo que necesites para reconocer el gasto: evitá datos de salud u otros muy personales.
          </p>
        </Bloque>

        <Bloque titulo="4. Tu consentimiento">
          <p>
            Tratamos tus datos porque nos diste tu consentimiento libre, expreso e informado al aceptar estos textos (art. 5,
            Ley 25.326). Todo lo opcional es optativo: si no lo respondés, FINA funciona igual, con menos personalización.
            Podés retirar tu consentimiento en cualquier momento pidiendo la baja de tu cuenta.
          </p>
        </Bloque>

        <Bloque titulo="5. Para qué usamos tus datos">
          <Lista items={[
            'Mostrarte tu plata: gastos, ingresos, saldos, objetivos e inversiones.',
            'Armarte recomendaciones, pasos del día y avisos pensados para vos.',
            'Que el bot de WhatsApp registre lo que le contás y te devuelva información.',
            'Que funcionen los grupos y las competencias.',
            'Cuidar la seguridad de las cuentas y frenar abusos.',
          ]} />
          <p>
            No vendemos tus datos ni los usamos para publicidad de terceros. Si algún día mostramos ofertas de comercios, el
            comercio no recibe datos que te identifiquen; si hiciera falta compartirlos, te pediríamos un consentimiento
            aparte.
          </p>
        </Bloque>

        <Bloque titulo="6. Con quién se comparten">
          <p>
            No cedemos tus datos. Para dar el servicio usamos proveedores que los tratan por nuestra instrucción y están
            obligados a mantenerlos confidenciales:
          </p>
          <Lista items={[
            'Supabase: base de datos y acceso a la cuenta.',
            'Vercel: hosting de la app y de las funciones del servidor.',
            'Anthropic (inteligencia artificial): para armar recomendaciones recibe un resumen agregado (totales por sección, porcentajes, rachas), no el listado de tus gastos con sus descripciones.',
            'WhatsApp (Meta) y Kapso: para el bot.',
          ]} />
          <p>
            Además, los miembros de tus grupos ven lo que se explica en los Términos (punto 8). Y podemos tener que
            entregar información si una autoridad competente nos lo exige.
          </p>
        </Bloque>

        <Bloque titulo="7. Transferencia fuera de Argentina">
          <p>
            Algunos de estos proveedores pueden tener sus servidores fuera de Argentina. Al aceptar esta política autorizás
            esa transferencia, que es necesaria para prestarte el servicio.
          </p>
        </Bloque>

        <Bloque titulo="8. Cómo cuidamos tus datos">
          <Lista items={[
            'Todo viaja cifrado (HTTPS).',
            'Cada cuenta solo puede leer y escribir sus propias filas: lo controla la base de datos, no solo la app.',
            'Las claves del servidor no están en la app ni en tu navegador.',
            'Al cerrar sesión se borran los datos guardados en ese dispositivo.',
          ]} />
          <p>Ningún sistema es 100% seguro. Si pasara algo que afecte tus datos, te lo vamos a comunicar.</p>
        </Bloque>

        <Bloque titulo="9. Cuánto tiempo los guardamos">
          <p>
            Mientras tengas tu cuenta. Si pedís la baja, eliminamos tus datos personales, salvo lo que la ley nos obligue a
            conservar. Los códigos de verificación del teléfono vencen a los 15 minutos.
          </p>
        </Bloque>

        <Bloque titulo="10. Tus derechos">
          <p>
            Podés pedir acceso a tus datos, que los rectifiquemos o actualicemos, y que los eliminemos (arts. 14 a 16 de la
            Ley 25.326). Es gratis.
          </p>
          <Lista items={[
            'Desde la app podés ver, editar y borrar tus gastos, ingresos, objetivos, topes, perfil y avisos.',
            <>Para pedir una copia de tus datos o borrar tu cuenta entera, escribinos a {mail}.</>,
            'Te respondemos dentro de los plazos de la ley: 10 días corridos para el acceso y 5 días hábiles para rectificar o suprimir.',
          ]} />
        </Bloque>

        <Bloque titulo="11. Menores">
          <p>
            FINA es para personas de 16 años o más y no te pide la edad exacta. Si sos menor de 18, usala con el
            acompañamiento de una persona adulta responsable.
          </p>
        </Bloque>

        <Bloque titulo="12. Lo que guardamos en tu dispositivo">
          <p>
            Guardamos en tu navegador lo necesario para que la app funcione: tu sesión, tus preferencias y, si lo activás,
            tu PIN (cifrado de forma irreversible). No usamos cookies de publicidad ni herramientas de seguimiento de
            terceros.
          </p>
        </Bloque>

        <Bloque titulo="13. Cambios en esta política">
          <p>
            Si cambiamos algo importante, te avisamos y te pedimos que lo vuelvas a aceptar para seguir usando la app.
          </p>
        </Bloque>

        <div className="rounded-2xl px-4 py-3.5" style={{ background: COLORS.tint }}>
          <p className="text-[13px] leading-relaxed" style={{ color: COLORS.inkSoft }}>
            El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma
            gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme
            lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326. La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en
            su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que
            se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.
          </p>
        </div>
      </div>
    </div>
  );
}
