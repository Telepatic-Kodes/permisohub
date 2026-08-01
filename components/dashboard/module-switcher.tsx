"use client"

import { usePathname, useRouter } from "next/navigation"
import { Shield, Landmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { inferirModuloDesdeRuta, MODULO_CONFIG, type Modulo } from "@/lib/modulo"

// Switcher fijo arriba del sidebar — a diferencia de un simple toggle visual,
// hace click = navegación real (router.push al href por defecto del
// módulo). Esto garantiza que el switcher, el contenido del sidebar, y el
// badge de módulo en PageHeader NUNCA queden desincronizados entre sí: el
// módulo activo siempre se deriva de la ruta actual, nunca de un estado
// manual separado.
//
// Colores del acento activo hardcodeados en oklch (no las variables CSS
// --modulo-permisos/--modulo-mercado de globals.css) — mismo criterio que
// el resto de sidebar.tsx, cuyo fondo oscuro tampoco sigue esas variables.
// Permisos = verde menta claro nuevo (el verde de página sería invisible
// sobre este fondo oscuro); Mercado = el mismo dorado que ya usa la barra
// activa del sidebar hoy, cero cambio visual para ese módulo.

const ICONO_MODULO: Record<Modulo, typeof Shield> = {
  permisos: Shield,
  'mercado-inmobiliario': Landmark,
}

export function ModuleSwitcher({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const moduloActivo = inferirModuloDesdeRuta(pathname)

  const modulos: Modulo[] = ['permisos', 'mercado-inmobiliario']

  function irAModulo(m: Modulo) {
    if (m === moduloActivo) return
    router.push(MODULO_CONFIG[m].hrefDefault)
  }

  if (collapsed) {
    return (
      <div className="mx-2 my-2 flex flex-col gap-1">
        {modulos.map((m) => {
          const Icono = ICONO_MODULO[m]
          const activo = m === moduloActivo
          return (
            <button
              key={m}
              type="button"
              onClick={() => irAModulo(m)}
              title={MODULO_CONFIG[m].label}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-colors",
                !activo && "text-white/40 hover:bg-white/8 hover:text-white/80",
                activo && m === 'permisos' && "bg-[oklch(0.72_0.09_155)] text-[oklch(0.28_0.055_158)]",
                activo && m === 'mercado-inmobiliario' && "bg-[oklch(0.78_0.16_78)] text-[oklch(0.28_0.055_158)]"
              )}
            >
              <Icono className="size-4" />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mx-2 my-2 flex rounded-lg border border-white/10 bg-white/5 p-1">
      {modulos.map((m) => {
        const activo = m === moduloActivo
        return (
          <button
            key={m}
            type="button"
            onClick={() => irAModulo(m)}
            className={cn(
              "font-technical flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-all",
              !activo && "text-white/45 hover:text-white/75",
              activo && m === 'permisos' && "bg-[oklch(0.72_0.09_155)] text-[oklch(0.28_0.055_158)]",
              activo && m === 'mercado-inmobiliario' && "bg-[oklch(0.78_0.16_78)] text-[oklch(0.28_0.055_158)]"
            )}
          >
            {m === 'mercado-inmobiliario' ? 'Mercado' : MODULO_CONFIG[m].label}
          </button>
        )
      })}
    </div>
  )
}
