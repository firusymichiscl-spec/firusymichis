import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad",
  description:
    "Cómo Firus&Michis recopila, usa y protege los datos personales de sus usuarios en Chile.",
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
  .lg-tabla { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 14px; }
  .lg-tabla th { text-align: left; background: #FFF0EB; color: #7A4522; font-weight: 700; padding: 10px 12px; border-bottom: 1px solid #F5E6DA; }
  .lg-tabla td { padding: 10px 12px; border-bottom: 1px solid #F5E6DA; vertical-align: top; line-height: 1.6; }
  .lg-nota { background: #FFF9E6; border: 1px solid #FFD166; border-radius: 14px; padding: 16px 18px; font-size: 14px; line-height: 1.7; margin: 20px 0; }
  .lg-contacto { background: #fff; border: 1px solid #F5E6DA; border-radius: 16px; padding: 20px; margin-top: 32px; }
  .lg a.enlace { color: #FF6B35; font-weight: 700; text-decoration: none; }
  .lg-footer { border-top: 1px solid #F5E6DA; margin-top: 48px; padding-top: 20px; font-size: 13px; color: #C4845A; text-align: center; }
`;

export default function PoliticaPrivacidad() {
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
          <h1 className="lg-h1">Política de Privacidad</h1>
          <div className="lg-meta">Última actualización: {ACTUALIZACION}</div>

          <div className="lg-intro">
            En Firus&amp;Michis cuidamos la información de tus mascotas con el mismo
            criterio con que cuidamos la nuestra. Este documento explica, en lenguaje
            claro, qué datos recopilamos, para qué los usamos, con quién los
            compartimos y qué derechos tienes sobre ellos.
          </div>

          <h2 className="lg-h2">1. Quién es responsable de tus datos</h2>
          <p>
            El responsable del tratamiento de los datos personales recopilados a
            través de este sitio es <strong>GO COMPUTACIÓN SpA</strong>, RUT
            77.776.589-2, sociedad constituida en Chile, en adelante
            &ldquo;Firus&amp;Michis&rdquo;, &ldquo;nosotros&rdquo; o &ldquo;la
            plataforma&rdquo;.
          </p>
          <p>
            Canal de contacto para materias de privacidad:{" "}
            <a className="enlace" href="mailto:contacto@firusymichis.cl">
              contacto@firusymichis.cl
            </a>
          </p>

          <h2 className="lg-h2">2. Marco legal aplicable</h2>
          <p>
            Tratamos tus datos conforme a la legislación chilena vigente sobre
            protección de la vida privada y datos personales, incluyendo la Ley
            N.º 19.628 y la Ley N.º 21.719, que la moderniza y crea la Agencia de
            Protección de Datos Personales. Cuando esta última entre plenamente en
            vigencia, ajustaremos nuestras prácticas y este documento a sus
            exigencias.
          </p>

          <h2 className="lg-h2">3. Qué datos recopilamos</h2>

          <h3 className="lg-h3">3.1 Datos de tu cuenta</h3>
          <ul>
            <li>
              <strong>Correo electrónico y nombre</strong>, obtenidos al iniciar
              sesión con tu cuenta de Google. No almacenamos tu contraseña de
              Google: la autenticación la realiza Google directamente.
            </li>
            <li>
              <strong>Plan contratado</strong> y fecha de vencimiento de tu período
              de prueba o suscripción.
            </li>
            <li>
              <strong>Preferencias de la aplicación</strong>, como el tema visual
              elegido y tus ajustes de notificaciones.
            </li>
          </ul>

          <h3 className="lg-h3">3.2 Datos que tú ingresas sobre tus mascotas</h3>
          <ul>
            <li>Identificación: nombre, especie, raza, sexo, fecha de nacimiento y número de microchip.</li>
            <li>Salud: condiciones médicas, alergias, medicamentos, dosis, vacunas, historial de eventos médicos, peso y alimentación.</li>
            <li>Imágenes: fotografías de la mascota, de eventos de salud y de recetas veterinarias.</li>
            <li>Contactos responsables: nombre, teléfono, correo, dirección y relación de los tutores que registres.</li>
          </ul>
          <div className="lg-nota">
            <strong>Importante:</strong> si registras datos de contacto de terceros
            (por ejemplo, un familiar como tutor suplente), declaras contar con su
            autorización para hacerlo y te comprometes a informarle que sus datos
            están en la plataforma.
          </div>

          <h3 className="lg-h3">3.3 Datos técnicos y de actividad</h3>
          <ul>
            <li>
              <strong>Registro de actividad:</strong> cada acción relevante sobre la
              ficha de una mascota queda registrada con fecha, hora, acción realizada
              y correo del usuario que la ejecutó. Este registro es visible para ti y
              no puede ser modificado ni eliminado desde la aplicación.
            </li>
            <li>
              <strong>Dirección IP:</strong> se registra únicamente al eliminar una
              mascota, con fines de seguridad y trazabilidad.
            </li>
            <li>
              <strong>Ubicación aproximada:</strong> solo si autorizas el permiso de
              geolocalización de tu navegador, y exclusivamente para mostrarte
              veterinarias cercanas. No la almacenamos.
            </li>
            <li>
              <strong>Datos de uso de funciones con inteligencia artificial:</strong>{" "}
              cantidad de consultas realizadas y tiempo de respuesta, para controlar
              cuotas y mejorar el servicio.
            </li>
          </ul>

          <h2 className="lg-h2">4. Para qué usamos tus datos</h2>
          <ul>
            <li>Prestar el servicio: mostrar, organizar y respaldar la información de salud de tus mascotas.</li>
            <li>Enviarte recordatorios y alertas por correo electrónico, según las preferencias que configures.</li>
            <li>Procesar tus consultas a las funciones de inteligencia artificial.</li>
            <li>Generar los documentos y perfiles compartibles que tú solicites.</li>
            <li>Prevenir usos abusivos, fraudes y accesos no autorizados.</li>
            <li>Cumplir obligaciones legales y responder requerimientos de autoridad competente.</li>
          </ul>
          <p>
            <strong>No vendemos tus datos personales</strong> ni los cedemos a
            terceros con fines publicitarios.
          </p>

          <h2 className="lg-h2">5. Inteligencia artificial</h2>
          <p>
            Algunas funciones —lectura de recetas, análisis de la ficha y consulta de
            síntomas— procesan la información de tu mascota mediante modelos de
            inteligencia artificial provistos por <strong>Anthropic</strong>. Al usar
            estas funciones, los datos de la consulta (incluida la imagen de la receta
            cuando corresponda) se transmiten a ese proveedor para generar la
            respuesta.
          </p>
          <div className="lg-nota">
            Las respuestas generadas por inteligencia artificial son{" "}
            <strong>orientativas</strong> y no constituyen un diagnóstico ni
            reemplazan la evaluación de un médico veterinario colegiado.
          </div>

          <h2 className="lg-h2">6. Con quién compartimos información</h2>
          <p>
            Trabajamos con proveedores que procesan datos por nuestra cuenta y bajo
            nuestras instrucciones:
          </p>
          <table className="lg-tabla">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Finalidad</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Supabase</td><td>Base de datos, autenticación y almacenamiento de imágenes</td></tr>
              <tr><td>Vercel</td><td>Alojamiento y entrega de la aplicación</td></tr>
              <tr><td>Google</td><td>Inicio de sesión y servicio de mapas para veterinarias cercanas</td></tr>
              <tr><td>Anthropic</td><td>Procesamiento de las funciones de inteligencia artificial</td></tr>
              <tr><td>Resend</td><td>Envío de correos de notificación</td></tr>
            </tbody>
          </table>
          <p>
            Algunos de estos proveedores almacenan o procesan información en
            servidores ubicados fuera de Chile. Al usar la plataforma, aceptas esta
            transferencia internacional, que se realiza bajo los estándares de
            seguridad contractuales de cada proveedor.
          </p>

          <h2 className="lg-h2">7. Perfiles públicos por código QR</h2>
          <p>
            Si generas un enlace público para compartir la ficha de tu mascota, la
            información que hayas marcado como visible quedará accesible para
            cualquier persona que tenga ese enlace, sin necesidad de iniciar sesión.
            Tú decides qué campos se muestran y por cuánto tiempo, y puedes desactivar
            el enlace en cualquier momento desde la aplicación.
          </p>

          <h2 className="lg-h2">8. Cuánto tiempo conservamos tus datos</h2>
          <ul>
            <li>
              <strong>Mientras tu cuenta esté activa:</strong> conservamos la
              información de tus mascotas para prestarte el servicio.
            </li>
            <li>
              <strong>Mascotas archivadas (&ldquo;En Memoria&rdquo;):</strong> se
              conservan en modo lectura mientras mantengas tu cuenta, para que puedas
              consultarlas.
            </li>
            <li>
              <strong>Al eliminar una mascota:</strong> sus datos se borran de la
              aplicación. Se conserva un registro técnico de la eliminación (usuario,
              fecha y dirección IP) por un plazo de <strong>2 años</strong>, con fines
              de seguridad, auditoría y resolución de controversias.
            </li>
            <li>
              <strong>Al cerrar tu cuenta:</strong> eliminamos tus datos personales
              dentro de un plazo razonable, salvo aquellos que debamos conservar por
              obligación legal o tributaria.
            </li>
          </ul>

          <h2 className="lg-h2">9. Seguridad</h2>
          <p>
            Aplicamos medidas técnicas y organizativas para proteger tu información,
            entre ellas: cifrado en tránsito mediante HTTPS, aislamiento de los datos
            de cada usuario mediante políticas de seguridad a nivel de base de datos,
            control de acceso a los archivos almacenados, y registro de actividad para
            detectar usos indebidos. Ningún sistema es completamente infalible, pero
            trabajamos permanentemente para reducir los riesgos.
          </p>

          <h2 className="lg-h2">10. Tus derechos</h2>
          <p>Como titular de los datos, puedes ejercer en cualquier momento tu derecho a:</p>
          <ul>
            <li><strong>Acceder</strong> a los datos que tenemos sobre ti.</li>
            <li><strong>Rectificar</strong> información inexacta o desactualizada.</li>
            <li><strong>Eliminar</strong> tus datos, con las excepciones legales indicadas.</li>
            <li><strong>Oponerte</strong> a determinados tratamientos o revocar tu consentimiento.</li>
            <li><strong>Solicitar una copia</strong> de tu información en un formato legible.</li>
          </ul>
          <p>
            Para ejercerlos, escríbenos a{" "}
            <a className="enlace" href="mailto:contacto@firusymichis.cl">
              contacto@firusymichis.cl
            </a>{" "}
            desde el correo asociado a tu cuenta. Responderemos dentro de los plazos
            que establece la ley.
          </p>
          <p>
            El registro de actividad es inmodificable por diseño. Si necesitas la
            eliminación de entradas específicas, puedes solicitarlo al mismo correo
            justificando el motivo; evaluaremos cada caso conforme a la normativa
            aplicable.
          </p>

          <h2 className="lg-h2">11. Menores de edad</h2>
          <p>
            La plataforma está dirigida a personas mayores de 18 años. No recopilamos
            deliberadamente datos de menores. Si detectamos una cuenta creada por un
            menor, procederemos a eliminarla.
          </p>

          <h2 className="lg-h2">12. Cookies y tecnologías similares</h2>
          <p>
            Usamos únicamente cookies y almacenamiento local necesarios para el
            funcionamiento del servicio: mantener tu sesión iniciada y recordar tus
            preferencias de visualización. No utilizamos cookies publicitarias ni de
            seguimiento entre sitios.
          </p>

          <h2 className="lg-h2">13. Cambios a esta política</h2>
          <p>
            Si modificamos esta política, actualizaremos la fecha del encabezado y, en
            caso de cambios relevantes, te avisaremos por correo electrónico o
            mediante un aviso destacado en la aplicación.
          </p>

          <div className="lg-contacto">
            <h2 className="lg-h2" style={{ marginTop: 0 }}>
              ¿Dudas sobre tus datos?
            </h2>
            <p style={{ marginBottom: 0 }}>
              Escríbenos a{" "}
              <a className="enlace" href="mailto:contacto@firusymichis.cl">
                contacto@firusymichis.cl
              </a>
              . Somos un equipo pequeño en Chile y respondemos personalmente cada
              consulta. 🐾
            </p>
          </div>

          <div className="lg-footer">
            GO COMPUTACIÓN SpA · RUT 77.776.589-2 · Chile
            <br />
            <Link href="/terminos" className="enlace">
              Términos y Condiciones
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
