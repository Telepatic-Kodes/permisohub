"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Copy, ExternalLink, FileText, Mail, Plus } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MOCK_CADENAS, MOCK_CENTROS, MOCK_LOCALES } from "@/lib/mock-data"
import { USO_LOCAL_LABELS } from "@/types"
import type { Local, Proyecto } from "@/types"

const ESTADO_LABELS: Record<string, string> = {
  borrador:           'Borrador',
  ingresado:          'Ingresado',
  en_revision:        'En revisión',
  con_observaciones:  'Con observaciones',
  aprobado:           'Aprobado',
  rechazado:          'Rechazado',
}

const ESTADO_BADGE: Record<string, string> = {
  borrador:           'bg-slate-100 text-slate-600 border-slate-200',
  ingresado:          'bg-blue-100 text-blue-700 border-blue-200',
  en_revision:        'bg-violet-100 text-violet-700 border-violet-200',
  con_observaciones:  'bg-amber-100 text-amber-700 border-amber-200',
  aprobado:           'bg-green-100 text-green-700 border-green-200',
  rechazado:          'bg-red-100 text-red-700 border-red-200',
}

export default function LocalDetailPage({
  params,
}: {
  params: Promise<{ id: string; centroId: string; localId: string }>
}) {
  const { id, centroId, localId } = use(params)

  const mockLocal = MOCK_LOCALES.find(l => l.id === localId)
  const mockCentro = MOCK_CENTROS.find(cc => cc.id === centroId)
  const mockCadena = MOCK_CADENAS.find(c => c.id === id)

  const [local, setLocal] = useState<Local | undefined>(mockLocal)
  const [proyectos, setProyectos] = useState<Proyecto[]>(mockLocal?.proyectos ?? [])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/locales/${localId}`)
      .then(r => r.json())
      .then((d: { local?: Local & { proyectos?: Proyecto[] } }) => {
        if (d.local) {
          setLocal(d.local)
          if (d.local.proyectos) setProyectos(d.local.proyectos)
        }
      })
      .catch(() => undefined)
  }, [localId])

  async function copyPortalLink() {
    const res = await fetch('/api/portal/generate-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ local_id: localId }),
    })
    const data = await res.json() as { url?: string; token?: string }
    const url = data.url ?? `${window.location.origin}/portal/${data.token ?? 'demo'}`
    await navigator.clipboard.writeText(url).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!local) return <div className="p-8 text-muted-foreground">Local no encontrado.</div>

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        emoji="🏪"
        title={`${local.numero}${local.nombre_negocio ? ` — ${local.nombre_negocio}` : ''}`}
        subtitle={mockCentro?.nombre ?? 'Local comercial'}
        breadcrumbs={[
          { label: 'Cadenas', href: '/cadenas' },
          { label: mockCadena?.nombre ?? 'Cadena', href: `/cadenas/${id}` },
          { label: mockCentro?.nombre ?? 'Centro', href: `/cadenas/${id}/centros/${centroId}` },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyPortalLink}>
              {copied ? (
                <><Copy className="size-4" /> ¡Copiado!</>
              ) : (
                <><Copy className="size-4" /> Copiar link locatario</>
              )}
            </Button>
            <Link href={`/proyectos/nuevo?localId=${localId}&centroId=${centroId}`}>
              <Button size="sm">
                <Plus className="size-4" />
                Nuevo permiso
              </Button>
            </Link>
          </div>
        }
      />

      {/* Info del local */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Tipo de uso</div>
          <div className="font-semibold">
            {local.uso ? USO_LOCAL_LABELS[local.uso] : '—'}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Superficie</div>
          <div className="font-semibold">{local.area_m2 ? `${local.area_m2} m²` : '—'}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 col-span-2">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <Mail className="size-3.5" /> Contacto locatario
          </div>
          <div className="font-semibold text-sm">{local.tenant_nombre ?? '—'}</div>
          {local.tenant_email && (
            <div className="text-xs text-muted-foreground">{local.tenant_email}</div>
          )}
        </div>
      </div>

      {/* Proyectos DOM */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Permisos DOM
          </h2>
          <Link href={`/proyectos/nuevo?localId=${localId}&centroId=${centroId}`}>
            <Button variant="outline" size="sm">
              <Plus className="size-4" /> Nuevo permiso
            </Button>
          </Link>
        </div>

        {proyectos.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-12 text-center text-muted-foreground">
            <FileText className="size-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin permisos registrados para este local.</p>
            <Link
              href={`/proyectos/nuevo?localId=${localId}&centroId=${centroId}`}
              className="text-sm text-primary underline mt-2 inline-block"
            >
              Registrar primer permiso
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {proyectos.map(p => (
              <div
                key={p.id}
                className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.nombre}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.tipo.replace(/_/g, ' ')} · {p.municipio} · Inicio {p.fecha_inicio}
                  </div>
                </div>
                <Badge className={`text-xs shrink-0 ${ESTADO_BADGE[p.estado] ?? ''}`}>
                  {ESTADO_LABELS[p.estado] ?? p.estado}
                </Badge>
                <Link href={`/proyectos/${p.id}`}>
                  <ExternalLink className="size-4 text-muted-foreground hover:text-foreground transition-colors" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
