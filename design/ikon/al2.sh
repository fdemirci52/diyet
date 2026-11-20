#!/bin/bash
# Kullanım: al2.sh m3 — İndirilenler'deki Gemini_Generated_Image_m3*.jpeg dosyalarından en büyüğünü sheets/m3.jpg yapar, gerisini siler; önizleme üretir.
cd "$(dirname "$0")"; sleep 2
f=$(ls -S ~/Downloads/Gemini_Generated_Image_"$1"*.jpeg 2>/dev/null | head -1)
[ -z "$f" ] && { echo "bulunamadı"; exit 1; }
mv "$f" "sheets/$1.jpg"; rm -f ~/Downloads/Gemini_Generated_Image_"$1"*.jpeg
sips -Z 1100 "sheets/$1.jpg" --out "/private/tmp/claude-501/-Users-mfd-Documents-GitHub-diyet/135d7155-5d4b-4705-a583-60522c3b1fb3/scratchpad/$1.jpg" >/dev/null && echo "sheets/$1.jpg $(stat -f %z "sheets/$1.jpg")"
