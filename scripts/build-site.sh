#!/usr/bin/env bash
# Copia solo i file dell'app in _site/ (usato da Cloudflare Pages e GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site
cp -r index.html manifest.webmanifest sw.js _headers css js icons data _site/
echo "Sito pronto in _site/ ($(find _site -type f | wc -l) file)"
