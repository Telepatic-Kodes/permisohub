#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Empuja las variables de entorno de tu .env.local a Vercel PRODUCCIÓN.
#
# Lo corres TÚ desde la raíz del repo. Lee .env.local (local, tuyo) y sube
# cada secreto a Vercel. NO sube las flags de desarrollo (BYPASS_AUTH,
# DEMO_MODE, etc.) y fija las URLs públicas al dominio real de producción.
#
# Uso:
#   bash scripts/vercel-env-push.sh
#
# Requisitos: Vercel CLI logueado (`vercel whoami`) y el repo linkeado
# (ya lo está: .vercel/project.json existe).
# ---------------------------------------------------------------------------
set -euo pipefail

ENV_FILE=".env.local"
PROD_URL="https://permisohub.vercel.app"   # dominio canónico de producción

# Claves que NUNCA deben ir a producción (solo desarrollo) o que se setean aparte.
DENY=(BYPASS_AUTH DEMO_MODE NEXT_PUBLIC_DEMO_MODE DEV_USER_EMAIL NEXT_PUBLIC_APP_URL NEXT_PUBLIC_SITE_URL)

[[ -f "$ENV_FILE" ]] || { echo "✗ No encuentro $ENV_FILE (corre esto desde la raíz del repo)"; exit 1; }
command -v vercel >/dev/null || { echo "✗ Vercel CLI no está instalado"; exit 1; }

is_denied() { local k="$1"; for d in "${DENY[@]}"; do [[ "$k" == "$d" ]] && return 0; done; return 1; }

push() { # push NOMBRE VALOR
  local name="$1" value="$2"
  # idempotente: borra si ya existe, luego agrega
  vercel env rm "$name" production -y >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$name" production >/dev/null 2>&1 \
    && echo "  ✓ $name" \
    || echo "  ✗ $name (falló — revisa manualmente)"
}

echo "⚠  Este script sube a PRODUCCIÓN lo que haya en $ENV_FILE (incluida OPENAI_API_KEY)."
echo "   Si aún NO rotaste la OpenAI key, rótala primero (platform.openai.com),"
echo "   pégala en $ENV_FILE y RECIÉN corre esto — así prod queda con la key nueva."
read -r -p "¿Continuar? (escribe 'si'): " ok
[[ "$ok" == "si" ]] || { echo "Cancelado."; exit 0; }

echo ""
echo "→ Subiendo secretos de $ENV_FILE a Vercel Producción…"
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#"${line%%[![:space:]]*}"}"                 # trim izquierda
  [[ -z "$line" || "$line" == \#* ]] && continue          # vacías / comentarios
  [[ "$line" != *"="* ]] && continue
  key="${line%%=*}"; key="${key%"${key##*[![:space:]]}"}" # nombre sin espacios
  val="${line#*=}"                                        # todo tras el primer =
  # quitar comillas envolventes
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  is_denied "$key" && { echo "  · omito $key (dev/URL)"; continue; }
  push "$key" "$val"
done < "$ENV_FILE"

echo ""
echo "→ Fijando URLs públicas al dominio de producción…"
push NEXT_PUBLIC_APP_URL  "$PROD_URL"
push NEXT_PUBLIC_SITE_URL "$PROD_URL"

echo ""
echo "✓ Listo. Variables en Vercel Producción:"
vercel env ls production 2>/dev/null | grep -vE "Retrieving|Common next|vercel env|^-|^\s*$" || true
echo ""
echo "→ Ahora redeploya para que tomen efecto:"
echo "    vercel --prod"
echo "  (o Deployments → Redeploy en el dashboard)"
