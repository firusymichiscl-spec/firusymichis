import Link from "next/link";

export const metadata = {
  title: "Términos y Condiciones",
  description:
    "Condiciones de uso del servicio Firus&Michis, plataforma de gestión de salud para mascotas.",
};

const ACTUALIZACION = "1 de agosto de 2026";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700&display=swap');
  .lg { font-family: 'Nunito', sans-serif; background: #FFF8F3; color: #3D1F0A; min-height: 100vh; }
  .lg-nav { background: #fff; border-bottom: 1px solid #F5E6DA; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
  .lg-brand { font-family: 'Baloo 2', cursive; font-size: 20px; font-weight: 800; color: #FF6B35; text-decoration: none; display: flex; align-items: center; gap: 8px; }
  .lg-brand span { color: #FFD166; }
  .lg-back { font-size: 14px; font-weight: 700; color: #7A4522; text-decoration: none; }
  .lg-wrap { max-width: 780px; margin: 0 auto; padding: 40px 20px 80px; }
  .lg-h1 { font-family: 'Baloo 2', cursive; font-size: 34px; font-weight: 800; line-height: 1.15; margin-bottom: 8px; }
  .lg-meta { font-size: 13px; color: #C4845A; margin-bottom: 28px; }
  .lg-intro { background: #fff; border: 1px solid #F5E6DA; border-radius: 16px; padding: 18px 20px; font-size: 15px; line-height: 1.7; margin-bottom: 32px; }
  .lg-h2 { font-family: 'Baloo 2', cursive; font-size: 21px; font-weight: 700; color: #FF6B35; margin: 34px 0 12px; }
  .lg-h3 { font-size: 15px; font-weight: 700; margin: 20px 0 8px; }
  .lg p { font-size: 15px; line-height: 1.75; margin-bottom: 14px; }
  .lg ul { margin: 0 0 16px 20px; }
  .lg li { font-size: 15px; line-height: 1.75; margin-bottom: 8px; }
  .lg strong { font-weight: 700; }
  .lg-alerta { background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 14px; padding: 18px 20px; font-size: 15px; line-height: 1.75; margin: 20px 0; }
  .lg-alerta-titulo { font-family: 'Baloo 2', cursive; font-size: 17px; font-weight: 700; color: #B91C1C; margin-bottom: 8px; }
  .lg-nota { background: #FFF9E6; border: 1px solid #FFD166; border-radius: 14px; padding: 16px 18px; font-size: 14px; line-height: 1.7; margin: 20px 0; }
  .lg-contacto { background: #fff; border: 1px solid #F5E6DA; border-radius: 16px; padding: 20px; margin-top: 32px; }
  .lg a.enlace { color: #FF6B35; font-weight: 700; text-decoration: none; }
  .lg-footer { border-top: 1px solid #F5E6DA; margin-top: 48px; padding-top: 20px; font-size: 13px; color: #C4845A; text-align: center; }
`;

export default function TerminosCondiciones() {
  return (
    <>
      <style>{css}</style>
      <div className="lg">
        <nav className="lg-nav">
          <Link href="/" className="lg-brand">
            🐾 Firus<span>&</span>Michis
          </Link>
          <Link href="/" className="lg-back">
            ← Volver al inicio
          </Link>
        </nav>

        <div className="lg-wrap">
          <h1 className="lg-h1">Términos y Condiciones de Uso</h1>
          <div className="lg-meta">Última actualización: {ACTUALIZACION}</div>

          <div className="lg-intro">
            Estas condiciones regulan el uso de Firus&amp;Michis. Al crear una cuenta
            o usar la plataforma, declaras haberlas leído y aceptado. Están escritas
            para que se entiendan: si algo no te queda claro, escríbenos y te lo
            explicamos.
          </div>

          <h2 className="lg-h2">1. Quiénes somos</h2>
          <p>
            Firus&amp;Michis es un servicio operado por{" "}
            <strong>GO COMPUTACIÓN SpA</strong>, RUT 77.776.589-2, sociedad
            constituida en Chile, disponible en firusymichis.cl y firusymichis.com.
          </p>

          <h2 className="lg-h2">2. Qué es y qué no es este servicio</h2>
          <p>
            Firus&amp;Michis es una herramienta de <strong>organización y registro</strong>{" "}
            de la información de salud de tus mascotas: medicamentos, vacunas,
            historial médico, peso, alimentación y contactos responsables.
          </p>

          <div className="lg-alerta">
            <div className="lg-alerta-titulo">⚠️ No somos un servicio veterinario</div>
            Firus&amp;Michis <strong>no presta atención médica veterinaria</strong>, no
            emite diagnósticos ni prescribe tratamientos. Toda la información que
            entrega la plataforma, incluidas las respuestas generadas por inteligencia
            artificial, las sugerencias de ración alimentaria y los recordatorios, es
            de carácter <strong>referencial y orientativo</strong>.
            <br />
            <br />
            Las decisiones sobre la salud de tu mascota deben tomarse siempre con un{" "}
            <strong>médico veterinario colegiado</strong>. Ante cualquier síntoma,
            urgencia o duda clínica, acude a un profesional. No suspendas ni modifiques
            un tratamiento basándote en información de esta plataforma.
          </div>

          <h2 className="lg-h2">3. Tu cuenta</h2>
          <ul>
            <li>Debes ser mayor de 18 años para crear una cuenta.</li>
            <li>La cuenta es personal. Eres responsable de la actividad realizada desde ella.</li>
            <li>Debes entregar información veraz. Los datos que registres sobre tus mascotas son de tu exclusiva responsabilidad.</li>
            <li>El acceso se realiza mediante tu cuenta de Google. Si pierdes el acceso a ese correo, podrías perder el acceso a tu cuenta.</li>
          </ul>

          <h2 className="lg-h2">4. Planes, prueba gratuita y pagos</h2>
          <p>
            Al registrarte accedes a un <strong>período de prueba gratuito</strong> con
            funcionalidades completas, sin necesidad de ingresar medios de pago. La
            duración del período y las características de cada plan son las publicadas
            en el sitio al momento de tu registro.
          </p>
          <p>
            Finalizado el período de prueba, el acceso a las funciones y a la
            visualización de los datos queda restringido hasta que contrates un plan.{" "}
            <strong>Tus datos no se eliminan</strong> por el solo vencimiento de la
            prueba: permanecen almacenados y vuelven a estar disponibles al activar un
            plan.
          </p>
          <ul>
            <li>Los precios vigentes son los publicados en el sitio y se expresan en pesos chilenos.</li>
            <li>Podemos modificar los precios avisando con anticipación razonable. Los cambios no afectan un período ya pagado.</li>
            <li>Puedes cancelar tu suscripción en cualquier momento; el servicio seguirá activo hasta el término del período pagado.</li>
            <li>Los límites de cada plan (cantidad de mascotas y de consultas a funciones de inteligencia artificial) son los indicados en el sitio.</li>
          </ul>
          <div className="lg-nota">
            Las mascotas archivadas en la sección &ldquo;En Memoria&rdquo; no ocupan
            cupo dentro del límite de tu plan.
          </div>

          <h2 className="lg-h2">5. Uso de las funciones con inteligencia artificial</h2>
          <p>
            La plataforma incorpora funciones asistidas por inteligencia artificial
            para leer recetas, analizar la ficha de la mascota y orientar sobre
            síntomas. Estas funciones:
          </p>
          <ul>
            <li>Pueden contener errores, omisiones o interpretaciones incorrectas.</li>
            <li>Tienen límites de uso diarios y semanales por mascota, indicados en la aplicación.</li>
            <li>No sustituyen la lectura de la receta original ni la indicación del profesional que la emitió.</li>
          </ul>
          <p>
            <strong>Siempre debes verificar</strong> los datos extraídos por la
            inteligencia artificial contra la receta física antes de administrar
            cualquier medicamento.
          </p>

          <h2 className="lg-h2">6. Recordatorios y notificaciones</h2>
          <p>
            La plataforma puede enviarte recordatorios por correo electrónico según las
            preferencias que configures. Se trata de una <strong>ayuda complementaria</strong>:
            no garantizamos su entrega puntual ni su recepción, ya que dependen de
            factores externos como tu proveedor de correo o filtros de spam. La
            responsabilidad de administrar los tratamientos de tu mascota es siempre
            tuya.
          </p>

          <h2 className="lg-h2">7. Contenido que registras</h2>
          <p>
            Los datos, textos e imágenes que subes siguen siendo tuyos. Nos otorgas
            únicamente la licencia necesaria para almacenarlos, procesarlos y
            mostrártelos dentro del servicio, incluyendo su envío a los proveedores
            descritos en nuestra{" "}
            <Link href="/privacidad" className="enlace">
              Política de Privacidad
            </Link>
            .
          </p>
          <p>Te comprometes a no subir contenido que:</p>
          <ul>
            <li>Infrinja derechos de terceros o normas legales.</li>
            <li>Contenga datos personales de terceros sin su autorización.</li>
            <li>Sea ofensivo, ilícito o ajeno a la finalidad del servicio.</li>
          </ul>

          <h2 className="lg-h2">8. Perfiles públicos compartidos</h2>
          <p>
            Si generas un enlace público con código QR, cualquier persona que lo tenga
            podrá ver la información que hayas marcado como visible, sin iniciar
            sesión. Eres responsable de con quién compartes ese enlace. Puedes
            desactivarlo en cualquier momento desde la aplicación.
          </p>

          <h2 className="lg-h2">9. Registro de actividad</h2>
          <p>
            Toda acción relevante sobre la ficha de una mascota queda registrada con
            fecha, hora, acción y usuario responsable. Este registro es{" "}
            <strong>inmodificable desde la aplicación</strong> y existe para tu propia
            trazabilidad y seguridad. Las solicitudes de eliminación de entradas deben
            hacerse por correo, justificando el motivo.
          </p>

          <h2 className="lg-h2">10. Eliminación y archivado</h2>
          <ul>
            <li>
              <strong>Archivar (En Memoria):</strong> acción permanente. La ficha queda
              en modo lectura y no puede reactivarse desde la aplicación.
            </li>
            <li>
              <strong>Eliminar mascota:</strong> borra sus datos de forma permanente.
              Conservamos un registro técnico de la eliminación conforme a la Política
              de Privacidad.
            </li>
          </ul>
          <p>
            Ambas acciones requieren confirmación explícita y{" "}
            <strong>no se pueden deshacer</strong>. Revisa bien antes de confirmar.
          </p>

          <h2 className="lg-h2">11. Disponibilidad del servicio</h2>
          <p>
            Trabajamos para mantener la plataforma disponible de manera continua, pero
            no garantizamos un funcionamiento libre de interrupciones. Podemos realizar
            mantenciones, actualizaciones o suspensiones temporales. Tampoco
            garantizamos la disponibilidad de servicios de terceros de los que depende
            la plataforma.
          </p>

          <h2 className="lg-h2">12. Limitación de responsabilidad</h2>
          <p>
            En la máxima medida permitida por la ley chilena, Firus&amp;Michis no será
            responsable por:
          </p>
          <ul>
            <li>Decisiones sobre la salud de una mascota tomadas a partir de información de la plataforma.</li>
            <li>Consecuencias derivadas de la falta de recepción de un recordatorio.</li>
            <li>Errores en los datos ingresados por el usuario o extraídos por inteligencia artificial.</li>
            <li>Interrupciones del servicio o fallas de proveedores externos.</li>
            <li>Pérdida de datos por causas ajenas a nuestro control.</li>
          </ul>
          <p>
            Nada de lo anterior limita los derechos irrenunciables que te reconoce la
            Ley N.º 19.496 sobre protección de los derechos de los consumidores.
          </p>

          <h2 className="lg-h2">13. Suspensión de cuentas</h2>
          <p>
            Podemos suspender o cerrar una cuenta que infrinja estas condiciones, haga
            un uso abusivo de los recursos del servicio o intente vulnerar su
            seguridad. Cuando sea razonable, te avisaremos previamente y te daremos la
            posibilidad de descargar tu información.
          </p>

          <h2 className="lg-h2">14. Cambios a estos términos</h2>
          <p>
            Podemos actualizar estas condiciones. Los cambios relevantes se comunicarán
            por correo electrónico o mediante aviso en la aplicación con anticipación
            razonable. El uso continuado del servicio tras la entrada en vigencia
            implica su aceptación.
          </p>

          <h2 className="lg-h2">15. Ley aplicable y jurisdicción</h2>
          <p>
            Estas condiciones se rigen por las leyes de la República de Chile.
            Cualquier controversia será sometida a los tribunales ordinarios de
            justicia con competencia en Chile, sin perjuicio de los derechos que la
            legislación de consumo reconoce a los usuarios.
          </p>

          <div className="lg-contacto">
            <h2 className="lg-h2" style={{ marginTop: 0 }}>
              ¿Consultas?
            </h2>
            <p style={{ marginBottom: 0 }}>
              Escríbenos a{" "}
              <a className="enlace" href="mailto:contacto@firusymichis.cl">
                contacto@firusymichis.cl
              </a>{" "}
              y te respondemos. 🐾
            </p>
          </div>

          <div className="lg-footer">
            GO COMPUTACIÓN SpA · RUT 77.776.589-2 · Chile
            <br />
            <Link href="/privacidad" className="enlace">
              Política de Privacidad
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
