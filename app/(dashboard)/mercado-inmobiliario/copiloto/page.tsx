"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { Send, Bot, User, AlertCircle, TrendingUp, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { leerEventosSSE } from "@/lib/sse-client"

interface Message {
  role: "user" | "assistant"
  content: string
}

const SUGGESTED_QUESTIONS = [
  "¿Cuál es la banda de arriendo de oficinas en Las Condes?",
  "¿Está vigente el Plan Regulador Comunal de Ñuñoa?",
  "¿Hay oportunidades bajo el precio de mercado en San Bernardo?",
  "Compárame Providencia vs Las Condes para arriendo de locales comerciales",
  "¿Cuál es el valor de la UF hoy?",
]

interface UsageInfo {
  used: number
  limit: number | null
  plan: string
}

function CopilotoMercadoPageInner() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState("")
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Guarda síncrona además de `loading` (estado, no se refleja hasta el
  // próximo render) — sin esto, dos clicks en el mismo tick sobre una
  // pregunta sugerida (que no tiene `disabled` propio) disparaban 2 envíos.
  const enviandoRef = useRef(false)

  useEffect(() => {
    fetch("/api/usage?metric=ai_chats")
      .then((r) => (r.ok ? (r.json() as Promise<UsageInfo>) : null))
      .then((data) => { if (data) setUsage(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  async function sendMessage(text?: string) {
    const content = text ?? input.trim()
    if (!content || loading || enviandoRef.current) return
    enviandoRef.current = true

    const newMessages: Message[] = [...messages, { role: "user", content }]
    setMessages(newMessages)
    setInput("")
    setLoading(true)
    setStatus(null)
    setStreamingText("")

    try {
      const response = await fetch("/api/mercado-inmobiliario/copiloto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!response.ok) {
        const err = (await response.json()) as { error?: string }
        throw new Error(err.error ?? "Error del servidor")
      }

      let accumulated = ""

      for await (const data of leerEventosSSE(response)) {
        const parsed = JSON.parse(data) as { text?: string; status?: string; error?: string }
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.status) setStatus(parsed.status)
        if (parsed.text) {
          accumulated += parsed.text
          setStreamingText(accumulated)
          setStatus(null)
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: accumulated }])
      setStreamingText("")
      setUsage((prev) => (prev ? { ...prev, used: prev.used + 1 } : null))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido"
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }])
      setStreamingText("")
    } finally {
      setLoading(false)
      setStatus(null)
      enviandoRef.current = false
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="💬"
        title="Copiloto de Mercado"
        subtitle="Pregunta en lenguaje natural — responde solo con datos reales ya calculados por el sistema"
        breadcrumbs={[{ label: "Copiloto" }]}
        action={
          usage && usage.limit !== null ? (
            <div
              className={`flex items-center gap-1.5 rounded-[3px] border px-3 py-1.5 text-xs font-medium ${
                usage.used >= usage.limit
                  ? "border-red-200 bg-red-50 text-red-700"
                  : usage.used >= usage.limit * 0.8
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-line-fine bg-muted text-muted-foreground"
              }`}
            >
              <span className="num">{usage.used}</span>
              <span className="opacity-60">/</span>
              <span className="num">{usage.limit}</span>
              <span className="ml-0.5">consultas este mes</span>
            </div>
          ) : null
        }
      />

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-8">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
          <div className="flex-1 overflow-y-auto rounded-lg border border-line-fine bg-blueprint-grid p-4 space-y-4">
            {messages.length === 0 && !streamingText && (
              <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
                <div className="space-y-2">
                  <TrendingUp className="mx-auto size-12 text-primary/30" />
                  <p className="font-medium text-primary">¿Qué quieres saber del mercado?</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Bandas de precio, oportunidades, vigencia de Planes Reguladores, indicadores macro — todo anclado en datos reales, nunca estimados por la IA.
                  </p>
                </div>
                <div className="grid w-full max-w-xl grid-cols-1 gap-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={q}
                      onClick={() => void sendMessage(q)}
                      className="flex items-center gap-3 rounded-lg border border-line-fine bg-card px-4 py-2.5 text-left text-sm text-primary transition-colors hover:border-[var(--blueprint)] hover:bg-[var(--blueprint)]/[0.05]"
                    >
                      <span className="num shrink-0 text-[10px] text-muted-foreground/60">{String(i + 1).padStart(2, "0")}</span>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-primary text-white">
                    <Bot className="size-4" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user" ? "bg-primary text-white" : "border border-line-fine bg-card text-gray-800"
                  }`}
                >
                  {msg.role === "assistant" ? <MarkdownRenderer content={msg.content} /> : msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-[3px] border border-line-fine bg-muted">
                    <User className="size-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {status && !streamingText && (
              <div className="flex gap-3 justify-start">
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-primary text-white">
                  <Bot className="size-4" />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-line-fine bg-card px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> {status}
                </div>
              </div>
            )}

            {streamingText && (
              <div className="flex gap-3 justify-start">
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-primary text-white">
                  <Bot className="size-4" />
                </div>
                <div className="max-w-[80%] rounded-lg border border-line-fine bg-card px-4 py-3 text-sm leading-relaxed text-gray-800">
                  <MarkdownRenderer content={streamingText} />
                  <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-[var(--blueprint)] align-middle" />
                </div>
              </div>
            )}

            {loading && !streamingText && !status && (
              <div className="flex gap-3">
                <div className="flex size-8 items-center justify-center rounded-[3px] bg-primary text-white">
                  <Bot className="size-4" />
                </div>
                <div className="rounded-lg border border-line-fine bg-card px-4 py-3">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <Card className="rounded-lg border-line-fine transition-colors focus-within:border-[var(--blueprint)]">
            <CardContent className="flex gap-3 p-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta sobre precios, oportunidades o vigencia normativa... (Enter para enviar)"
                className="max-h-32 min-h-[48px] resize-none border-0 bg-transparent focus-visible:ring-0"
                rows={1}
              />
              <Button
                onClick={() => void sendMessage()}
                disabled={!input.trim() || loading}
                className="h-12 w-12 shrink-0 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="size-4" />
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            <AlertCircle className="mr-1 inline size-3.5 align-text-bottom" />
            Solo responde con datos que sus herramientas verifican en vivo — si no hay dato, lo dice explícitamente.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function CopilotoMercadoPage() {
  return (
    <Suspense>
      <CopilotoMercadoPageInner />
    </Suspense>
  )
}
