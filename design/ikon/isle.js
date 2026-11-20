// veri.js'i yeniler: set/ içinde ikonu olan hazır sayılır, isaret.json'daki notlar kırmızı çerçeve olur.
const fs = require('fs'); process.chdir(__dirname);
eval(fs.readFileSync('veri.js', 'utf8').replace('const ICONS', 'global.ICONS'));
const F = JSON.parse(fs.readFileSync('isaret.json', 'utf8'));
for (const x of ICONS) { x.ok = fs.existsSync(`set/${x.id}-320.webp`); x.f = F[x.id] || ''; }
fs.writeFileSync('veri.js', 'const ICONS=' + JSON.stringify(ICONS) + ';\n');
console.log(ICONS.filter(x => x.ok).length + ' / ' + ICONS.length + ', işaretli ' + ICONS.filter(x => x.f).length);
