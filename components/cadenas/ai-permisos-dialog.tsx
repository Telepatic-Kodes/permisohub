"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2, Copy, CheckCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AiPermisosDialogProps {
  cadenaId: string;
  cadenaNombre: string;
}

export function AiPermisosDialog({ cadenaId, cadenaNombre }: AiPermisosDialogProps) {
  const [open, setOpen] = useState(false);
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/cadenas/${cadenaId}/ai-consulta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta }),
      });
      const data = (await res.json()) as { respuesta: string };
      setRespuesta(data.respuesta);
    } catch {
      setRespuesta("Error al consultar la IA. Por favor, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setPregunta("");
      setRespuesta(null);
    }
  }

  function handleCopy() {
    if (!respuesta) return;
    void navigator.clipboard.writeText(respuesta).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Sparkles className="mr-2 h-4 w-4" />
        Consultar IA
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Asistente IA de Permisos
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Consultas sobre {cadenaNombre}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Textarea
            placeholder="Ej: ¿Qué permiso necesito para abrir una tienda de ropa de 200m² en Maipú?"
            rows={3}
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
          />

          <Button
            onClick={() => void handleSubmit()}
            disabled={loading || pregunta.length < 10}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {loading ? "Consultando..." : "Preguntar"}
          </Button>

          {respuesta && (
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {respuesta}
              </p>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <CheckCheck className="mr-2 h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Las respuestas se basan en OGUC y normativa municipal chilena vigente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
