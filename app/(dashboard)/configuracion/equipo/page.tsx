"use client"

import { useEffect, useState } from "react"
import {
  Check,
  Clock,
  Copy,
  Crown,
  Eye,
  ExternalLink,
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
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────────
const MOCK_MEMBERS: WorkspaceMember[] = [
  {
    id: "m1",
    workspace_id: "ws1",
    user_id: "u1",
    role: "admin",
    nombre: "Estefanía Parada",
    email: "estefania@arch.cl",
    joined_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "m2",
    workspace_id: "ws1",
    user_id: "u2",
    role: "arquitecto",
    nombre: "Carlos Muñoz",
    email: "carlos@arch.cl",
    joined_at: "2026-03-01T00:00:00Z",
  },
  {
    id: "m3",
    workspace_id: "ws1",
    user_id: "u3",
    role: "viewer",
    nombre: "Parque Arauco — Locales",
    email: "obras@parauco.cl",
    joined_at: "2026-05-20T00:00:00Z",
  },
]

const MOCK_INVITES: WorkspaceInvite[] = [
  {
    id: "i1",
    workspace_id: "ws1",
    email: "nuevo@arch.cl",
    role: "arquitecto",
    token: "abc123",
    expires_at: "2026-07-01T00:00:00Z",
    created_at: "2026-06-24T00:00:00Z",
  },
]

// ──────────────────────────────────────────────────
// Role UI helpers
// ──────────────────────────────────────────────────
const ROL_ICON: Record<RolWorkspace, typeof Crown> = {
  admin:      Crown,
  arquitecto: Wrench,
  viewer:     Eye,
}

const ROL_COLOR: Record<RolWorkspace, string> = {
  admin:      "bg-amber-100 text-amber-700",
  arquitecto: "bg-blue-100 text-blue-700",
  viewer:     "bg-gray-100 text-gray-600",
}

function RolBadge({ role }: { role: RolWorkspace }) {
  const Icon = ROL_ICON[role]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium", ROL_COLOR[role])}>
      <Icon className="size-2.5" />
      {ROL_LABELS[role]}
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
// Generate a deterministic portal link from member user_id (mock: slug from id)
const VIEWER_TOKEN_MAP: Record<string, string> = {
  "u3": "pq-arauco-01",
}

function portalLink(userId: string): string {
  const token = VIEWER_TOKEN_MAP[userId] ?? userId
  return `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${token}`
}

export default function EquipoPage() {
  const [members, setMembers] = useState<WorkspaceMember[]>(MOCK_MEMBERS)
  const [invites, setInvites] = useState<WorkspaceInvite[]>(MOCK_INVITES)
  const [showInvite, setShowInvite] = useState(false)

  useEffect(() => {
    fetch('/api/workspace/members')
      .then((r) => r.json())
      .then((d: { members?: WorkspaceMember[]; invites?: WorkspaceInvite[] }) => {
        if (d.members && d.members.length > 0) setMembers(d.members)
        if (d.invites) setInvites(d.invites)
      })
      .catch(() => undefined)
  }, [])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRol, setInviteRol] = useState<RolWorkspace>("arquitecto")
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function copyLink(userId: string) {
    navigator.clipboard.writeText(portalLink(userId)).catch(() => {})
    setCopiedId(userId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    const newInvite: WorkspaceInvite = {
      id: `i${Date.now()}`,
      workspace_id: "ws1",
      email: inviteEmail.trim(),
      role: inviteRol,
      token: Math.random().toString(36).slice(2),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      created_at: new Date().toISOString(),
    }
    setInvites((prev) => [...prev, newInvite])
    setInviteEmail("")
    setInviteSent(true)
    setTimeout(() => { setInviteSent(false); setShowInvite(false) }, 2000)

    fetch('/api/workspace/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newInvite.email, role: inviteRol }),
    }).catch(() => undefined)
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
          <div className="rounded-xl border border-primary/20 bg-primary/4 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">Invitar nuevo miembro</p>
              <button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-primary">
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
                      <SelectItem key={r} value={r}>
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
                <Button size="sm" onClick={handleInvite} className="h-9 gap-1.5">
                  {inviteSent ? <><Check className="size-3.5" /> Enviado</> : <><Mail className="size-3.5" /> Enviar</>}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {(["admin", "arquitecto", "viewer"] as RolWorkspace[]).map((r) => (
                <div key={r} className="flex items-start gap-2">
                  {(() => { const Icon = ROL_ICON[r]; return <Icon className={cn("size-3.5 mt-0.5 shrink-0", r === "admin" ? "text-amber-500" : r === "arquitecto" ? "text-blue-500" : "text-gray-400")} /> })()}
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Miembros activos ({members.length})
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white divide-y divide-border/60 overflow-hidden">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Initials nombre={m.nombre} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-primary truncate">{m.nombre ?? m.email}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate">{m.email}</p>
                </div>
                <RolBadge role={m.role} />
                {m.role === "viewer" && (
                  <button
                    onClick={() => copyLink(m.user_id)}
                    title="Copiar link de portal para este cliente"
                    className="flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-[10.5px] text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                  >
                    {copiedId === m.user_id ? (
                      <><Check className="size-3 text-green-500" /> Copiado</>
                    ) : (
                      <><Copy className="size-3" /> Link portal</>
                    )}
                  </button>
                )}
                {m.role !== "admin" && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground/40 hover:bg-muted hover:text-primary transition-colors"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                    {menuOpen === m.id && (
                      <div className="absolute right-0 top-8 z-10 w-44 rounded-xl border border-border bg-white shadow-lg py-1">
                        {(["arquitecto", "viewer"] as RolWorkspace[]).filter((r) => r !== m.role).map((r) => (
                          <button
                            key={r}
                            onClick={() => changeRole(m.id, r)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[#F9F7F3] text-left"
                          >
                            {(() => { const Icon = ROL_ICON[r]; return <Icon className="size-3.5 text-muted-foreground" /> })()}
                            Cambiar a {ROL_LABELS[r]}
                          </button>
                        ))}
                        <div className="my-1 h-px bg-border" />
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
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Invitaciones pendientes ({invites.length})
              </p>
            </div>
            <div className="rounded-xl border border-border bg-white divide-y divide-border/60 overflow-hidden">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
                    <Mail className="size-4 text-muted-foreground/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-primary truncate">{inv.email}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Vence {new Date(inv.expires_at).toLocaleDateString("es-CL")}
                    </p>
                  </div>
                  <RolBadge role={inv.role} />
                  <button
                    onClick={() => removeInvite(inv.id)}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground/30 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info portal */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-start gap-3">
            <Link2 className="size-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-indigo-900">Portal de cliente — acceso por link</p>
              <p className="mt-1 text-xs text-indigo-700 leading-relaxed">
                Cada miembro con rol <strong>Sólo lectura</strong> tiene un link único al portal.
                Compártelo con el mandante, administradora o locatario — no necesitan crear cuenta.
                Solo ven sus proyectos, no el panel completo.
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Link
                  href="/portal/pq-arauco-01"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <ExternalLink className="size-3.5" />
                  Ver demo portal Parque Arauco →
                </Link>
                <span className="text-[10px] text-indigo-400">|</span>
                <Link
                  href="/portal"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700"
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
