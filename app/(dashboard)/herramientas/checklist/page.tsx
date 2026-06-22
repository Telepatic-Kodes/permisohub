"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Building2,
  CheckSquare,
  ClipboardCopy,
  Clock,
  Printer,
  RefreshCw,
  Square,
} from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { COMUNAS_CHILE } from "@/lib/comunas-chile"

// --- Tipos ---

type ChecklistItem = {
  id: string
  nombre: string
  descripcion?: string
  copias?: string // "Original + 3 copias" | "Digital"
  warning?: boolean
}

type ChecklistSection = {
  titulo: string
  items: ChecklistItem[]
}

// --- Datos ---

const COMUNAS_NOMBRES = COMUNAS_CHILE.map((c) => c.nombre).sort((a, b) =>
  a.localeCompare(b, "es")
)

const TIPOS_PERMISO = [
  "Permiso de Edificación",
  "Revisión Normativa",
  "Supervisión de Apertura",
  "Patente Comercial",
  "Recepción Final",
] as const

type Municipio = string
type TipoPermiso = (typeof TIPOS_PERMISO)[number]

// Municipios que operan con plataforma digital (DOM en Línea)
const MUNICIPIOS_EN_LINEA: string[] = COMUNAS_CHILE
  .filter((c) => c.domStatus === "dom_en_linea")
  .map((c) => c.nombre)

// Plazo típico (días hábiles) por tipo de permiso
const PLAZOS: Record<TipoPermiso, number> = {
  "Permiso de Edificación": 60,
  "Revisión Normativa": 15,
  "Supervisión de Apertura": 20,
  "Patente Comercial": 30,
  "Recepción Final": 45,
}

// Listas base por tipo de permiso
const CHECKLISTS_BASE: Record<TipoPermiso, ChecklistItem[]> = {
  "Permiso de Edificación": [
    {
      id: "pe-1",
      nombre: "Solicitud de permiso (formulario DOM)",
      descripcion:
        "Formulario oficial firmado por propietario y arquitecto",
      copias: "Original + 3 copias",
    },
    {
      id: "pe-2",
      nombre: "Certificado de informaciones previas vigente",
      descripcion: "Vigencia máxima 180 días",
      warning: true,
    },
    {
      id: "pe-3",
      nombre: "Título de dominio o certificado de dominio vigente",
      descripcion: "No mayor a 60 días",
    },
    {
      id: "pe-4",
      nombre: "Planos de arquitectura (planta, corte, elevaciones)",
      descripcion:
        "Escala 1:50 mínimo, firmados por arquitecto habilitado",
      copias: "Original + 3 copias",
    },
    {
      id: "pe-5",
      nombre: "Memoria de cálculo estructural",
      descripcion: "Firmada por ingeniero estructural",
    },
    {
      id: "pe-6",
      nombre: "Planos estructurales",
      descripcion: "Incluir fundaciones",
    },
    {
      id: "pe-7",
      nombre: "Planilla de cálculo de dotaciones (agua, alcantarillado)",
      descripcion: "Según RIDAA vigente",
    },
    {
      id: "pe-8",
      nombre:
        "Informe sanitario o certificado SEC según corresponda",
    },
    {
      id: "pe-9",
      nombre: "Certificado de número municipal",
      descripcion: "Solicitado a la misma DOM",
    },
    {
      id: "pe-10",
      nombre: "Pago de derechos municipales",
      descripcion: "Calculado sobre presupuesto de obras",
      warning: true,
    },
  ],
  "Revisión Normativa": [
    { id: "rn-1", nombre: "Planos de arquitectura preliminares" },
    { id: "rn-2", nombre: "Certificado de informaciones previas" },
    {
      id: "rn-3",
      nombre: "Descripción del proyecto (memoria arquitectónica)",
    },
    { id: "rn-4", nombre: "Planimetría de emplazamiento" },
    { id: "rn-5", nombre: "Fotografías del predio actual" },
  ],
  "Supervisión de Apertura": [
    {
      id: "sa-1",
      nombre: "Permiso de edificación aprobado (copia)",
      copias: "Original + 3 copias",
    },
    { id: "sa-2", nombre: "Informe de inspección final" },
    {
      id: "sa-3",
      nombre:
        "Certificado de recepción de instalaciones (ESSBIO/Aguas, SEC)",
    },
    { id: "sa-4", nombre: "Declaración de término de obra" },
    { id: "sa-5", nombre: "Plano as-built (as executed)" },
    { id: "sa-6", nombre: "Certificado de habilitación del local" },
  ],
  "Patente Comercial": [
    { id: "pc-1", nombre: "Formulario solicitud patente municipal" },
    { id: "pc-2", nombre: "RUT empresa (SII)" },
    { id: "pc-3", nombre: "Inicio de actividades SII vigente" },
    {
      id: "pc-4",
      nombre: "Copia escritura sociedad o RUT persona natural",
    },
    { id: "pc-5", nombre: "Certificado de domicilio comercial" },
    {
      id: "pc-6",
      nombre: "Permiso de edificación o recepción final del local",
    },
    {
      id: "pc-7",
      nombre: "Informe sanitario SEREMI Salud (si aplica rubro)",
    },
    {
      id: "pc-8",
      nombre: "Certificado de antecedentes (persona natural)",
    },
    {
      id: "pc-9",
      nombre: "Resolución sanitaria (si es rubro de alimentos)",
    },
  ],
  "Recepción Final": [
    { id: "rf-1", nombre: "Formulario solicitud recepción DOM" },
    {
      id: "rf-2",
      nombre: "Permiso de edificación original",
      copias: "Original + 3 copias",
    },
    {
      id: "rf-3",
      nombre:
        "Libro de obras (original, con todas las inspecciones firmadas)",
    },
    {
      id: "rf-4",
      nombre: "Certificado final instalaciones eléctricas (SEC)",
    },
    {
      id: "rf-5",
      nombre: "Certificado final instalaciones sanitarias",
    },
    { id: "rf-6", nombre: "Planos as-built actualizados" },
    { id: "rf-7", nombre: "Fotografías de obra terminada" },
    { id: "rf-8", nombre: "Declaración jurada de término" },
  ],
}

