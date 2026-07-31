-- Compartir de verdad: la visibilidad pasa de "soy el dueño de la fila" a
-- "soy miembro del workspace".
--
-- Antes, la RLS era `user_id = auth.uid()` en todas partes. Eso hacía imposible
-- que dos personas trabajaran el mismo expediente: invitar a alguien desde
-- Configuración › Equipo no le daba acceso a nada, porque ninguna política
-- miraba la membresía y `proyectos` ni siquiera tenía `workspace_id`.
--
-- Aplicada en 5 pasos (ver supabase_migrations.schema_migrations:
-- workspace_compartir_paso1..paso5). Se consolida aquí para versionar el
-- esquema en el repo. Idempotente.

-- ── Helpers ────────────────────────────────────────────────────────────────
-- Van SECURITY DEFINER a propósito: se usan DENTRO de las políticas de
-- workspace_members, y una subconsulta normal sobre esa misma tabla dispara
-- recursión infinita de RLS. Al ser definer, la lectura interna no vuelve a
-- pasar por las políticas. search_path fijo para que no se pueda secuestrar.

CREATE OR REPLACE FUNCTION public.es_miembro(ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = ws AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.rol_en_workspace(ws uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM workspace_members m
  WHERE m.workspace_id = ws AND m.user_id = auth.uid() LIMIT 1;
$$;

-- Las políticas de invitaciones consultaban auth.users directamente, pero el
-- rol `authenticated` no tiene SELECT sobre esa tabla: cualquier consulta a
-- workspace_invites moría con "permission denied for table users".
CREATE OR REPLACE FUNCTION public.mi_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.email::text FROM auth.users u WHERE u.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.es_miembro(uuid) FROM public;
REVOKE ALL ON FUNCTION public.rol_en_workspace(uuid) FROM public;
REVOKE ALL ON FUNCTION public.mi_email() FROM public;
GRANT EXECUTE ON FUNCTION public.es_miembro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rol_en_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mi_email() TO authenticated;

-- ── Estructura ─────────────────────────────────────────────────────────────
-- Solo las tablas RAÍZ llevan workspace_id. Las derivadas (documentos, etapas,
-- comunicaciones, cuadros_calculo, document_checklist_items,
-- planos_anotaciones) cuelgan de proyectos y heredan su visibilidad: una sola
-- columna define el alcance y no hay dos fuentes de verdad que puedan diferir.
ALTER TABLE proyectos  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE clientes   ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_proyectos_workspace     ON proyectos (workspace_id);
CREATE INDEX IF NOT EXISTS idx_clientes_workspace      ON clientes (workspace_id);
CREATE INDEX IF NOT EXISTS idx_prospectos_workspace    ON prospectos (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user  ON workspace_members (user_id, workspace_id);

-- ── Backfill ───────────────────────────────────────────────────────────────
-- Cada usuario con datos recibe su workspace y queda como admin.
DO $$
DECLARE u RECORD; ws_id uuid;
BEGIN
  FOR u IN
    SELECT DISTINCT p.id AS user_id, COALESCE(pr.nombre, 'Mi estudio') AS nombre
    FROM auth.users p LEFT JOIN profiles pr ON pr.id = p.id
  LOOP
    SELECT w.id INTO ws_id FROM workspaces w WHERE w.owner_id = u.user_id LIMIT 1;
    IF ws_id IS NULL THEN
      INSERT INTO workspaces (nombre, tipo, plan, owner_id)
      VALUES (u.nombre, 'estudio', 'free', u.user_id) RETURNING id INTO ws_id;
    END IF;
    INSERT INTO workspace_members (workspace_id, user_id, role)
    SELECT ws_id, u.user_id, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM workspace_members m
                      WHERE m.workspace_id = ws_id AND m.user_id = u.user_id);
    UPDATE proyectos  SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE clientes   SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE prospectos SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
  END LOOP;
END $$;

-- ── RLS de los datos ───────────────────────────────────────────────────────
-- Se conserva `user_id = auth.uid()` como red de seguridad para filas sin
-- workspace_id: tras el backfill no deberían existir, pero así nadie queda
-- fuera de sus propios datos si algo se inserta sin workspace.

DROP POLICY IF EXISTS proyectos_own ON proyectos;
CREATE POLICY proyectos_workspace ON proyectos FOR ALL
  USING (es_miembro(workspace_id) OR user_id = auth.uid())
  WITH CHECK (es_miembro(workspace_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS clientes_own ON clientes;
CREATE POLICY clientes_workspace ON clientes FOR ALL
  USING (es_miembro(workspace_id) OR user_id = auth.uid())
  WITH CHECK (es_miembro(workspace_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS prospectos_own ON prospectos;
CREATE POLICY prospectos_workspace ON prospectos FOR ALL
  USING (es_miembro(workspace_id) OR user_id = auth.uid())
  WITH CHECK (es_miembro(workspace_id) OR user_id = auth.uid());

-- Derivadas de proyectos.
DROP POLICY IF EXISTS documentos_own ON documentos;
CREATE POLICY documentos_workspace ON documentos FOR ALL
  USING (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = documentos.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = documentos.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())));

DROP POLICY IF EXISTS etapas_own ON etapas;
CREATE POLICY etapas_workspace ON etapas FOR ALL
  USING (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = etapas.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = etapas.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())));

DROP POLICY IF EXISTS comunicaciones_own ON comunicaciones;
CREATE POLICY comunicaciones_workspace ON comunicaciones FOR ALL
  USING (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = comunicaciones.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = comunicaciones.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())));

