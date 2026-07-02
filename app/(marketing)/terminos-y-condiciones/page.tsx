import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones — PermisoHub",
  description:
    "Términos y condiciones de uso del servicio PermisoHub para arquitectos y estudios chilenos.",
};

// ---------------------------------------------------------------------------
// Contenido estructurado — estándar SaaS chileno.
// Los datos de la empresa son marcadores hasta la revisión legal.
// ---------------------------------------------------------------------------

interface Seccion {
  titulo: string;
  parrafos: string[];
  destacado?: boolean;
}

const SECCIONES: Seccion[] = [
  {
    titulo: "1. Aceptación de los términos",
    parrafos: [
      "Estos Términos y Condiciones (los “Términos”) regulan el acceso y uso de la plataforma PermisoHub (el “Servicio”), operada por [RAZÓN SOCIAL], RUT [RUT], con domicilio en [DIRECCIÓN], Chile (“PermisoHub”, “nosotros”).",
      "Al crear una cuenta, contratar un plan o utilizar el Servicio, el usuario (“usted”, el “Usuario”) declara haber leído, entendido y aceptado estos Términos en su totalidad. Si no está de acuerdo, no debe utilizar el Servicio.",
    ],
  },
  {
    titulo: "2. Descripción del servicio",
    parrafos: [
      "PermisoHub es una plataforma de software como servicio (SaaS) que asiste a arquitectos y estudios de arquitectura en la preparación, seguimiento y gestión de expedientes para la tramitación de permisos ante las Direcciones de Obras Municipales (DOM), incluyendo herramientas basadas en inteligencia artificial (IA).",
      "El Servicio se ofrece “tal cual” y “según disponibilidad”. PermisoHub puede modificar, ampliar o discontinuar funcionalidades, avisando con antelación razonable cuando el cambio sea material.",
    ],
  },
  {
    titulo: "3. Registro y cuenta",
    parrafos: [
      "Para usar el Servicio debe registrar una cuenta con información veraz, completa y actualizada. Usted es responsable de mantener la confidencialidad de sus credenciales y de toda actividad realizada bajo su cuenta.",
      "Debe notificar de inmediato a contacto@permisohub.cl ante cualquier uso no autorizado de su cuenta.",
    ],
  },
  {
    titulo: "4. Planes, pago y facturación",
    parrafos: [
      "El Servicio se ofrece bajo planes de suscripción de pago recurrente (mensual o anual) según los precios publicados en el sitio, expresados en pesos chilenos (CLP) e incluyendo los impuestos que correspondan conforme a la legislación vigente.",
      "La suscripción se renueva automáticamente por períodos iguales, salvo cancelación por parte del Usuario antes del término del período en curso. Los cambios de precio se comunicarán con anticipación razonable y regirán a partir del siguiente período de facturación.",
      "Salvo obligación legal en contrario, los pagos ya efectuados no son reembolsables. El Usuario puede cancelar en cualquier momento y conservará el acceso hasta el fin del período pagado.",
    ],
  },
  {
    titulo: "5. Uso aceptable",
    parrafos: [
      "El Usuario se compromete a utilizar el Servicio conforme a la ley, estos Términos y la buena fe. Queda prohibido, entre otros: (i) usar el Servicio para fines ilícitos; (ii) intentar vulnerar la seguridad o integridad de la plataforma; (iii) realizar ingeniería inversa del software; (iv) revender o ceder el acceso sin autorización; y (v) cargar contenido que infrinja derechos de terceros.",
    ],
  },
  {
    titulo: "6. Contenido del Usuario",
    parrafos: [
      "El Usuario conserva la titularidad de los documentos, datos de proyectos y demás contenidos que cargue en el Servicio (“Contenido del Usuario”). Usted otorga a PermisoHub una licencia limitada para alojar, procesar y mostrar dicho contenido con el único fin de prestar el Servicio.",
      "Usted declara contar con los derechos y autorizaciones necesarios sobre el Contenido del Usuario, incluyendo los datos de sus mandantes y terceros.",
    ],
  },
  {
    titulo: "7. Asistencia por IA — no sustituye al profesional competente",
    destacado: true,
    parrafos: [
      "Las salidas generadas por las herramientas de inteligencia artificial de PermisoHub (pre-revisiones, borradores de observaciones, memorias, checklists, cálculos y similares) constituyen una asistencia técnica y NO una resolución oficial, dictamen legal ni certificación normativa.",
      "La revisión, validación y firma final del expediente es responsabilidad exclusiva del profesional competente (arquitecto u otro). PermisoHub no reemplaza el criterio profesional, la revisión de la DOM ni la normativa aplicable vigente (OGUC, LGUC, Ley 21.718, planes reguladores y circulares). El Usuario es el único responsable del contenido que ingresa ante la autoridad.",
    ],
  },
  {
    titulo: "8. Propiedad intelectual",
    parrafos: [
      "El Servicio, su software, marca, diseño, bases de datos de inteligencia municipal y demás elementos son propiedad de PermisoHub o de sus licenciantes, y están protegidos por la legislación chilena e internacional de propiedad intelectual. Estos Términos no transfieren al Usuario ningún derecho sobre dichos elementos, salvo la licencia de uso limitada aquí descrita.",
    ],
  },
  {
    titulo: "9. Disponibilidad y soporte",
    parrafos: [
      "PermisoHub realizará esfuerzos comercialmente razonables para mantener el Servicio disponible, sin garantizar una operación ininterrumpida o libre de errores. Podrán existir ventanas de mantenimiento e interrupciones por causas fuera de nuestro control. Los niveles de soporte aplicables son los indicados en cada plan.",
    ],
  },
  {
    titulo: "10. Limitación de responsabilidad",
    parrafos: [
      "En la máxima medida permitida por la ley, PermisoHub no será responsable por daños indirectos, incidentales o consecuenciales, ni por lucro cesante, pérdida de datos, rechazos, observaciones, multas o plazos derivados de la tramitación ante la DOM u otras autoridades.",
      "La responsabilidad total de PermisoHub, por cualquier causa, se limitará al monto efectivamente pagado por el Usuario en los doce (12) meses anteriores al hecho que origine la reclamación.",
    ],
  },
  {
    titulo: "11. Protección de datos",
    parrafos: [
      "El tratamiento de datos personales se rige por nuestra Política de Privacidad y por la legislación chilena aplicable (Ley 19.628 y Ley 21.719). Al usar el Servicio, usted acepta dicho tratamiento en los términos allí descritos.",
    ],
  },
  {
    titulo: "12. Terminación",
    parrafos: [
      "Usted puede terminar su cuenta en cualquier momento. PermisoHub podrá suspender o terminar el acceso ante incumplimientos de estos Términos, previo aviso cuando sea razonable. Terminada la cuenta, el Usuario podrá exportar su Contenido durante el plazo que se indique, tras lo cual podrá ser eliminado conforme a la Política de Privacidad.",
    ],
  },
  {
    titulo: "13. Modificaciones",
    parrafos: [
      "PermisoHub podrá actualizar estos Términos. Los cambios materiales se comunicarán por medios razonables. El uso continuado del Servicio tras la entrada en vigencia de los cambios implica su aceptación.",
    ],
  },
  {
    titulo: "14. Ley aplicable y jurisdicción",
    parrafos: [
      "Estos Términos se rigen por las leyes de la República de Chile. Cualquier controversia se someterá a los tribunales ordinarios de justicia con asiento en [CIUDAD], sin perjuicio de los derechos irrenunciables que la ley reconozca a los consumidores.",
    ],
  },
  {
    titulo: "15. Contacto",
    parrafos: [
      "Para cualquier consulta sobre estos Términos, escríbanos a contacto@permisohub.cl.",
    ],
  },
];

export default function TerminosPage() {
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
          Términos y condiciones
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
            <Link
              href="/"
              className="transition-colors hover:text-[#E9C46A]"
            >
              Inicio
            </Link>
            <Link
              href="/politica-de-privacidad"
              className="transition-colors hover:text-[#E9C46A]"
            >
              Política de privacidad
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
