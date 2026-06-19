"use client"

import { useMemo, useState } from "react"
import {
  ChevronDown,
  Clock,
  FileCheck,
  Globe,
  Mail,
  MapPin,
  Phone,
  Search,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MOCK_MUNICIPIOS } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

function plazoColor(dias?: number) {
  if (!dias) return "bg-gray-100 text-gray-700"
  if (dias < 90) return "bg-green-100 text-green-700"
  if (dias <= 180) return "bg-yellow-100 text-yellow-700"
  return "bg-red-100 text-red-700"
}

export default function MunicipiosPage() {
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)

  const municipios = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return MOCK_MUNICIPIOS
    return MOCK_MUNICIPIOS.filter((m) => m.nombre.toLowerCase().includes(q))
  }, [search])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
          Municipios
        </h1>
        <p className="text-sm text-muted-foreground">
          Base de conocimiento normativo
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar municipio..."
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {municipios.map((m) => {
          const isOpen = expanded === m.id
          const enLinea = m.plataforma_tipo === "DOM en Línea"
          return (
            <Card key={m.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[#1A3328]">
                      {m.nombre}
                    </h2>
                    <Badge variant="outline">{m.region}</Badge>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      enLinea
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    )}
                  >
                    <Globe className="size-3" />
                    {m.plataforma_tipo}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Plazo típico:</span>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      plazoColor(m.plazo_tipico_dias)
                    )}
                  >
                    {m.plazo_tipico_dias} días
                  </span>
                </div>

                <div className="grid gap-1.5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Phone className="size-4" />
                    {m.dom_telefono}
                  </span>
                  <span className="flex items-center gap-2">
                    <Mail className="size-4" />
                    {m.dom_email}
                  </span>
                  {m.dom_horario && (
                    <span className="flex items-center gap-2">
                      <MapPin className="size-4" />
                      {m.dom_horario}
                    </span>
                  )}
                </div>

                <div className="border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    className="flex w-full items-center justify-between text-sm font-medium text-[#1A3328]"
                  >
                    <span className="flex items-center gap-2">
                      <FileCheck className="size-4" />
                      Ver requisitos
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {isOpen && (
                    <ul className="mt-3 space-y-1.5">
                      {m.requisitos.map((r) => (
                        <li
                          key={r.nombre}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#1A3328]" />
                          <span>
                            {r.nombre}
                            {!r.obligatorio && (
                              <span className="ml-1 text-xs italic">
                                (si aplica)
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
