-- Enriquecimiento SII para Mi Cartera — rol_sii ya existía en la tabla desde
-- su creación (20260808_propiedades_portafolio.sql) pero no estaba cableado
-- a ninguna lógica ni UI. Cierra ese dato muerto: permite consultar el
-- destino declarado y el avalúo fiscal reales por rol, mismo lookup ya
-- usado en producción por Tasación y Due Diligence (lib/sii-lookup-server.ts).
alter table propiedades_portafolio add column if not exists sii_destino text;
alter table propiedades_portafolio add column if not exists sii_avaluo_fiscal_uf numeric;
alter table propiedades_portafolio add column if not exists sii_consultado_el timestamptz;
