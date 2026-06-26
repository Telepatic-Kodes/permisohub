"use client"
// cadenas-v1
import { useEffect, useState } from "react"
import Link from "next/link"
import { Building2, ChevronRight, MapPin, Plus, Store } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MOCK_CADENAS, MOCK_CENTROS } from "@/lib/mock-data"
import type { Cadena } from "@/types"

type CadenaConStats = Cadena & { num_centros: number; num_locales: number; proyectos_activos: number }

export default function CadenasPage() {
  const [cadenas, setCadenas] = useState<CadenaConStats[]>(
    MOCK_CADENAS.map(c => ({
      ...c,
      num_centros: MOCK_CENTROS.filter(cc => cc.cadena_id === c.id).length,
      num_locales: MOCK_CENTROS.filter(cc => cc.cadena_id === c.id).reduce((s, cc) => s + (cc.num_locales ?? 0), 0),
      proyectos_activos: 0,
    }))
  )

  useEffect(() => {
    fetch('/api/cadenas')
      .then(r => r.json())
      .then((d: { data?: CadenaConStats[] }) => {
        if (d.data && d.data.length > 0) setCadenas(d.data)
      })
      .catch(() => undefined)
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        emoji="🏬"
        title="Cadenas Comerciales"
        subtitle="Carteras de centros comerciales y locales"
        action={
          <Link href="/cadenas/nueva">
            <Button size="sm">
              <Plus className="size-4" />
              Nueva cadena
            </Button>
          </Link>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Building2 className="size-4" /> Cadenas activas
          </div>
          <div className="text-3xl font-semibold">{cadenas.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <MapPin className="size-4" /> Centros comerciales
          </div>
          <div className="text-3xl font-semibold">
            {cadenas.reduce((s, c) => s + c.num_centros, 0)}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Store className="size-4" /> Locales gestionados
          </div>
          <div className="text-3xl font-semibold">
            {cadenas.reduce((s, c) => s + c.num_locales, 0)}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cadena</TableHead>
              <TableHead>RUT</TableHead>
              <TableHead>Municipios</TableHead>
              <TableHead className="text-right">Centros</TableHead>
              <TableHead className="text-right">Locales</TableHead>
              <TableHead className="text-right">Permisos activos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cadenas.map(c => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
                <TableCell>
                  <Link href={`/cadenas/${c.id}`} className="font-medium hover:underline">
                    {c.nombre}
                  </Link>
                  {c.contacto_nombre && (
                    <div className="text-xs text-muted-foreground">{c.contacto_nombre}</div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.rut ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(c.municipios ?? []).slice(0, 3).map(m => (
                      <Badge key={m} variant="secondary" className="text-xs font-normal">{m}</Badge>
                    ))}
                    {(c.municipios ?? []).length > 3 && (
                      <Badge variant="outline" className="text-xs font-normal">
                        +{(c.municipios ?? []).length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{c.num_centros}</TableCell>
                <TableCell className="text-right font-medium">{c.num_locales}</TableCell>
                <TableCell className="text-right">
                  {c.proyectos_activos > 0 ? (
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">{c.proyectos_activos}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/cadenas/${c.id}`}>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {cadenas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No hay cadenas registradas.{" "}
                  <Link href="/cadenas/nueva" className="underline">Crear la primera</Link>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