// Adiciones específicas por municipio
const ADICIONES_MUNICIPIO: Partial<Record<Municipio, ChecklistItem>> = {
  Providencia: {
    id: "mun-providencia",
    nombre: "Informe de impacto vial (proyectos > 500m²)",
  },
  "Las Condes": {
    id: "mun-lascondes",
    nombre: "Informe de arborización y paisajismo",
  },
  Vitacura: {
    id: "mun-vitacura",
    nombre: "Certificado de aprobación comité de arquitectura comunal",
  },
  Santiago: {
    id: "mun-santiago",
    nombre:
      "Informe patrimonial (si zona típica o monumento nacional)",
  },
  Maipú: {
    id: "mun-maipu",
    nombre: "Certificado de no expropiación",
    warning: true,
  },
}

function buildChecklist(
  tipo: TipoPermiso,
  municipio: Municipio
): ChecklistSection[] {
  const base = CHECKLISTS_BASE[tipo]
  const adicion = ADICIONES_MUNICIPIO[municipio]

  const sections: ChecklistSection[] = [
    { titulo: "Documentos requeridos", items: base },
  ]

  if (adicion) {
    sections.push({
      titulo: `Requisito adicional — ${municipio}`,
      items: [adicion],
    })
  }

  return sections
}

// --- Componente ---

