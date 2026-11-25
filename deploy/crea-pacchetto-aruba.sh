#!/bin/bash
# Aqua — builds the package for Aruba Hosting Linux: aqua-aruba.zip in the project folder,
# with only the files of the public site (see DOCUMENTAZIONE.md, chapter 7).
# The zip is not tracked by Git (.gitignore).
#
# Usage, from the project folder:
#   deploy/crea-pacchetto-aruba.sh                     same addresses as the GitHub version
#   deploy/crea-pacchetto-aruba.sh tuodominio.it       final domain written into the package
#                                                      (canonical, social previews, sitemap, robots, .htaccess)
set -euo pipefail
cd "$(dirname "$0")/.."

GITHUB_URL="https://francescomalaccari98.github.io/aqua-sito/"
OUT="aqua-aruba.zip"
DOMAIN="${1:-}"
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#www.}"; DOMAIN="${DOMAIN%%/*}"

say() { printf '  %s\n' "$*"; }
warn() { printf '  ATTENZIONE: %s\n' "$*"; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAGE="$WORK/aqua-aruba"
mkdir -p "$STAGE"

# ---------- Files of the public site ----------
for f in .htaccess index.html carta.html food.html privacy.html 404.html manifest.webmanifest robots.txt sitemap.xml; do
  [ -f "$f" ] || { echo "Manca il file $f"; exit 1; }
  cp "$f" "$STAGE/"
done
# assets/ and data/, without Mac system files
EXCLUDE=(--exclude '.DS_Store')
# The previous cover video/photos ("calice") are included only if data/foto.properties uses them
if ! grep -v '^[[:space:]]*#' data/foto.properties | grep -q 'calice'; then
  EXCLUDE+=(--exclude '*calice*')
  say "File \"calice\" (video precedente, non usato) esclusi."
fi
rsync -a "${EXCLUDE[@]}" assets data "$STAGE/"

# ---------- Final domain ----------
if [ -n "$DOMAIN" ]; then
  NEW_URL="https://www.${DOMAIN}/"
  for f in index.html carta.html food.html robots.txt sitemap.xml; do
    sed -i '' "s#${GITHUB_URL}#${NEW_URL}#g" "$STAGE/$f"
  done
  sed -i '' "s#tuodominio\.it#${DOMAIN}#g" "$STAGE/.htaccess"
  say "Indirizzo del sito nel pacchetto: ${NEW_URL}"
else
  warn "nessun dominio indicato: canonical, anteprime social e sitemap puntano ancora a GitHub."
  say "Per il pacchetto definitivo: deploy/crea-pacchetto-aruba.sh tuodominio.it"
fi

# ---------- Checks before publishing (warnings only) ----------
if grep -q 'github.io' "$STAGE"/index.html "$STAGE"/carta.html "$STAGE"/food.html "$STAGE"/robots.txt "$STAGE"/sitemap.xml; then
  [ -n "$DOMAIN" ] && warn "è rimasto un indirizzo github.io nelle pagine."
fi
grep -q '000 000 0000\|ciao@aqua.bar' "$STAGE/index.html" && warn "telefono/email della home sono ancora segnaposto (index.html, sezione Dove siamo)."
grep -q 'da completare' "$STAGE/privacy.html" && warn "privacy.html ha ancora campi \"da completare\"."
grep -q 'GitHub, Inc' "$STAGE/privacy.html" && warn "privacy.html indica ancora GitHub come hosting: va indicato Aruba S.p.A."

# ---------- Zip ----------
rm -f "$OUT"
(cd "$WORK" && zip -rqX "$OLDPWD/$OUT" aqua-aruba)
say "Creato $OUT ($(du -h "$OUT" | cut -f1)): carica su Aruba il CONTENUTO della cartella aqua-aruba."
