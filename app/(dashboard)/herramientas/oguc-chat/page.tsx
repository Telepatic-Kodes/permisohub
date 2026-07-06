"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Send, Bot, User, AlertCircle, BookOpen, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Num } from "@/components/arch/dato"
import { TextoConCitas } from "@/components/arch/cita"

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_QUESTIONS = [
  "¿Cuál es el coeficiente de constructibilidad máximo para zona R2?",
  "¿Cómo se calculan las rasantes según la OGUC?",
  "¿Qué documentos necesito para un permiso de edificación?",
  "¿Cuántos estacionamientos debo contemplar para una vivienda de 120m²?",
  "¿Qué plazo tiene la DOM para pronunciarse sobre mi permiso?",
  "¿Cómo regularizo una construcción sin permiso?",
]

interface UsageInfo {
  used: number
  limit: number | null
  plan: string
}

function OgucChatPageInner() {
  const searchParams = useSearchParams()
  const municipioCtx = searchParams.get("municipio")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (municipioCtx) {
      setInput(`En el municipio de ${municipioCtx}, `)
    }

    fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [] }) })
      .then(r => { setAiAvailable(r.status !== 503) })
      .catch(() => setAiAvailable(false))

    fetch('/api/usage?metric=ai_chats')
      .then(r => r.ok ? r.json() as Promise<UsageInfo> : null)
      .then(data => { if (data) setUsage(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function sendMessage(text?: string) {
    const content = text ?? input.trim()
    if (!content || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setInput("")
    setLoading(true)
    setStreamingText("")

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!response.ok) {
        const err = await response.json() as { error?: string }
        throw new Error(err.error ?? 'Error del servidor')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string }
            if (parsed.text) {
              accumulated += parsed.text
              setStreamingText(accumulated)
            }
          } catch {}
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
      setStreamingText("")
      setUsage(prev => prev ? { ...prev, used: prev.used + 1 } : null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
      setStreamingText("")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="💬"
        title="Chat OGUC"
        breadcrumbs={[{ label: "IA Normativa" }, { label: "Chat OGUC" }]}
        action={
          <div className="flex items-center gap-2">
            {usage && usage.limit !== null && (
              <div className={`flex items-center gap-1.5 rounded-[3px] border px-3 py-1.5 text-xs font-medium ${
                usage.used >= usage.limit
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : usage.used >= usage.limit * 0.8
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-line-fine bg-muted text-muted-foreground'
              }`}>
                <Num>{usage.used}</Num>
                <span className="opacity-60">/</span>
                <Num>{usage.limit}</Num>
                <span className="ml-0.5">consultas este mes</span>
              </div>
            )}
            {aiAvailable === false && (
              <div className="flex items-center gap-2 rounded-[3px] bg-amber-50 border border-amber-200 px-3 py-1.5">
                <AlertCircle className="size-4 text-amber-600" />
                <span className="text-xs text-amber-700">ANTHROPIC_API_KEY no configurado</span>
              </div>
            )}
          </div>
        }
      />
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-8">
      {/* Cabecera técnica */}
      <div className="flex items-end justify-between gap-4 border-b border-line-med pb-4">
        <div>
          <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Consulta normativa
          </p>
          <h2 className="font-technical mt-1.5 text-lg font-semibold leading-none text-primary">
            OGUC · LGUC · DDU
          </h2>
        </div>
        <span className="num hidden text-[10px] text-muted-foreground/60 sm:block">
          Art. 5.1.17 · DDU 456
        </span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-[4px] border border-line-fine bg-blueprint-grid p-4 space-y-4">
        {messages.length === 0 && !streamingText && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="space-y-2">
              <BookOpen className="size-12 text-primary/30 mx-auto" />
              <p className="font-medium text-primary">¿Tienes una consulta normativa?</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Pregunta sobre coeficientes, rasantes, documentos requeridos, plazos DOM, o cualquier artículo de la OGUC.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xl">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={q}
                  onClick={() => void sendMessage(q)}
                  className="flex items-center gap-3 rounded-[4px] border border-line-fine bg-card px-4 py-2.5 text-left text-sm text-primary transition-colors hover:border-[var(--blueprint)] hover:bg-[var(--blueprint)]/[0.05]"
                >
                  <span className="num shrink-0 text-[10px] text-muted-foreground/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-primary text-white mt-1">
                <Bot className="size-4" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-[4px] px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-primary text-white'
                : 'bg-card border border-line-fine text-gray-800'
            }`}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {msg.role === 'assistant' ? <TextoConCitas>{msg.content}</TextoConCitas> : msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-[3px] border border-line-fine bg-muted mt-1">
                <User className="size-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming */}
        {streamingText && (
          <div className="flex gap-3 justify-start">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-primary text-white mt-1">
              <Bot className="size-4" />
            </div>
            <div className="max-w-[80%] rounded-[4px] border border-line-fine bg-card px-4 py-3 text-sm leading-relaxed text-gray-800"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {streamingText}
              <span className="inline-block w-1 h-4 bg-[var(--blueprint)] animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}

        {loading && !streamingText && (
          <div className="flex gap-3">
            <div className="flex size-8 items-center justify-center rounded-[3px] bg-primary text-white">
              <Bot className="size-4" />
            </div>
            <div className="rounded-[4px] border border-line-fine bg-card px-4 py-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <Card className="rounded-[4px] border-line-fine transition-colors focus-within:border-[var(--blueprint)]">
        <CardContent className="flex gap-3 p-3">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta sobre la OGUC... (Enter para enviar)"
            className="min-h-[48px] max-h-32 resize-none border-0 focus-visible:ring-0 bg-transparent"
            rows={1}
          />
          <Button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || loading}
            className="h-12 w-12 shrink-0 rounded-[4px] bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Basado en la OGUC vigente (<span className="num">D.S. N°47</span>,{" "}
        <Num>1992</Num> y modificaciones <Num>2025</Num>) · Siempre verifica con el PRC de tu municipio
      </p>
      </div>
    </div>
  )
}

export default function OgucChatPage() {
  return (
    <Suspense>
      <OgucChatPageInner />
    </Suspense>
  )
}
