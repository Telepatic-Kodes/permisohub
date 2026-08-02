# Requirements: PermisoHub

**Defined:** 2026-08-02
**Core Value:** El copiloto IA del arquitecto chileno

## v1.7 Requirements — Cabida Comercial (Demografía y Consumo)

Determinar si hay demanda real ("cabida") para un nuevo supermercado, minimarket, strip center o power center en una oportunidad, cruzando demografía/consumo público chileno y competencia existente dentro de un área de influencia (isócrona).

### UBIC — Ubicación e Isócrona

- [ ] **UBIC-01**: Al abrir el tab "Cabida Comercial" de una oportunidad, el sistema resuelve su punto geolocalizado (lat/lng) a partir de comuna + `locationText` vía geocoding, con fallback a centroide de comuna si no resuelve más fino
- [ ] **UBIC-02**: La precisión real obtenida (ej. "dirección aproximada" vs. "centroide de comuna") se muestra explícitamente en la UI — nunca se presenta como ubicación exacta si no lo es
- [ ] **UBIC-03**: El área de influencia se calcula como isócrona real (caminata/auto, vía openrouteservice) cuando el servicio responde correctamente
- [ ] **UBIC-04**: Si el cálculo de isócrona falla o no está disponible, el sistema degrada a un radio simple equivalente, señalando explícitamente el método usado (`red_vial` vs. `círculo_equivalente`) — nunca de forma silenciosa
- [ ] **UBIC-05**: El usuario puede forzar un recálculo explícito ("Actualizar"), sin refresco silencioso en background — mismo patrón que zonificación

### DEMO — Demografía y Consumo

- [ ] **DEMO-01**: El tab muestra población estimada dentro del área de influencia, por intersección geoespacial con Censo 2017 (manzana), con disclaimer de antigüedad del dato
- [ ] **DEMO-02**: El tab muestra capacidad de gasto estimada por categoría de consumo (ingreso/pobreza comunal vía CASEN + share de categoría vía EPF), etiquetada explícitamente como "estimado agregado a nivel macro-zona, no medido en el área específica" — nunca presentado con precisión de isócrona
- [ ] **DEMO-03**: Cada cifra demográfica/de consumo muestra su fuente y año/vintage de forma visible — nunca mezclando vintages censales (2017 vs. 2024) sin declararlo

### COMPE — Competencia

- [ ] **COMPE-01**: El usuario puede seleccionar uno de los 4 formatos objetivo (supermercado, minimarket, strip center, power center) para el análisis
- [ ] **COMPE-02**: El tab muestra el conteo de competidores existentes por formato dentro del área de influencia, con nombre/tag y distancia, extendiendo la consulta Overpass ya existente (`obtenerSenalesUbicacion`)
- [ ] **COMPE-03**: Para supermercado/minimarket, la detección usa tags OSM estándar (`shop=supermarket|convenience|mall|department_store`)
- [ ] **COMPE-04**: Para strip center/power center, la detección usa una lista curada a mano de centros conocidos en Chile (mantenida por el equipo), dado que no existe tag OSM ni fuente pública con direcciones para estos formatos
- [ ] **COMPE-05**: Un conteo de 0 competidores nunca se interpreta como "confirmado: no hay competencia" cuando la cobertura de la fuente es conocida como incompleta (ej. roster SII sin Unimarc) — el nivel de confianza se degrada explícitamente en ese caso
- [ ] **COMPE-06**: El usuario puede ver el nombre real de cadena de cada competidor detectado (ej. "Líder Express"), cruzando OSM con la nómina SII geocodificada on-demand por comuna

### VERE — Veredicto y Metodología

- [ ] **VERE-01**: El tab presenta un veredicto de 3 estados por formato (ej. "evidencia de espacio" / "mercado parece cubierto" / "evidencia insuficiente para concluir") — nunca un veredicto binario sí/no
- [ ] **VERE-02**: El veredicto siempre se muestra junto a su nivel de confianza — nunca uno sin el otro
- [ ] **VERE-03**: El tab incluye una sección de metodología/fuentes citando fecha del censo, fecha de scraping de competidores, radio/isócrona usado, y qué no se pudo verificar
- [ ] **VERE-04**: El gap score se presenta explícitamente como proxy de densidad de oferta vs. demanda estimada — nunca como índice de fuga de ventas (leakage/surplus) real

