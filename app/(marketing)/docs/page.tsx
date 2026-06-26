import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  Building2,
  Bell,
  CreditCard,
  FileText,
  Search,
  Shield,
  Users,
  Zap,
  CheckCircle2,
  Globe,
} from 'lucide-react'

// ─── Module registry ──────────────────────────────────────────────────────────

const MODULES = [
  {
    id: 'proyectos',
    name: 'Proyectos',
    icon: FileText,
    accent: '#1A3328',
    bg: '#E8F4EF',
    status: 'Operacional',
    desc: 'Núcleo del sistema. Gestión end-to-end de expedientes de permisos de edificación ante la DOM.',
  },
  {
    id: 'ia',
    name: 'Copiloto IA',
    icon: Bot,
    accent: '#7C3AED',
    bg: '#EDE9FE',
    status: 'Operacional',
    desc: '9 herramientas de inteligencia artificial para auditar expedientes, predecir observaciones y generar documentos.',
  },
  {
    id: 'portal',
    name: 'Portal de Clientes',
    icon: Globe,
    accent: '#0369A1',
    bg: '#E0F2FE',
    status: 'Operacional',
    desc: 'Acceso público seguro mediante token único. Los clientes ven el estado real de su proyecto sin login.',
  },
  {
    id: 'workspace',
    name: 'Workspace',
    icon: Users,
    accent: '#B45309',
    bg: '#FEF3C7',
    status: 'Operacional',
    desc: 'Gestión del estudio: invitaciones por email, roles (viewer / arquitecto / admin) y permisos granulares.',
  },
  {
    id: 'cadenas',
    name: 'Cadenas Comerciales',
    icon: Building2,
    accent: '#047857',
    bg: '#ECFDF5',
    status: 'Operacional',
    desc: 'Módulo B2B para retail: cadenas → centros → locales → boletas de garantía y patentes comerciales.',
  },
  {
    id: 'notificaciones',
    name: 'Notificaciones',
    icon: Bell,
    accent: '#BE185D',
    bg: '#FCE7F3',
    status: 'Operacional',
    desc: 'Alertas automáticas por email (Resend) y WhatsApp (Twilio) ante cambios de estado, observaciones y plazos.',
  },
  {
    id: 'billing',
    name: 'Billing',
    icon: CreditCard,
    accent: '#5B21B6',
    bg: '#EDE9FE',
    status: 'Operacional',
    desc: 'Suscripciones gestionadas por Stripe: Free / Starter / Pro / Estudio / Enterprise con límites por plan.',
  },
  {
    id: 'enrich',
    name: 'Datos SII / RUT',
    icon: Search,
    accent: '#0E7490',
    bg: '#ECFEFF',
    status: 'Operacional',
    desc: 'Lookup catastral SII por ROL de avalúo y consulta de contribuyentes por RUT para pre-rellenar formularios.',
  },
]

// ─── Flow diagram primitives ──────────────────────────────────────────────────

