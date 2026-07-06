"use client"

import { useState } from "react"
import { ArrowLeft, ChevronRight, ExternalLink, FileText, Info } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/dashboard/page-header"
import { Num } from "@/components/arch/dato"
import { cn } from "@/lib/utils"

const MINVU_BASE = "https://www.minvu.gob.cl/elementos-tecnicos/formularios/"

interface Formulario {
  id: string
  nombre: string
  descripcion: string
  categoria: string
  articuloOguc?: string
  camposPreLlenados: string[]
  urlMinvu?: string
  nota?: string
}

const CATEGORIAS = [
  "Todos",
  "Permisos",
  "Obras Menores",
  "Recepciones",
  "Certificados",
  "Especialidades",
]

const FORMULARIOS: Formulario[] = [
  // PERMISOS
  {
    id: "solicitud-permiso-edificacion",
    nombre: "Solicitud de Permiso de Edificación",
    descripcion: "Formulario de ingreso de permiso de edificación para obras nuevas, ampliaciones y remodelaciones que requieren permiso completo.",
    categoria: "Permisos",
    articuloOguc: "Art. 5.1.6 OGUC",
    urlMinvu: MINVU_BASE,
    camposPreLlenados: ["Nombre del propietario", "RUT propietario", "Dirección del proyecto", "Municipio", "Tipo de obra"],
    nota: "El formulario debe ir firmado por propietario y arquitecto proyectista.",
  },
  {
    id: "solicitud-anteproyecto",
    nombre: "Solicitud de Anteproyecto",
    descripcion: "Aprobación previa de diseño. Una vez aprobado, congela la normativa aplicable por 180 días hábiles.",
    categoria: "Permisos",
    articuloOguc: "Art. 1.1.2 OGUC",
    urlMinvu: MINVU_BASE,
    camposPreLlenados: ["Propietario", "RUT", "Dirección", "Municipio"],
  },
  {
    id: "solicitud-ampliacion",
    nombre: "Solicitud de Permiso de Ampliación",
    descripcion: "Para aumentar superficie construida en una edificación existente con permiso de edificación vigente.",
    categoria: "Permisos",
    articuloOguc: "Art. 5.2.1 OGUC",
    urlMinvu: MINVU_BASE,
    camposPreLlenados: ["Propietario", "RUT", "Dirección", "Municipio", "N° expediente original"],
  },
  // OBRAS MENORES
  {
    id: "declaracion-jurada-obra-menor",
    nombre: "Declaración Jurada Obra Menor (Art. 5.1.2)",
    descripcion: "Para obras de mantención y reparación que no alteran estructura ni superficie construida. Exenta de permiso — se ingresa solo la declaración.",
    categoria: "Obras Menores",
    articuloOguc: "Art. 5.1.2 OGUC",
    urlMinvu: MINVU_BASE,
    camposPreLlenados: ["Propietario", "RUT propietario", "Dirección", "Municipio", "Tipo de obra", "Arquitecto", "N° Matrícula MINVU"],
    nota: "PermisoHub puede generar este documento directamente en Herramientas → Declaración Jurada.",
  },
  {
    id: "solicitud-obra-menor-permiso",
    nombre: "Solicitud Obra Menor con Permiso (Art. 5.1.4)",
    descripcion: "Para obras menores que requieren permiso DOM simplificado (cambios de tabiques, ventanas con modificación de vanos, techumbres en áreas > 10 m², etc.).",
    categoria: "Obras Menores",
    articuloOguc: "Art. 5.1.4 OGUC",
    urlMinvu: MINVU_BASE,
    camposPreLlenados: ["Propietario", "RUT", "Dirección", "Municipio", "Arquitecto"],
  },
  // RECEPCIONES
  {
    id: "solicitud-recepcion-final",
    nombre: "Solicitud de Recepción Final",
    descripcion: "Certificación de término de obra. Requiere adjuntar certificados de todas las especialidades: electricidad (SEC), gas, sanitario, ascensores (si aplica), y registro de ITO.",
    categoria: "Recepciones",
    articuloOguc: "Art. 5.2.5 OGUC",
    urlMinvu: MINVU_BASE,
    camposPreLlenados: ["Propietario", "RUT", "Dirección", "Municipio", "N° permiso original"],
    nota: "La recepción final requiere que la constructora entregue los certificados de cada especialidad. Sin ellos, la DOM no puede aprobar la recepción.",
  },
  {
    id: "solicitud-recepcion-parcial",
    nombre: "Solicitud de Recepción Parcial",
    descripcion: "Para recepcionar una etapa de obra mientras continúa la construcción de las demás etapas autorizadas.",
    categoria: "Recepciones",
    articuloOguc: "Art. 5.2.6 OGUC",
    urlMinvu: MINVU_BASE,
    camposPreLlenados: ["Propietario", "RUT", "Dirección", "Municipio", "N° permiso original", "Etapa a recepcionar"],
  },
  // CERTIFICADOS
  {
    id: "cip",
    nombre: "Solicitud de Certificado de Informaciones Previas (CIP)",
    descripcion: "Documento fundamental antes de diseñar. Informa uso de suelo, coeficientes de constructibilidad y ocupación, altura máxima, rasantes, afectaciones viales, y más.",
    categoria: "Certificados",
    articuloOguc: "Art. 1.1.4 OGUC",
    urlMinvu: MINVU_BASE,
    camposPreLlenados: ["Propietario / Solicitante", "RUT", "Dirección del predio", "Municipio"],
    nota: "Solicitar con al menos 30 días antes del ingreso del permiso. Vigencia: 6 meses.",
  },
  {
    id: "certificado-numero",
    nombre: "Solicitud de Certificado de Número",
    descripcion: "Asignación oficial del número de la propiedad por parte del municipio.",
    categoria: "Certificados",
    urlMinvu: MINVU_BASE,
    camposPreLlenados: ["Propietario", "RUT", "Dirección", "Municipio"],
  },
  {
    id: "linea-de-edificacion",
    nombre: "Solicitud de Certificado de Línea de Edificación",
    descripcion: "Confirma la línea oficial de edificación y el deslinde con la vía pública. Requerido en muchos municipios para el ingreso del permiso.",
    categoria: "Certificados",
    articuloOguc: "Art. 5.1.4 OGUC",
    urlMinvu: MINVU_BASE,
    camposPreLlenados: ["Propietario", "RUT", "Dirección", "Municipio"],
    nota: "Vigencia: 6 meses. Renovar si vence antes del ingreso del permiso.",
  },
  // ESPECIALIDADES
  {
    id: "certificado-electrico",
    nombre: "Certificado de Instalación Eléctrica (SEC)",
    descripcion: "Emitido por la Superintendencia de Electricidad y Combustibles tras la inspección de la instalación eléctrica. Obligatorio para recepción final.",
    categoria: "Especialidades",
    camposPreLlenados: ["Dirección", "N° permiso"],
    nota: "Lo tramita el instalador eléctrico autorizado SEC, no el arquitecto directamente.",
  },
  {
    id: "certificado-gas",
    nombre: "Certificado de Instalación de Gas",
    descripcion: "Certificación de la instalación de gas por empresa revisora autorizada. Obligatorio para recepción final cuando el proyecto incluye gas.",
    categoria: "Especialidades",
    camposPreLlenados: ["Dirección", "N° permiso"],
    nota: "Tramitar con empresa revisora autorizada (GASCO, Abastible, etc.).",
  },
  {
    id: "certificado-sanitario",
    nombre: "Certificado de Instalaciones Sanitarias",
    descripcion: "Aprobación del proyecto sanitario por parte de la empresa de agua potable (Aguas Andinas, ESSBIO, ESSAL según región). Requisito para ingreso DOM y recepción final.",
    categoria: "Especialidades",
    camposPreLlenados: ["Dirección", "Municipio"],
    nota: "Tramitar directamente con la empresa sanitaria de la región. Puede demorar 15-20 días hábiles.",
  },
]

