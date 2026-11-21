// Web motorunun (app.js) rastgele kayıtlar için verdiği cevapları yazar; DiyetKit'in Swift motoru bunlarla karşılaştırılır.
// app.js motorun tek kaynağı olduğu sürece motor değişince bunu yeniden çalıştır:
//   node ios/scripts/engine-golden.mjs [web kökü]
// Çıktı: ios/DiyetKit/Tests/DiyetKitTests/golden/{default,weekly}.json, foods.json (kütüphane), plan-weekly.json.
// Saat 21 Kasım 2026 13:00'e sabitlenir; rastgelelik tohumludur, çıktı her çalıştırmada aynıdır.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import url from 'node:url';
const here = path.dirname(url.fileURLToPath(import.meta.url));
const web = path.resolve(process.argv[2] || path.join(here, '../..'));
const out = path.join(here, '../DiyetKit/Tests/DiyetKitTests/golden');
fs.mkdirSync(out, { recursive: true });

const FIX = new Date(2026, 10, 21, 13, 0, 0).getTime();
function load(planJSON) {
  const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'then' ? undefined : stub(), apply: () => stub(), construct: () => stub(), set: () => true });
  const store = planJSON ? { 'diyet-plan': planJSON } : {};
  const ls = { getItem: k => k in store ? store[k] : null, setItem: (k, v) => store[k] = String(v), removeItem: k => delete store[k] };
  class D extends Date { constructor(...a) { if (a.length) super(...a); else super(FIX); } static now() { return FIX; } }
  const ctx = { document: stub(), window: stub(), navigator: stub(), localStorage: ls, sessionStorage: ls, location: { hash: '', search: '', origin: 'x', pathname: '/' }, history: stub(),
    matchMedia: () => ({ matches: false, addEventListener() {} }), setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0,
    fetch: () => new Promise(() => {}), console, Date: D, Intl, Math, JSON, URL, TextEncoder, TextDecoder, Blob: stub(), CompressionStream: stub(), DecompressionStream: stub(),
    Response: stub(), Image: stub(), alert() {}, confirm: () => true, addEventListener() {}, structuredClone };
  vm.createContext(ctx);
  for (const f of ['plan.js', 'foods.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(web, f), 'utf8'), ctx, { filename: f });
  return code => vm.runInContext(code, ctx);
}

/* Tohumlu rastgele kayıt üreteci; motorun kendisi içinde çalışır ki o günün kalemlerini bilsin. */
const GEN = `(seed) => {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
  const TXT = ['simit', 'peynir yarım + salataya tulum', '2 yumurtalı omlet', '1 dilim ekmek ve zeytin', 'muz', 'tavuk döner dürüm', 'mercimek çorbası', 'ayran', '3 haşlanmış yumurta', 'kola', 'bir şey'];
  const EXN = ['Simit', 'Lahmacun', 'Muz', 'Kola', '2 haşlanmış yumurta', 'Badem', 'Ayran', 'Baklava'];
  S = { days: {}, weights: [], foods: { simit: { n: 'Simit', u: '1 adet', k: 280, p: 9 }, 'ev yogurdu': { n: 'Ev yoğurdu', u: '1 kase', k: 120, p: 7 } } };
  for (let i = -10; i <= 7; i++) { const k = addDays(today, i); if (rnd() < 0.25) continue;
    const d = S.days[k] = { items: {}, main: {}, mode: {}, extras: [], water: Math.floor(rnd() * 12), coffee: 0, walk: false };
    MEALS.forEach(m => { if (m.main && hasMain(m, k) && rnd() < 0.35) d.main[m.id] = pick(MAINS).id; if (m.modes && rnd() < 0.2) d.mode[m.id] = 1; });
    const fill = i < 0 ? 0.9 : i === 0 ? 0.55 : 0.15;
    MEALS.forEach((m, mi) => { if (i === 0 && mi > 3 && rnd() < 0.7) return;
      itemsOf(m, k).forEach(it => { if (rnd() > fill) return; const key = m.id + '.' + it.id, r = rnd();
        if (r < 0.5) { const st = { s: 'done' }; if (it.opts && rnd() < 0.3) st.o = 1 + Math.floor(rnd() * (it.opts.length - 1));
          if (rnd() < 0.2) { st.q = pick([0.5, 0.75, 1.5, 2]); st.k = Math.round(it.k * st.q); st.p = Math.round(it.p * st.q * 10) / 10; } d.items[key] = st; }
        else if (r < 0.62 && (it.subs || []).length) { const b = pick(it.subs); d.items[key] = { s: 'swap', sub: b, base: b, alt: 1, q: 1, k: Math.round(it.k * (0.8 + rnd() * 0.4)), p: it.p }; }
        else if (r < 0.7) { const q = pick([1, 0.5, 2]); d.items[key] = { s: 'swap', sub: 'Simit', base: 'Simit', q, k: 280 * q, p: 9 * q, src: { n: 'Simit', k: 280, p: 9, u: '1 adet' } }; }
        else if (r < 0.82) { const b = pick(TXT), st = { s: 'swap', sub: b, base: b }; if (rnd() < 0.5) { const g = guess(b); if (g) { st.k = g.k; st.p = g.p; } } d.items[key] = st; }
        else { d.items[key] = { s: 'skip', ...(rnd() < 0.15 ? { pl: true } : {}) }; } }); });
    const nx = rnd() < 0.5 ? 0 : 1 + Math.floor(rnd() * 2);
    for (let j = 0; j < nx; j++) { const m = pick(MEALS.filter(x => x.time)), n = pick(EXN), f = FOODS.find(x => x.n === n), k0 = f ? f.k : 150, p0 = f ? f.p : 5;
      d.extras.push({ meal: m.id, name: n, k: k0, p: p0, ...(rnd() < 0.15 ? { pl: true } : {}) }); }
    if (i === 0 && rnd() < 0.3) d.extras.push({ meal: pick(MEALS.filter(x => x.time)).id, id: 'x-prot', name: '+1 haşlanmış yumurta', k: 75, p: 6.5, adj: true });
    if (i === 0 && rnd() < 0.3) d.noadj = { [pick(['x-prot', 'x-ekmek', 'x-ara'])]: 1 };
  }
  return JSON.stringify(S);
}`;

/* Bir durum için motorun bütün cevapları. */
const DUMP = `(() => { const R = { days: {} }, r = x => Math.round(x * 1000) / 1000;
  for (let i = -10; i <= 7; i++) { const k = addDays(today, i);
    const meals = MEALS.map(m => ({ id: m.id, time: timeOf(m, k), main: m.main && hasMain(m, k) ? mainFor(k, m.id).id : null, modes: modesOn(m, k),
      items: itemsOf(m, k).map(it => [it.id, it.k, it.p, !!it.optional]), stat: (s => [s.total, s.ok, s.skip])(mealStat(m, k)),
      val: (v => v == null ? null : r(v))(mealVal(m, k)), ate: itemsOf(m, k).map(it => { const a = ateOf(it, stOf(peek(k), m, it)); return [r(a.k), r(a.p)]; }) }));
    const b = balance(k), sc = dayScore(k), L = ledger(k);
    R.days[k] = { meals, bal: [r(b.gk), r(b.gp), r(b.tk), r(b.tp), r(b.ek), r(b.ep), b.open.length, b.any],
      score: sc && [sc.pct, r(sc.cover), r(sc.meal), r(sc.kcal), r(sc.prot)], fill: dayFill(k),
      ledger: { gk: r(L.gk), gp: r(L.gp), paid: r(L.paid), G: Object.fromEntries(Object.entries(L.G).map(([g, v]) => [g, r(v)])),
        why: Object.fromEntries(Object.entries(L.why).map(([g, xs]) => [g, xs.map(x => [x.m.id, x.it.id, r(x.miss), x.skip])])) } };
  }
  const A = adjust(today);
  R.adjust = { adds: A.adds.map(a => [a.meal, a.id, a.name, r(a.k), r(a.p), a.why, a.off, a.xi]), over: Object.fromEntries(Object.entries(A.over).map(([k, o]) => [k, [o.name, r(o.k), r(o.p)]])), why: A.why, note: A.note };
  return JSON.stringify(R); })()`;

const SAMPLES = ['simit', 'peynir yarım + salataya tulum', '2 yumurtalı omlet', '3 haşlanmış yumurta', '1 dilim ekmek ve zeytin', 'kabak çekirdeği', 'ton balıklı salata', 'yağsız menemen',
  'tavuk döner dürüm', 'muz, elma ve 5 badem', '2 dilim tam buğday ekmeği', '4 yk yulaf ezmesi (40 g)', '½ çay bardağı leblebi', 'yarım avokado', '3-4 yk yoğurt + 1 çk keten tohumu',
  '150 g tavuk', 'Ev yoğurdu', 'bir şey', 'etli nohut', 'tulum peyniri', 'salatalık', 'kuru fasulye pilav'];

function run(name, planJSON, seeds) {
  const ev = load(planJSON);
  ev(`S.foods = { simit: { n: 'Simit', u: '1 adet', k: 280, p: 9 }, 'ev yogurdu': { n: 'Ev yoğurdu', u: '1 kase', k: 120, p: 7 } }`);
  const unit = JSON.parse(ev(`JSON.stringify(${JSON.stringify(SAMPLES)}.map(t => ({ t, grps: grpsIn(t), guess: guess(t), amt: parseAmt(t) })))`));
  const cases = seeds.map(seed => { const state = JSON.parse(ev(`(${GEN})(${seed})`)); return { seed, state, out: JSON.parse(ev(DUMP)) }; });
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ today: '2026-11-21', now: '13:00', unit, cases }));
  console.log(name, cases.length, 'durum');
}

const seeds = Array.from({ length: 15 }, (_, i) => 1000 + i * 7919);
run('default', null, seeds);
const weekly = fs.readFileSync(path.join(here, '../DiyetKit/Tests/DiyetKitTests/plan-weekly.json'), 'utf8');
run('weekly', weekly, seeds);
/* Kütüphane: uygulama ve testler aynı listeyi okur. */
const ev = load(null), foods = ev('JSON.stringify(FOODS)');
for (const f of [path.join(here, '../Diyet/foods.json'), path.join(here, '../DiyetKit/Tests/DiyetKitTests/foods.json')]) fs.writeFileSync(f, foods + '\n');
console.log('foods.json', JSON.parse(foods).length, 'gıda');
