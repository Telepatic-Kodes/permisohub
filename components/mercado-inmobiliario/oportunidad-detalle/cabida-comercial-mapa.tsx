"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import type { Map as LeafletMap } from "leaflet"
import type { CompetidorDetectado } from "@/lib/cabida-comercial"

interface CabidaComercialMapaProps {
  lat: number
  lng: number
  // A diferencia de ZonaPolygon (zonificacion-mapa.tsx), que solo acepta
  // Polygon: IsocronaResultado.geometria está tipado Polygon | MultiPolygon
  // desde el día 1 (lib/cabida-comercial.ts) — L.geoJSON() maneja ambos
  // nativamente, sin código adicional, pero el tipo del prop debe aceptarlo.
  geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon
  competidores: CompetidorDetectado[]
  className?: string
}

function formatearDistancia(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

export function CabidaComercialMapa({ lat, lng, geometria, competidores, className }: CabidaComercialMapaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return

      // Zoom 15 por defecto (vs. 17 de zonificacion-mapa.tsx) — isócronas
      // cubren un área mayor que una sola parcela.
      const map = L.map(containerRef.current).setView([lat, lng], 15)
      mapRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const origenIcon = L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
      L.marker([lat, lng], { icon: origenIcon }).addTo(map)

      // Verde (#16a34a), NO el azul de zonificacion-mapa.tsx (#2563eb) —
      // evitar confundir "área de influencia comercial" con "polígono de
      // zonificación PRC" si un usuario tiene ambos tabs en memoria.
      const areaLayer = L.geoJSON(geometria as GeoJSON.Geometry, {
        style: { color: "#16a34a", weight: 2, fillOpacity: 0.10 },
      }).addTo(map)

      // Pines de competidores — NO existen en zonificacion-mapa.tsx.
      // CompetidorDetectado.lat/.lng son campos no-opcionales (confirmado en
      // lib/cabida-comercial.ts) — sin guard de null necesario acá.
      const pinIcon = L.divIcon({
        className: "",
        html: '<div style="width:12px;height:12px;border-radius:50%;background:#dc2626;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })
      competidores.forEach((c) => {
        L.marker([c.lat, c.lng], { icon: pinIcon })
          .bindPopup(`${c.nombre} — ${formatearDistancia(c.distanciaM)}`)
          .addTo(map)
      })

      // Fit bounds al polígono del área de influencia (no a los pines) — el
      // área es el encuadre principal, los pines son detalle dentro de ella.
      const bounds = areaLayer.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16] })
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [lat, lng, geometria, competidores])

  return (
    <div className={className}>
      <div ref={containerRef} className="h-[280px] w-full rounded-lg border border-border" />
    </div>
  )
}
