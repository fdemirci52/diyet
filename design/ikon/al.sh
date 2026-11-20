#!/bin/bash
# Kullanım: al.sh s01 — İndirilenler'e son düşen Gemini görselini sheets/s01.jpg olarak taşır.
cd "$(dirname "$0")"; mkdir -p sheets
for i in $(seq 1 30); do f=$(ls -t ~/Downloads/Gemini_Generated_Image_* 2>/dev/null | head -1); [ -n "$f" ] && break; sleep 2; done
[ -z "$f" ] && { echo "bulunamadı"; exit 1; }
sleep 1; mv "$f" "sheets/$1.jpg"; sips -g pixelWidth -g pixelHeight "sheets/$1.jpg" | tail -2 | tr '\n' ' '; echo
