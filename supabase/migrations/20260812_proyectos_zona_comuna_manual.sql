-- Backlog (checkpoint 11-08): la etiqueta de cita "Fuente: capa oficial
-- {municipio}" en via-decision.tsx usaba proyecto.municipio incluso cuando
-- la zona vino de la selección manual del fallback (ZONE-05) — la comuna
-- realmente elegida ahí nunca se persistía, así que la cita citaba el
-- municipio original del proyecto, no la comuna seleccionada.
--
-- Aditivo: columna nullable, poblada solo por el branch manual de
-- POST /api/proyectos/[id]/zonificacion.

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS zona_comuna_manual text;

COMMENT ON COLUMN proyectos.zona_comuna_manual IS
  'Comuna realmente seleccionada en el fallback manual de zonificación (ZONE-05) — distinta de proyectos.municipio, que puede no coincidir. NULL cuando zona_origen != ''manual''.';
