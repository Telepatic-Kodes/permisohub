# Archivado — el código vive ahora en `permisohub`

**Fecha:** 31 de julio de 2026
**No desarrolles aquí.** Esta copia queda como referencia histórica.

## Por qué se fusionó

Esta app y `permisohub` nunca estuvieron realmente separadas: apuntaban a **la
misma base de datos de Supabase** y al **mismo repositorio de GitHub**. No eran
dos productos, sino dos frontends sobre los mismos datos — lo que da cero
aislamiento y doble mantenimiento.

`permisohub` ya era un superconjunto: de las rutas de esta app, solo 6 no
existían allá. Todo lo demás (proyectos, clientes, documentos, municipios,
herramientas) estaba duplicado, y `permisohub` además tiene cadenas, centros
comerciales, locales, boletas, patentes, el copiloto y las herramientas de IA.

La divergencia ya cobraba: este código consulta una tabla `observaciones` que
**no existe** en la base (la real es `observaciones_dom`), y no tiene nada del
trabajo de julio — rediseño del expediente, anotación de planos por recorte,
compartir por workspace, ni los arreglos de RLS.

La razón por la que probablemente nació esta app —no había multi-tenancy y
separar el código parecía la única forma de separar clientes— dejó de existir:
`permisohub` ahora tiene workspaces con roles y RLS por membresía.

## Dónde quedó cada cosa

| Aquí | En `permisohub` |
|---|---|
| `app/(admin)/layout.tsx` | `app/(admin)/layout.tsx` — usa el gate compartido |
| `app/(admin)/admin/cuentas/**` | igual |
| `app/(admin)/admin/sla/` | igual |
| `app/(admin)/admin/billing/` | igual, en el nav como "Facturación" |
| `app/portal/cadena/[token]/` | igual |
| `app/api/admin/sla/` | igual |
| `app/api/admin/cadenas/[cadenaId]/bulk-import/` | igual |
| `app/api/billing/outsourcing/` | igual |
| `app/api/portal/cadena/[token]/` | igual |
| `lib/sla-config.ts`, `lib/outsourcing-pricing.ts` | igual |
| Todo lo demás | ya existía allá, en versión más nueva |

La consola de métricas que en `permisohub` estaba en `(dashboard)/admin` se
movió al mismo grupo `(admin)`, para que haya **una sola** consola interna. La
URL `/admin` no cambió.

## El gate de acceso, unificado

Había dos reglas para lo mismo: `ADMIN_EMAILS` (plural) aquí y `ADMIN_EMAIL`
(singular) allá. Ahora vive en `lib/admin-plataforma.ts`, que acepta ambas
formas para no romper configuraciones existentes.

Es deliberado que el administrador de **plataforma** (el equipo que opera el
servicio) no sea un rol de base de datos: `workspace_members.role = 'admin'` es
el administrador de la cuenta de UN cliente. Son cosas distintas y un cliente no
debe poder otorgarse la primera.

> **Pendiente de configuración:** `ADMIN_EMAILS` no está definida en producción.
> Sin ella la consola redirige a `/` — seguro por defecto, pero inaccesible.
> Hay que agregarla en Vercel para poder usarla en vivo.

## Historial

El trabajo de esta app está en la rama `feature/outsourcing-enterprise` del
repositorio compartido (commit `1428edf`). Se subió al remoto el 31 de julio;
hasta entonces existía **solo en este disco**.

## Si ves builds fallidos de esta rama en Vercel

Son esperables. `feature/outsourcing-enterprise` contiene **otra aplicación**
dentro del mismo repositorio, así que Vercel intenta construirla como si fuera
`permisohub` y falla. No hay nada que arreglar: la rama existe solo como
historial y no debe desplegarse. Si molesta el ruido, se descarta con un
"Ignored Build Step" en la configuración del proyecto.
