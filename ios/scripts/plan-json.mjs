// plan.js'teki PLAN_DEFAULT'u iOS uygulamasının okuduğu plan.json'a çevirir. plan.js tek kaynak; değişince bunu çalıştır:
//   node ios/scripts/plan-json.mjs
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import url from 'node:url';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const ctx = {}; vm.runInNewContext(fs.readFileSync(path.join(root, 'plan.js'), 'utf8') + ';this.P = PLAN_DEFAULT;', ctx);
const out = JSON.stringify(ctx.P, null, 1);
for (const f of ['ios/Diyet/plan.json', 'ios/DiyetKit/Tests/DiyetKitTests/plan.json']) fs.writeFileSync(path.join(root, f), out + '\n');
console.log('plan.json yazıldı:', Object.keys(ctx.P.items).length, 'kalem,', ctx.P.meals.length, 'öğün');
