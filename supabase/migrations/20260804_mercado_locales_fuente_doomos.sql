-- Segunda fuente para mercado_locales_listings (04-08): Doomos.cl confirmado
-- en vivo con inventario real de locales/oficinas/bodegas/industrial (436
-- avisos solo en "arriendo locales comerciales RM") — mismo patrón de tarjeta
-- HTML y slugs de comuna que su scraper de terrenos ya usa.
alter table mercado_locales_listings
  drop constraint mercado_locales_listings_fuente_check;

alter table mercado_locales_listings
  add constraint mercado_locales_listings_fuente_check
  check (fuente in ('portalinmobiliario', 'doomos'));
