-- Datos catastrales SII del predio, persistidos en el proyecto.
-- El formulario de nuevo proyecto (SIIEnricher) ya los captura; antes el insert
-- los descartaba. Con destino_sii persistido, el flujo guiado de vía pre-informa
-- el destino actual del inmueble. Idempotente: seguro si las columnas ya existen.

alter table proyectos
  add column if not exists rol_sii text,
  add column if not exists destino_sii text,
  add column if not exists avaluo_fiscal_clp bigint,
  add column if not exists superficie_terreno_m2 numeric,
  add column if not exists superficie_construida_m2 numeric,
  add column if not exists lat double precision,
  add column if not exists lng double precision;
