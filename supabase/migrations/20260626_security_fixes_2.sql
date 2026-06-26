-- Security fixes batch 2
-- A) workspace_invites: separate policies per command (INSERT/UPDATE/DELETE require auth)
-- B) etapas / documentos / comunicaciones / actividades_crm: add WITH CHECK to FOR ALL policies
-- C) workspace_members_admin_write: add WITH CHECK

-- ─── A) workspace_invites — token accept must not allow unauthenticated write ─

-- Drop all existing workspace_invites policies
DROP POLICY IF EXISTS "workspace_invites_read"        ON workspace_invites;
DROP POLICY IF EXISTS "workspace_invites_admin_write" ON workspace_invites;
DROP POLICY IF EXISTS "workspace_invites_token_accept" ON workspace_invites;

-- 1. Workspace members can read their own workspace's invites (authenticated)
CREATE POLICY "workspace_invites_member_read" ON workspace_invites
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- 2. Public token lookup for portal/accept flow (unauthenticated SELECT only)
--    Only non-expired, non-accepted invites can be looked up by token.
--    Because no auth.uid() is required, this allows the invite portal to resolve
--    the invite without the user being logged in yet.
CREATE POLICY "workspace_invites_token_read" ON workspace_invites
  FOR SELECT
  USING (accepted_at IS NULL AND expires_at > now());

-- 3. Only workspace admins can INSERT new invites
CREATE POLICY "workspace_invites_admin_insert" ON workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- 4. Only the invited user (matched by email) can UPDATE (accept) the invite
--    Workspace admins can also update (e.g., revoke / extend expiry)
CREATE POLICY "workspace_invites_accept" ON workspace_invites
  FOR UPDATE TO authenticated
  USING (
    -- The invited user is accepting (their email must match)
    (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR
    -- OR a workspace admin is managing the invite
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  )
  WITH CHECK (
    (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- 5. Only workspace admins can DELETE (revoke) invites
CREATE POLICY "workspace_invites_admin_delete" ON workspace_invites
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- ─── B) etapas: add WITH CHECK to FOR ALL policy ─────────────────────────────

DROP POLICY IF EXISTS "etapas_own" ON etapas;

CREATE POLICY "etapas_own" ON etapas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = etapas.proyecto_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = etapas.proyecto_id
        AND p.user_id = auth.uid()
    )
  );

-- ─── B) documentos: add WITH CHECK to FOR ALL policy ─────────────────────────

DROP POLICY IF EXISTS "documentos_own" ON documentos;

CREATE POLICY "documentos_own" ON documentos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = documentos.proyecto_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = documentos.proyecto_id
        AND p.user_id = auth.uid()
    )
  );

-- ─── B) comunicaciones: add WITH CHECK to FOR ALL policy ─────────────────────

DROP POLICY IF EXISTS "comunicaciones_own" ON comunicaciones;

CREATE POLICY "comunicaciones_own" ON comunicaciones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = comunicaciones.proyecto_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = comunicaciones.proyecto_id
        AND p.user_id = auth.uid()
    )
  );

-- ─── B) actividades_crm: add WITH CHECK to FOR ALL policy ────────────────────

DROP POLICY IF EXISTS "actividades_own" ON actividades_crm;

CREATE POLICY "actividades_own" ON actividades_crm
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prospectos pr
      WHERE pr.id = actividades_crm.prospecto_id
        AND pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prospectos pr
      WHERE pr.id = actividades_crm.prospecto_id
        AND pr.user_id = auth.uid()
    )
  );

-- ─── C) workspace_members_admin_write: add WITH CHECK ────────────────────────

DROP POLICY IF EXISTS "workspace_members_admin_write" ON workspace_members;

CREATE POLICY "workspace_members_admin_write" ON workspace_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );
