#!/bin/bash
# Kullanım: kes.sh s01 [s02 ...] — sheets/<s>.jpg sayfasını liste.json'daki adlarla set/ klasörüne keser.
# Pilot ikonları da kalıcı adlarıyla set/ içine kopyalar. 160 ve 320 px WebP, 512 px PNG.
cd "$(dirname "$0")"
K=../ikon-konsept/kes.swift
mkdir -p set
for s in "$@"; do
  names=$(node -e "const L=require('./liste.json');console.log(L.sheets.find(x=>x.id==='$s').items.map(i=>i[0]).join(' '))")
  # shellcheck disable=SC2086
  swift "$K" "sheets/$s.jpg" 4 3 set $names | tr '\n' ' '; echo
done
P=../ikon-konsept/pilot/ikon
while read -r a b; do
  cp "$P/$a.png" "set/$b.png"; cp "$P/$a-160.webp" "set/$b-160.webp"; cp "$P/$a-320.webp" "set/$b-320.webp"
done <<'EOF'
yumurta haslanmis-yumurta
beyaz-peynir beyaz-peynir
ekmek tam-bugday-ekmegi
avokado avokado
tavuk firin-tavuk-but
bulgur bulgur-pilavi
yogurt yogurt
sut sut
elma elma
kofte izgara-kofte
mercimek mercimek-corbasi
ceviz ceviz
EOF
cd set
for f in *-160.png *-320.png; do
  [ -f "$f" ] && cwebp -quiet -q 85 -alpha_q 90 "$f" -o "${f%.png}.webp" && mv "$f" /tmp/ 2>/dev/null
done
echo "$(ls *.png | wc -l) ikon"
