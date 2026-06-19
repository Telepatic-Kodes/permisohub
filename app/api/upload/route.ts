import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Tamaño máximo permitido por archivo: 50MB.
const MAX_FILE_SIZE = 50 * 1024 * 1024

// Extensiones permitidas (debe coincidir con el `accept` del componente).
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".dwg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]

export async function POST(request: Request) {
  // 1. Parse FormData
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json(
      { error: "Solicitud inválida: se esperaba multipart/form-data." },
      { status: 400 },
    )
  }

  const file = formData.get("file") as File | null
  const proyectoId = formData.get("proyectoId") as string | null
  const tipo = (formData.get("tipo") as string | null) ?? "Otro"

  if (!file || !proyectoId) {
    return Response.json(
      { error: "Faltan campos requeridos (file, proyectoId)." },
      { status: 400 },
    )
  }

  // 2. Validaciones de archivo: tamaño y extensión.
  if (file.size === 0) {
    return Response.json({ error: "El archivo está vacío." }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "El archivo supera el máximo permitido de 50MB." },
      { status: 413 },
    )
  }

  const extension = file.name
    .slice(file.name.lastIndexOf("."))
    .toLowerCase()

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return Response.json(
      {
        error:
          "Tipo de archivo no permitido. Usa PDF, DWG, PNG, JPG o WEBP.",
      },
      { status: 415 },
    )
  }

  // 3. Create Supabase server client
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // setAll llamado desde un contexto de solo lectura; lo refresca
              // el middleware.
            }
          }),
      },
    },
  )

  // 4. Upload to Supabase Storage
  const safeName = file.name.replace(/\s+/g, "-")
  const fileName = `${proyectoId}/${Date.now()}-${safeName}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(fileName, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) {
    console.error("Upload error:", uploadError)
    // Return mock success for development (when Supabase Storage not configured)
    if (process.env.NODE_ENV !== "production") {
      return Response.json({
        success: true,
        documento: {
          nombre: file.name,
          tipo,
          url: `/mock-uploads/${fileName}`,
          tamano: file.size,
        },
      })
    }
    return Response.json({ error: uploadError.message }, { status: 500 })
  }

  // 5. Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("documentos").getPublicUrl(fileName)

  // 6. Save to documentos table
  const { error: dbError } = await supabase.from("documentos").insert({
    proyecto_id: proyectoId,
    nombre: file.name,
    tipo,
    url: publicUrl,
    tamano: file.size,
  })

  if (dbError) {
    console.error("DB error:", dbError)
  }

  return Response.json({
    success: true,
    documento: {
      nombre: file.name,
      tipo,
      url: publicUrl,
      tamano: file.size,
    },
  })
}
