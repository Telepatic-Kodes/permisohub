"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import type { Map as LeafletMap } from "leaflet"

export interface ZonaPolygon {
  type: "Polygon"
  coordinates: number[][][]
}

interface ZonificacionMapaProps {
  lat: number | null
  lng: number | null
  geometria: ZonaPolygon | null
  className?: string
}

export function ZonificacionMapa({ lat, lng, geometria, className }: ZonificacionMapaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    if (!containerRef.current || lat == null || lng == null) return
    let cancelled = false

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return

      const map = L.map(containerRef.current).setView([lat, lng], 17)
      mapRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const markerIcon = L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
      L.marker([lat, lng], { icon: markerIcon }).addTo(map)

      if (geometria) {
        const layer = L.geoJSON(geometria as GeoJSON.Geometry, {
          style: { color: "#2563eb", weight: 2, fillOpacity: 0.12 },
        }).addTo(map)
        const bounds = layer.getBounds()
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16] })
      }
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [lat, lng, geometria])

  if (lat == null || lng == null) {
    return (
      <div className={className}>
        <p className="text-xs text-muted-foreground">Sin coordenadas geocodificadas todavía.</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="h-[240px] w-full rounded-lg border border-border" />
      {!geometria && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Límite de zona no disponible aún — usa &quot;Actualizar&quot; para obtenerlo.
        </p>
      )}
    </div>
  )
}
