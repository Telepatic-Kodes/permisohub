-- Fallback de geocodeComunaCentroide() (lib/geocoding.ts) conectado a
-- /api/zonificacion/lookup: cuando la dirección/título no geocodifica
-- (causa dominante de zona_status='error' en terrenos scrapeados — 04-08),
-- se resuelve al centroide de la comuna en vez de rendirse. Esto SIEMPRE
-- debe quedar distinguible de una resolución exacta — nunca se muestra como
-- si fuera la zona real del predio sin decirlo (ver disciplina del proyecto
-- de nunca fabricar precisión no fundamentada).
alter table zonificacion_cache
  add column if not exists precision text not null default 'exacta'
    check (precision in ('exacta', 'centroide_comuna'));

-- Snapshot sin CHECK (mismo estilo que zona_status en estas dos tablas —
-- el valor autoritativo vive en zonificacion_cache.precision, esto es solo
-- una copia rápida para listados sin join). NULL = fila resuelta antes de
-- este cambio, tratar como 'exacta' en código (comportamiento histórico).
alter table proyectos
  add column if not exists zona_precision text; -- 'exacta' | 'centroide_comuna' | null (legacy)

alter table terrenos
  add column if not exists zona_precision text; -- 'exacta' | 'centroide_comuna' | null (legacy)
