// node istem.js id1 id2 ... — liste.json açıklamalarından 4x3 sayfa istemi üretir (JSON dizgesi olarak).
const fs = require('fs'); process.chdir(__dirname);
const L = require('./liste.json'), D = {}; L.sheets.forEach(s => s.items.forEach(i => D[i[0]] = i[2]));
const head = 'New image. ' + fs.readFileSync('istem/s01.txt', 'utf8').split('Row 1:')[0].trim().replace('No text, no labels.', 'No text, no labels, no captions or names under the icons.');
const ids = process.argv.slice(2);
const rows = [0, 1, 2].map(r => `Row ${r + 1}: ` + ids.slice(r * 4, r * 4 + 4).map((id, j) => `${r * 4 + j + 1}) ${D[id]}`).join('; ') + '.');
console.log(JSON.stringify(head + ' ' + rows.join(' ')));
