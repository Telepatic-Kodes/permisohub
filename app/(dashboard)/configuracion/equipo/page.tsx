"use client"

import { useEffect, useState } from "react"
import {
  Check,
  Clock,
  Copy,
  Crown,
  Eye,
  Link2,
  Mail,
  MoreHorizontal,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Wrench,
  X,
} from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROL_LABELS, ROL_DESCRIPCION, type RolWorkspace, type WorkspaceMember, type WorkspaceInvite } from "@/types"

// ──────────────────────────────────────────────────
// Role UI helpers
// ──────────────────────────────────────────────────
const ROL_ICON: Record<RolWorkspace, typeof Crown> = {
  admin:      Crown,
  arquitecto: Wrench,
  viewer:     Eye,
}

function RolBadge({ role }: { role: RolWorkspace }) {
  // Un rol inesperado no debe tumbar la página entera: se degrada al más
  // restrictivo. Pasó con las invitaciones, que traían la columna `rol`.
  const Icon = ROL_ICON[role] ?? ROL_ICON.viewer
  const etiqueta = ROL_LABELS[role] ?? role ?? "—"
  return (
    <span className="inline-flex items-center gap-1 rounded-[3px] border border-line-med px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      <Icon className="size-2.5" />
      {etiqueta}
    </span>
  )
}

function Initials({ nombre }: { nombre?: string }) {
  const init = (nombre ?? "?").split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("")
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
      {init}
    </div>
  )
}

