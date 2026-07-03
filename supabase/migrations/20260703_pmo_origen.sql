-- Marca el origen de etapas y observaciones para poder repoblar la PMO desde el
-- due diligence de forma idempotente sin borrar las filas creadas manualmente.
alter table etapas add column if not exists origen text not null default 'manual';
alter table observaciones_dom add column if not exists origen text not null default 'manual';
