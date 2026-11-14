#!/bin/sh
# Lance le registre même si npm/node ne sont pas dans le PATH système.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.labo-tracabilite/nodejs/bin:$PATH"
export NODE_PATH="$HOME/.labo-tracabilite/node_modules"
if ! command -v node >/dev/null 2>&1; then
  echo "Node n'est pas installé. Lance d'abord : sh outils/installer-node.sh"
  exit 1
fi
cd "$ROOT/backend"
exec node start.js
