"use client"

import { useState, useRef, type FormEvent } from 'react'
import { Upload, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PROVEEDORES_POR_SERVICIO, getPeriodoActual, SERVICIO_CONFIG } from '@/lib/boletas'
import type { BoletaServicio, TipoServicioBasico } from '@/types'
import { toast } from 'sonner'

interface BoletaUploadDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  localId: string
  localNumero?: string
  defaultTipo?: TipoServicioBasico
  onSaved?: (boleta: BoletaServicio) => void
}

export function BoletaUploadDialog({
  open,
  onOpenChange,
  localId,
  localNumero,
  defaultTipo,
  onSaved,
}: BoletaUploadDialogProps) {
  const [tipoServicio, setTipoServicio] = useState<TipoServicioBasico>(defaultTipo ?? 'agua')
  const [proveedor,    setProveedor   ] = useState('')
  const [periodo,      setPeriodo     ] = useState(getPeriodoActual())
  const [numeroCuenta, setNumeroCuenta] = useState('')
  const [fechaEmision, setFechaEmision] = useState('')
  const [fechaVenc,    setFechaVenc   ] = useState('')
  const [monto,        setMonto       ] = useState('')
  const [tramiteTipo,  setTramiteTipo ] = useState('')
  const [file,         setFile        ] = useState<File | null>(null)
  const [saving,       setSaving      ] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const proveedores = PROVEEDORES_POR_SERVICIO[tipoServicio]

  function reset() {
    setTipoServicio('agua')
    setProveedor('')
    setPeriodo(getPeriodoActual())
    setNumeroCuenta('')
    setFechaEmision('')
    setFechaVenc('')
    setMonto('')
    setTramiteTipo('')
    setFile(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!proveedor) { toast.error('Selecciona un proveedor'); return }

    setSaving(true)
    try {
      let url: string | undefined

      // 1. Upload PDF si hay archivo
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('proyectoId', localId)
        fd.append('tipo', `boleta_${tipoServicio}`)
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (upRes.ok) {
          const upData = await upRes.json() as { documento?: { url: string } }
          url = upData.documento?.url
        }
      }

      // 2. Crear boleta
      const res = await fetch('/api/boletas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          local_id:          localId,
          tipo_servicio:     tipoServicio,
          proveedor,
          numero_cuenta:     numeroCuenta || undefined,
          periodo,
          url,
          fecha_emision:     fechaEmision || undefined,
          fecha_vencimiento: fechaVenc    || undefined,
          monto_clp:         monto ? parseInt(monto, 10) : undefined,
          tramite_tipo:      tramiteTipo  || undefined,
        }),
      })

      const data = await res.json() as { ok?: boolean; boleta?: BoletaServicio }
      if (!res.ok) throw new Error()

      toast.success('Boleta registrada correctamente')
      if (data.boleta) onSaved?.(data.boleta)
      reset()
      onOpenChange(false)
    } catch {
      toast.error('Error al guardar la boleta')
    } finally {
      setSaving(false)
    }
  }

  const ServicioIcon = SERVICIO_CONFIG[tipoServicio].icon

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) { reset(); onOpenChange(v) } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Registrar boleta{localNumero ? ` — Local ${localNumero}` : ''}
          </DialogTitle>
        </DialogHeader>

        <form id="boleta-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de servicio */}
          <div className="space-y-1.5">
            <Label>Tipo de servicio</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['agua', 'electricidad', 'gas'] as TipoServicioBasico[]).map((t) => {
                const cfg  = SERVICIO_CONFIG[t]
                const Icon = cfg.icon
                const active = tipoServicio === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTipoServicio(t); setProveedor('') }}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors
                      ${active
                        ? `${cfg.badgeBg} border-current`
                        : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700'
                      }`}
                  >
                    <Icon className={`size-4 ${active ? cfg.color : 'text-neutral-400'}`} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Proveedor */}
          <div className="space-y-1.5">
            <Label>Proveedor</Label>
            <Select value={proveedor} onValueChange={(v) => setProveedor(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Período (YYYY-MM)</Label>
              <Input
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                placeholder="2026-06"
                pattern="\d{4}-\d{2}"
              />
            </div>
            <div className="space-y-1.5">
              <Label>N° cuenta (opcional)</Label>
              <Input
                value={numeroCuenta}
                onChange={(e) => setNumeroCuenta(e.target.value)}
                placeholder="123456789"
              />
            </div>
          </div>

          {/* Fechas + monto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha emisión</Label>
              <Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha vencimiento</Label>
              <Input type="date" value={fechaVenc} onChange={(e) => setFechaVenc(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto (CLP)</Label>
              <Input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="45000"
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Trámite asociado</Label>
              <Select value={tramiteTipo} onValueChange={(v) => setTramiteTipo(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informe_sanitario">Informe Sanitario</SelectItem>
                  <SelectItem value="autorizacion_sanitaria_alimentos">Autorización Sanitaria</SelectItem>
                  <SelectItem value="patente_comercial">Patente Comercial</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Upload PDF */}
          <div className="space-y-1.5">
            <Label>PDF de la boleta (opcional)</Label>
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                <ServicioIcon className={`size-4 shrink-0 ${SERVICIO_CONFIG[tipoServicio].color}`} />
                <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 py-3 text-sm text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700 dark:border-neutral-700"
              >
                <Upload className="size-4" />
                Subir PDF
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="boleta-form" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar boleta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