### MAPA — Mapa Visual

- [ ] **MAPA-01**: El tab muestra un mapa Leaflet con el polígono del área de influencia (isócrona o radio) y pines de los competidores detectados

### CABI — Arquitectura del Motor

- [ ] **CABI-01**: El análisis de cabida comercial se implementa como una función pura `(lat, lng, formato) → resultado`, no acoplada a `oportunidadId`, para soportar un modo standalone por dirección/comuna en un milestone futuro sin refactor
- [ ] **CABI-02**: El tab "Cabida Comercial" aparece como una 5ª pestaña en la ficha de detalle de oportunidad (`/oportunidades/[id]`), junto a posicionamiento/historial/comparables/resumen, con carga bajo demanda (no eager) siguiendo el patrón de `ResumenTab`

## Future Requirements (v1.x / v2+)

### Cabida Comercial (extensión)

- **CABI-03**: Modo standalone por dirección/comuna libre, sin pasar por una oportunidad ya cargada
- **CABI-04**: Riesgo de canibalización entre el formato objetivo y otras oportunidades/propiedades del propio usuario (cartera)
- **CABI-05**: GSE (grupo socioeconómico) proxy propio desde variables censales, si el ingreso/pobreza comunal de CASEN resulta insuficiente

## Out of Scope

Explícitamente excluido de v1.7 — todos requieren un insumo que Chile no publica públicamente, o un vendor ya vetado por la founder.

| Feature | Reason |
|---------|--------|
| Huff model calibrado (probabilidad de captura de mercado) | Requiere datos reales de visitas/ventas para calibrar atractivo y decaimiento por distancia — Chile no los publica; simularlo sería fabricar una probabilidad con apariencia científica |
| Índice de leakage/surplus real (ventas reales del área vs. potencial) | No existe en Chile un equivalente al Economic Census of Retail Trade (ventas reales por categoría y comuna) |
| Foot traffic real (tipo Placer.ai) | Vendor pagado, ya vetado explícitamente por la founder (2026-08-01: no pagar por datos/apps de terceros por ahora) |
| GSE preciso vía dataset comercial (Adimark/Ipsos/similar) | Vendor pagado, mismo veto que Foot traffic real |
| Score único 0-100 de "viabilidad del local" | Esconde criterios subjetivos como si fueran objetivos — mismo anti-patrón ya descartado en v1.6 (Mercado Inmobiliario) |
| Proyección de ventas/facturación esperada ($/mes) | Requiere modelo de captura de mercado + ticket promedio real por formato — ninguno disponible con fuentes públicas chilenas |
| Isócrona con tráfico en tiempo real (hora punta vs. valle) | Requiere servicios pagados (Google/TomTom Traffic) con la fidelidad necesaria |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UBIC-01 | TBD | Pending |
| UBIC-02 | TBD | Pending |
| UBIC-03 | TBD | Pending |
| UBIC-04 | TBD | Pending |
| UBIC-05 | TBD | Pending |
| DEMO-01 | TBD | Pending |
| DEMO-02 | TBD | Pending |
| DEMO-03 | TBD | Pending |
| COMPE-01 | TBD | Pending |
| COMPE-02 | TBD | Pending |
| COMPE-03 | TBD | Pending |
| COMPE-04 | TBD | Pending |
| COMPE-05 | TBD | Pending |
| COMPE-06 | TBD | Pending |
| VERE-01 | TBD | Pending |
| VERE-02 | TBD | Pending |
| VERE-03 | TBD | Pending |
| VERE-04 | TBD | Pending |
| MAPA-01 | TBD | Pending |
| CABI-01 | TBD | Pending |
| CABI-02 | TBD | Pending |

**Coverage:**
- v1.7 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20 ⚠️ (pendiente de roadmap)

---
*Requirements defined: 2026-08-02*
*Last updated: 2026-08-02 — v1.7 Cabida Comercial requirements definidos vía `/gsd:new-milestone`*
