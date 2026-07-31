-- Desarchivo de expedientes: el esquema que la feature nunca tuvo.
--
-- DesarchivoPanel, GET/POST/PATCH de /api/proyectos/[id]/desarchivo y la lista
-- de campos actualizables de /api/proyectos/[id] ya escribían y leían estas
-- tres columnas, pero no existían en la tabla. El SELECT fallaba, el catch lo
-- devolvía como 404 "Proyecto no encontrado" (falso: el proyecto existe) y la
-- ficha disparaba dos peticiones fallidas en cada carga.
--
-- Aditiva e idempotente.

ALTER TABLE proyectos
  -- Un expediente archivado por la DOM no admite tramitación hasta desarchivarlo.
  ADD COLUMN IF NOT EXISTS esta_archivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_archivado date,
  -- Solicitud de desarchivo (SolicitudDesarchivo en types/index.ts): fecha,
  -- estado, número que asigna el municipio, costo en UF, fechas de pago y de
  -- entrega estimada. Va como jsonb porque es un sub-documento del expediente,
  -- no una entidad consultada por separado.
  ADD COLUMN IF NOT EXISTS solicitud_desarchivo jsonb;

-- Los expedientes archivados son la minoría y siempre se filtran por este flag.
CREATE INDEX IF NOT EXISTS idx_proyectos_archivados
  ON proyectos (esta_archivado)
  WHERE esta_archivado = true;
