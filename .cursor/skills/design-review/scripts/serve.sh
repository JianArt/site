#!/usr/bin/env bash
# Serve THIS repo on a free port and prove the served CSS matches the working tree.
#
# Guards against reviewing the stale duplicate of this site at
# ~/Documents/Development/JianArt, which is commonly already serving on 4173.
#
# Usage:
#   bash .cursor/skills/design-review/scripts/serve.sh [port]
#       Start a server and verify it. The server is a child of this script, so
#       it only outlives the script in an interactive shell.
#
#   bash .cursor/skills/design-review/scripts/serve.sh --port
#       Print a free port and exit, starting nothing.
#
#   bash .cursor/skills/design-review/scripts/serve.sh --verify PORT
#       Verify a server that was started elsewhere. Agents must use this:
#       a server backgrounded inside this script is killed as soon as the
#       tool call returns, so start it as a persistent job first, then verify.
#
# Stop: kill <PID printed below>

set -euo pipefail

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
CSS="$ROOT/assets/css/style.css"

if [ ! -f "$CSS" ]; then
  echo "ERROR: $CSS not found — is this the jianart.com repo?" >&2
  exit 1
fi

port_free() { ! lsof -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

pick_port() {
  for p in $(seq 5180 5220); do
    if port_free "$p"; then echo "$p"; return 0; fi
  done
  echo "ERROR: no free port in 5180-5220." >&2
  return 1
}

# Refuse to report success on a server that is not this working tree.
verify_css() {
  local port="$1"
  local local_hash served_hash css_bytes

  for _ in $(seq 1 30); do
    curl -fsS -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null && break
    sleep 0.2
  done

  if ! curl -fsS -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null; then
    echo "ERROR: nothing is serving on 127.0.0.1:$port." >&2
    return 1
  fi

  local_hash="$(shasum -a 256 "$CSS" | cut -d' ' -f1)"
  served_hash="$(curl -fsS "http://127.0.0.1:$port/assets/css/style.css" | shasum -a 256 | cut -d' ' -f1)"

  if [ "$local_hash" != "$served_hash" ]; then
    echo "ERROR: CSS served on $port does not match $CSS — refusing to review stale files." >&2
    echo "       (port 4173 is usually the stale copy at ~/Documents/Development/JianArt)" >&2
    return 1
  fi

  css_bytes="$(wc -c <"$CSS" | tr -d ' ')"
  cat <<EOF
ROOT=$ROOT
PORT=$port
CSS_VERIFIED=yes
CSS_SHA256=$local_hash
CSS_BYTES=$css_bytes
URL=http://127.0.0.1:$port/
EOF
}

reject_4173() {
  if [ "$1" = "4173" ]; then
    echo "ERROR: 4173 is reserved for the other copy of this site. Pick another port." >&2
    exit 1
  fi
}

case "${1:-}" in
  --port)
    pick_port
    exit 0
    ;;
  --verify)
    PORT="${2:-}"
    [ -n "$PORT" ] || { echo "ERROR: --verify needs a port, e.g. --verify 5180" >&2; exit 1; }
    reject_4173 "$PORT"
    verify_css "$PORT"
    exit 0
    ;;
esac

PORT="${1:-}"
if [ -n "$PORT" ]; then
  reject_4173 "$PORT"
  port_free "$PORT" || { echo "ERROR: port $PORT is already in use." >&2; exit 1; }
else
  PORT="$(pick_port)"
fi

LOG="/tmp/jianart-review-$PORT.log"
( cd "$ROOT" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 ) >"$LOG" 2>&1 &
PID=$!

if ! verify_css "$PORT"; then
  kill "$PID" 2>/dev/null || true
  exit 1
fi

echo "PID=$PID"
echo "LOG=$LOG"
