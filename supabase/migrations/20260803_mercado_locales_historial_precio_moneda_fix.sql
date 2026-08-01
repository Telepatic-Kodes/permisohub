-- Bug real encontrado en la primera corrida manual del scraper (1 ago 2026):
-- registrar_historial_precio_mercado_local() solo chequeaba
-- NEW.precio_monto IS NOT NULL, no NEW.precio_moneda — un listing con precio
-- parseado pero en una moneda no normalizada a UF/CLP (ver
-- parseCardMercadoLocal en lib/scrapers/portalinmobiliario.ts, que deja
-- precio_moneda en NULL para cualquier unidad que no sea UF o $) dispara un
-- INSERT en mercado_locales_historial_precio con precio_moneda NULL, que la
-- tabla rechaza (columna NOT NULL) — reventó el upsert completo de esa
-- comuna×operación (Las Condes/venta) en la primera corrida real.
CREATE OR REPLACE FUNCTION public.registrar_historial_precio_mercado_local()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.precio_monto IS NOT NULL AND NEW.precio_moneda IS NOT NULL THEN
    INSERT INTO mercado_locales_historial_precio (listing_id, precio_monto, precio_moneda)
    VALUES (NEW.id, NEW.precio_monto, NEW.precio_moneda);
  ELSIF TG_OP = 'UPDATE' AND NEW.precio_monto IS NOT NULL AND NEW.precio_moneda IS NOT NULL
        AND (NEW.precio_monto IS DISTINCT FROM OLD.precio_monto
             OR NEW.precio_moneda IS DISTINCT FROM OLD.precio_moneda) THEN
    INSERT INTO mercado_locales_historial_precio (listing_id, precio_monto, precio_moneda)
    VALUES (NEW.id, NEW.precio_monto, NEW.precio_moneda);
  END IF;
  RETURN NEW;
END;
$$;
