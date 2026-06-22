"use client"

import { useState } from "react"
import { ArrowLeft, ChevronRight, ExternalLink, FileText, Info } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"

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
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="size-4" /> Herramientas
          </Link>

          {/* Banner MINVU */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-start gap-3">
              <FileText className="size-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-900">Formularios oficiales MINVU</p>
                <p className="mt-1 text-xs text-indigo-700 leading-relaxed">
                  Estos son los formularios vigentes del Ministerio de Vivienda para trámites DOM. Cada formulario indica qué campos de tu proyecto pueden pre-llenarse automáticamente.
                </p>
                <a
                  href={MINVU_BASE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Ver todos los formularios en minvu.gob.cl <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Filtro por categoría */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoria(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  categoria === cat
                    ? "bg-primary text-white"
                    : "bg-white border border-border text-muted-foreground hover:border-primary/30 hover:text-primary"
                }`}
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
                className="rounded-xl border border-border bg-white overflow-hidden"
              >
                <button
                  onClick={() => setExpandido(expandido === form.id ? null : form.id)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-[#F9F7F3] transition-colors"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 mt-0.5">
                    <FileText className="size-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-primary leading-snug">{form.nombre}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0">{form.categoria}</Badge>
                    </div>
                    {form.articuloOguc && (
                      <p className="text-[10.5px] text-muted-foreground/60 mt-0.5">{form.articuloOguc}</p>
                    )}
                  </div>
                  <ChevronRight
                    className={`size-4 text-muted-foreground/30 shrink-0 mt-1 transition-transform ${
                      expandido === form.id ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {expandido === form.id && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    <p className="text-[12.5px] text-muted-foreground leading-relaxed">{form.descripcion}</p>

                    {/* Campos pre-llenados */}
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                      <p className="text-[11px] font-semibold text-emerald-800 mb-2">
                        Campos que PermisoHub puede pre-llenar desde tu proyecto:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {form.camposPreLlenados.map((campo) => (
                          <span
                            key={campo}
                            className="rounded-full bg-white border border-emerald-200 px-2 py-0.5 text-[10.5px] text-emerald-700"
                          >
                            {campo}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Nota */}
                    {form.nota && (
                      <div className="flex items-start gap-2">
                        <Info className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11.5px] text-amber-700 leading-relaxed">{form.nota}</p>
                      </div>
                    )}

                    {/* Botón MINVU */}
                    <a
                      href={form.urlMinvu ?? MINVU_BASE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
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
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Proyectos en Zonas Típicas o Monumentos Nacionales</p>
                <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                  Si el proyecto se ubica en una Zona de Conservación Histórica, Zona Típica o en el entorno de un Monumento Nacional, se requiere visación adicional del{" "}
                  <strong>Consejo de Monumentos Nacionales (CMN)</strong>{" "}
                  o de la <strong>SEREMI de Vivienda</strong>. Consultar la cartografía patrimonial y los planos seccionales del PRC de la comuna antes de diseñar.
                </p>
                <a
                  href="https://www.monumentos.gob.cl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
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
