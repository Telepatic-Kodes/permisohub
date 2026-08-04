-- El checklist del copiloto nunca persistía: el insert en
-- app/api/ai/copiloto/route.ts escribía columnas inexistentes
-- (nombre/articulo_normativo/descripcion/obligatorio) contra el schema real
-- (label/articulo_oguc, sin descripcion/obligatorio) — el insert fallaba en
-- silencio y document_checklist_items quedaba siempre en 0 filas (verificado
-- en vivo). label y articulo_oguc ya existían; solo faltan estas dos.
alter table document_checklist_items
  add column if not exists descripcion text,
  add column if not exists obligatorio boolean not null default true;
