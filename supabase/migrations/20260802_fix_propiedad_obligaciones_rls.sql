-- Fix de seguridad real (encontrado en revisión de código, 2026-08-02): la
-- policy original de propiedad_obligaciones solo validaba
-- es_miembro(workspace_id) contra la columna workspace_id de la FILA QUE SE
-- ESTÁ ESCRIBIENDO — un valor que el propio caller controla en el body del
-- request. No validaba que propiedad_id realmente perteneciera a ESE
-- workspace. Un usuario del workspace A podía hacer PATCH
-- /api/propiedades-portafolio/<uuid-de-B>/obligaciones con su propio
-- workspace_id=A en el insert, y el WITH CHECK pasaba igual — quedando una
-- fila que referencia una propiedad de otro workspace (y pisando, vía el
-- upsert por (propiedad_id, obligacion_slug), un registro real de B).
--
-- Mismo patrón que ya se usa en este proyecto para tablas hijas derivadas
-- (ver documentos_workspace/etapas_workspace en
-- 20260731_workspace_compartir.sql): la policy valida contra el workspace
-- REAL del padre (propiedades_portafolio), no contra una columna que el
-- caller puede rellenar con cualquier workspace al que sí pertenece.
drop policy if exists propiedad_obligaciones_workspace on propiedad_obligaciones;

create policy propiedad_obligaciones_workspace on propiedad_obligaciones for all
  using (exists (
    select 1 from propiedades_portafolio p
    where p.id = propiedad_obligaciones.propiedad_id and es_miembro(p.workspace_id)
  ))
  with check (exists (
    select 1 from propiedades_portafolio p
    where p.id = propiedad_obligaciones.propiedad_id and es_miembro(p.workspace_id)
  ));
