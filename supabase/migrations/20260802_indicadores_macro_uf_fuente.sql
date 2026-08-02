-- Trazabilidad de la UF persistida — antes se guardaba UF_FALLBACK_CLP
-- (constante de respaldo) indistinguible de un valor real de mindicador.cl,
-- tanto en la tabla de historial como en el prompt de IA de Reportes de
-- Mercado ("CONTEXTO MACROECONÓMICO CHILE (dato real, hoy)" se afirmaba
-- incluso cuando era el fallback). fetchMacroData() ya calculaba ufFuente,
-- solo faltaba persistirlo.
alter table indicadores_macro_historial add column if not exists uf_fuente text;
alter table indicadores_macro_historial
  add constraint indicadores_macro_uf_fuente_check check (uf_fuente in ('live', 'fallback'));
