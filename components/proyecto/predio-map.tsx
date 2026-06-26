"use client"

import { ExternalLink, MapPin } from "lucide-react"

interface PredioMapProps {
  direccion: string
  municipio?: string
  lat?: number
  lng?: number
  className?: string
}

export function PredioMap({ direccion, municipio, lat, lng, className }: PredioMapProps) {
  const fullAddress = municipio ? `${direccion}, ${municipio}, Chile` : `${direccion}, Chile`

  // If we have coordinates, use lat/lng; otherwise use address search
  const embedQuery = lat && lng
    ? `${lat},${lng}`
    : encodeURIComponent(fullAddress)

  const embedSrc = `https://maps.google.com/maps?q=${embedQuery}&output=embed&z=17`
  const mapsUrl = lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(fullAddress)}`

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
        <iframe
          title="Mapa del predio"
          src={embedSrc}
          width="100%"
          height="220"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block"
          style={{ border: 0 }}
        />
        {/* Overlay link for opening in full Google Maps */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-white transition-colors"
        >
          <ExternalLink className="size-3" />
          Ver en Google Maps
        </a>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3 shrink-0" />
        {fullAddress}
      </p>
    </div>
  )
}
