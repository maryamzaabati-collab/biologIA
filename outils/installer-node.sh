#!/bin/sh
# Télécharge Node 22 dans ~/.labo-tracabilite/nodejs (sans Homebrew).
set -e
DEST="$HOME/.labo-tracabilite/nodejs"
VER="v22.20.0"
OS=$(uname -s)
ARCH=$(uname -m)
case "$OS-$ARCH" in
  Darwin-arm64) PLAT="darwin-arm64" ;;
  Darwin-x86_64) PLAT="darwin-x64" ;;
  Linux-aarch64) PLAT="linux-arm64" ;;
  Linux-x86_64) PLAT="linux-x64" ;;
  *) echo "Système non géré: $OS $ARCH"; exit 1 ;;
esac
if [ -x "$DEST/bin/npm" ]; then
  echo "Node déjà présent : $($DEST/bin/node -v)"
  echo "Dans VS Code / Cursor : ferme le terminal, ouvres-en un nouveau, puis :"
  echo "  cd backend && npm install && node start.js"
  exit 0
fi
mkdir -p "$HOME/.labo-tracabilite"
TGZ="$HOME/.labo-tracabilite/node-$VER-$PLAT.tar.gz"
URL="https://nodejs.org/dist/$VER/node-$VER-$PLAT.tar.gz"
echo "Téléchargement de $URL"
curl -fL --retry 3 -o "$TGZ" "$URL"
tar -xzf "$TGZ" -C "$HOME/.labo-tracabilite"
rm -f "$TGZ"
rm -rf "$DEST"
mv "$HOME/.labo-tracabilite/node-$VER-$PLAT" "$DEST"
export PATH="$DEST/bin:$PATH"
echo "Installé : $(node -v)  npm $(npm -v)"
echo "Ajoute au PATH de ce terminal :"
echo "  export PATH=\"$DEST/bin:\$PATH\""