export default function ChecklistNormativoPage() {
  const [municipio, setMunicipio] = useState<Municipio | "">("")
  const [tipo, setTipo] = useState<TipoPermiso | "">("")

  // Combinación generada (se congela al hacer clic en "Generar")
  const [generado, setGenerado] = useState<{
    municipio: Municipio
    tipo: TipoPermiso
  } | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const sections = useMemo(() => {
    if (!generado) return []
    return buildChecklist(generado.tipo, generado.municipio)
  }, [generado])

  const allItems = useMemo(
    () => sections.flatMap((s) => s.items),
    [sections]
  )

  const total = allItems.length
  const completados = allItems.filter((i) => checked[i.id]).length
  const progreso = total > 0 ? Math.round((completados / total) * 100) : 0

  const canGenerate = municipio !== "" && tipo !== ""
  const enLinea =
    generado !== null && MUNICIPIOS_EN_LINEA.includes(generado.municipio)

  function handleGenerate() {
    if (municipio === "" || tipo === "") return
    setGenerado({ municipio, tipo })
    setChecked({})
  }

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function handleReset() {
    setMunicipio("")
    setTipo("")
    setGenerado(null)
    setChecked({})
  }

  async function handleCopy() {
    if (!generado) return
    const pendientes = allItems.filter((i) => !checked[i.id])
    const encabezado = `Checklist para ${generado.tipo} en ${generado.municipio}`
    const lineas = pendientes.map((i) => {
      const desc = i.descripcion ? ` — ${i.descripcion}` : ""
      return `[ ] ${i.nombre}${desc}`
    })
    const texto =
      pendientes.length === 0
        ? `${encabezado}\n\nTodos los documentos están marcados como completados.`
        : `${encabezado}\n\nDocumentos pendientes:\n${lineas.join("\n")}`

    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      // navigator.clipboard puede no estar disponible; silenciar
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Estilos de impresión */}
      <style jsx global>{`
        @media print {
          aside {
            display: none !important;
          }
          main {
            margin-left: 0 !important;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <PageHeader
        emoji="✅"
        title="Checklist Normativo"
        breadcrumbs={[
          { label: "IA Normativa" },
          { label: "Checklist Normativo" },
        ]}
      />
      <div className="flex-1 space-y-6 overflow-auto p-8">
      {/* Paso 1 — Selector */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-primary">
            1. Selecciona tu trámite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-primary">
                Municipio
              </label>
              <Select
                value={municipio}
                onValueChange={(v) => setMunicipio(v as Municipio)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar municipio" />
                </SelectTrigger>
                <SelectContent>
                  {COMUNAS_NOMBRES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-primary">
                Tipo de permiso
              </label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as TipoPermiso)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo de permiso" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_PERMISO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            size="lg"
            className="bg-primary hover:bg-primary/90"
          >
            Generar checklist
          </Button>
        </CardContent>
      </Card>

      {/* Paso 2 — Resultado */}
      {generado && (
        <>
          <Card className="print-area">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg text-primary">
                    Checklist para {generado.tipo} en {generado.municipio}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4" />
                    <span>
                      Plazo típico: {PLAZOS[generado.tipo]} días hábiles
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    enLinea
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  )}
                >
                  <Building2 className="size-3" />
                  {enLinea ? "DOM en Línea" : "Presencial"}
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Barra de progreso */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-primary">
                    Progreso
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {completados} de {total} ({progreso}%)
                  </span>
                </div>
                <Progress value={progreso} />
              </div>

              {/* Secciones de documentos */}
              {sections.map((section) => (
                <div key={section.titulo} className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide text-primary uppercase">
                    {section.titulo}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {section.items.map((item) => {
                      const isChecked = !!checked[item.id]
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggle(item.id)}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                            isChecked
                              ? "border-primary/30 bg-[#F0EBE1]"
                              : "border-border bg-card hover:bg-[#F0EBE1]"
                          )}
                        >
                          <span className="mt-0.5 shrink-0 text-primary">
                            {isChecked ? (
                              <CheckSquare className="size-5" />
                            ) : (
                              <Square className="size-5 text-muted-foreground" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 space-y-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "font-semibold text-primary",
                                  isChecked &&
                                    "line-through opacity-60"
                                )}
                              >
                                {item.nombre}
                              </span>
                              {item.copias && (
                                <Badge variant="outline">
                                  {item.copias}
                                </Badge>
                              )}
                              {item.warning && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                  <AlertTriangle className="size-3" />
                                  Error común
                                </span>
                              )}
                            </span>
                            {item.descripcion && (
                              <span className="block text-xs text-muted-foreground">
                                {item.descripcion}
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Fila de acciones */}
          <div className="no-print flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.print()}
            >
              <Printer className="size-4" />
              Imprimir checklist
            </Button>
            <Button variant="outline" size="lg" onClick={handleCopy}>
              <ClipboardCopy className="size-4" />
              Copiar al portapapeles
            </Button>
            <Button variant="ghost" size="lg" onClick={handleReset}>
              <RefreshCw className="size-4" />
              Nuevo checklist
            </Button>
          </div>
        </>
      )}
      </div>
    </div>
  )
}
