#!/usr/bin/env bash
# Copies the web app into ./www and bundles the libraries so the native apps work offline.
set -euo pipefail
rm -rf www && mkdir -p www/lib
cp index.html manifest.webmanifest icon-192.png icon-512.png www/
mkdir -p /tmp/libs && cd /tmp/libs
[ -f package.json ] || npm init -y >/dev/null
npm i --no-save --silent pdfjs-dist@3.11.174 jspdf@2.5.1 exceljs@4.4.0 three@0.128.0
cd - >/dev/null
L=/tmp/libs/node_modules
cp $L/pdfjs-dist/build/pdf.min.js $L/pdfjs-dist/build/pdf.worker.min.js $L/jspdf/dist/jspdf.umd.min.js \
   $L/exceljs/dist/exceljs.min.js $L/three/build/three.min.js www/lib/
sed -i \
  -e 's#https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/#lib/#g' \
  -e 's#https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/#lib/#g' \
  -e 's#https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/#lib/#g' \
  -e 's#https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/#lib/#g' www/index.html
if grep -q cdnjs www/index.html; then echo "CDN reference left"; exit 1; fi
ls -la www www/lib