DROP POLICY IF EXISTS "cuadros_calculo owner" ON cuadros_calculo;
CREATE POLICY cuadros_calculo_workspace ON cuadros_calculo FOR ALL
  USING (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = cuadros_calculo.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = cuadros_calculo.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())));

DROP POLICY IF EXISTS checklist_items_own ON document_checklist_items;
CREATE POLICY checklist_items_workspace ON document_checklist_items FOR ALL
  USING (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = document_checklist_items.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = document_checklist_items.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())));

DROP POLICY IF EXISTS planos_anotaciones_own ON planos_anotaciones;
CREATE POLICY planos_anotaciones_workspace ON planos_anotaciones FOR ALL
  USING (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = planos_anotaciones.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = planos_anotaciones.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())));

-- Estas dos tenían user_id propio: un informe sobre un proyecto compartido
-- debe verlo todo el equipo, no solo quien lo generó.
DROP POLICY IF EXISTS dd_reports_own ON due_diligence_reports;
CREATE POLICY dd_reports_workspace ON due_diligence_reports FOR ALL
  USING (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = due_diligence_reports.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())) OR user_id = auth.uid())
  WITH CHECK (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = due_diligence_reports.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())) OR user_id = auth.uid());

DROP POLICY IF EXISTS observaciones_dom_owner ON observaciones_dom;
CREATE POLICY observaciones_dom_workspace ON observaciones_dom FOR ALL
  USING (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = observaciones_dom.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())) OR user_id = auth.uid())
  WITH CHECK (EXISTS (SELECT 1 FROM proyectos p WHERE p.id = observaciones_dom.proyecto_id
                 AND (es_miembro(p.workspace_id) OR p.user_id = auth.uid())) OR user_id = auth.uid());

-- ── RLS del propio workspace ───────────────────────────────────────────────
-- Estas políticas existían pero nunca se ejercitaron (las tablas estaban
-- vacías) y tenían tres defectos que habrían aparecido al primer uso.

-- Decía `wm.workspace_id = wm.id`: comparaba con su propia PK, nunca cierto.
DROP POLICY IF EXISTS workspaces_member_read ON workspaces;
CREATE POLICY workspaces_member_read ON workspaces FOR SELECT
  USING (owner_id = auth.uid() OR es_miembro(id));

-- Decía `wm2.workspace_id = wm2.workspace_id`: columna contra sí misma,
-- SIEMPRE verdadero. Cualquier miembro veía los miembros de todos.
DROP POLICY IF EXISTS workspace_members_read ON workspace_members;
CREATE POLICY workspace_members_read ON workspace_members FOR SELECT
  USING (user_id = auth.uid() OR es_miembro(workspace_id));

-- Se auto-referenciaba: recursión infinita apenas hubiera filas.
DROP POLICY IF EXISTS workspace_members_admin_write ON workspace_members;
CREATE POLICY workspace_members_admin_write ON workspace_members FOR ALL
  USING (rol_en_workspace(workspace_id) = 'admin')
  WITH CHECK (rol_en_workspace(workspace_id) = 'admin');

-- Dejaba leer TODA invitación pendiente a cualquier usuario autenticado. Como
-- el token es la credencial para unirse, permitía listar invitaciones ajenas y
-- colarse en otro workspace. El canje por token se hace en el servidor con
-- service role; por RLS solo se ve lo propio.
DROP POLICY IF EXISTS workspace_invites_token_read ON workspace_invites;
DROP POLICY IF EXISTS workspace_invites_propia_read ON workspace_invites;
CREATE POLICY workspace_invites_propia_read ON workspace_invites FOR SELECT
  USING (email = mi_email() OR es_miembro(workspace_id));

DROP POLICY IF EXISTS workspace_invites_accept ON workspace_invites;
CREATE POLICY workspace_invites_accept ON workspace_invites FOR UPDATE
  USING (email = mi_email() OR rol_en_workspace(workspace_id) = 'admin')
  WITH CHECK (email = mi_email() OR rol_en_workspace(workspace_id) = 'admin');

DROP POLICY IF EXISTS workspace_invites_admin_insert ON workspace_invites;
CREATE POLICY workspace_invites_admin_insert ON workspace_invites FOR INSERT
  WITH CHECK (rol_en_workspace(workspace_id) = 'admin');

DROP POLICY IF EXISTS workspace_invites_admin_delete ON workspace_invites;
CREATE POLICY workspace_invites_admin_delete ON workspace_invites FOR DELETE
  USING (rol_en_workspace(workspace_id) = 'admin');
