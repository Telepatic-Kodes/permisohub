import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad — PermisoHub",
  description:
    "Cómo PermisoHub recopila, usa y protege los datos personales conforme al marco chileno de protección de datos (Ley 19.628 y Ley 21.719).",
};

// ---------------------------------------------------------------------------
// Contenido estructurado — estándar SaaS chileno, marco Ley 19.628 / 21.719.
// Los datos de la empresa son marcadores hasta la revisión legal.
// ---------------------------------------------------------------------------

interface Seccion {
  titulo: string;
  parrafos?: string[];
  lista?: string[];
  destacado?: boolean;
}

const SECCIONES: Seccion[] = [
  {
    titulo: "1. Responsable del tratamiento",
    parrafos: [
      "El responsable del tratamiento de los datos personales es [RAZÓN SOCIAL], RUT [RUT], con domicilio en [DIRECCIÓN], Chile (“PermisoHub”, “nosotros”). Para asuntos de privacidad puede contactarnos en contacto@permisohub.cl.",
    ],
  },
  {
    titulo: "2. Marco legal aplicable",
    parrafos: [
      "Esta Política se rige por la legislación chilena sobre protección de la vida privada y de datos personales, en particular la Ley N° 19.628 sobre Protección de la Vida Privada y la Ley N° 21.719, que moderniza el régimen de protección de datos personales y crea la Agencia de Protección de Datos Personales.",
      "En caso de contradicción con normas imperativas de dichas leyes, prevalecerá lo dispuesto por la ley.",
    ],
  },
  {
    titulo: "3. Datos que recopilamos",
    lista: [
      "Datos de identificación y contacto: nombre, correo electrónico, teléfono y datos de la cuenta.",
      "Datos de facturación: plan contratado, historial de pagos y datos tributarios necesarios para emitir documentos.",
      "Contenido del Usuario: documentos, expedientes, datos de proyectos y datos de sus mandantes que usted carga en la plataforma.",
      "Datos de uso: información técnica sobre el acceso y uso del Servicio (registros, dirección IP, tipo de dispositivo y navegador).",
    ],
  },
  {
    titulo: "4. Finalidades del tratamiento",
    lista: [
      "Proveer, operar y mantener el Servicio y sus funcionalidades de IA.",
      "Gestionar la cuenta, la suscripción, el cobro y la facturación.",
      "Brindar soporte y comunicarnos con usted sobre el Servicio.",
      "Mejorar y desarrollar nuevas funcionalidades, y velar por la seguridad de la plataforma.",
      "Cumplir obligaciones legales, contables y tributarias aplicables.",
    ],
  },
  {
    titulo: "5. Base de licitud",
    parrafos: [
      "Tratamos sus datos sobre la base de: (i) la ejecución del contrato de prestación del Servicio; (ii) el consentimiento que usted otorga al registrarse y aceptar esta Política; (iii) el cumplimiento de obligaciones legales; y (iv) nuestro interés legítimo en operar, asegurar y mejorar el Servicio, resguardando siempre sus derechos.",
    ],
  },
  {
    titulo: "6. Datos de terceros (mandantes)",
    destacado: true,
    parrafos: [
      "Al cargar datos de sus clientes o mandantes, el Usuario actúa como responsable de dichos datos y declara contar con la autorización y las bases legales necesarias para su tratamiento. PermisoHub actúa como encargado del tratamiento respecto de ese Contenido del Usuario, tratándolo únicamente según las instrucciones del Usuario y para prestar el Servicio.",
    ],
  },
  {
    titulo: "7. Herramientas de inteligencia artificial",
    parrafos: [
      "Algunas funcionalidades procesan el contenido de sus proyectos mediante modelos de IA para generar asistencia técnica. Este procesamiento se realiza con el fin de prestar el Servicio y no se utiliza para identificar o perfilar a personas más allá de dicha finalidad. Las salidas de IA son asistencia y no reemplazan el criterio del profesional competente.",
    ],
  },
  {
    titulo: "8. Comunicación y encargados de tratamiento",
    parrafos: [
      "No vendemos sus datos personales. Podemos compartirlos con proveedores que nos prestan servicios (alojamiento en la nube, procesamiento de pagos, proveedores de modelos de IA, soporte y analítica), quienes actúan como encargados bajo obligaciones de confidencialidad y seguridad.",
      "También podremos comunicar datos cuando la ley lo exija o lo requiera una autoridad competente.",
    ],
  },
  {
    titulo: "9. Transferencias internacionales",
    parrafos: [
      "Algunos de nuestros proveedores pueden alojar o procesar datos fuera de Chile. En tales casos adoptaremos resguardos razonables para que la transferencia cumpla con las exigencias de la legislación chilena aplicable.",
    ],
  },
  {
    titulo: "10. Conservación",
    parrafos: [
      "Conservamos los datos mientras mantenga una cuenta activa y durante los plazos necesarios para cumplir obligaciones legales, contables y tributarias, o para la defensa de eventuales reclamaciones. Cumplidos dichos plazos, los datos se eliminan o anonimizan.",
    ],
  },
  {
    titulo: "11. Derechos de los titulares",
    parrafos: [
      "Usted puede ejercer sus derechos de acceso, rectificación, cancelación (supresión), oposición y portabilidad, así como los demás derechos reconocidos por la Ley 19.628 y la Ley 21.719.",
      "Para ejercerlos, escríbanos a contacto@permisohub.cl. Responderemos en los plazos que establece la ley. Si considera que sus derechos no han sido debidamente atendidos, podrá reclamar ante la autoridad de protección de datos competente.",
    ],
  },
  {
    titulo: "12. Seguridad",
    parrafos: [
      "Aplicamos medidas técnicas y organizativas razonables para proteger los datos contra acceso no autorizado, pérdida o alteración. Ningún sistema es completamente infalible; ante una vulneración que afecte sus datos, actuaremos conforme a las obligaciones de notificación aplicables.",
    ],
  },
  {
    titulo: "13. Cookies",
    parrafos: [
      "El sitio utiliza cookies y tecnologías similares necesarias para su funcionamiento y para mejorar la experiencia de uso. Usted puede configurar su navegador para gestionarlas, considerando que su bloqueo puede afectar algunas funcionalidades.",
    ],
  },
  {
    titulo: "14. Cambios a esta política",
    parrafos: [
      "Podremos actualizar esta Política. Los cambios materiales se comunicarán por medios razonables y regirán desde su publicación. El uso continuado del Servicio implica la aceptación de la versión vigente.",
    ],
  },
  {
    titulo: "15. Contacto",
    parrafos: [
      "Para consultas o para ejercer sus derechos sobre datos personales, escríbanos a contacto@permisohub.cl.",
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-[#F9F7F3] text-[#1A3328]">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[#1A3328]/10 bg-[#F9F7F3]/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xl font-semibold tracking-tight text-[#1A3328]"
          >
            PermisoHub
            <span className="size-2 rounded-full bg-[#2D6A4F]" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1A3328]/70 transition-colors hover:text-[#1A3328]"
          >
            <ArrowLeft className="size-4" />
            Volver al inicio
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        {/* Aviso de borrador */}
        <div className="flex items-start gap-3 rounded-2xl border border-[#E9C46A]/50 bg-[#E9C46A]/15 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#1A3328]" />
          <p className="text-sm leading-relaxed text-[#1A3328]/80">
            <strong>Borrador — pendiente de revisión con asesoría legal.</strong>{" "}
            Este documento es una versión preliminar y no constituye asesoría
            jurídica. Su contenido puede cambiar antes de su publicación
            definitiva.
          </p>
        </div>

        <h1 className="mt-10 text-4xl font-semibold tracking-tight text-[#1A3328]">
          Política de privacidad
        </h1>
        <p className="mt-3 text-sm text-[#1A3328]/55">
          Última actualización: Julio 2026
        </p>

        <div className="mt-12 space-y-10">
          {SECCIONES.map((seccion) => (
            <section
              key={seccion.titulo}
              className={
                seccion.destacado
                  ? "rounded-2xl border border-[#2D6A4F]/25 bg-white p-6"
                  : ""
              }
            >
              <h2 className="text-lg font-semibold text-[#1A3328]">
                {seccion.titulo}
              </h2>

              {seccion.parrafos && (
                <div className="mt-3 space-y-3">
                  {seccion.parrafos.map((parrafo, i) => (
                    <p
                      key={i}
                      className="text-sm leading-relaxed text-[#1A3328]/70"
                    >
                      {parrafo}
                    </p>
                  ))}
                </div>
              )}

              {seccion.lista && (
                <ul className="mt-3 space-y-2.5">
                  {seccion.lista.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-[#1A3328]/70"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#2D6A4F]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1A3328]/10 bg-[#1A3328] text-[#F9F7F3]">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-10 text-center">
          <div className="flex items-center gap-1.5 text-lg font-semibold">
            PermisoHub
            <span className="size-2 rounded-full bg-[#E9C46A]" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#F9F7F3]/65">
            <Link href="/" className="transition-colors hover:text-[#E9C46A]">
              Inicio
            </Link>
            <Link
              href="/terminos-y-condiciones"
              className="transition-colors hover:text-[#E9C46A]"
            >
              Términos y condiciones
            </Link>
            <a
              href="mailto:contacto@permisohub.cl"
              className="transition-colors hover:text-[#E9C46A]"
            >
              contacto@permisohub.cl
            </a>
          </div>
          <p className="text-xs text-[#F9F7F3]/45">
            Desarrollado para arquitectos chilenos · Santiago, 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
