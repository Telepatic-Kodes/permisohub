-- Fase 2 de la fusión PROPRA·BI → PermisoHub: historial diario de
-- indicadores macro (UF/IPC/TPM/dólar). Dataset global, mismo patrón de RLS
-- que noticias_mercado.
--
-- Divergencia deliberada del origen (market_snapshots en Drizzle): esa tabla
-- no tiene constraint de unicidad y es de solo-escritura — se inserta a
-- diario pero nada la lee nunca en la app origen. Acá fecha_captura es
-- UNIQUE + upsert on-conflict (una fila por día, idempotente ante corridas
-- repetidas del cron el mismo día) precisamente porque esta tabla SÍ se va a
-- leer (app/(dashboard)/mercado-inmobiliario/macro).

CREATE TABLE IF NOT EXISTS indicadores_macro_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  fecha_captura date NOT NULL DEFAULT CURRENT_DATE,
  uf numeric(10,2) NOT NULL,
  uf_fecha date,               -- fecha propia del dato UF según mindicador.cl
  ipc numeric(10,2),
  tpm numeric(10,2),
  dolar numeric(10,2),

  capturado_el timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_indicadores_macro_historial_fecha
  ON indicadores_macro_historial (fecha_captura);

ALTER TABLE indicadores_macro_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "indicadores_macro_historial_read" ON indicadores_macro_historial
  FOR SELECT TO authenticated USING (true);
