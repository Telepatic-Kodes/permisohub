-- Security fixes: 3 critical RLS vulnerabilities
-- C-6: cadenas policy used workspace_id = auth.uid() (impossible condition)
-- C-7: boletas_servicios policy had typo wm.rol instead of wm.role
-- A-9: municipios/requisitos_municipio allowed any authenticated user to corrupt global data

-- ─── C-6: Fix cadenas RLS (workspace_id ≠ auth.uid()) ───────────────────────

DROP POLICY IF EXISTS "cadenas_workspace_owner" ON cadenas;
DROP POLICY IF EXISTS "centros_via_cadena" ON centros_comerciales;
DROP POLICY IF EXISTS "locales_via_centro" ON locales;

-- Members can read cadenas belonging to their workspace
CREATE POLICY "cadenas_member_read" ON cadenas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = cadenas.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- Only workspace admins can create/update/delete cadenas
CREATE POLICY "cadenas_admin_write" ON cadenas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = cadenas.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = cadenas.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- centros_comerciales: access via cadena → workspace membership
CREATE POLICY "centros_member_read" ON centros_comerciales
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cadenas c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = centros_comerciales.cadena_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "centros_admin_write" ON centros_comerciales
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cadenas c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = centros_comerciales.cadena_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin', 'arquitecto')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cadenas c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = centros_comerciales.cadena_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin', 'arquitecto')
    )
  );

-- locales: access via centro → cadena → workspace membership
CREATE POLICY "locales_member_read" ON locales
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM centros_comerciales cc
      JOIN cadenas c ON c.id = cc.cadena_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE cc.id = locales.centro_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "locales_admin_write" ON locales
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM centros_comerciales cc
      JOIN cadenas c ON c.id = cc.cadena_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE cc.id = locales.centro_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin', 'arquitecto')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM centros_comerciales cc
      JOIN cadenas c ON c.id = cc.cadena_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE cc.id = locales.centro_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin', 'arquitecto')
    )
  );

-- ─── C-7: Fix typo wm.rol → wm.role in boletas_servicios ────────────────────

DROP POLICY IF EXISTS "boletas_workspace_read" ON boletas_servicios;
DROP POLICY IF EXISTS "boletas_workspace_write" ON boletas_servicios;

CREATE POLICY "boletas_workspace_read" ON boletas_servicios
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM locales l
      JOIN centros_comerciales cc ON cc.id = l.centro_id
      JOIN cadenas ca             ON ca.id = cc.cadena_id
      JOIN workspace_members wm   ON wm.workspace_id = ca.workspace_id
      WHERE l.id = boletas_servicios.local_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "boletas_workspace_write" ON boletas_servicios
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM locales l
      JOIN centros_comerciales cc ON cc.id = l.centro_id
      JOIN cadenas ca             ON ca.id = cc.cadena_id
      JOIN workspace_members wm   ON wm.workspace_id = ca.workspace_id
      WHERE l.id = boletas_servicios.local_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin', 'arquitecto')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM locales l
      JOIN centros_comerciales cc ON cc.id = l.centro_id
      JOIN cadenas ca             ON ca.id = cc.cadena_id
      JOIN workspace_members wm   ON wm.workspace_id = ca.workspace_id
      WHERE l.id = boletas_servicios.local_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin', 'arquitecto')
    )
  );

-- ─── A-9: Restrict municipios/requisitos writes to service_role only ─────────

DROP POLICY IF EXISTS "municipios_write" ON municipios;
DROP POLICY IF EXISTS "requisitos_write" ON requisitos_municipio;

-- Global reference data: only service_role (admin API / migrations) can write
CREATE POLICY "municipios_service_write" ON municipios
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "requisitos_service_write" ON requisitos_municipio
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