export default function FormulariosMinvuPage() {
  const [categoria, setCategoria] = useState("Todos")
  const [expandido, setExpandido] = useState<string | null>(null)

  const filtrados = categoria === "Todos"
    ? FORMULARIOS
    : FORMULARIOS.filter((f) => f.categoria === categoria)

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📋"
        title="Formularios MINVU"
        subtitle="Trámites DOM oficiales · Pre-llenado desde tu proyecto"
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
                  Estos son los formularios vigentes del Ministerio de Vivienda para trámites DOM. Cada formulario indica qué campos de tu proyecto pueden pre-llenarse automáticamente.
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

          {/* Section header */}
          <div className="flex items-end justify-between gap-4 border-b border-line-med pb-4">
            <div>
              <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Trámites DOM
              </p>
              <h2 className="font-technical mt-1.5 text-lg font-semibold leading-none text-primary">
                Catálogo de formularios
              </h2>
            </div>
            <span className="num text-xs text-muted-foreground/70">
              {filtrados.length} de {FORMULARIOS.length}
            </span>
          </div>

          {/* Filtro por categoría */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoria(cat)}
                className={cn(
                  "font-technical rounded-[4px] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors",
                  categoria === cat
                    ? "border border-[var(--blueprint)] bg-[var(--blueprint)]/[0.05] text-[var(--blueprint)]"
                    : "border border-line-fine text-muted-foreground hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Lista de formularios */}
          <div className="space-y-2">
            {filtrados.map((form) => (
              <div
                key={form.id}
                className="overflow-hidden rounded-[4px] border border-line-fine bg-card transition-colors hover:border-[var(--blueprint)]"
              >
                <button
                  onClick={() => setExpandido(expandido === form.id ? null : form.id)}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[var(--blueprint)]/[0.05]"
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[3px] border border-line-fine">
                    <FileText className="size-4 text-muted-foreground/70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start gap-2">
                      <p className="font-technical text-[13px] font-semibold leading-snug text-primary">{form.nombre}</p>
                      <span className="font-technical shrink-0 rounded-[3px] border border-line-fine px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {form.categoria}
                      </span>
                    </div>
                    {form.articuloOguc && (
                      <Num className="mt-0.5 block text-[10.5px] text-muted-foreground/60">{form.articuloOguc}</Num>
                    )}
                  </div>
                  <ChevronRight
                    className={cn(
                      "mt-1 size-4 shrink-0 text-muted-foreground/40 transition-transform",
                      expandido === form.id && "rotate-90"
                    )}
                  />
                </button>

                {expandido === form.id && (
                  <div className="space-y-3 border-t border-line-fine px-4 pb-4 pt-3">
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">{form.descripcion}</p>

                    {/* Campos pre-llenados */}
                    <div className="rounded-[4px] border border-line-fine p-3">
                      <p className="font-technical mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Campos que PermisoHub puede pre-llenar desde tu proyecto
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {form.camposPreLlenados.map((campo) => (
                          <span
                            key={campo}
                            className="rounded-[3px] border border-line-fine px-2 py-0.5 text-[10.5px] text-muted-foreground"
                          >
                            {campo}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Nota */}
                    {form.nota && (
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                        <p className="text-[11.5px] leading-relaxed text-muted-foreground">{form.nota}</p>
                      </div>
                    )}

                    {/* Botón MINVU */}
                    <a
                      href={form.urlMinvu ?? MINVU_BASE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-[4px] border border-line-fine px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-[var(--blueprint)] hover:bg-[var(--blueprint)]/[0.05] hover:text-[var(--blueprint)]"
                    >
                      <ExternalLink className="size-3.5" />
                      Descargar desde minvu.gob.cl
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Nota Consejo de Monumentos */}
          <div className="rounded-[4px] border border-line-fine bg-card p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
              <div>
                <p className="font-technical text-sm font-semibold text-primary">Proyectos en Zonas Típicas o Monumentos Nacionales</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Si el proyecto se ubica en una Zona de Conservación Histórica, Zona Típica o en el entorno de un Monumento Nacional, se requiere visación adicional del{" "}
                  <strong>Consejo de Monumentos Nacionales (CMN)</strong>{" "}
                  o de la <strong>SEREMI de Vivienda</strong>. Consultar la cartografía patrimonial y los planos seccionales del PRC de la comuna antes de diseñar.
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
