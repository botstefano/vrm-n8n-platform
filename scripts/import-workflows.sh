#!/usr/bin/env bash
# Importa (o actualiza) los workflows en n8n vía API pública.
#  - Crea/actualiza WF-00 primero y lo asigna como "Error Workflow" de todos los demás
#    (excepto WF-00 y WF-06, para evitar bucles de error).
#  - Es idempotente: si un workflow con el mismo nombre ya existe, lo actualiza (PUT).
# Requisitos: curl, jq.   Variables: N8N_URL (def. http://localhost:5678), N8N_API_KEY (obligatoria)
set -euo pipefail

N8N_URL="${N8N_URL:-http://localhost:5678}"
N8N_API_KEY="${N8N_API_KEY:?Define N8N_API_KEY (n8n → Settings → n8n API)}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/automation/n8n/workflows"
api() { curl -sf -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" "$@"; }

EXISTING="$(api "$N8N_URL/api/v1/workflows?limit=250")"

# upsert <archivo> [errorWorkflowId] → imprime el id resultante
upsert() {
  local f="$1" err="${2:-}" name id body
  name="$(jq -r '.name' "$f")"
  # La API pública solo acepta estas claves; "active" y "tags" se gestionan aparte.
  body="$(jq --arg e "$err" '{name, nodes, connections, settings: (.settings + (if $e != "" then {errorWorkflow: $e} else {} end))}' "$f")"
  id="$(jq -r --arg n "$name" '.data[] | select(.name == $n) | .id' <<<"$EXISTING" | head -n1)"
  if [ -n "$id" ]; then
    api -X PUT "$N8N_URL/api/v1/workflows/$id" -d "$body" >/dev/null
    echo "  ↻ actualizado  $name ($id)" >&2
  else
    id="$(api -X POST "$N8N_URL/api/v1/workflows" -d "$body" | jq -r '.id')"
    echo "  + creado       $name ($id)" >&2
  fi
  echo "$id"
}

echo "▶ Importando workflows en $N8N_URL"
ERR_ID="$(upsert "$DIR/wf-00-global-error-handler.json")"
ALERTS_ID=""
for f in "$DIR"/wf-*.json; do
  case "$(basename "$f")" in
    wf-00-*) continue ;;
    wf-06-*) ALERTS_ID="$(upsert "$f")" ;;          # sin errorWorkflow (evita bucle)
    *)       upsert "$f" "$ERR_ID" >/dev/null ;;
  esac
done

if [ "${ACTIVATE_ALERTS:-0}" = "1" ] && [ -n "$ALERTS_ID" ]; then
  api -X POST "$N8N_URL/api/v1/workflows/$ALERTS_ID/activate" >/dev/null && echo "  ✓ WF-06 activado"
fi
echo "✔ Listo. Siguiente: asignar credenciales en la UI y activar según el orden del README."