function Node({
  label,
  sub,
  accent = '#1A3328',
  bg = '#E8F4EF',
  size = 'md',
}: {
  label: string
  sub?: string
  accent?: string
  bg?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const padding = size === 'lg' ? 'px-5 py-3' : size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2.5'
  const text = size === 'lg' ? 'text-sm font-semibold' : 'text-xs font-semibold'
  return (
    <div
      className={`rounded-xl border ${padding} text-center leading-tight`}
      style={{ borderColor: accent, backgroundColor: bg, color: accent }}
    >
      <span className={text}>{label}</span>
      {sub && <div className="mt-0.5 text-[10px] opacity-70">{sub}</div>}
    </div>
  )
}

function Arrow({ dir = 'right', label }: { dir?: 'right' | 'down'; label?: string }) {
  if (dir === 'down') {
    return (
      <div className="flex flex-col items-center gap-0.5">
        {label && <span className="text-[10px] text-[#1A3328]/50">{label}</span>}
        <span className="text-lg leading-none text-[#1A3328]/30">↓</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-0.5">
      {label && <span className="text-[10px] text-[#1A3328]/50">{label}</span>}
      <span className="text-lg leading-none text-[#1A3328]/30">→</span>
    </div>
  )
}

function FlowRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

function FlowCol({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-2">{children}</div>
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#1A3328]/40">
      {label}
    </p>
  )
}

// ─── Module sections ──────────────────────────────────────────────────────────

function ModuleSection({
  id,
  module,
  children,
  api,
}: {
  id: string
  module: (typeof MODULES)[number]
  children: React.ReactNode
  api?: string[]
}) {
  const Icon = module.icon
  return (
    <section id={id} className="scroll-mt-24 border-t border-[#1A3328]/8 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          {/* Left: meta */}
          <div>
            <div
              className="inline-flex size-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: module.bg }}
            >
              <Icon size={22} style={{ color: module.accent }} />
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[#1A3328]">
              {module.name}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#1A3328]/60">{module.desc}</p>

            {api && (
              <div className="mt-6">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#1A3328]/40">
                  Endpoints
                </p>
                <ul className="space-y-1">
                  {api.map((ep) => (
                    <li
                      key={ep}
                      className="rounded-lg bg-[#1A3328]/5 px-3 py-1.5 font-mono text-[11px] text-[#1A3328]/70"
                    >
                      {ep}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: diagram */}
          <div className="rounded-2xl border border-[#1A3328]/8 bg-[#F9F7F3] p-6">{children}</div>
        </div>
      </div>
    </section>
  )
}

// ─── Architecture overview (CSS grid) ────────────────────────────────────────

function ArchDiagram() {
  return (
    <div className="relative w-full overflow-x-auto">
      <div className="min-w-[600px] space-y-3">
        {/* Row 1: User */}
        <div className="flex justify-center">
          <div className="rounded-xl border-2 border-[#1A3328] bg-[#1A3328] px-6 py-3 text-center">
            <p className="text-sm font-semibold text-[#F9F7F3]">Arquitecto / Equipo</p>
            <p className="text-[10px] text-[#F9F7F3]/60">Next.js App Router · Supabase Auth</p>
          </div>
        </div>

        {/* Arrow down */}
        <div className="flex justify-center">
          <div className="flex h-6 w-px flex-col items-center">
            <div className="h-full w-px bg-[#1A3328]/20" />
          </div>
        </div>

        {/* Row 2: Core modules */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#1A3328]/20 bg-[#E8F4EF] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-[#1A3328]">Proyectos</p>
            <p className="text-[10px] text-[#1A3328]/50">expedientes DOM</p>
          </div>
          <div className="rounded-xl border border-[#047857]/20 bg-[#ECFDF5] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-[#047857]">Cadenas</p>
            <p className="text-[10px] text-[#047857]/50">centros · locales</p>
          </div>
          <div className="rounded-xl border border-[#B45309]/20 bg-[#FEF3C7] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-[#B45309]">Workspace</p>
            <p className="text-[10px] text-[#B45309]/50">roles · invitaciones</p>
          </div>
        </div>

        {/* Connectors */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-center">
              <div className="h-4 w-px bg-[#1A3328]/15" />
            </div>
          ))}
        </div>

        {/* Row 3: Services */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#7C3AED]/20 bg-[#EDE9FE] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-[#7C3AED]">Copiloto IA</p>
            <p className="text-[10px] text-[#7C3AED]/50">OpenAI GPT-4o</p>
          </div>
          <div className="rounded-xl border border-[#BE185D]/20 bg-[#FCE7F3] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-[#BE185D]">Notificaciones</p>
            <p className="text-[10px] text-[#BE185D]/50">Resend · Twilio</p>
          </div>
          <div className="rounded-xl border border-[#5B21B6]/20 bg-[#EDE9FE] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-[#5B21B6]">Billing</p>
            <p className="text-[10px] text-[#5B21B6]/50">Stripe</p>
          </div>
        </div>

        {/* Row 4: Data layer */}
        <div className="flex justify-center">
          <div className="h-4 w-px bg-[#1A3328]/15" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#0369A1]/20 bg-[#E0F2FE] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-[#0369A1]">Portal Clientes</p>
            <p className="text-[10px] text-[#0369A1]/50">acceso token</p>
          </div>
          <div className="rounded-xl border border-[#0E7490]/20 bg-[#ECFEFF] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-[#0E7490]">Datos SII / RUT</p>
            <p className="text-[10px] text-[#0E7490]/50">scraping catastral</p>
          </div>
          <div className="rounded-xl border border-[#1A3328]/20 bg-[#F9F7F3] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-[#1A3328]/60">Supabase</p>
            <p className="text-[10px] text-[#1A3328]/40">PostgreSQL · Auth · RLS</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#F9F7F3] font-sans text-[#1A3328]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#1A3328]/8 bg-[#F9F7F3]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-1.5 text-lg font-semibold">
            PermisoHub
            <span className="size-1.5 rounded-full bg-[#E9C46A]" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-[#1A3328]/60 md:flex">
            {MODULES.map((m) => (
              <a key={m.id} href={`#${m.id}`} className="transition-colors hover:text-[#1A3328]">
                {m.name}
              </a>
            ))}
          </nav>
          <Link
            href="/login"
            className="rounded-lg bg-[#1A3328] px-4 py-2 text-sm font-medium text-[#F9F7F3] transition-colors hover:bg-[#2D6A4F]"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#1A3328]/15 bg-white px-4 py-1.5 text-xs font-medium text-[#2D6A4F]">
          <span className="size-1.5 animate-pulse rounded-full bg-[#E9C46A]" />
          Todos los módulos operacionales · v1.3
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          Cómo funciona{' '}
          <span className="italic text-[#2D6A4F]">PermisoHub</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[#1A3328]/60">
          Arquitectura, flujos de datos y diagramas de cada módulo del sistema.
        </p>

        {/* Status pills */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {MODULES.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: m.accent + '30', backgroundColor: m.bg, color: m.accent }}
            >
              <CheckCircle2 size={11} />
              {m.name}
            </div>
          ))}
        </div>
      </section>

      {/* Architecture overview */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-3xl border border-[#1A3328]/10 bg-white p-8 shadow-sm">
          <p className="mb-6 text-center text-[10px] font-semibold uppercase tracking-widest text-[#1A3328]/40">
            Arquitectura general
          </p>
          <ArchDiagram />
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#1A3328]/8 pt-6 sm:grid-cols-4">
            {[
              { label: 'Next.js 16', sub: 'App Router + Server Components' },
              { label: 'Supabase', sub: 'PostgreSQL · Auth · RLS · Storage' },
              { label: 'OpenAI GPT-4o', sub: '9 herramientas IA especializadas' },
              { label: 'Stripe', sub: '5 planes · webhooks · portal billing' },
            ].map((t) => (
              <div key={t.label} className="rounded-xl bg-[#1A3328]/5 px-4 py-3">
                <p className="text-xs font-semibold text-[#1A3328]">{t.label}</p>
                <p className="mt-0.5 text-[10px] text-[#1A3328]/50">{t.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROYECTOS ──────────────────────────────────────────────────────── */}
      <ModuleSection
        id="proyectos"
        module={MODULES[0]}
        api={[
          'GET /api/proyectos',
          'POST /api/proyectos',
          'GET /api/proyectos/[id]',
          'PATCH /api/proyectos/[id]',
          'GET /api/proyectos/[id]/observaciones',
          'GET /api/proyectos/[id]/export-zip',
        ]}
      >
        <SectionLabel label="Ciclo de vida de un expediente" />
        <FlowCol>
          <FlowRow>
            <Node label="Nuevo proyecto" sub="nombre · cliente · municipio · tipo" accent="#1A3328" bg="#E8F4EF" size="lg" />
          </FlowRow>
          <Arrow dir="down" label="se crean automáticamente" />
          <FlowRow>
            <Node label="Etapa: Ingreso DOM" accent="#1A3328" bg="#E8F4EF" />
            <Arrow />
            <Node label="Etapa: Revisión" accent="#1A3328" bg="#E8F4EF" />
            <Arrow />
            <Node label="Etapa: Observaciones" accent="#E9C46A" bg="#FFFBEB" />
            <Arrow />
            <Node label="Aprobado" accent="#047857" bg="#ECFDF5" />
          </FlowRow>
          <Arrow dir="down" />
          <div className="grid w-full grid-cols-3 gap-2">
            <Node label="Documentos adjuntos" sub="PDF · DWG · imágenes" accent="#0369A1" bg="#E0F2FE" size="sm" />
            <Node label="Comunicaciones" sub="historial DOM" accent="#BE185D" bg="#FCE7F3" size="sm" />
            <Node label="Actividades CRM" sub="llamadas · reuniones" accent="#B45309" bg="#FEF3C7" size="sm" />
          </div>
          <Arrow dir="down" label="salidas" />
          <FlowRow>
            <Node label="Export PDF" accent="#5B21B6" bg="#EDE9FE" />
            <Arrow />
            <Node label="Portal cliente" accent="#0369A1" bg="#E0F2FE" />
            <Arrow />
            <Node label="Notificación" accent="#BE185D" bg="#FCE7F3" />
          </FlowRow>
        </FlowCol>
      </ModuleSection>

      {/* ── COPILOTO IA ────────────────────────────────────────────────────── */}
      <ModuleSection
        id="ia"
        module={MODULES[1]}
        api={[
          'POST /api/ai/audit-expediente',
          'POST /api/ai/compliance-check',
          'POST /api/ai/declaracion-jurada',
          'POST /api/ai/genera-communication',
          'POST /api/ai/memoria-descriptiva',
          'POST /api/ai/observation-response',
          'POST /api/ai/predict-observations',
          'POST /api/ai/chat',
          'POST /api/ai/extract-observations',
        ]}
      >
        <SectionLabel label="9 herramientas especializadas sobre OGUC + DOM" />

        <div className="mb-4 rounded-xl border border-[#7C3AED]/20 bg-[#EDE9FE]/60 p-3">
          <p className="text-[10px] font-semibold text-[#7C3AED]">Capa de protección (aiAuthGuard)</p>
          <p className="mt-0.5 text-[10px] text-[#7C3AED]/70">
            Auth → Plan → Límite mensual → Rate limit (30 req/60s) → OpenAI GPT-4o
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { name: 'Audit expediente', desc: 'Analiza PDF de expediente y detecta gaps', type: 'PDF' },
            { name: 'Compliance check', desc: 'Verifica cumplimiento OGUC artículo por artículo', type: 'Form' },
            { name: 'Declaración jurada', desc: 'Genera declaración jurada a partir del proyecto', type: 'Form' },
            { name: 'Genera comunicación', desc: 'Redacta cartas y oficios para la DOM', type: 'Form' },
            { name: 'Memoria descriptiva', desc: 'Genera memoria descriptiva completa', type: 'Form' },
            { name: 'Responde observación', desc: 'Respuesta fundamentada a observaciones DOM', type: 'Form' },
            { name: 'Predice observaciones', desc: 'Anticipa qué observará la DOM antes de ingresar', type: 'Form' },
            { name: 'Chat OGUC', desc: 'Consultas libres sobre normativa chilena', type: 'Chat' },
            { name: 'Extrae observaciones', desc: 'Extrae texto estructurado desde PDF DOM', type: 'PDF' },
          ].map((tool) => (
            <div
              key={tool.name}
              className="rounded-lg border border-[#7C3AED]/15 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-[11px] font-semibold text-[#7C3AED]">{tool.name}</p>
                <span className="shrink-0 rounded-full bg-[#7C3AED]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#7C3AED]">
                  {tool.type}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-[#1A3328]/50">{tool.desc}</p>
            </div>
          ))}
        </div>
      </ModuleSection>

      {/* ── PORTAL DE CLIENTES ─────────────────────────────────────────────── */}
      <ModuleSection
        id="portal"
        module={MODULES[2]}
        api={[
          'POST /api/portal/generate-token',
          'POST /api/portal/resolve',
          'GET /api/portal/[token]',
        ]}
      >
        <SectionLabel label="Acceso externo sin login" />
        <FlowCol>
          <FlowRow>
            <Node label="Arquitecto" accent="#1A3328" bg="#E8F4EF" />
            <Arrow label="genera" />
            <Node label="Token JWT" sub="firmado · 30 días" accent="#0369A1" bg="#E0F2FE" />
          </FlowRow>
          <Arrow dir="down" label="comparte por WhatsApp / Email" />
          <FlowRow>
            <Node label="Cliente visita" sub="permisohub.cl/portal/[token]" accent="#0369A1" bg="#E0F2FE" size="lg" />
          </FlowRow>
          <Arrow dir="down" label="sin contraseña, sin login" />
          <div className="grid w-full grid-cols-2 gap-2">
            <Node label="Estado actual" sub="En revisión / Con observaciones / Aprobado" accent="#0369A1" bg="#E0F2FE" size="sm" />
            <Node label="Etapas completadas" sub="progreso del trámite" accent="#0369A1" bg="#E0F2FE" size="sm" />
            <Node label="Documentos descargables" accent="#0369A1" bg="#E0F2FE" size="sm" />
            <Node label="Comunicaciones DOM" accent="#0369A1" bg="#E0F2FE" size="sm" />
          </div>
          <div className="mt-2 rounded-xl border border-[#0369A1]/20 bg-[#E0F2FE]/60 p-3">
            <p className="text-[10px] font-medium text-[#0369A1]">
              RLS: el token solo expone datos del proyecto asociado. Nunca da acceso al workspace completo.
            </p>
          </div>
        </FlowCol>
      </ModuleSection>

      {/* ── WORKSPACE ──────────────────────────────────────────────────────── */}
      <ModuleSection
        id="workspace"
        module={MODULES[3]}
        api={[
          'GET /api/workspace/members',
          'POST /api/workspace/invites',
          'GET /api/workspace/invites',
        ]}
      >
        <SectionLabel label="Gestión de equipo y roles" />
        <FlowCol>
          <FlowRow>
            <Node label="Admin del estudio" accent="#B45309" bg="#FEF3C7" />
            <Arrow label="invita por" />
            <Node label="email" accent="#B45309" bg="#FEF3C7" />
          </FlowRow>
          <Arrow dir="down" />
          <Node label="Invite record en DB" sub="email · rol · token · expires_at" accent="#B45309" bg="#FEF3C7" size="lg" />
          <Arrow dir="down" label="email automático" />
          <Node label="Miembro acepta link" accent="#B45309" bg="#FEF3C7" />
          <Arrow dir="down" />
          <div className="grid w-full grid-cols-3 gap-2">
            <Node label="viewer" sub="solo lectura" accent="#1A3328" bg="#E8F4EF" size="sm" />
            <Node label="arquitecto" sub="edita proyectos" accent="#B45309" bg="#FEF3C7" size="sm" />
            <Node label="admin" sub="gestiona equipo" accent="#047857" bg="#ECFDF5" size="sm" />
          </div>
          <div className="mt-2 rounded-xl border border-[#B45309]/20 bg-[#FEF3C7]/60 p-3">
            <p className="text-[10px] font-medium text-[#B45309]">
              Roles validados con Zod + RLS en PostgreSQL. No hay escalada de privilegios posible por API.
            </p>
          </div>
        </FlowCol>
      </ModuleSection>

      {/* ── CADENAS ────────────────────────────────────────────────────────── */}
      <ModuleSection
        id="cadenas"
        module={MODULES[4]}
        api={[
          'GET /api/cadenas',
          'POST /api/cadenas',
          'GET /api/cadenas/[id]/centros',
          'GET /api/cadenas/[id]/risk-scores',
          'GET /api/cadenas/[id]/benchmark',
          'GET /api/cadenas/[id]/compliance-export',
          'POST /api/cadenas/[id]/whatsapp-bulk',
        ]}
      >
        <SectionLabel label="Modelo jerárquico para retail" />
        <FlowCol>
          <Node label="Cadena" sub="FALABELLA / SODIMAC / etc." accent="#047857" bg="#ECFDF5" size="lg" />
          <Arrow dir="down" />
          <div className="grid w-full grid-cols-3 gap-2">
            {['Centro Mall Norte', 'Centro Mall Sur', 'Centro Centro'].map((c) => (
              <Node key={c} label={c} accent="#047857" bg="#ECFDF5" size="sm" />
            ))}
          </div>
          <Arrow dir="down" />
          <div className="grid w-full grid-cols-4 gap-1.5">
            {['Local 101', 'Local 102', 'Local 103', 'Local 104'].map((l) => (
              <Node key={l} label={l} accent="#047857" bg="#ECFDF5" size="sm" />
            ))}
          </div>
          <Arrow dir="down" label="documentos por local" />
          <div className="grid w-full grid-cols-2 gap-2">
            <Node label="Boletas de garantía" sub="vencimiento · montos" accent="#047857" bg="#ECFDF5" size="sm" />
            <Node label="Patentes comerciales" sub="estado · municipio" accent="#047857" bg="#ECFDF5" size="sm" />
          </div>
          <Arrow dir="down" label="análisis agregado" />
          <div className="grid w-full grid-cols-3 gap-2">
            <Node label="Risk scores" accent="#BE185D" bg="#FCE7F3" size="sm" />
            <Node label="Benchmark" accent="#5B21B6" bg="#EDE9FE" size="sm" />
            <Node label="WhatsApp bulk" accent="#047857" bg="#ECFDF5" size="sm" />
          </div>
        </FlowCol>
      </ModuleSection>

      {/* ── NOTIFICACIONES ─────────────────────────────────────────────────── */}
      <ModuleSection
        id="notificaciones"
        module={MODULES[5]}
        api={[
          'POST /api/notify',
          'POST /api/notifications/whatsapp',
          'GET /api/notifications/whatsapp',
          'POST /api/cron/weekly-summary',
        ]}
      >
        <SectionLabel label="Triggers → canales de salida" />
        <div className="space-y-3">
          {[
            { trigger: 'Estado cambia', types: ['observacion', 'estado_change'], channels: ['Email', 'WhatsApp'] },
            { trigger: 'Observación registrada', types: ['observacion'], channels: ['Email'] },
            { trigger: 'Plazo se acerca', types: ['deadline'], channels: ['Email', 'WhatsApp'] },
            { trigger: 'Cron semanal', types: ['resumen'], channels: ['Email'] },
          ].map((row) => (
            <div key={row.trigger} className="flex flex-wrap items-center gap-2">
              <Node label={row.trigger} accent="#BE185D" bg="#FCE7F3" size="sm" />
              <Arrow />
              <div className="flex gap-1">
                {row.types.map((t) => (
                  <span key={t} className="rounded-full bg-[#FCE7F3] px-2 py-0.5 text-[10px] font-medium text-[#BE185D]">
                    {t}
                  </span>
                ))}
              </div>
              <Arrow />
              <div className="flex gap-1">
                {row.channels.map((ch) => (
                  <Node
                    key={ch}
                    label={ch}
                    accent={ch === 'WhatsApp' ? '#047857' : '#0369A1'}
                    bg={ch === 'WhatsApp' ? '#ECFDF5' : '#E0F2FE'}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#0369A1]/20 bg-[#E0F2FE]/60 p-3">
            <p className="text-[10px] font-semibold text-[#0369A1]">Email — Resend</p>
            <p className="mt-0.5 text-[10px] text-[#0369A1]/70">
              Templates HTML reactivos · dominio @permisohub.cl
            </p>
          </div>
          <div className="rounded-xl border border-[#047857]/20 bg-[#ECFDF5]/60 p-3">
            <p className="text-[10px] font-semibold text-[#047857]">WhatsApp — Twilio</p>
            <p className="mt-0.5 text-[10px] text-[#047857]/70">
              9 templates pre-aprobados · número CL
            </p>
          </div>
        </div>
      </ModuleSection>

      {/* ── BILLING ────────────────────────────────────────────────────────── */}
      <ModuleSection
        id="billing"
        module={MODULES[6]}
        api={[
          'POST /api/billing/checkout',
          'POST /api/billing/portal',
          'POST /api/billing/webhook',
        ]}
      >
        <SectionLabel label="Ciclo de suscripción" />
        <FlowCol>
          <FlowRow>
            <Node label="Usuario elige plan" accent="#5B21B6" bg="#EDE9FE" />
            <Arrow />
            <Node label="Stripe Checkout" sub="payment intent" accent="#5B21B6" bg="#EDE9FE" />
          </FlowRow>
          <Arrow dir="down" label="webhook payment_intent.succeeded" />
          <Node label="subscription activa en DB" sub="stripe_customer_id · plan · status" accent="#5B21B6" bg="#EDE9FE" size="lg" />
          <Arrow dir="down" />
          <div className="grid w-full grid-cols-5 gap-1">
            {['Free', 'Starter', 'Pro', 'Estudio', 'Enterprise'].map((plan) => (
              <Node key={plan} label={plan} accent="#5B21B6" bg="#EDE9FE" size="sm" />
            ))}
          </div>
          <Arrow dir="down" label="limita acceso a" />
          <div className="grid w-full grid-cols-3 gap-2">
            <Node label="Proyectos activos" accent="#1A3328" bg="#E8F4EF" size="sm" />
            <Node label="Chats IA / mes" accent="#7C3AED" bg="#EDE9FE" size="sm" />
            <Node label="Extracciones PDF" accent="#7C3AED" bg="#EDE9FE" size="sm" />
          </div>
        </FlowCol>
      </ModuleSection>

      {/* ── DATOS SII / RUT ────────────────────────────────────────────────── */}
      <ModuleSection
        id="enrich"
        module={MODULES[7]}
        api={[
          'POST /api/enrich/rut',
          'POST /api/enrich/sii',
          'GET /api/sii/lookup',
        ]}
      >
        <SectionLabel label="Enriquecimiento de datos para formularios" />
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#0E7490]/60">
              Lookup por ROL de avalúo (SII Catastro)
            </p>
            <FlowRow>
              <Node label="ROL ingresado" sub='ej: "1234-56"' accent="#0E7490" bg="#ECFEFF" />
              <Arrow />
              <Node label="zeus.sii.cl" sub="scraping HTML" accent="#0E7490" bg="#ECFEFF" />
              <Arrow />
              <Node label="Dirección · m² · destino" accent="#0E7490" bg="#ECFEFF" />
            </FlowRow>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#0E7490]/60">
              Lookup por RUT contribuyente
            </p>
            <FlowRow>
              <Node label="RUT ingresado" sub='ej: "12.345.678-9"' accent="#0E7490" bg="#ECFEFF" />
              <Arrow />
              <Node label="SII personas" sub="scraping HTML" accent="#0E7490" bg="#ECFEFF" />
              <Arrow />
              <Node label="Nombre · actividad" accent="#0E7490" bg="#ECFEFF" />
            </FlowRow>
          </div>
          <div className="rounded-xl border border-[#0E7490]/20 bg-[#ECFEFF]/60 p-3">
            <p className="text-[10px] font-medium text-[#0E7490]">
              Si SII no responde o está caído, ambas rutas devuelven datos simulados con{' '}
              <code className="rounded bg-[#0E7490]/10 px-1">simulated: true</code> para no bloquear el flujo.
              Protegido por auth + rate limiting.
            </p>
          </div>
        </div>
      </ModuleSection>

      {/* Security callout */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-3xl border border-[#1A3328]/10 bg-[#1A3328] p-8 text-[#F9F7F3]">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-[#E9C46A]" />
            <h3 className="text-xl font-semibold">Seguridad transversal</h3>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-[#F9F7F3]/70">
            Cada request pasa por múltiples capas de protección antes de llegar a datos o IA.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Auth obligatoria', desc: 'getUser() explícito en todos los handlers. RLS como segunda capa.' },
              { title: 'Rate limiting', desc: 'Upstash Redis — 30 req / 60s por usuario. Graceful fallback.' },
              { title: 'Validación Zod', desc: 'Todos los body de entrada validados. Sin as-casts.' },
              { title: 'Sin error.message al cliente', desc: 'apiError() loguea internamente, respuesta genérica al usuario.' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl bg-[#F9F7F3]/8 p-4">
                <p className="text-sm font-semibold text-[#E9C46A]">{item.title}</p>
                <p className="mt-1 text-xs text-[#F9F7F3]/60">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1A3328]/10 bg-[#1A3328] text-[#F9F7F3]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link href="/" className="flex items-center gap-1.5 font-semibold">
              PermisoHub
              <span className="size-1.5 rounded-full bg-[#E9C46A]" />
            </Link>
            <div className="flex items-center gap-6 text-sm text-[#F9F7F3]/60">
              <Link href="/" className="transition-colors hover:text-[#E9C46A]">
                Inicio
              </Link>
              <Link href="/pricing" className="transition-colors hover:text-[#E9C46A]">
                Precios
              </Link>
              <Link href="/login" className="transition-colors hover:text-[#E9C46A]">
                Entrar
              </Link>
            </div>
            <p className="text-xs text-[#F9F7F3]/40">Arquitectura v1.3 · Santiago, 2026</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
