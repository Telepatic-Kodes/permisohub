import { ArrowLeft, ExternalLink, FileText, Info } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/dashboard/page-header"
import { ExploradorMapaFormularios } from "@/components/herramientas/explorador-mapa-formularios"

const MINVU_BASE = "https://www.minvu.gob.cl/elementos-tecnicos/formularios/"

export default function FormulariosMinvuPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📋"
        title="Formularios MINVU"
        subtitle="Mapa de Formularios oficial · Transcripción literal de los 5 grupos"
      />

      <div className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Link
            href="/herramientas"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-[var(--blueprint)]"
          >
            <ArrowLeft className="size-4" /> Herramientas
          </Link>

          {/* Banner MINVU */}
          <div className="rounded-[4px] border border-line-fine bg-card p-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0 flex-1">
                <p className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Repositorio oficial
                </p>
                <p className="font-technical mt-1 text-sm font-semibold text-primary">
                  Formularios oficiales MINVU
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  El explorador de abajo es una transcripción literal de los 5 PDF &quot;Mapa de Formularios&quot; del
                  Ministerio de Vivienda: para cada grupo, régimen, actuación y obra específica muestra el nombre
                  exacto del trámite. No es una aproximación — cada fila viene de un PDF descargado de minvu.gob.cl.
                </p>
                <a
                  href={MINVU_BASE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-[var(--blueprint)]"
                >
                  Ver todos los formularios en minvu.gob.cl <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Explorador oficial — transcripción literal de los 5 PDF Mapa de
              Formularios Minvu (Grupo 1-5), navegable por Grupo → Régimen →
              Actuación → Obra específica. */}
          <ExploradorMapaFormularios />

          {/* Nota Consejo de Monumentos */}
          <div className="rounded-[4px] border border-line-fine bg-card p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
              <div>
                <p className="font-technical text-sm font-semibold text-primary">Proyectos en Zonas Típicas o Monumentos Nacionales</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Si el proyecto se ubica en una Zona de Conservación Histórica, Zona Típica o en el entorno de un
                  Monumento Nacional, se requiere visación adicional del{" "}
                  <strong>Consejo de Monumentos Nacionales (CMN)</strong>{" "}
                  o de la <strong>SEREMI de Vivienda</strong>. Consultar la cartografía patrimonial y los planos
                  seccionales del PRC de la comuna antes de diseñar.
                </p>
                <a
                  href="https://www.monumentos.gob.cl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-[var(--blueprint)]"
                >
                  Consejo de Monumentos <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
