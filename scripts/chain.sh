#!/usr/bin/env bash
# CSECTIC — ține lanțul de notificări viu.
#
# Asigură că există EXACT un rulaj succesor în coada workflow-ului. Dacă rulajul
# curent moare (anulat, timeout, startup_failure — cum s-a întâmplat pe 11 nov),
# ștafeta pornește imediat și sistemul continuă singur.
#
# Ieșire: 0 = există ștafetă în coadă / 1 = nu am reușit să pornesc una.
# Folosire: bash chain.sh [nr_incercari]
set -u

API="https://api.github.com/repos/${GITHUB_REPOSITORY:-csecticioncreanga-source/csectic-app}/actions/workflows/notificari.yml"
AUTH="Authorization: Bearer ${GITHUB_TOKEN:?lipsește GITHUB_TOKEN}"
ME="${GITHUB_RUN_ID:-0}"
RETRIES="${1:-5}"

# 1) Există deja un rulaj neîncheiat (ștafeta)? Atunci nu mai trimitem altul —
#    două rulaje în așteptare în același grup se anulează reciproc și pot
#    produce exact „startup_failure”.
active=$(curl -s --max-time 20 -H "$AUTH" -H "Accept: application/vnd.github+json" "$API/runs?per_page=20" \
  | jq --argjson me "$ME" '[.workflow_runs[] | select(.status != "completed" and .id != $me)] | length' 2>/dev/null || echo 0)
if [ "${active:-0}" -gt 0 ]; then
  echo "ștafetă: deja în coadă ($active) — nimic de făcut"
  exit 0
fi

# 2) Trimite ștafeta și verifică faptul că a pornit cu adevărat.
for try in $(seq 1 "$RETRIES"); do
  code=$(curl -s --max-time 20 -o /tmp/chain.json -w "%{http_code}" -X POST \
    -H "$AUTH" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" \
    -d '{"ref":"main","inputs":{"mode":"schedule"}}' "$API/dispatches")
  if [ "$code" != "204" ]; then
    echo "ștafetă: dispatch HTTP $code (încercarea $try)"; cat /tmp/chain.json 2>/dev/null; sleep 20; continue
  fi
  sleep 12
  st=$(curl -s --max-time 20 -H "$AUTH" -H "Accept: application/vnd.github+json" "$API/runs?per_page=1" \
    | jq -r '.workflow_runs[0] | "\(.status) \(.conclusion)"' 2>/dev/null || echo "necunoscut")
  echo "ștafetă: dispatch OK, rulaj nou → $st (încercarea $try)"
  case "$st" in
    "completed startup_failure"|"completed failure"|"completed cancelled")
      echo "ștafetă: rulajul nou nu a pornit — reîncerc"; sleep 20 ;;
    *) exit 0 ;;
  esac
done

echo "ștafetă: NU am reușit să pornesc următorul rulaj"
exit 1
