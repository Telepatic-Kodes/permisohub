// Subida real de documentos a Supabase Storage (bucket `documentos`) vía
// POST /api/upload, que además registra el documento en la tabla `documentos`.
// Compartido por la pestaña Documentos del proyecto y el flujo de ingreso DOM.

export interface DocumentoSubido {
  nombre: string
  tipo: string
  url: string
  tamano: number
}

export type UploadDocumentoResult =
  | { ok: true; documento: DocumentoSubido }
  | { ok: false; error: string }

export async function uploadDocumento(
  file: File,
  proyectoId: string,
  tipo: string,
): Promise<UploadDocumentoResult> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('proyectoId', proyectoId)
    formData.append('tipo', tipo)

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    const result = (await response
      .json()
      .catch(() => ({ error: 'Respuesta inválida del servidor.' }))) as {
      success?: boolean
      documento?: DocumentoSubido
      error?: string
    }

    if (!response.ok || !result.success || !result.documento) {
      return { ok: false, error: result.error ?? 'No se pudo subir el archivo.' }
    }

    return { ok: true, documento: result.documento }
  } catch {
    return { ok: false, error: 'Error de red. Inténtalo nuevamente.' }
  }
}