// ──────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────
export default function EquipoPage() {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  useEffect(() => {
    fetch('/api/workspace/members')
      .then((r) => r.json())
      .then((d: { members?: WorkspaceMember[]; invites?: WorkspaceInvite[] }) => {
        if (d.members) setMembers(d.members)
        if (d.invites) setInvites(d.invites)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRol, setInviteRol] = useState<RolWorkspace>("arquitecto")
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  // El envío de correo no está configurado en producción, así que la
  // invitación se entrega copiando el enlace. Antes se descartaba la respuesta
  // del servidor —donde viene el token real— y se mostraba uno inventado en el
  // cliente, que no servía para entrar.
  async function handleInvite() {
    const email = inviteEmail.trim()
    if (!email || inviteLoading) return
    setInviteLoading(true)
    setInviteError(null)
    try {
      const res = await fetch("/api/workspace/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRol }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        url?: string
        invite?: WorkspaceInvite
      }
      if (!res.ok || !json.ok || !json.url) {
        setInviteError(json.error ?? "No se pudo crear la invitación")
        return
      }
      if (json.invite) setInvites((prev) => [...prev, json.invite as WorkspaceInvite])
      setInviteUrl(json.url)
      setInviteEmail("")
      setInviteSent(true)
    } catch {
      setInviteError("No se pudo conectar con el servidor")
    } finally {
      setInviteLoading(false)
    }
  }

  async function copiarEnlace() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function removeInvite(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }

  function changeRole(memberId: string, role: RolWorkspace) {
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role } : m))
    setMenuOpen(null)
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    setMenuOpen(null)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="👥"
        title="Equipo"
        subtitle="Gestión de miembros y accesos del workspace"
        action={
          <Button
            size="sm"
            onClick={() => setShowInvite(true)}
            className="gap-1.5"
          >
            <UserPlus className="size-3.5" />
            Invitar miembro
          </Button>
        }
      />

      <div className="flex-1 px-6 py-8 space-y-6 max-w-3xl">

        {/* Invite modal */}
        {showInvite && (
          <div className="rounded-[4px] border border-line-med bg-[var(--blueprint)]/[0.03] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-technical text-[13px] font-semibold text-primary">Invitar nuevo miembro</p>
              <button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-[var(--blueprint)]">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
              <div className="space-y-1">
                <Label className="text-xs">Correo electrónico</Label>
                <Input
                  type="email"
                  placeholder="arquitecto@ejemplo.cl"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rol</Label>
                <Select value={inviteRol} onValueChange={(v) => setInviteRol(v as RolWorkspace)}>
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["admin", "arquitecto", "viewer"] as RolWorkspace[]).map((r) => (
                      <SelectItem key={r} value={r} label={ROL_LABELS[r]}>
                        <div>
                          <p className="text-xs font-medium">{ROL_LABELS[r]}</p>
                          <p className="text-[10px] text-muted-foreground">{ROL_DESCRIPCION[r]}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={handleInvite} disabled={inviteLoading} className="h-9 gap-1.5">
                  {inviteLoading ? (
                    <>Creando…</>
                  ) : inviteSent ? (
                    <><Check className="size-3.5" /> Creada</>
                  ) : (
                    <><Mail className="size-3.5" /> Crear invitación</>
                  )}
                </Button>
              </div>
            </div>

            {inviteError && (
              <p className="text-xs" style={{ color: "var(--state-error)" }}>
                {inviteError}
              </p>
            )}

            {/* El correo automático no está configurado: la invitación se
                entrega copiando este enlace y mandándolo por donde sea. */}
            {inviteUrl && (
              <div className="rounded-[3px] border border-line-med bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Enlace de invitación — envíaselo tú
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="num min-w-0 flex-1 truncate rounded-[3px] bg-muted/50 px-2 py-1.5 text-[11px]">
                    {inviteUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={copiarEnlace} className="h-8 shrink-0 gap-1.5">
                    {copiado ? <><Check className="size-3.5" /> Copiado</> : <>Copiar</>}
                  </Button>
                </div>
                <p className="mt-2 text-[10.5px] leading-4 text-muted-foreground">
                  Vence en 7 días. Solo funciona para quien inicie sesión con ese mismo correo.
                </p>
              </div>
            )}
            <div className="space-y-2 border-t border-line-fine pt-3">
              {(["admin", "arquitecto", "viewer"] as RolWorkspace[]).map((r) => (
                <div key={r} className="flex items-start gap-2">
                  {(() => { const Icon = ROL_ICON[r]; return <Icon className="size-3.5 mt-0.5 shrink-0 text-muted-foreground/70" /> })()}
                  <p className="text-[10.5px] text-muted-foreground">
                    <span className="font-medium text-primary">{ROL_LABELS[r]}:</span> {ROL_DESCRIPCION[r]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members list */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-3.5 text-muted-foreground" />
            <p className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/70">
              Miembros activos (<span className="num">{members.length}</span>)
            </p>
          </div>
          <div className="rounded-[4px] border border-line-med bg-card divide-y divide-line-fine overflow-hidden">
            {!loading && members.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Aún no hay miembros en el equipo. Invita a tu primer miembro.
              </div>
            )}
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Initials nombre={m.nombre} />
                <div className="flex-1 min-w-0">
                  <p className="font-technical text-[13px] font-medium text-primary truncate">{m.nombre ?? m.email}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate">{m.email}</p>
                </div>
                <RolBadge role={m.role} />
                {m.role === "viewer" && (
                  <button
                    disabled
                    title="Genera un enlace desde el proyecto"
                    className="flex cursor-not-allowed items-center gap-1 rounded-[4px] border border-line-fine px-2 py-1 text-[10.5px] text-muted-foreground/50"
                  >
                    <Copy className="size-3" /> Link portal
                  </button>
                )}
                {m.role !== "admin" && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                      className="flex size-7 items-center justify-center rounded-[4px] text-muted-foreground/40 hover:bg-[var(--blueprint)]/[0.06] hover:text-[var(--blueprint)] transition-colors"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                    {menuOpen === m.id && (
                      <div className="absolute right-0 top-8 z-10 w-44 rounded-[6px] border border-line-med bg-card shadow-lg py-1">
                        {(["arquitecto", "viewer"] as RolWorkspace[]).filter((r) => r !== m.role).map((r) => (
                          <button
                            key={r}
                            onClick={() => changeRole(m.id, r)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--blueprint)]/[0.06] text-left"
                          >
                            {(() => { const Icon = ROL_ICON[r]; return <Icon className="size-3.5 text-muted-foreground" /> })()}
                            Cambiar a {ROL_LABELS[r]}
                          </button>
                        ))}
                        <div className="my-1 h-px bg-line-fine" />
                        <button
                          onClick={() => removeMember(m.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 text-left"
                        >
                          <Trash2 className="size-3.5" />
                          Eliminar del equipo
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pending invites */}
        {invites.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="size-3.5 text-muted-foreground" />
              <p className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/70">
                Invitaciones pendientes (<span className="num">{invites.length}</span>)
              </p>
            </div>
            <div className="rounded-[4px] border border-line-med bg-card divide-y divide-line-fine overflow-hidden">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong">
                    <Mail className="size-4 text-muted-foreground/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-primary truncate">{inv.email}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Vence <span className="num">{new Date(inv.expires_at).toLocaleDateString("es-CL")}</span>
                    </p>
                  </div>
                  <RolBadge role={inv.role} />
                  <button
                    onClick={() => removeInvite(inv.id)}
                    className="flex size-7 items-center justify-center rounded-[4px] text-muted-foreground/30 transition-colors hover:text-[var(--state-error)]"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info portal */}
        <div className="rounded-[4px] border border-line-med bg-[var(--blueprint)]/[0.03] p-4">
          <div className="flex items-start gap-3">
            <Link2 className="size-4 text-[var(--blueprint)] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-technical text-[13px] font-semibold text-primary">Portal de cliente — acceso por link</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Cada miembro con rol <strong className="font-semibold text-foreground/80">Sólo lectura</strong> tiene un link único al portal.
                Compártelo con el mandante, administradora o locatario — no necesitan crear cuenta.
                Solo ven sus proyectos, no el panel completo.
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Link
                  href="/portal"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[var(--blueprint)] transition-colors"
                >
                  <Shield className="size-3.5" />
                  Portal general →
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
