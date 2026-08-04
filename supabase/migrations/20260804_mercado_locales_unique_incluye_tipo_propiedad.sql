-- Gap de integridad confirmado en vivo (04-08): el índice único de
-- mercado_locales_listings era (fuente, fuente_id) sin tipo_propiedad — un
-- mismo aviso publicado en 2 categorías del portal (ej. DM-3002938 real,
-- listado tanto en "bodega" como en "industrial" de Doomos) hacía que la
-- segunda corrida de scraper pisara silenciosamente la clasificación de la
-- primera vía el upsert onConflict. Afecta ambas fuentes (Doomos nuevo,
-- Portalinmobiliario ya en producción), no es exclusivo de la fuente nueva.
-- Un mismo fuente_id ahora puede tener una fila por cada tipo_propiedad en
-- que la fuente lo categoriza — eso es honesto (así lo presenta la fuente),
-- no un bug nuevo introducido por permitirlo.
drop index if exists idx_mercado_locales_listings_fuente_id;

create unique index if not exists idx_mercado_locales_listings_fuente_id
  on mercado_locales_listings (fuente, fuente_id, tipo_propiedad);
