#!/usr/bin/env bash
# Serve THIS repo on a free port and prove the served CSS matches the working tree.
#
# Guards against reviewing the stale duplicate of this site at
# ~/Documents/Development/JianArt, which is commonly already serving on 4173.
#
# Usage: bash .cursor/skills/design-review/scripts/serve.sh [port]
# Stop:  kill <PID printed below>

set -euo pipefail

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
CSS="$ROOT/assets/css/style.css"

if [ ! -f "$CSS" ]; then
  echo "ERROR: $CSS not found — is this the jianart.com repo?" >&2
  exit 1
fi

port_free() { ! lsof -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

PORT="${1:-}"
if [ -n "$PORT" ]; then
  if [ "$PORT" = "4173" ]; then
    echo "ERROR: 4173 is reserved for the other copy of this site. Pick another port." >&2
    exit 1
  fi
  port_free "$PORT" || { echo "ERROR: port $PORT is already in use." >&2; exit 1; }
else
  for p in $(seq 5180 5220); do
    if port_free "$p"; then PORT="$p"; break; fi
  done
  [ -n "$PORT" ] || { echo "ERROR: no free port in 5180-5220." >&2; exit 1; }
fi

LOG="/tmp/jianart-review-$PORT.log"
( cd "$ROOT" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 ) >"$LOG" 2>&1 &
PID=$!

for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null && break
  sleep 0.2
done

LOCAL_HASH="$(shasum -a 256 "$CSS" | cut -d' ' -f1)"
SERVED_HASH="$(curl -fsS "http://127.0.0.1:$PORT/assets/css/style.css" | shasum -a 256 | cut -d' ' -f1)"

if [ "$LOCAL_HASH" != "$SERVED_HASH" ]; then
  kill "$PID" 2>/dev/null || true
  echo "ERROR: served CSS does not match $CSS — refusing to review stale files." >&2
  exit 1
fi

CSS_BYTES="$(wc -c <"$CSS" | tr -d ' ')"

cat <<EOF
ROOT=$ROOT
PORT=$PORT
PID=$PID
LOG=$LOG
CSS_VERIFIED=yes
CSS_SHA256=$LOCAL_HASH
CSS_BYTES=$CSS_BYTES
URL=http://127.0.0.1:$PORT/
EOF
