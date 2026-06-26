import { cn } from '@/lib/utils'
import { ESTADO_BOLETA_CONFIG } from '@/lib/boletas'
import type { EstadoBoleta } from '@/types'

interface BoletaStatusBadgeProps {
  estado: EstadoBoleta
  className?: string
  size?: 'sm' | 'md'
}

export function BoletaStatusBadge({ estado, className, size = 'md' }: BoletaStatusBadgeProps) {
  const config = ESTADO_BOLETA_CONFIG[estado]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        config.className,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full shrink-0', config.dot)} />
      {config.label}
    </span>
  )
}
