/* ---------- Program ----------
   Varsayılan plan plan.js içinde (PLAN_DEFAULT). Bağlantıyla yüklenen bir plan varsa localStorage['diyet-plan']
   içindedir ve onun yerine geçer. Buradakiler yalnızca plandan türetilir. */
const PLANKEY = 'diyet-plan';
/* Eksik isteğe bağlı bölümleri doldurur, kimlik bağlarını denetler. Hata varsa açıklamasını döndürür. */
function planCheck(p) {
  if (!p || p.v !== 1) return 'Program biçimi tanınmadı.';
  if (!p.items || !Array.isArray(p.meals) || !p.meals.length) return 'Programda öğün yok.';
  p.mains = p.mains || []; p.groups = p.groups || {}; p.rota = p.rota || {}; p.rules = p.rules || []; p.swaps = p.swaps || [];
  p.dietitian = { name: '', phone: '', ...(p.dietitian || {}) }; p.prefs = { kcal: true, tune: true, ...(p.prefs || {}) }; p.client = p.client || { name: '' }; p.goal = p.goal || { kg: 0, text: '' };
  p.body = p.body || { date: p.date, fat: '', rows: [] };
  p.daily = { water: { goal: 10, ml: 250 }, coffee: { max: 2, note: '' }, walk: { perWeek: 0, name: 'Yürüyüş' }, ...(p.daily || {}) };
  p.training = { perWeek: 0, time: '', after: '', lead: '', notes: {}, days: {}, ...(p.training || {}) };
  p.tune = { protein: [], cuts: [], ...(p.tune || {}) };
  /* Döngü (isteğe bağlı): program n günde bir tekrar eder, start 1. günün tarihi; öğünün days[i] listesi i+1. günün kalemleri. */
  if (p.cycle) { const c = p.cycle;
    if (!(c.n >= 2 && c.n <= 14) || !/^\d{4}-\d\d-\d\d$/.test(c.start || '')) return 'Programın gün döngüsü tanınmadı.';
    for (const m of p.meals) if (m.days && (!Array.isArray(m.days) || m.days.length !== c.n || m.days.some(x => !Array.isArray(x)))) return `"${m.title}" öğününün günleri eksik.`;
    for (const m of p.meals) if (m.dtime && (!Array.isArray(m.dtime) || m.dtime.length !== c.n)) delete m.dtime; }
  else for (const m of p.meals) { delete m.days; delete m.dtime; }
  for (const m of p.meals) {
    /* Gün listelerindeki "ana", ana yemekli öğünde o gün ana yemeğin yer tuttuğunu gösterir. */
    for (const id of [...(m.items || []), ...(m.alt || []), ...(m.days || []).flat().filter(id => !(m.main && id === 'ana'))]) if (!p.items[id]) return `"${m.title}" öğünündeki "${id}" kalemi katalogda yok.`;
    if (m.main) { if (!p.mains.length) return 'Ana yemek listesi boş.';
      const r = p.rota[m.id]; if (!r || r.length !== 7 || r.some(id => !p.mains.some(x => x.id === id))) return `"${m.title}" için haftalık dağılım eksik.`; }
  }
  for (const x of p.mains) if (!p.groups[x.g]) return `"${x.name}" ana yemeğinin kota grubu yok.`;
  return '';
}
function loadPlan() {
  try { const o = JSON.parse(localStorage.getItem(PLANKEY) || 'null'); if (o && !planCheck(o)) return o; } catch (e) {}
  return PLAN_DEFAULT;
}
const PLAN = loadPlan(), PLAN_CUSTOM = PLAN !== PLAN_DEFAULT;
/* Diyetisyen ayarları: KC kalori sayıları görünür mü, TUNE_ON telafi önerilir mi. */
const KC = !PLAN.prefs || PLAN.prefs.kcal !== false, TUNE_ON = !PLAN.prefs || PLAN.prefs.tune !== false;
const item = id => ({ id, ...PLAN.items[id] });
const MAINS = PLAN.mains, GROUPS = PLAN.groups, ROTA = PLAN.rota, RULES = PLAN.rules, SWAPS = PLAN.swaps, BODY = PLAN.body.rows;
const MEALS = PLAN.meals.map(m => ({ ...m, items: m.items.map(item), alt: m.alt && m.alt.map(item), days: m.days && m.days.map(ids => ids.map(item)) }));
const CYCLE = PLAN.cycle || null;
const MAIN_MEALS = MEALS.filter(m => m.main);
const TRAIN = PLAN.training, WORKOUTS = TRAIN.days, GYM_GOAL = TRAIN.perWeek;
const WATER_GOAL = PLAN.daily.water.goal, WATER_ML = PLAN.daily.water.ml, COFFEE_MAX = PLAN.daily.coffee.max, WALK_GOAL = PLAN.daily.walk.perWeek;
const WATER_L = (WATER_GOAL * WATER_ML / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
const AI_MODEL = 'claude-sonnet-5-5', CHAT_MODEL = 'claude-haiku-5-5';
/* Milyon token başına dolar (girdi, çıktı); kullanım sayacı için. */
const PRICE = { 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] };

/* ---------- Durum ---------- */
const KEY = 'diyet-v1', AIKEY = 'diyet-ai-key', USEKEY = 'diyet-ai-use', CHATKEY = 'diyet-chat';
let S = { days: {}, weights: [] };
try { const raw = localStorage.getItem(KEY); if (raw) S = JSON.parse(raw); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const aiKey = () => { try { return localStorage.getItem(AIKEY) || ''; } catch (e) { return ''; } };

const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
const weekOf = k => { const d = parse(k); const off = (d.getDay() + 6) % 7; const mon = addDays(k, -off); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); };
const isWknd = k => [0, 6].includes(parse(k).getDay());
/* Döngülü programda k tarihinin program günü (0'dan). Gün farkı UTC'de sayılır, yaz saati kaymasın. */
const dayDiff = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(...a.split('-').map((x, i) => i === 1 ? x - 1 : +x))) / 864e5);
const cycleIdx = k => CYCLE ? ((dayDiff(CYCLE.start, k) % CYCLE.n) + CYCLE.n) % CYCLE.n : 0;
const cycleName = k => CYCLE ? `${cycleIdx(k) + 1}. gün` : '';
const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'], DAYNAME = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const fmtDM = k => parse(k).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
const fmtLong = k => parse(k).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = n => Math.round(n).toLocaleString('tr-TR');
const num1 = n => (Math.round(n * 10) / 10).toLocaleString('tr-TR');

let today = key(new Date()), sel = today, tab = 'today', opened = {}, sheet = null, pending = null, camMeal = null;
const EMPTY = () => ({ items: {}, main: {}, mode: {}, extras: [], water: 0, coffee: 0, walk: false });
const day = k => { const d = S.days[k] || (S.days[k] = EMPTY()); d.extras = d.extras || []; return d; };
const peek = k => S.days[k] || EMPTY();
const mainById = id => MAINS.find(m => m.id === id);
/* Öğünde o gün ana yemek var mı. Gün gün değişen programda yalnızca listesinde "ana" yer tutucusu olan günler
   (ör. haftanın iki hafif gününde ana yemek yok); döngüsüz programda ana yemekli öğünün her günü. */
const hasMain = (meal, k) => !!meal.main && (!meal.days || meal.days[cycleIdx(k)].some(i => i.id === 'ana'));
/* Ana yemek seçilince öğünden çıkan kalemler (ör. salatası içinde olan yemekte bol salata). */
/* Öğünün ikinci biçimi (ör. protein bar) gün gün değişen programda yalnızca öğünün asıl kalemlerinin olduğu günlerde seçilir. */
const modesOn = (meal, k) => !!meal.modes && (!meal.days || meal.days[cycleIdx(k)].map(i => i.id).join() === meal.items.map(i => i.id).join());
const dropOf = m => m.drop || (m.noSalad ? ['salata'] : []);

/* Haftanın geri kalanı: seçilmemiş günlere, kalan kotaya göre ana yemek dağıtılır. */
function mainFor(k, mealId) {
  const meal = MAIN_MEALS.find(x => x.id === mealId); if (!meal || !hasMain(meal, k)) return null;
  const own = peek(k).main[mealId]; if (own) return mainById(own);
  const wk = weekOf(k), pool = {}; Object.entries(GROUPS).forEach(([g, x]) => pool[g] = x.perWeek);
  wk.forEach(x => { const m = mainById(peek(x).main[mealId]); if (m) pool[m.g]--; });
  for (let i = 0; i < 7; i++) {
    if (peek(wk[i]).main[mealId] || !hasMain(meal, wk[i])) continue;
    let m = mainById(ROTA[mealId][i]);
    /* Aynı gün iki öğüne aynı ana yemek düşmesin: öncekilerin dağıtılmış, sonrakilerin seçilmiş yemeği dolu sayılır. */
    const av = new Set(), at = MAIN_MEALS.findIndex(x => x.id === mealId);
    MAIN_MEALS.forEach((x, j) => { const o = j < at ? mainFor(wk[i], x.id) : j > at ? mainById(peek(wk[i]).main[x.id]) : null; if (o) av.add(o.g); });
    if (pool[m.g] <= 0 || av.has(m.g)) {
      const by = (x, y) => pool[y] - pool[x], left = Object.keys(pool).filter(g => pool[g] > 0);
      const g = left.filter(g => !av.has(g)).sort(by)[0] || (pool[m.g] <= 0 ? left.sort(by)[0] : null);
      if (g) m = MAINS.find(x => x.g === g);
    }
    pool[m.g]--;
    if (wk[i] === k) return m;
  }
}
function itemsOf(meal, k) {
  const d = peek(k);
  if (modesOn(meal, k) && d.mode[meal.id] === 1) return meal.alt;
  const L = meal.days ? meal.days[cycleIdx(k)] : meal.items;
  if (!hasMain(meal, k)) return meal.main ? L.filter(i => i.id !== 'ana') : L;
  const m = mainFor(k, meal.id), drop = dropOf(m);
  return [{ ...m, id: 'ana' }, ...L.filter(i => i.id !== 'ana' && !drop.includes(i.id))];
}
const lockMain = (k, meal) => { if (hasMain(meal, k) && !day(k).main[meal.id]) day(k).main[meal.id] = mainFor(k, meal.id).id; };
const stOf = (d, meal, it) => d.items[meal.id + '.' + it.id];
function mealStat(meal, k) {
  const d = peek(k), its = itemsOf(meal, k).filter(i => !i.optional);
  let ok = 0, skip = 0;
  its.forEach(i => { const s = stOf(d, meal, i); if (s) s.s === 'skip' ? skip++ : ok++; });
  return { total: its.length, ok, skip, resolved: ok + skip === its.length };
}
function dayStat(k) {
  let total = 0, ok = 0, skipped = 0;
  const ate = new Set((peek(k).extras || []).filter(e => !e.adj).map(e => e.meal));
  MEALS.forEach(m => { const s = mealStat(m, k); total += s.total; ok += s.ok; if (s.skip === s.total && !ate.has(m.id)) skipped++; });
  return { total, ok, pct: total ? Math.round(ok / total * 100) : 0, skipped };
}
/* ---------- Uyum puanı ----------
   Yalnızca kaydı olan öğünler üzerinden: %50 öğün düzeni, %25 kalori, %25 protein. Kaydedilmemiş öğün puanı
   düşürmez; günün ne kadarının kaydedildiği ayrıca cover olarak döner (halkalar onu gösterir).
   Öğün düzeni: plandaki gibi, programın kendi seçeneği ya da muadiliyle yenen kalem 1; başka bir şeyle değiştirilen
   kalem ya da plan yerine yenen öğün ¾; atlanan 0. Kalori: planın ±%10'u tam puan, fark %40'a çıkınca 0.
   Protein: planın %90'ı ve üstü tam puan, %50'ye inince 0. Ağırlıklar ve eşikler SCORE içinde. */
const SCORE = { meal: .5, kcal: .25, prot: .25, kOk: .1, kZero: .4, pOk: .9, pZero: .5, other: .75 };
const TIMED = MEALS.filter(m => m.time);
const clamp01 = x => Math.max(0, Math.min(1, x));
const isAlt = (it, s) => s.alt || (it.subs || []).includes(s.base || s.sub);
function mealVal(m, k) {
  if (planned(m, k)) return null;
  const d = peek(k), ex = (d.extras || []).some(e => e.meal === m.id && !e.adj);
  let n = 0, v = 0;
  itemsOf(m, k).forEach(it => { if (it.optional) return; const s = stOf(d, m, it); if (!s) return; n++;
    v += s.s === 'skip' ? (ex ? SCORE.other : 0) : s.s === 'swap' && !isAlt(it, s) ? SCORE.other : 1; });
  return n ? v / n : null;
}
function dayScore(k) {
  const d = S.days[k]; if (!d || (!Object.keys(d.items || {}).length && !(d.extras || []).length)) return null;
  const vals = TIMED.map(m => mealVal(m, k)).filter(v => v != null); if (!vals.length) return null;
  /* Fark günün planına oranlanır: öğün içindeki küçük sapma yarım gün kaydedilmişken de abartılmaz. */
  const B = balance(k), meal = vals.reduce((a, b) => a + b, 0) / vals.length;
  const kcal = B.tk < 300 ? 1 : clamp01(1 - (Math.abs(B.gk) / B.tk - SCORE.kOk) / (SCORE.kZero - SCORE.kOk));
  const prot = B.tp < 5 ? 1 : clamp01((1 - Math.max(0, B.gp) / B.tp - SCORE.pZero) / (SCORE.pOk - SCORE.pZero));
  const pct = Math.round(100 * (SCORE.meal * meal + SCORE.kcal * kcal + SCORE.prot * prot));
  return { pct, cover: vals.length / TIMED.length, meal, kcal, prot, n: vals.length };
}
/* Halkalar: günün ne kadarı plana uygun kaydedildi (gün bitince uyum puanına eşit). */
const dayFill = k => { const s = dayScore(k); return s ? Math.round(s.pct * s.cover) : 0; };
function quotaUsed(k, mealId, g) {
  return weekOf(k).filter(x => { const m = mainById(peek(x).main[mealId]); return m && m.g === g; }).length;
}
/* dtime: gün gün değişen programda o güne özel saat (ör. hafif günlerde akşam 18:00); boşsa hafta içi / hafta sonu saati. */
const timeOf = (meal, k) => !meal.time ? '' : (meal.dtime && meal.dtime[cycleIdx(k)]) || (isWknd(k) ? meal.wknd : meal.time);
const minsTo = (meal, k) => { const [h, m] = timeOf(meal, k).split(':').map(Number), n = new Date(); return h * 60 + m - n.getHours() * 60 - n.getMinutes(); };
function isLate(meal, k) {
  if (k !== today || !meal.time) return false;
  const s = mealStat(meal, k);
  return s.ok + s.skip === 0 && minsTo(meal, k) < -90;
}

/* ---------- Telafi motoru ----------
   Yenenle plan arasındaki fark (kcal, protein) hesaplanır; bugünün kalan
   öğünleri buna göre güncellenir. Eksikte önce protein, sonra ekmek eklenir;
   fazlada protein kalemlerine dokunulmaz, yağ ve ekmek azaltılır. */
const TUNE = PLAN.tune;
/* Önerinin düşeceği öğün: 'main', 'first', 'last' ya da öğün kimliği; liste ise ilk bulunan. */
const mealAt = (meals, at) => [].concat(at).map(a => a === 'main' ? meals.find(m => m.main) : a === 'first' ? meals[0] : a === 'last' ? meals[meals.length - 1] : meals.find(m => m.id === a)).find(Boolean);
const fill = (t, n, x) => t.replace('{n}', n).replace('{g}', n * (x.g || 1));
/* ---------- Besin grupları ----------
   Diyetisyenin değişim listesindeki gruplar: prot (et, peynir, yumurta, lor, kurubaklagil), carb (ekmek ve muadilleri),
   dairy (yoğurt, ayran), fat (yağ, zeytin, kuruyemiş), fruit, veg. Telafi bir eksiği yalnızca aynı gruptan ve gerçekten
   karşılanmamışsa önerir. Grup addaki sözcüklerden çıkar: sözcük kökle başlar; noktalı kök tam sözcük ya da kısa ekli
   olmalı (et, etli; yağsız sayılmaz). -siz/-suz ile biten sözcük yok sayılır. Plan kalemi grp taşıyorsa o geçerlidir.
   Sıra önceliktir: "kabak çekirdeği" yağ, "ton balıklı salata" protein. */
const GRPS = [
  ['prot', 'protein whey quark skyr peynir lor. cokelek kasar tulum hellim yumurta omlet menemen et. kiyma kofte tavu hindi balik ton. somon levrek hamsi uskumru sardalya bonfile antrikot bifte kurubaklagil fasulye nohut mercimek barbunya borulce bakla.'],
  ['fat', 'cekirde ceviz badem findi avokado zeytin yag. tereyag tahin fistik'],
  ['carb', 'ekme yulaf bulgur makarna pirinc pilav patates lavas galeta leblebi bazlama simit kraker'],
  ['dairy', 'yogurt ayran kefir caci sut.'],
  ['fruit', 'meyve elma portakal mandalina muz. cilek kayisi kivi kavun karpuz uzum armut kiraz seftali incir hurma nar.'],
  ['veg', 'salata sogus domates yesillik sebze roka marul maydanoz biber kabak brokoli ispanak mantar havuc semizotu'],
].map(([g, w]) => [g, w.split(' ').map(x => x.endsWith('.') ? new RegExp(`^${x.slice(0, -1)}(li|lu|i|u|e|a)?$`) : x)]);
const kwHit = (w, kw) => typeof kw === 'string' ? w.startsWith(kw) : kw.test(w);
/* Metindeki gruplar, öncelik sırasıyla. "Kabak çekirdeği" gibi tohumlarda öndeki sebze adı sayılmaz. */
function grpsIn(t) {
  const w = fold(t).split(' '), hit = new Set();
  w.forEach((x, i) => { if (!x || /(siz|suz)$/.test(x) || /^cekirde/.test(w[i + 1] || '')) return;
    const g = GRPS.find(([, kws]) => kws.some(kw => kwHit(x, kw))); if (g) hit.add(g[0]); });
  return GRPS.map(([g]) => g).filter(g => hit.has(g));
}
const GRP_MEMO = {};
const grpOf = it => it.grp || (GRP_MEMO[it.name] ??= grpsIn([it.chip, it.name, ...(it.opts || [])].join(' '))[0] || '');
/* Bir değişim (porsiyon) karşılığı yaklaşık kcal ve protein: 1 dilim peynir / 1 yumurta / 30 g et, 1 dilim ekmek,
   3-4 yk yoğurt, 1 tk yağ, 1 porsiyon meyve, söğüş. Yalnızca adı kütüphanede olmayan yazılmış yiyecekte kullanılır. */
const STD = { prot: [80, 6], carb: [70, 2.5], dairy: [60, 4], fat: [45, .5], fruit: [70, 1], veg: [30, 1] };
const spread = (by, gs, k) => { (gs.length ? gs : ['']).forEach(g => by[g] = (by[g] || 0) + k / (gs.length || 1)); };
const libExact = t => { const f = fold(t); return (S.foods || {})[f] || FOODS.find(x => fold(x.n) === f || (x.a || []).some(a => fold(a) === f)); };
/* Elle yazılmış yiyeceğin tahmini: virgül, artı ya da "ve" ile ayrılan her parça kütüphanede birebir varsa onun değeri,
   yoksa içindeki her besin grubu bir değişim. Öndeki küçük sayı protein ve ekmekte adet sayılır ("3 yumurtalı omlet").
   Hiçbir şey tanınmazsa null: kayıt planın değeriyle sayılır. by: grup başına kcal. */
function guess(t) {
  let k = 0, p = 0, any = false; const by = {};
  String(t || '').split(/\s*(?:[,+;&/]|\s(?:ve|ile)\s)\s*/i).forEach(part => { if (!part.trim()) return;
    const f = libExact(part);
    if (f) { any = true; k += f.k; p += f.p; spread(by, grpsIn(f.n), f.k); return; }
    const gs = grpsIn(part); if (!gs.length) return;
    const pa = parseAmt(part), n = pa && gs.length === 1 && ['prot', 'carb'].includes(gs[0]) && ['', 'adet', 'dilim', 'tane'].includes(pa.u) && Number.isInteger(pa.a) && pa.a >= 1 && pa.a <= 4 ? pa.a : 1;
    gs.forEach(g => { any = true; k += STD[g][0] * n; p += STD[g][1] * n; by[g] = (by[g] || 0) + STD[g][0] * n; });
  });
  return any ? { k: Math.round(k), p: r1(p), by } : null;
}
/* Kalemin yerine elle yazılan bir şey mi (programın seçeneği, muadili ya da kütüphaneden değil)? */
const isTxt = (it, st) => st.s === 'swap' && !st.alt && !st.src && ![...(it.subs || []), ...(it.sugg || [])].includes(st.base || st.sub);
/* Yenen değer: kayıtta varsa o; değersiz eski yazılmış muadilde addan tahmin; yoksa planınki. */
function ateOf(it, st) {
  if (!st || st.s === 'skip') return { k: 0, p: 0 };
  if (st.k != null) return { k: st.k, p: st.p ?? it.p };
  if (isTxt(it, st)) { const g = guess(st.base || st.sub), q = st.q || 1; if (g) return { k: Math.round(g.k * q), p: r1(g.p * q) }; }
  return { k: it.k, p: it.p };
}
/* Yenenin besin gruplarına dağılımı (kcal). Programın kendi seçenek ve muadilleri kalemin grubundan sayılır. */
function ateBy(it, st, a, g) {
  const by = {}; if (st.s === 'skip' || !a.k) return by;
  if (st.s === 'swap' && st.src) spread(by, grpsIn(st.src.n), a.k);
  else if (isTxt(it, st)) { const x = guess(st.base || st.sub);
    if (x && x.k) Object.entries(x.by).forEach(([y, v]) => by[y] = v * a.k / x.k); else by[g] = a.k; }
  else by[g] = a.k;
  return by;
}

function balance(k) {
  const d = peek(k), open = []; let gk = 0, gp = 0, tk = 0, tp = 0, rk = 0, rp = 0, any = false;
  MEALS.forEach(m => itemsOf(m, k).forEach(it => {
    if (it.optional) return; tk += it.k; tp += it.p;
    const st = stOf(d, m, it);
    if (!st) return open.push({ m, it, key: m.id + '.' + it.id });
    any = true; rk += it.k; rp += it.p;
    const a = ateOf(it, st); gk += it.k - a.k; gp += it.p - a.p;
  }));
  (d.extras || []).forEach(e => { gk -= e.k; gp -= e.p; any = true; });
  return { gk, gp, tk, tp, open, any, ek: rk - gk, ep: rp - gp };
}
/* Telafi defteri: kapanmış öğünlerin plana göre farkı (kcal, protein), besin grubu başına karşılanmamış kcal (G)
   ve eksiğin nereden geldiği (why). Öğün kapanmış sayılır: bütün kalemleri işaretli ya da sonraki bir öğün kaydedilmiş.
   Yarım işaretlenmiş öğün henüz yazılıyordur (peyniri azaltıp salataya tulum eklemek gibi); farkı telafiye girmez.
   Açık öğündeki kabul edilmiş telafi sayılmaz: öneri kabul edilince değişmez, işaretli görünür. */
const ADJ_GRP = { 'x-prot': 'prot', 'x-ekmek': 'carb', 'x-ara': 'fruit' };
function ledger(k) {
  const d = peek(k), G = {}, why = {}; let gk = 0, gp = 0, paid = 0;
  const has = m => (d.extras || []).some(e => e.meal === m.id) || itemsOf(m, k).some(i => stOf(d, m, i));
  MEALS.forEach((m, mi) => {
    const its = itemsOf(m, k).filter(i => !i.optional), open = its.some(i => !stOf(d, m, i));
    if (open && !MEALS.slice(mi + 1).some(has)) return;
    its.forEach(it => { const st = stOf(d, m, it); if (!st) return;
      const g = grpOf(it), a = ateOf(it, st), by = ateBy(it, st, a, g);
      gk += it.k - a.k; gp += it.p - a.p; G[g] = (G[g] || 0) + it.k;
      Object.entries(by).forEach(([x, v]) => G[x] = (G[x] || 0) - v);
      const miss = it.k - (by[g] || 0); if (miss >= 20) (why[g] = why[g] || []).push({ m, it, miss, skip: st.s === 'skip' });
    });
    (d.extras || []).forEach(e => { if (e.meal !== m.id || (e.adj && open)) return;
      gk -= e.k; gp -= e.p; if (e.adj) paid += e.k;
      const by = {}; spread(by, e.adj ? [ADJ_GRP[e.id] || ''] : grpsIn(e.name), e.k);
      Object.entries(by).forEach(([x, v]) => G[x] = (G[x] || 0) - v); });
  });
  return { gk, gp, G, why, paid };
}
/* Telafi: yalnızca gerçekten eksik kalan, aynı besin grubundan karşılanır.
   Protein grubundan bir değişim yerine konmadan kaldıysa ya da gün 8 g eksikse protein; ekmek grubundan en az yarım dilim eksik kaldıysa ve gün de eksikteyse ekmek;
   gün 150 kcal'den fazla eksikse ara öğün. Yerine aynı gruptan bir şey yenmişse (peynir azalıp salataya tulum
   eklenmiş) eksik yoktur. Fazlada 120 kcal'den sonra kısılır.
   Kullanıcı "gerek yok" dediği öneriyi (days[k].noadj) karşılanmış sayar; o eksik başka bir öneriye kaymaz. */
function adjust(k) {
  const b = balance(k), out = { over: {}, adds: [], why: '', note: '' };
  if (k !== today || !b.any || !TUNE_ON) return out;
  const meals = [...new Set(b.open.map(o => o.m))].filter(m => m.time);
  if (!meals.length) return out;
  const L = ledger(k), d0 = peek(k), no = d0.noadj || {};
  let { gk, gp } = L;
  /* Neden satırı: eksiğin geldiği kalemler öğün öğün ("Kahvaltı: peynir eksik"), bütünüyle atlanan öğün tek sözle. */
  const reason = gs => { const by = new Map();
    gs.filter(g => (L.G[g] || 0) > 0).flatMap(g => L.why[g] || []).sort((x, y) => y.miss - x.miss).forEach(x => by.set(x.m, [...(by.get(x.m) || []), x]));
    return [...by].slice(0, 2).map(([m, xs]) => mealStat(m, k).skip === mealStat(m, k).total ? `${m.title} atlandı`
      : `${m.title}: ${xs.slice(0, 2).map(x => lc(x.it.chip || x.it.name)).join(', ')} ${xs.every(x => x.skip) ? 'atlandı' : 'eksik'}`).join(' · '); };
  /* Telafi zincirlenmesin: önceki öğünlerde yenen telafi 250 kcal'i geçtiyse yenisi önerilmez. */
  const add = (meal, id, name, kk, pp, why) => { if (L.paid >= 250) return; out.adds.push({ meal: meal.id, id, name, k: kk, p: pp, why, off: !!no[id] }); gk -= kk; gp -= pp; };
  /* Birimli öneri: max varsa açığa göre 1..max birim, yoksa tek birim. */
  const offer = (x, id, gap, per, why) => { const m = mealAt(meals, x.at); if (!m) return false;
    const n = x.max ? Math.min(x.max, Math.max(1, Math.round(gap / per))) : 1; add(m, id, fill(x.name, n, x), x.k * n, x.p * n, why); return true; };
  /* Protein: gün 8 g eksikse ya da protein grubundan bir değişim (1 dilim peynir, 1 yumurta) yerine konmadan kaldıysa. */
  if ((gp >= 8 || ((L.G.prot || 0) >= 70 && gp >= 4)) && gk > -100) { const w = reason(['prot']) || `Bugün protein ${num(gp)} g eksik`; TUNE.protein.some(x => offer(x, 'x-prot', gp, x.p, w)); }
  if (TUNE.carb && (L.G.carb || 0) >= 50 && gk >= 60) offer(TUNE.carb, 'x-ekmek', Math.min(L.G.carb, gk), TUNE.carb.k, reason(['carb']));
  if (TUNE.snack && gk >= 150) offer(TUNE.snack, 'x-ara', gk, TUNE.snack.k, reason(['fat', 'fruit', 'dairy', 'veg', '']) || reason(Object.keys(L.why)) || `Bugün ${num(gk)} kcal eksik`);
  out.adds.forEach(a => a.xi = (d0.extras || []).findIndex(e => e.adj && e.id === a.id && e.meal === a.meal));
  if (gk <= -120) {
    let need = -gk, cut = 0;
    for (const { item: id, name, k: dk, p: dp } of TUNE.cuts) for (const o of b.open) {
      if (o.it.id !== id || need < 40 || cut >= 300) continue;
      out.over[o.key] = { name, k: o.it.k - dk, p: o.it.p - dp }; need -= dk; cut += dk;
    }
    if (cut) out.why = 'Fazlayı dengelemek için azaltıldı';
    if (need >= 150) out.note = 'Fazlanın kalanını telafi etmeye çalışma; yarın programa normal devam et.';
  }
  return out;
}

/* ---------- Görünümler ---------- */
const P = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', dash: '<path d="M7 12h10"/>', swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  plus: '<path d="M12 6v12M6 12h12"/>', minus: '<path d="M6 12h12"/>', right: '<path d="M9 6l6 6-6 6"/>', left: '<path d="M15 6l-6 6 6 6"/>',
  dots: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  cam: '<path d="M4 8.5A1.5 1.5 0 015.5 7h2l1.300-2h6.400l1.300 2h2A1.5 1.5 0 0120 8.5v8a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5z"/><circle cx="12" cy="12.5" r="3.200"/>',
  pen: '<path d="M4.5 19.5l1-4.5L16 4.5 19.5 8 9 18.500zM14 6.5L17.5 10"/>',
  today: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.200l2.400 2.400 4.600-5"/>', week: '<path d="M6 19v-6M12 19V5M18 19v-9"/>',
  list: '<path d="M9 7h10M9 12h10M9 17h10M5 7h.01M5 12h.01M5 17h.01"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.500V12l3 2"/>',
  person: '<circle cx="12" cy="7.500" r="3"/><path d="M6 20c0-4 2.500-6.500 6-6.500s6 2.500 6 6.500"/>', down: '<path d="M12 4v10M8 10.500l4 4 4-4M5 19h14"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
  sabah: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600L7 7M17 17l1.400 1.400M5.600 18.400L7 17M17 7l1.400-1.400"/>',
  kahvalti: '<path d="M5 9h11v5a4 4 0 01-4 4H9a4 4 0 01-4-4zM16 10h1.500a2.500 2.500 0 010 5H16M8 3v2M12 3v2"/>',
  ogle: '<path d="M7 3v18M5 3v4a2 2 0 004 0V3M16.500 3C14.800 4.500 14 7 14 10h2.500zM16.500 10v11"/>',
  ikindi: '<path d="M12 8c-1.500-1.500-5-1.600-6 1.500-1 3 .8 8.500 3.500 9.500 1 .4 1.700-.2 2.500-.2s1.500.6 2.500.2c2.700-1 4.500-6.500 3.500-9.500-1-3.100-4.500-3-6-1.500zM12 8c0-2 1-3.500 2.500-4"/>',
  aksam: '<path d="M4 12h16a8 8 0 01-16 0zM9 21h6M9 8c0-1 1-1 1-2s-1-1-1-2M14 8c0-1 1-1 1-2s-1-1-1-2"/>',
  gece: '<path d="M20 14.500A8 8 0 019.500 4a8 8 0 1010.500 10.500z"/>',
  gym: '<path d="M6.500 6.500v11M3.500 9v6M17.500 6.500v11M20.500 9v6M6.500 12h11"/>',
  chat: '<path d="M20 11.500c0 3.900-3.600 7-8 7-1.100 0-2.100-.2-3-.5L4.500 19.500l1.300-3.700C4.700 14.600 4 13.100 4 11.500c0-3.900 3.600-7 8-7s8 3.100 8 7z"/>',
  up: '<path d="M12 19V6M6.500 11.500L12 6l5.500 5.500"/>',
  grid: '<rect x="4" y="4" width="4.200" height="4.200" rx="1.200"/><rect x="9.900" y="4" width="4.200" height="4.200" rx="1.200"/><rect x="15.800" y="4" width="4.200" height="4.200" rx="1.200"/><rect x="4" y="9.900" width="4.200" height="4.200" rx="1.200"/><rect x="9.900" y="9.900" width="4.200" height="4.200" rx="1.200"/><rect x="15.800" y="9.900" width="4.200" height="4.200" rx="1.200" fill="currentColor"/><rect x="4" y="15.800" width="4.200" height="4.200" rx="1.200"/><rect x="9.900" y="15.800" width="4.200" height="4.200" rx="1.200" fill="currentColor"/><rect x="15.800" y="15.800" width="4.200" height="4.200" rx="1.200" fill="currentColor"/>',
  doc: '<path d="M7 3.500h7l4 4V19a1.500 1.500 0 01-1.500 1.500h-9.500A1.500 1.500 0 015.500 19V5A1.500 1.500 0 017 3.500zM13.500 3.500V8H18M8.500 12.500h7M8.500 16h5"/>',
  photo: '<rect x="4" y="5" width="16" height="14" rx="2.500"/><circle cx="9" cy="10" r="1.600"/><path d="M20 15.500l-4.500-4.500L7 19"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  link: '<path d="M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1 1M14 10a4 4 0 00-5.700 0l-3 3a4 4 0 005.700 5.700l1-1"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M20 20l-4.200-4.200"/>',
  pill: '<path d="M10.500 20.500l10-10a4.950 4.950 0 10-7-7l-10 10a4.950 4.950 0 107 7zM8.500 8.500l7 7"/>',
  copy: '<rect x="8.500" y="8.500" width="11" height="11" rx="2.500"/><path d="M15.500 8.500V6.500a2 2 0 00-2-2h-7a2 2 0 00-2 2v7a2 2 0 002 2h2"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>',
  hist: '<path d="M4.500 12a7.500 7.500 0 101.900-5M4.500 4.500v3h3"/><path d="M12 8v4l2.500 2"/>',
  compose: '<path d="M11 4.500H7A2.500 2.500 0 004.500 7v10A2.500 2.500 0 007 19.500h10a2.500 2.500 0 002.500-2.500v-4"/><path d="M17.500 4l2.500 2.500-7 7H10.500V11z"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${P[n] || ''}</svg>`;
const ring = (pct, size, w, color) => { const r = (size - w) / 2, C = 2 * Math.PI * r, c = size / 2;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="--c:${color}"><circle class="t" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}"/><circle class="p" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.max(0, Math.min(1, pct)))}"/></svg>`; };
const label = it => it.opts ? it.opts[0] : it.name;
const hint = it => it.opts ? 'veya ' + it.opts.slice(1).join(' · ') : it.meta || '';
const short = it => it.chip || it.name;
const cap = s => s ? s[0].toLocaleUpperCase('tr') + s.slice(1) : s, lc = s => s ? s[0].toLocaleLowerCase('tr') + s.slice(1) : s;
const r1 = x => Math.round(x * 10) / 10;

/* ---------- Miktar ----------
   Kalem adının başındaki miktar ayrıştırılır: "2 dilim tam buğday ekmeği" → 2 · dilim · "Tam buğday ekmeği".
   Porsiyon (q) değişince miktar ölçeklenerek gösterilir; adet gibi sayılanlarda adım bir birimdir (2 dilimde ½),
   gram ve ayrışmayan adlarda ¼ porsiyon. */
const UNITS = ['su bardağı', 'çay bardağı', 'yemek kaşığı', 'tatlı kaşığı', 'çay kaşığı', 'avuç içi', 'küçük kase', 'gr', 'g', 'kg', 'ml', 'yk', 'tk', 'çk', 'dilim', 'adet', 'bardak', 'fincan', 'kase', 'avuç', 'porsiyon', 'kutu', 'ölçü', 'ölçek', 'tane', 'paket', 'kepçe'];
const AMT_RE = new RegExp(`^(\\d+(?:[.,]\\d+)?|[½¼¾]|yarım)(?:\\s*[-–]\\s*(\\d+(?:[.,]\\d+)?))?\\s+(?:(${UNITS.join('|')})\\s+)?(.+)$`, 'i');
const MASS = ['g', 'gr', 'kg', 'ml'];
function parseAmt(t) {
  const m = String(t || '').match(AMT_RE); if (!m || m[4].includes('+')) return null;
  const n = s => ({ '½': .5, '¼': .25, '¾': .75, yarım: .5 })[s.toLocaleLowerCase('tr')] ?? parseFloat(s.replace(',', '.'));
  return { a: n(m[1]), b: m[2] ? n(m[2]) : 0, u: (m[3] || '').toLocaleLowerCase('tr'), rest: cap(m[4]) };
}
const fmtQ = (x, u) => { if (MASS.includes(u) && x >= 20) return num(Math.round(x / 5) * 5);
  const r = x >= 4 ? Math.round(x * 2) / 2 : Math.round(x * 4) / 4, w = Math.floor(r); return (w || '') + ({ .25: '¼', .5: '½', .75: '¾' }[r - w] || '') || '0'; };
const amtNum = (pa, q) => fmtQ(pa.a * q, pa.u) + (pa.b ? '-' + fmtQ(pa.b * q, pa.u) : '');
const amtText = (pa, q) => `${amtNum(pa, q)} ${pa.u || 'adet'}`;
/* Addaki parantezli gramaj da ölçeklenir: "(40 g)" → "(20 g)". */
const scaleRest = (rest, q) => q === 1 ? rest : rest.replace(/\((~?)(\d+)\s?(g|ml)\)/, (_, t, n, u) => `(${t}${fmtQ(n * q, u)} ${u})`);
const stepOf = pa => pa && !MASS.includes(pa.u) && !pa.b && Number.isInteger(pa.a) && pa.a >= 1 && pa.a <= 6 ? (pa.a === 1 ? .5 : 1 / pa.a) : .25;
/* Düz metin olarak ölçeklenmiş ad: "4 yk yulaf ezmesi (40 g)" × ½ → "2 yk yulaf ezmesi (20 g)". */
function scaleText(t, q) {
  if (q === 1) return t; const pa = parseAmt(t);
  return pa ? `${amtNum(pa, q)}${pa.u ? ' ' + pa.u : ''} ${lc(scaleRest(pa.rest, q))}` : `${t} × ${qLab(q)}`;
}
/* Kalemin ekranda görünüşü: ad, miktar hapı ve plandan farklı mı. */
function itemView(it, st) {
  let text = label(it), q = 1, changed = false;
  if (st && st.s === 'done') { if (st.o && it.opts) text = it.opts[st.o]; if (st.name) { text = st.name; changed = true; } q = st.q || 1; }
  if (st && st.s === 'swap') {
    if (st.src) return { n: st.src.n, amt: st.q && st.q !== 1 ? qLab(st.q) + ' porsiyon' : '', changed: !!st.q && st.q !== 1 };
    text = st.sub; changed = !!st.q && st.q !== 1;
    const pa = parseAmt(text); return pa ? { n: pa.rest, amt: amtText(pa, 1), changed } : { n: text, amt: '', changed };
  }
  if (q !== 1) changed = true;
  const pa = parseAmt(text);
  return pa ? { n: scaleRest(pa.rest, q), amt: amtText(pa, q), changed } : { n: text, amt: q !== 1 ? qLab(q) + ' porsiyon' : '', changed };
}
const viewText = (it, st) => { const v = itemView(it, st); return v.amt ? `${v.amt.replace(/ adet$/, '')} ${lc(v.n)}` : v.n; };
/* Açık kalemin alt satırı: eşdeğer seçenekler ve muadil sayısı. */
const altHint = it => { const o = (it.opts || []).slice(1).map(lc), n = (it.subs || []).length + (it.sugg || []).length;
  return [o.length ? 'veya ' + o.join(', ') : it.meta || '', n ? `${n} muadil` : ''].filter(Boolean).join(' · '); };
/* Önceden planlanmış sapma: henüz yenmemiş, plan dışı bir öğün. extras ve atlanan kalemler pl: true taşır;
   motor onları yenmiş sayar ki gün yemekten önce dengelensin. Kullanıcı yiyince "Yedim" ile onaylar. */
const planned = (m, k) => (peek(k).extras || []).some(e => e.meal === m.id && e.pl);
const nextMeal = () => MEALS.find(m => m.time && (!mealStat(m, today).resolved || planned(m, today)));
const openEv = {};

/* Kalem satırı: dokununca yendi/yenmedi; sağdaki miktar hapı porsiyon ve muadil sayfasını açar. */
function rowHTML(meal, it, d, ov) {
  const id = meal.id + '.' + it.id, st = d.items[id], s = st ? st.s : '';
  const v = itemView(it, !s && ov ? { s: 'done', name: ov.name } : st), plan = itemView(it, null);
  let m = altHint(it);
  if (!s && ov) m = 'Bugün için azaltıldı';
  if (s === 'done') m = st.name && !st.q ? 'Azaltılmış porsiyon' : v.changed ? `Planda ${plan.amt || '1 porsiyon'}` : st.o ? 'Programdaki seçenek' : '';
  if (s === 'swap') m = `${short(it)} yerine`;
  if (s === 'skip') m = st.pl ? 'Yerine başka şey planlandı' : 'Atlandı';
  const pill = v.amt ? `<button class="amt ${v.changed ? 'on' : ''}" data-act="sheet" data-id="${id}" aria-label="Porsiyon ve muadil">${esc(v.amt)}</button>`
    : `<button class="amt dot" data-act="sheet" data-id="${id}" aria-label="Porsiyon ve muadil">${ic('dots')}</button>`;
  return `<div class="row ${s}" data-act="toggle" data-id="${id}"><span class="chk">${ic(s === 'skip' ? 'dash' : s === 'swap' ? 'swap' : 'check')}</span>
    <span class="b"><span class="n">${esc(v.n)}</span>${m ? `<span class="m">${esc(m)}</span>` : ''}</span>${pill}</div>`;
}
/* Öğünün planı ve şimdiye kadar yenen: kalem sayısı, kalori, protein. */
function mealSum(meal, k) {
  const d = peek(k); let pk = 0, pp = 0, ek = 0, ep = 0, n = 0, ok = 0;
  itemsOf(meal, k).forEach(it => { if (it.optional) return; n++; pk += it.k; pp += it.p; const s = stOf(d, meal, it);
    if (s) ok++; if (s) { const a = ateOf(it, s); ek += a.k; ep += a.p; } });
  (d.extras || []).forEach(e => { if (e.meal === meal.id && !e.pl) { ek += e.k; ep += e.p; } });
  return { pk, pp, ek, ep, n, ok };
}
function mealPanel(meal, k, A, st) {
  const d = peek(k), W = WORKOUTS[parse(k).getDay()];
  const cap = W && TRAIN.notes[meal.id] || '', M = mealSum(meal, k), note = (d.notes || {})[meal.id];
  const ps = (n, a, b, u) => `<div><small>${n}</small><span><b>${a}</b> / ${b}${u}</span></div>`;
  let h = `<div class="psum">${ps('Kalem', M.ok, M.n, '')}${KC ? ps('Kalori', num(M.ek), num(M.pk), ' kcal') : ''}${ps('Protein', num(M.ep), num(M.pp), ' g')}</div>`;
  h += cap ? `<p class="cap">${cap}</p>` : '';
  if (note) h += `<button class="mnote" data-act="note" data-meal="${meal.id}">${ic('pen')}<span>${esc(note)}</span></button>`;
  if (modesOn(meal, k)) h += `<div class="seg">${meal.modes.map((m, i) => `<button class="${(d.mode[meal.id] || 0) === i ? 'on' : ''}" data-act="mode" data-meal="${meal.id}" data-i="${i}">${esc(m)}</button>`).join('')}</div>`;
  h += itemsOf(meal, k).map(it => rowHTML(meal, it, d, A.over[meal.id + '.' + it.id])).join('');
  /* Telafi önerisi: dokununca kabul edilir; sağdaki çarpı "gerek yok" der, satır üstü çizili kalır, dokununca geri gelir. */
  h += A.adds.filter(a => a.meal === meal.id).map(a => { const i = A.adds.indexOf(a), on = a.xi >= 0, no = !on && a.off;
    return `<div class="row ${on ? 'done' : no ? 'skip' : 'plus'}" data-act="add" data-i="${i}"><span class="chk">${ic(no ? 'dash' : 'check')}</span><span class="b"><span class="n">${esc(a.name)}</span><span class="m">${esc(no ? 'Gerek yok dedin' : a.why || 'Eksik kalanı dengelemek için')}</span></span>${on || no ? '' : `<button class="amt dot" data-act="noadj" data-i="${i}" aria-label="Gerek yok">${ic('x')}</button>`}</div>`; }).join('');
  h += (d.extras || []).map((e, i) => e.meal !== meal.id || (e.adj && A.adds.some(a => a.xi === i)) ? '' : `<div class="row ${e.pl ? '' : 'done'}" data-act="${e.adj ? 'unextra' : 'xedit'}" data-i="${i}"><span class="chk">${ic('check')}</span><span class="b"><span class="n">${esc(e.name)}</span><span class="m">${e.adj ? 'Telafi' : e.pl ? 'Planlandı' : 'Plan dışı'}${KC ? ` · yaklaşık ${num(e.k)} kcal` : ''}</span></span></div>`).join('');
  const sups = meal.time ? supList(meal.id) : [], left = supLeft(meal, k).length;
  if (sups.length) h += `<p class="rsect">Takviye · öğünden sonra</p>` + sups.map(s => supRow(s, k)).join('');
  const noteBtn = note ? '' : `<button data-act="note" data-meal="${meal.id}">Not ekle</button>`;
  if (planned(meal, k)) return h + `<div class="actions" style="grid-template-columns:1fr"><button class="primary" data-act="plok" data-meal="${meal.id}">${ic('check')}Yedim</button></div>
    <div class="tbtns"><button data-act="plno" data-meal="${meal.id}">Planı kaldır</button>${noteBtn}</div>`;
  if (st.resolved) return h + (left ? `<div class="actions" style="grid-template-columns:1fr"><button class="primary" data-act="supall" data-at="${meal.id}">${ic('check')}${left > 1 ? 'Takviyeleri aldım' : 'Takviyeyi aldım'}</button></div>` : '') + `<div class="tbtns"><button data-act="clear" data-meal="${meal.id}">İşaretleri sıfırla</button>${noteBtn}</div>`;
  return h + `<div class="actions"><button class="primary" data-act="all" data-meal="${meal.id}">${ic('check')}${st.ok + st.skip ? 'Kalanını yedim' : 'Hepsini yedim'}</button>
      <button class="sq" data-act="photo" data-meal="${meal.id}" aria-label="Fotoğrafla kaydet">${ic('cam')}</button>
      <button class="sq" data-act="write" data-meal="${meal.id}" aria-label="Yazarak kaydet">${ic('pen')}</button></div>
    <div class="tbtns"><button data-act="skipmeal" data-meal="${meal.id}">Bu öğünü atladım</button>${noteBtn}</div>`;
}
/* Kapalı olay: zaman çizelgesinde bir satır. Açık olay: başlığı içinde tek kart; başlık kaydırınca ekranın tepesine
   yapışır, dokununca kapanır. prog: kalemlerin işaretlenen oranı, simgenin çevresinde halka. */
function eventHTML({ id, cls, node, title, sub, right, panel, act, prog }) {
  if (!panel) return `<div class="ev ${cls}"><span class="node">${ic(node)}</span><div>
    <button class="evh" ${act}><div><h3>${title}</h3><p>${esc(sub)}</p></div>${right}</button></div></div>`;
  const pr = prog > 0 && prog < 1 ? `<span class="nprog">${ring(prog, 52, 3, 'var(--fg)')}</span>` : '';
  return `<div class="ev ${cls} open"><div class="mcard"><button class="evh mh" ${act}><span class="node">${pr}${ic(node)}</span><div><h3>${title}</h3><p>${esc(sub)}</p></div>${right}</button>
    <div class="panel">${panel}</div></div></div>`;
}
function mealEvent(meal, k, A, next, open) {
  const d = peek(k), st = mealStat(meal, k), ate = (d.extras || []).filter(e => e.meal === meal.id && !e.adj), allSkip = st.skip === st.total && !ate.length, isNow = meal === next;
  const pl = planned(meal, k), done = st.resolved && !pl;
  const wait = done && k <= today ? supLeft(meal, k) : [];   /* öğün bitti, takviyesi duruyor */
  const cls = wait.length ? '' : done ? (allSkip ? 'skipd' : 'done') : isNow ? 'now' : '';
  let sub = pl ? 'Planlandı · ' + ate.filter(e => e.pl).map(e => e.name).join(' · ')
    : st.resolved ? (allSkip ? 'Atlandı' : st.skip === st.total ? ate.map(e => e.name).join(' · ') : st.skip ? `${st.ok} / ${st.total} kalem` : 'Tamam')
    : itemsOf(meal, k).filter(i => !i.optional).map(short).join(' · ') + (A.adds.some(a => a.meal === meal.id && (a.xi >= 0 || !a.off)) ? ' · + telafi' : '');
  if (wait.length) sub = 'Takviye bekliyor · ' + wait.map(s => s.n).join(' · ');
  let right = meal.time ? `<span class="t">${timeOf(meal, k)}</span>` : '';
  if (open === meal.id && !st.resolved && !pl) sub = st.ok + st.skip ? `${st.ok + st.skip} / ${st.total} tamam` : itemsOf(meal, k).filter(i => !i.optional).length + ' kalem';
  if (isNow) { const mt = minsTo(meal, k); sub = timeOf(meal, k) + ' · ' + sub;
    right = `<span class="pill ${mt < -90 ? 'late' : mt <= 30 ? 'hot' : ''}">${mt > 0 ? (mt >= 60 ? `${Math.floor(mt / 60)} sa ${mt % 60} dk` : `${mt} dk`) : mt > -90 ? 'Şimdi' : 'Gecikti'}</span>`; }
  else if (isLate(meal, k)) right = `<span class="pill late">Gecikti</span>`;
  if (!meal.time) { const it = itemsOf(meal, k)[0], id = meal.id + '.' + it.id, s = d.items[id];   /* saatsiz tek kalem: satıra dokunmak yeter */
    const sub = [label(it), it.meta && it.meta[0].toLocaleLowerCase('tr') + it.meta.slice(1)].filter(Boolean).join(', ');
    return eventHTML({ cls, node: s ? 'check' : meal.id, title: meal.title, sub: s ? 'Tamam' : sub, right: '', act: `data-act="toggle" data-id="${id}"` }); }
  return eventHTML({ cls, node: wait.length ? 'pill' : done ? (allSkip ? 'dash' : 'check') : meal.id, title: meal.title, sub, right,
    act: `data-act="ev" data-id="${meal.id}"`, panel: open === meal.id ? mealPanel(meal, k, A, st) : '', prog: st.total ? (st.ok + st.skip) / st.total : 0 });
}
function gymEvent(k, W, open) {
  const d = peek(k);
  const panel = open !== 'gym' ? '' : `<p class="cap">Öncesi · ${W.pre}</p>${W.ex.map(([n, x]) => `<div class="kv"><span>${n}</span><span>${x}</span></div>`).join('')}<p class="cap" style="padding-bottom:8px">Sonrası · ${W.post}</p>
    <div class="row ${d.z2 ? 'done' : ''}" data-act="z2"><span class="chk">${ic('check')}</span><span class="b"><span class="n">Antrenman sonrası kardiyo</span><span class="m">İsteğe bağlı</span></span></div>
    <div class="actions" style="grid-template-columns:1fr"><button class="primary ${d.gym ? 'is-done' : ''}" data-act="gym">${ic('check')}${d.gym ? 'Yapıldı' : 'Antrenmanı yaptım'}</button></div>`;
  return eventHTML({ cls: d.gym ? 'done' : '', node: d.gym ? 'check' : 'gym', title: 'Antrenman', sub: d.gym ? 'Tamam' : `${W.name} · ${W.ex.length} hareket`, right: `<span class="t">${TRAIN.time}</span>`, act: 'data-act="ev" data-id="gym"', panel });
}
/* ---------- Takviyeler ----------
   Kullanıcının kendi girdiği takviyeler: S.supps = [{ id, n, dose, at }]. Programın parçası değil, kullanıcı verisi.
   at: öğün kimliği (o öğünden sonra), 'yat' (yatmadan önce), 'SS:DD' (belirli saat) ya da '' (saat önemsiz).
   Günlük işaret: S.days[k].supps = { id: 1 }. Öğüne bağlı olanlar zaman çizelgesinde öğünün hemen ardından çıkar;
   öğün işaretlenince sıradaki iş o olur ve kendiliğinden açılır. */
const SUPS = () => S.supps || [];
const isHM = at => /^\d\d:\d\d$/.test(at || '');
/* Programdan kalkmış bir öğüne bağlı takviye saat önemsiz sayılır. */
const anc = s => s.at === 'yat' || isHM(s.at) || MEALS.some(m => m.id === s.at) ? s.at : '';
const supTaken = (k, id) => !!(peek(k).supps || {})[id];
const supAt = at => at === 'yat' ? 'Yatmadan önce' : isHM(at) ? 'Saat ' + at : !at ? 'Saat önemsiz'
  : (m => !m ? 'Saat önemsiz' : m.time ? m.title + ' sonrası' : m.title)(MEALS.find(m => m.id === at));
const hm = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const supRank = at => at === 'yat' ? 3000 : isHM(at) ? hm(at) : !at ? 4000 : (m => m.time ? hm(m.time) + 1 : 0)(MEALS.find(m => m.id === at));
const supList = at => SUPS().filter(s => anc(s) === at);
/* Saatli öğüne bağlı takviye öğünün kendi listesinde durur; yatmadan önce alınan zaman çizelgesinin sonunda. */
const inMeal = at => MEALS.some(m => m.id === at && m.time);
const supLeft = (meal, k) => meal.time ? supList(meal.id).filter(s => !supTaken(k, s.id)) : [];
/* Zaman çizelgesindeki gruplar; saat önemsizler Gün boyu bölümünde. */
const supGroups = () => [...new Set(SUPS().map(anc))].filter(Boolean).map(at => ({ at, list: supList(at) }));
function supDue(at, k) {
  if (k !== today) return false;
  const n = new Date(), now = n.getHours() * 60 + n.getMinutes();
  if (at === 'yat') { const ms = MEALS.filter(m => m.time), last = ms[ms.length - 1]; return now >= 22 * 60 + 30 || (!!last && mealStat(last, k).resolved); }
  if (isHM(at)) return hm(at) - now <= 15;
  const m = MEALS.find(x => x.id === at); return mealStat(m, k).resolved && !planned(m, k);
}
/* Açık duran olay: zamanı gelmiş ve alınmamış takviye öne geçer; sıradaki öğünün vakti geldiyse (yarım saat kala
   ile gecikmiş sayılana kadar) öğün açılır. */
function defOpen(k) {
  if (k !== today) return '';
  const next = nextMeal(), g = supGroups().find(g => supDue(g.at, k) && g.list.some(s => !supTaken(k, s.id))), mt = next ? minsTo(next, k) : 0;
  if (g && (!next || mt > 30 || mt < -90)) return inMeal(g.at) ? g.at : 'sp:' + g.at;
  return next ? next.id : '';
}
const supRow = (s, k) => `<div class="row ${supTaken(k, s.id) ? 'done' : ''}" data-act="sup" data-id="${esc(s.id)}"><span class="chk">${ic('check')}</span><span class="b"><span class="n">${esc(s.n)}</span>${s.dose ? `<span class="m">${esc(s.dose)}</span>` : ''}</span></div>`;
function supEvent(g, k, open) {
  const id = 'sp:' + g.at, taken = g.list.filter(s => supTaken(k, s.id)).length, all = taken === g.list.length;
  const sub = all ? 'Tamam' : taken ? `${taken} / ${g.list.length} alındı` : g.list.map(s => s.n).join(' · ');
  const right = isHM(g.at) ? `<span class="t">${g.at}</span>` : g.at === 'yat' ? `<span class="t">Yatarken</span>` : '';
  const panel = open !== id ? '' : g.list.map(s => supRow(s, k)).join('') + (all ? ''
    : `<div class="actions" style="grid-template-columns:1fr"><button class="primary" data-act="supall" data-at="${esc(g.at)}">${ic('check')}${g.list.length > 1 ? 'Hepsini aldım' : 'Aldım'}</button></div>`);
  return eventHTML({ cls: all ? 'done' : '', node: all ? 'check' : 'pill', title: 'Takviye', sub, right, act: `data-act="ev" data-id="${id}"`, panel });
}
let SP = null;   /* düzenlenen takviye: { id, n, dose, at, del } */
function supsSheet() {
  sheet = 'sups';
  const L = [...SUPS()].sort((a, b) => supRank(anc(a)) - supRank(anc(b)));
  showSheet(`<div class="between" style="align-items:center;padding-right:6px"><h2>Takviyeler</h2>${L.length ? `<button class="pill" data-act="spnew">${ic('plus')}Yeni</button>` : ''}</div>
    <p class="lead">Aldığın takviyeler ve ne zaman aldığın. Öğüne bağlı olanlar o öğünün listesinde, yatmadan önce alınanlar günün son adımı olarak çıkar.</p>
    ${L.length ? `<div class="group">${L.map(s => `<button class="opt" data-act="spedit" data-id="${esc(s.id)}"><span>${esc(s.n)}<small>${[s.dose, supAt(anc(s))].filter(Boolean).map(esc).join(' · ')}</small></span>${ic('right')}</button>`).join('')}</div>`
      : `<button class="primary" data-act="spnew">${ic('plus')}İlk takviyeni ekle</button><p class="note" style="padding-top:12px">Örneğin omega 3 kahvaltıdan sonra, magnezyum yatmadan önce, kreatin günün herhangi bir saatinde.</p>`}
    <p class="note">Bu liste senin kaydın; diyetisyenin programını değiştirmez. Yeni bir takviyeye başlamadan önce ona danış.</p>`);
}
function supForm() {
  sheet = 'sup';
  const f = SP, at = f.at, kind = isHM(at) ? 'saat' : at;
  const ch = (v, n) => `<button class="${kind === v ? 'on' : ''}" data-act="spat" data-at="${v}">${n}</button>`;
  const m = MEALS.find(x => x.id === at);
  const how = at === 'yat' ? 'Zaman çizelgesinin sonunda çıkar; son öğünden sonra ya da 22.30\'da sırada bu olur.' : isHM(at) ? 'Zaman çizelgesinde bu saate yerleşir.'
    : !at ? 'Gün boyu bölümünde durur; ne zaman alırsan işaretle.' : (m.time ? `${m.title} listesinin sonunda çıkar; alınana kadar öğün tamamlanmış görünmez.` : `${m.title} işaretlenince sırada bu olur.`);
  showSheet(`<h2>${f.id ? 'Takviyeyi düzenle' : 'Yeni takviye'}</h2>
    <div class="group form" style="margin-top:12px"><label class="fl"><span>Ad</span><input id="spn" value="${esc(f.n)}" placeholder="Örn. Omega 3" autocomplete="off"></label>
      <label class="fl"><span>Miktar</span><input id="spd" value="${esc(f.dose)}" placeholder="Örn. 1 kapsül, 3 damla, 5 g" autocomplete="off"></label></div>
    <div class="sect">Ne zaman?</div>
    <div class="chips pick">${MEALS.map(x => ch(x.id, x.time ? x.title + ' sonrası' : x.title)).join('')}${ch('yat', 'Yatmadan önce')}${ch('saat', 'Belirli saatte')}${ch('', 'Saat önemsiz')}</div>
    ${isHM(at) ? `<div class="group form"><label class="fl"><span>Saat</span><input id="spt" type="time" value="${at}"></label></div>` : ''}
    <p class="note">${how}</p>
    <button class="primary" data-act="spsave" ${f.n.trim() ? '' : 'disabled'}>${ic('check')}Kaydet</button>
    ${f.id ? `<button class="textbtn ${f.del ? 'over' : ''}" data-act="spdel">${f.del ? 'Silmek için tekrar dokun' : 'Sil'}</button>` : `<button class="textbtn" data-act="spback">Vazgeç</button>`}`);
}
const spSync = () => { if (!SP) return; const n = document.getElementById('spn'), d = document.getElementById('spd'), t = document.getElementById('spt');
  if (n) SP.n = n.value; if (d) SP.dose = d.value; if (t && isHM(t.value)) SP.at = t.value; };
function spSave() {
  const n = SP.n.trim(); if (!n) return;
  const L = S.supps || (S.supps = []), x = { id: SP.id || 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n, dose: SP.dose.trim(), at: SP.at };
  const i = L.findIndex(s => s.id === x.id); i >= 0 ? L[i] = x : L.push(x);
}
function stepper(act, val, over) {
  return `<span class="stepper"><button data-act="${act}" data-n="-1" aria-label="Azalt">${ic('minus')}</button><b class="${over ? 'over' : ''}">${val}</b><button data-act="${act}" data-n="1" aria-label="Artır">${ic('plus')}</button></span>`;
}
/* İleriye en çok sekiz hafta gidilir. */
const AHEAD = 8 * 7;
/* Gün başlığı: bugün, dün, yarın; diğerlerinde haftanın günü. */
const dayTitle = k => k === today ? 'Bugün' : k === addDays(today, -1) ? 'Dün' : k === addDays(today, 1) ? 'Yarın' : parse(k).toLocaleDateString('tr-TR', { weekday: 'long' }).replace(/^./, c => c.toLocaleUpperCase('tr'));
/* Başlık sola kaydırılınca ertesi gün, sağa kaydırılınca önceki gün. */
function shiftDay(n) {
  const k = addDays(sel, n); if (k > addDays(today, AHEAD)) return;
  sel = k; render(); window.scrollTo({ top: 0 });
  const a = document.getElementById('app'); a.classList.remove('slide-l', 'slide-r'); void a.offsetWidth; a.classList.add(n > 0 ? 'slide-l' : 'slide-r');
  a.addEventListener('animationend', () => a.classList.remove('slide-l', 'slide-r'), { once: true });
}
function todayView() {
  const d = peek(sel), fillPct = dayFill(sel), A = adjust(sel), B = balance(sel), wk = weekOf(sel);
  const next = sel === today ? nextMeal() : null, W = WORKOUTS[parse(sel).getDay()];
  const open = openEv[sel] !== undefined ? openEv[sel] : defOpen(sel);
  /* Takviyeler: öğüne bağlı olan öğünün ardından, saatli olan saatine göre, yatarken olan en sonda. */
  const G = supGroups(), sp = at => G.filter(g => g.at === at).map(g => supEvent(g, sel, open)).join('');
  const timed = G.filter(g => isHM(g.at)).sort((a, b) => a.at < b.at ? -1 : 1);
  const before = m => { if (!m.time) return ''; const t = timeOf(m, sel), out = timed.filter(g => !g.put && g.at < t); out.forEach(g => g.put = true); return out.map(g => supEvent(g, sel, open)).join(''); };
  const anytime = SUPS().filter(s => !anc(s));
  const litres = (d.water * WATER_ML / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  /* Kadran: sayı halkanın içinde, ad ve hedef altta (Apple Watch dairesel komplikasyonu). */
  const tile = (name, val, unit, of, pct, color) => `<div class="tile dial"><div class="dr">${ring(pct, 76, 6.5, color)}<strong><span>${val}${unit ? `<em>${unit}</em>` : ''}</span></strong></div><b>${name}</b><small>${of}</small></div>`;
  const walks = wk.filter(x => peek(x).walk).length, gyms = wk.filter(x => peek(x).gym).length;
  return `<header class="head" id="dayhead"><div><p>${fmtLong(sel)}${CYCLE && CYCLE.n !== 7 ? ` · ${cycleName(sel)}` : ''}</p><h1>${dayTitle(sel)}</h1></div>
      <div class="hright">${sel !== today ? `<button class="pill" data-act="gotoday">Bugüne dön</button>` : `<button class="dayring" data-act="score" aria-label="Uyum puanı">${ring(fillPct / 100, 54, 5, 'var(--accent)')}<b>%${fillPct}</b></button>`}</div></header>
    ${sample() ? `<section class="card"><div class="row goto" data-act="setup" role="button"><span class="b"><span class="n">Örnek programı görüyorsun</span><span class="m">Diyetisyeninin verdiği programı ekle</span></span>${ic('right')}</div></section>` : ''}
    <div class="tiles dials">${KC ? tile('Kalori', num(B.ek), '', `/ ${num(B.tk)} kcal`, B.ek / B.tk, 'var(--fg)') : (() => { const ms = MEALS.filter(m => m.time), r = ms.filter(m => mealStat(m, sel).resolved).length; return tile('Öğün', r, '', `/ ${ms.length} öğün`, r / ms.length, 'var(--fg)'); })()}${tile('Protein', num(B.ep), 'g', `/ ${num(B.tp)} g`, B.ep / B.tp, 'var(--accent)')}${tile('Su', litres, 'L', `/ ${WATER_L} L`, d.water / WATER_GOAL, 'var(--blue)')}</div>
    ${A.note ? `<p class="note">${A.note}</p>` : ''}
    <div class="tl">${MEALS.filter(m => itemsOf(m, sel).length).map(m => before(m) + mealEvent(m, sel, A, next, open) + (m.time ? '' : sp(m.id)) + (m.id === TRAIN.after && W ? gymEvent(sel, W, open) : '')).join('')}${timed.filter(g => !g.put).map(g => supEvent(g, sel, open)).join('')}${sp('yat')}</div>
    <div class="sect">Gün boyu</div>
    <section class="card">
      <div class="row"><span class="b"><span class="n">Su</span><span class="m">${d.water} bardak · ${litres} / ${WATER_L} L</span></span>${stepper('water', d.water)}</div>
      <div class="row"><span class="b"><span class="n">Kahve</span><span class="m ${d.coffee > COFFEE_MAX ? 'over' : ''}">${d.coffee > COFFEE_MAX ? 'Günlük sınır aşıldı' : PLAN.daily.coffee.note}</span></span>${stepper('coffee', d.coffee, d.coffee > COFFEE_MAX)}</div>
      ${!WALK_GOAL ? '' : `<div class="row ${d.walk ? 'done' : ''}" data-act="walk"><span class="b"><span class="n">${PLAN.daily.walk.name}</span><span class="m">Bu hafta ${walks} / ${WALK_GOAL}</span></span><span class="chk">${ic('check')}</span></div>`}
      ${anytime.map(s => `<div class="row ${supTaken(sel, s.id) ? 'done' : ''}" data-act="sup" data-id="${esc(s.id)}"><span class="b"><span class="n">${esc(s.n)}</span><span class="m">${esc((s.dose || 'Takviye') + ' · saat önemsiz')}</span></span><span class="chk">${ic('check')}</span></div>`).join('')}
      ${W || !GYM_GOAL ? '' : `<div class="row ${d.gym ? 'done' : ''}" data-act="gym"><span class="b"><span class="n">Ağırlık antrenmanı</span><span class="m">Bugün planlı değil · bu hafta ${gyms} / ${GYM_GOAL}</span></span><span class="chk">${ic('check')}</span></div>`}
      <div class="row goto" data-act="prog" data-p="takviye" role="button"><span class="b"><span class="n">Takviyeler</span><span class="m">${SUPS().length ? 'Ekle ya da düzenle' : 'Unutmamak için ekle: öğününde ya da burada hatırlatılır'}</span></span>${ic('right')}</div>
    </section>`;
}
function weekView() {
  const wk = weekOf(sel), stats = wk.map(dayStat), sc = wk.map(dayScore), logged = sc.filter(Boolean);
  const avg = logged.length ? Math.round(logged.reduce((a, s) => a + s.pct, 0) / logged.length) : 0;
  const skipped = stats.reduce((a, s, i) => a + (wk[i] <= today && s.ok + s.skipped > 0 ? s.skipped : 0), 0);
  const bal = wk.filter(k => k <= today).map(balance).filter(b => b.any);
  const gk = bal.reduce((a, b) => a + b.gk, 0), full = bal.filter(b => !b.open.length);
  const pavg = full.length ? full.reduce((a, b) => a + b.ep, 0) / full.length : 0;
  const waters = wk.map(k => peek(k).water).filter(Boolean), wavg = waters.length ? waters.reduce((a, b) => a + b, 0) / waters.length * WATER_ML / 1000 : 0;
  const walks = wk.filter(k => peek(k).walk).length, gyms = wk.filter(k => peek(k).gym).length;
  const dots = n => `<span class="dots">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
  const stat = (name, val, unit, sub) => `<div class="tile"><span class="label">${name}</span><strong style="margin-top:10px">${val}${unit ? `<em>${unit}</em>` : ''}</strong><small>${sub}</small></div>`;
  return `<header class="head"><div><p>${fmtDM(wk[0])} – ${fmtDM(wk[6])}</p><h1>Hafta</h1></div>
      <div style="display:flex;gap:8px"><button class="round" data-act="week" data-n="-1" aria-label="Önceki hafta">${ic('left')}</button><button class="round" data-act="week" data-n="1" aria-label="Sonraki hafta" ${wk[6] >= addDays(today, AHEAD) ? 'disabled' : ''}>${ic('right')}</button></div></header>
    <section class="card pad"><div class="between"><div><span class="label">Ortalama uyum</span><div class="num">${logged.length ? '%' + avg : '—'}</div></div><span class="pill">${logged.length} gün kayıtlı</span></div>
      <div class="bars">${wk.map((k, i) => `<button class="barcol ${k === today ? 'today' : ''}" data-act="day" data-k="${k}" data-go="1" aria-label="${fmtDM(k)}"><span><u style="height:${sc[i] ? sc[i].pct : 0}%"></u></span><small>${DOW[parse(k).getDay()]}</small></button>`).join('')}</div>
      <button class="textbtn" data-act="score" data-k="${wk[0]}" style="margin-top:14px">Uyum nasıl hesaplanıyor?</button></section>
    <div class="tiles two">${KC ? stat('Kalori dengesi', Math.abs(gk) < 50 ? 'Dengede' : (gk > 0 ? '−' : '+') + num(Math.abs(gk)), Math.abs(gk) < 50 ? '' : 'kcal', Math.abs(gk) < 50 ? 'Plana göre' : gk > 0 ? 'Plandan eksik' : 'Plandan fazla')
        : stat('Plan dışı', wk.filter(k => k <= today).reduce((t, k) => t + (peek(k).extras || []).filter(e => !e.adj).length, 0), '', 'Bu hafta kayıt')}
      ${stat('Protein', pavg ? num(pavg) : '—', pavg ? 'g' : '', 'Günlük ortalama')}${stat('Atlanan öğün', skipped, '', 'Bu hafta')}${stat('Su', wavg ? wavg.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) : '—', wavg ? 'L' : '', 'Günlük ortalama')}</div>
    ${GYM_GOAL || WALK_GOAL ? `<section class="card">${GYM_GOAL ? `<div class="kv"><span>Ağırlık antrenmanı</span><span style="display:flex;align-items:center;gap:10px">${gyms} / ${GYM_GOAL}${dots(gyms)}</span></div>` : ''}
      ${WALK_GOAL ? `<div class="kv"><span>Yürüyüş</span><span style="display:flex;align-items:center;gap:10px">${walks} / ${WALK_GOAL}${dots(walks)}</span></div>` : ''}</section>` : ''}
    ${MAIN_MEALS.length ? `<div class="sect">Haftanın ana yemekleri</div>
    <section class="card" style="padding:10px 8px"><div class="menu h"><span></span>${MAIN_MEALS.map(m => `<span>${m.title}</span>`).join('')}</div>
      ${wk.map(k => `<button class="menu ${k === today ? 'today' : k < today ? 'past' : ''}" data-act="day" data-k="${k}" data-go="1"><b>${DOW[parse(k).getDay()]}</b>${MAIN_MEALS.map(m => `<span>${esc((mainFor(k, m.id) || { chip: '—' }).chip)}</span>`).join('')}</button>`).join('')}</section>
    <p class="note">Bir gün farklı yersen kalan günler kotaya göre yeniden dağıtılır.</p>` : ''}
    <div class="sect">Diyetisyenine</div>
    <section class="card"><button class="nav-row" data-act="report"><span class="ic">${ic('chat')}</span><span class="b"><span class="n">Haftalık rapor</span><span class="m">Kısa özet, WhatsApp mesajı olarak</span></span>${ic('right')}</button>
      <button class="nav-row" data-act="dump"><span class="ic">${ic('doc')}</span><span class="b"><span class="n">Döküm</span><span class="m">Seçtiğin günlerde ne yediğin, PDF olarak</span></span>${ic('right')}</button></section>
    <p class="note">Kontrole gitmeden önce gönder.</p>`;
}
/* ---------- İlerleme ----------
   Uzun vadeli görünüm: son bir yılın uyum takvimi (sütunlar hafta, satırlar Pazartesi'den Pazar'a), son 30 gün,
   aylar ve kilo. Seri ya da rozet yok; sade veri. */
const lvl = s => !s ? 0 : s.pct < 50 ? 1 : s.pct < 75 ? 2 : s.pct < 90 ? 3 : 4;
const avgOf = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function weightCard() {
  const ws = [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1), last = ws[ws.length - 1], first = ws[0], goal = PLAN.goal.kg;
  let chart = '';
  if (ws.length > 1) {
    const v = ws.map(w => w.kg), mn = Math.min(...v, goal || Infinity) - .5, mx = Math.max(...v, goal || -Infinity) + .5, r = mx - mn;
    const t0 = parse(ws[0].d).getTime(), span = parse(last.d).getTime() - t0 || 1;
    const X = w => 4 + (parse(w.d).getTime() - t0) / span * 292, Y = kg => 8 + (1 - (kg - mn) / r) * 104;
    chart = `<svg class="wchart" viewBox="0 0 300 120" preserveAspectRatio="none">${goal ? `<line x1="0" x2="300" y1="${Y(goal)}" y2="${Y(goal)}"/>` : ''}<polyline points="${ws.map(w => `${X(w)},${Y(w.kg)}`).join(' ')}"/></svg>
      <div class="between wlab"><span>${fmtDM(first.d)} · ${fmtNum1(first.kg)} kg</span>${goal ? `<span>Hedef ${fmtNum1(goal)} kg</span>` : ''}</div>`;
  }
  const diff = ws.length > 1 ? last.kg - first.kg : 0;
  return `<section class="card pad"><div class="between"><div><span class="label">Son ölçüm${last ? ' · ' + fmtDM(last.d) : ''}</span><div class="num">${last ? fmtNum1(last.kg) : '—'}<em>kg</em></div></div>
      ${diff ? `<span class="pill">Başlangıçtan ${diff > 0 ? '+' : '−'}${fmtNum1(Math.abs(diff))} kg</span>` : ''}</div>
      ${chart}<div class="field" style="padding-bottom:0"><input id="kg" type="text" inputmode="decimal" placeholder="Bugünkü kilo"><button class="btn" data-act="weight">Kaydet</button></div></section>
    <p class="note">Haftada bir, aynı saatte tartıl.</p>`;
}
function progressView() {
  const t0 = weekOf(today)[0], first = addDays(t0, -52 * 7), cols = [];
  for (let w = first; w <= t0; w = addDays(w, 7)) cols.push(weekOf(w));
  const SC = {}; cols.flat().forEach(k => { if (k <= today) SC[k] = dayScore(k); });
  /* Ay etiketleri: ayın ilk gününü içeren sütunun üstünde. */
  const months = cols.map((w, i) => { const f = w.find(k => k.endsWith('-01')); return f ? `<span style="left:${i * 16}px">${MON[parse(f).getMonth()]}</span>` : ''; }).join('');
  const grid = cols.map(w => `<div class="hcol">${w.map(k => k > today ? '<i class="hc fut"></i>'
    : `<button class="hc l${lvl(SC[k])} ${k === today ? 'now' : ''}" data-act="day" data-k="${k}" data-go="1" aria-label="${fmtDM(k)}${SC[k] ? ', uyum %' + SC[k].pct : ''}"></button>`).join('')}</div>`).join('');
  const all = Object.values(SC).filter(Boolean), yAvg = Math.round(avgOf(all.map(s => s.pct)));
  /* Son 30 gün */
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, -i)), s30 = last30.map(k => SC[k] !== undefined ? SC[k] : dayScore(k)).filter(Boolean);
  const full = last30.map(balance).filter(b => b.any && !b.open.length), pAvg = avgOf(full.map(b => b.ep));
  const gyms = last30.filter(k => peek(k).gym).length, waters = last30.map(k => peek(k).water).filter(Boolean);
  const stat = (name, val, unit, sub) => `<div class="tile"><span class="label">${name}</span><strong style="margin-top:10px">${val}${unit ? `<em>${unit}</em>` : ''}</strong><small>${sub}</small></div>`;
  /* Aylar: son altı ay */
  const mrows = Array.from({ length: 6 }, (_, i) => { const d = parse(today); d.setDate(1); d.setMonth(d.getMonth() - i); return key(d).slice(0, 7); }).map(m => {
    const days = Object.keys(S.days).filter(k => k.startsWith(m) && k <= today), sc = days.map(dayScore).filter(Boolean);
    const w = S.weights.filter(x => x.d.startsWith(m)).sort((a, b) => a.d < b.d ? -1 : 1).pop();
    if (!sc.length && !w) return '';
    const [y, mo] = m.split('-').map(Number);
    return `<div class="mrow"><b>${MON[mo - 1]}${y !== parse(today).getFullYear() ? ' ' + y : ''}</b><span>${sc.length} gün</span><span>${sc.length ? '%' + Math.round(avgOf(sc.map(s => s.pct))) : '—'}</span><span>${GYM_GOAL ? days.filter(k => peek(k).gym).length : '—'}</span><span>${w ? fmtNum1(w.kg) : '—'}</span></div>`; }).join('');
  return `<header class="head"><div><p>Son 12 ay</p><h1>İlerleme</h1></div></header>
    <section class="card pad"><div class="between"><div><span class="label">Ortalama uyum</span><div class="num">${all.length ? '%' + yAvg : '—'}</div></div><span class="pill">${all.length} gün kayıtlı</span></div>
      <div class="heat"><div class="hdays"><span>Pzt</span><span></span><span>Çar</span><span></span><span>Cum</span><span></span><span></span></div>
        <div class="hscroll" id="heat"><div class="hmon">${months}</div><div class="hgrid">${grid}</div></div></div>
      <div class="hleg"><button data-act="score">Nasıl hesaplanır?</button><span>Düşük<i class="hc l1"></i><i class="hc l2"></i><i class="hc l3"></i><i class="hc l4"></i>Yüksek</span></div></section>
    <div class="sect">Son 30 gün</div>
    <div class="tiles two">${stat('Uyum', s30.length ? '%' + Math.round(avgOf(s30.map(s => s.pct))) : '—', '', `${s30.length} / 30 gün kayıtlı`)}
      ${stat('Protein', pAvg ? num(pAvg) : '—', pAvg ? 'g' : '', 'Günlük ortalama')}
      ${GYM_GOAL ? stat('Antrenman', gyms, '', `Hedef ${Math.round(GYM_GOAL * 30 / 7)}`) : ''}
      ${stat('Su', waters.length ? fmtNum1(avgOf(waters) * WATER_ML / 1000) : '—', waters.length ? 'L' : '', 'Günlük ortalama')}</div>
    ${mrows ? `<div class="sect">Aylar</div><section class="card" style="padding:8px 14px"><div class="mrow h"><b></b><span>Kayıt</span><span>Uyum</span><span>Antr.</span><span>Kilo</span></div>${mrows}</section>` : ''}
    <div class="sect">Kilo</div>${weightCard()}`;
}
/* Uyum puanının açıklaması; k verilirse o haftanın, yoksa seçili günün dökümü. */
function scoreSheet(wk0) {
  sheet = 'score';
  const days = wk0 ? weekOf(wk0) : [sel], sc = days.map(dayScore).filter(Boolean);
  const pc = x => '%' + Math.round(avgOf(sc.map(s => s[x])) * 100), n = TIMED.length;
  const skipLoss = Math.round(SCORE.meal * 100 / n), swapLoss = Math.ceil(SCORE.meal * (1 - SCORE.other) * 100 / n);
  const head = sc.length ? `<div class="group"><div class="kv"><span>Öğün düzeni</span><span>${pc('meal')}</span></div><div class="kv"><span>${KC ? 'Kalori' : 'Porsiyon'} dengesi</span><span>${pc('kcal')}</span></div><div class="kv"><span>Protein</span><span>${pc('prot')}</span></div>
    <div class="kv"><span><b>Uyum</b></span><span><b>%${Math.round(avgOf(sc.map(s => s.pct)))}</b></span></div></div>` : '';
  showSheet(`<h2>Uyum puanı</h2><p class="lead">${wk0 ? `${fmtDM(days[0])} – ${fmtDM(days[6])} haftası` : fmtLong(sel)}${sc.length ? '' : ' · henüz kayıt yok'}</p>${head}
    <div class="group prose">
      <p>Öğün düzeni · %${SCORE.meal * 100}<small>Plandaki gibi ya da programın kendi seçeneği veya muadiliyle yenen öğün tam puan alır. Başka bir şeyle değiştirilen öğün ¾ puan, atlanan öğün puan almaz.</small></p>
      <p>${KC ? 'Kalori' : 'Porsiyon'} dengesi · %${SCORE.kcal * 100}<small>Yediğin günlük planın ±%${SCORE.kOk * 100}'u içindeyse tam puan; fark %${SCORE.kZero * 100}'a çıkana dek yavaş yavaş azalır.</small></p>
      <p>Protein · %${SCORE.prot * 100}<small>Planın %${SCORE.pOk * 100}'ı ve üstü tam puan; %${SCORE.pZero * 100}'ye indikçe azalır.</small></p></div>
    <div class="group prose"><p>Bir öğünü kaçırırsan<small>Kalorini ve proteinini günün kalanında tamamlarsan gün %${100 - skipLoss} olur. Kalan öğünlere eklenen telafi satırları bunun için.</small></p>
      <p>Öğünü başka bir şeyle değiştirirsen<small>Kalori ve protein tutuyorsa kayıp %${swapLoss}'ü geçmez.</small></p>
      <p>Kaydetmediğin öğün<small>Puanı düşürmez. Bugün ekranındaki gün halkaları ise günün ne kadarını plana uygun kaydettiğini gösterir.</small></p></div>
    <button class="textbtn" data-act="close">Kapat</button>`);
}
const PROG = [['kurallar', 'list', 'Kurallar', `${RULES.length} madde`], ['saatler', 'clock', 'Öğün saatleri', 'Hafta içi ve hafta sonu'], ['muadil', 'swap', 'Muadiller', 'Neyin yerine ne yenir'], ['gidalar', 'ogle', 'Gıdalarım', ''], ['takviye', 'pill', 'Takviyeler', ''], ['gorunum', 'sabah', 'Görünüm', ''],
  ['antrenman', 'gym', 'Antrenman', Object.entries(WORKOUTS).map(([n, w]) => `${DOW[n]} ${w.name.toLocaleLowerCase('tr')}`).join(' · ')], ['vucut', 'person', 'Vücut analizi', `${fmtDM(PLAN.body.date)} ölçümü`], ['ai', 'chat', 'Yapay zekâ', ''], ['baglanti', 'link', 'Program bağlantısı', 'Yükle ya da paylaş'], ['veri', 'down', 'Yedek', 'İndir ya da geri yükle']];
function planView() {
  const t = balance(today), last = [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1).pop();
  return `<header class="head"><div><p>${esc(PLAN.dietitian.name || 'Diyetisyen programı')} · ${fmtDM(PLAN.date)}</p><h1>Program</h1></div></header>
    <section class="card pad"><span class="label">Hedef</span><div class="num">${PLAN.goal.kg ? PLAN.goal.kg.toLocaleString('tr-TR') + '<em>kg</em>' : '—'}</div><p class="note" style="padding:8px 0 14px">${esc(PLAN.goal.text)}</p>
      <div class="tiles two" style="margin:0"><div class="tile" style="background:var(--ctl);box-shadow:none"><span class="label">Şu an</span><strong style="margin-top:8px">${last ? last.kg.toLocaleString('tr-TR') + '<em>kg</em>' : '—'}</strong><small>${PLAN.body.fat ? PLAN.body.fat + ' yağ' : 'Son tartı'}</small></div>
        <div class="tile" style="background:var(--ctl);box-shadow:none"><span class="label">Günlük plan</span>${KC ? `<strong style="margin-top:8px">${num(t.tk)}<em>kcal</em></strong><small>${num(t.tp)} g protein</small>` : `<strong style="margin-top:8px">${num(t.tp)}<em>g</em></strong><small>protein</small>`}</div></div></section>
    <section class="card">${PROG.filter(([id]) => !(id === 'antrenman' && !Object.keys(WORKOUTS).length) && !(id === 'vucut' && !BODY.length) && !(id === 'muadil' && !SWAPS.length)).map(([id, icn, n, m]) => `<button class="nav-row" data-act="prog" data-p="${id}"><span class="ic">${ic(icn)}</span><span class="b"><span class="n">${n}</span><span class="m">${id === 'ai' ? (aiCode() ? 'Davet kodu kayıtlı' : aiKey() ? 'API anahtarı kayıtlı' : PROXY_URL ? 'Davet kodu gerekli' : 'API anahtarı gerekli') : id === 'gidalar' ? (Object.keys(S.foods || {}).length ? `${Object.keys(S.foods).length} gıda` : 'Kendi ürünlerin') : id === 'gorunum' ? ({ light: 'Açık', dark: 'Koyu' }[theme()] || 'Sistemle aynı') : id === 'takviye' ? (SUPS().length ? `${SUPS().length} takviye` : 'Ne zaman alacağını hatırlat') : m}</span></span>${ic('right')}</button>`).join('')}</section>
    <p class="note">Kayıtlar yalnızca bu cihazda tutulur. Kalori ve protein değerleri yaklaşık tahminlerdir.</p>`;
}
function progSheet(p) {
  sheet = p;
  const kv = rows => `<div class="group">${rows.map(([a, b]) => `<div class="kv"><span>${a}</span><span>${b}</span></div>`).join('')}</div>`;
  const prose = rows => `<div class="group prose">${rows.map(([a, b]) => `<p>${a}${b ? `<small>${b}</small>` : ''}</p>`).join('')}</div>`;
  const S2 = {
    kurallar: () => `<h2>Kurallar</h2><p class="lead">Diyetisyenin notları.</p>${prose(RULES)}`,
    saatler: () => `<h2>Öğün saatleri</h2><p class="lead">Hafta sonu saatleri kendiliğinden uygulanır.</p><div class="sect">Hafta içi</div>${kv(MEALS.filter(m => m.time).map(m => [m.title, m.time]))}<div class="sect">Hafta sonu</div>${kv(MEALS.filter(m => m.time).map(m => [m.title, m.wknd]))}`,
    muadil: () => `<h2>Muadiller</h2><p class="lead">Aynı grup içinde değişim programı bozmaz. Yaklaşık eşdeğerlerdir; diyetisyenin onayladıklarını kullan.</p>${prose(SWAPS)}`,
    antrenman: () => `<h2>Antrenman</h2><p class="lead">${TRAIN.lead}</p>${Object.entries(WORKOUTS).map(([n, w]) => { const g = DAYNAME[n];
      return `<div class="sect">${g} · ${w.name}</div><div class="group"><p class="cap">Öncesi · ${w.pre}</p>${w.ex.map(([a, b]) => `<div class="kv"><span>${a}</span><span>${b}</span></div>`).join('')}<p class="cap" style="padding-bottom:12px">Sonrası · ${w.post}</p></div>`; }).join('')}`,
    vucut: () => `<h2>Vücut analizi</h2><p class="lead">${parse(PLAN.body.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} ölçümü.</p>${kv(BODY)}`,
    ai: () => `<h2>Yapay zekâ</h2><p class="lead">Fotoğraftan ya da yazıdan kayıt, etiket okuma ve asistan için ${PROXY_URL ? 'diyetisyeninin verdiği davet kodu' : 'bir Anthropic API anahtarı'} gerekir. Kütüphanede ve geçmişinde bulunanlar bunsuz kaydedilir.</p>
      ${PROXY_URL ? `<div class="group"><div class="kv"><span>Davet kodu</span><span>${aiCode() ? esc(aiCode()) : 'Yok'}</span></div>
        ${aiCode() ? `<div class="kv"><span>Bu ayki hak</span><span>${!ME ? '…' : ME.err ? ME.err : `%${Math.min(100, Math.round(ME.usd / ME.budget * 100))} kullanıldı`}</span></div>` : ''}
        <div class="field"><input id="aicode" type="text" autocomplete="off" autocapitalize="characters" placeholder="Örn. AYSE-7K2M"><button class="btn" data-act="savecode">Kaydet</button></div></div>
        ${aiCode() ? `<button class="textbtn" data-act="delcode">Kodu kaldır</button>` : ''}<div class="sect">Kendi anahtarınla</div>` : ''}
      <div class="group"><div class="kv"><span>API anahtarı</span><span>${aiKey() ? 'Kayıtlı' : 'Yok'}</span></div><div class="field"><input id="aikey" type="password" autocomplete="off" placeholder="sk-ant-…"><button class="btn" data-act="savekey">Kaydet</button></div></div>
      <div class="group"><div class="kv"><span>Veri paylaşım onayı</span><span>${aiOk() ? fmtDM(aiOk()) : 'Verilmedi'}</span></div></div>
      ${usageRows()}${aiOk() ? `<button class="textbtn" data-act="aino">Onayı geri al</button>` : ''}${aiKey() ? `<button class="textbtn" data-act="delkey">Anahtarı sil</button>` : ''}`,
    gorunum: () => `<h2>Görünüm</h2><p class="lead">Açık ya da koyu tema. Sistemle aynı seçiliyken telefonun ayarını izler.</p>
      <div class="group">${[['', 'Sistemle aynı'], ['light', 'Açık'], ['dark', 'Koyu']].map(([v, n]) => `<button class="opt" data-act="theme" data-v="${v}"><span>${n}</span>${theme() === v ? ic('check') : ''}</button>`).join('')}</div>`,
    veri: () => `<h2>Yedek</h2><p class="lead">Kayıtların bu cihazda durur. Telefon değiştirmeden önce yedek al.</p><div class="group"><button class="opt" data-act="export"><span>Yedeği indir</span>${ic('down')}</button><button class="opt" data-act="import"><span>Yedekten yükle</span>${ic('right')}</button></div>`,
  };
  showSheet(S2[p]());
}
function render() {
  const B0 = blank();
  document.getElementById('app').innerHTML = B0 ? blankView() : tab === 'today' ? todayView() : tab === 'week' ? weekView() : tab === 'chat' ? chatView() : tab === 'progress' ? progressView() : planView();
  document.body.classList.toggle('on-chat', !B0 && tab === 'chat'); document.getElementById('ask').hidden = B0 || tab !== 'chat';
  document.getElementById('dock').innerHTML = `<div class="tabs">${[['today', 'today', 'Bugün'], ['week', 'week', 'Hafta'], ['chat', 'chat', 'Asistan'], ['progress', 'grid', 'İlerleme'], ['plan', 'list', 'Program']].map(([t, i, n]) =>
    `<button class="${tab === t ? 'on' : ''}" data-act="tab" data-t="${t}">${ic(i)}${n}</button>`).join('')}</div>`;
  const h = document.getElementById('heat'); if (h) h.scrollLeft = h.scrollWidth;
  if (tab === 'chat' && chatScroll) { chatScroll = false; toEnd(); }
  if (tab === 'chat') askPaint();
}

/* ---------- Alt sayfalar ---------- */
const $sheet = () => document.getElementById('sheet');
const showSheet = html => { $sheet().innerHTML = '<button class="grab" data-act="close" aria-label="Kapat"></button>' + html; $sheet().scrollTop = 0; document.body.classList.add('sheet-open'); };
const closeSheet = () => { if (sheet === 'plan' && PL && PL.built) pbClear(); document.body.classList.remove('sheet-open'); sheet = null; pending = null; afterKey = null; };
/* Sayfa aşağı sürüklenerek kapanır: tutamaçtan her zaman, içerikten yalnızca en üstteyken. Yazı alanları hariç. */
(() => {
  const sh = $sheet(), sc = document.querySelector('.scrim'); let y0 = null, x0 = 0, dy = 0, t0 = 0, drag = false;
  const reset = () => { sh.style.transition = ''; sh.style.transform = ''; sc.style.transition = ''; sc.style.opacity = ''; };
  sh.addEventListener('touchstart', e => { y0 = null; drag = false; const t = e.target;
    if (e.touches.length !== 1 || t.closest('input, textarea') || (sh.scrollTop > 0 && !t.closest('.grab'))) return;
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; t0 = Date.now(); }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; const dx = Math.abs(e.touches[0].clientX - x0);
    if (!drag) { if (dy > 8 && dy > dx) { drag = true; sh.style.transition = 'none'; sc.style.transition = 'none'; } else { if (dy < -8 || dx > 8) y0 = null; return; } }
    if (e.cancelable) e.preventDefault(); const y = Math.max(0, dy);
    sh.style.transform = `translateY(${y}px)`; sc.style.opacity = Math.max(.2, 1 - y / sh.offsetHeight); }, { passive: false });
  const end = () => { if (y0 == null || !drag) { y0 = null; return; } const fast = dy > 40 && dy / Math.max(1, Date.now() - t0) > .5;
    y0 = null; drag = false; reset(); if (dy > 120 || fast) closeSheet(); };
  sh.addEventListener('touchend', end); sh.addEventListener('touchcancel', end);
})();
/* Açılan olay ekranın ortasına yumuşakça gelir; ekrana sığmıyorsa başı yukarıda kalır. */
const openNow = () => tab === 'today' ? (openEv[sel] !== undefined ? openEv[sel] : defOpen(sel)) : '';
function centerOpen() {
  const el = document.querySelector('.ev.open'); if (!el) return;
  el.classList.add('fresh');
  const r = el.getBoundingClientRect(), top = 20, room = innerHeight - 116 - top;
  window.scrollBy({ top: r.top - top - Math.max(0, (room - r.height) / 2), behavior: 'smooth' });
}
/* ---------- Görünüm: sistem, açık ya da koyu ---------- */
const THEMEKEY = 'diyet-theme';
const theme = () => { try { return localStorage.getItem(THEMEKEY) || ''; } catch (e) { return ''; } };
function setTheme(v) {
  try { v ? localStorage.setItem(THEMEKEY, v) : localStorage.removeItem(THEMEKEY); } catch (e) {}
  window.applyTheme && window.applyTheme();
}
function findItem(id) { const [mid, iid] = id.split('.'), meal = MEALS.find(m => m.id === mid); return [meal, itemsOf(meal, sel).find(i => i.id === iid)]; }
/* ---------- Kalem sayfası ----------
   Bir kalemde ne kadar ve ne yendiği. Her dokunuş hemen kaydedilir: seçenek (programın eşdeğerleri, muadiller,
   uygulamanın önerdikleri, kütüphaneden ya da yazılan) ve porsiyon. Yenen değer: plan kalemi ve muadilleri için
   planın değeri × porsiyon; kütüphaneden seçilen için kendi değeri × porsiyon.
   Kayıt: done { o?: seçenek sırası, q?, k?, p? } · swap { sub: ölçekli ad, base?: ölçeksiz ad, alt?: programdan, q?, k, p, src? }. */
let IT = null;   /* { id, c: { t: 'opt'|'sub'|'sugg'|'lib'|'txt', i, x, text }, q } */
function openSheet(id) {
  const [, it] = findItem(id), st = peek(sel).items[id];
  let c = { t: 'opt', i: 0 }, q = 1;
  if (st) {
    q = st.q || (st.name && it.k ? Math.round(st.k / it.k * 4) / 4 || 1 : 1);
    if (st.s === 'done' && st.o) c = { t: 'opt', i: st.o };
    if (st.s === 'swap') { const b = st.base || st.sub, si = (it.subs || []).indexOf(b), gi = (it.sugg || []).indexOf(b);
      c = si >= 0 ? { t: 'sub', i: si } : gi >= 0 ? { t: 'sugg', i: gi } : st.src ? { t: 'lib', x: { ...st.src } } : { t: 'txt', text: b };
      if (!st.base && !st.src) q = 1; }   /* eski kayıtta ad zaten yenen miktardır */
  }
  IT = { id, c, q }; itemSheet();
}
/* Seçili seçeneğin ölçeksiz metni ve ayrıştırılmış miktarı. */
const itBase = (it, c) => c.t === 'opt' ? (it.opts ? it.opts[c.i] : it.name) : c.t === 'sub' ? it.subs[c.i] : c.t === 'sugg' ? it.sugg[c.i] : c.t === 'lib' ? c.x.n : c.text;
/* Yenen değer: kütüphaneden seçilen kendi değeriyle, yazılan addan tahminle (tanınmazsa planınki), gerisi planın değeriyle. */
function itVal(it, c, q) {
  const g = c.t === 'lib' ? c.x : c.t === 'txt' && guess(c.text) || it;
  return { k: Math.round(g.k * q), p: r1(g.p * q) };
}
function itemSheet() {
  const [meal, it] = findItem(IT.id), st = peek(sel).items[IT.id], s = st ? st.s : ''; sheet = IT.id;
  const c = IT.c, base = itBase(it, c), pa = c.t === 'lib' ? null : parseAmt(base), V = itVal(it, c, IT.q), P = itemView(it, null);
  const now = pa ? amtText(pa, IT.q) : `${qLab(IT.q)} porsiyon`, nm = pa ? pa.rest : base;
  const tick = on => `<span class="radio ${on ? 'on' : ''}">${on ? ic('check') : ''}</span>`;
  const same = (t, i) => !!s && s !== 'skip' && c.t === t && c.i === i;
  const opt = (t, i, text, sub) => `<button class="opt" data-act="it-o" data-t="${t}" data-i="${i}"><span>${esc(text)}<small>${sub}</small></span>${tick(same(t, i))}</button>`;
  const plan = (it.opts || [it.name]).map((o, i) => opt('opt', i, o, i ? 'Programdaki seçenek' : 'Planlanan')).join('');
  const subs = (it.subs || []).map((x, i) => opt('sub', i, x, 'Programdaki muadil')).join('');
  const sugg = (it.sugg || []).map((x, i) => opt('sugg', i, x, 'Uygulamanın önerisi')).join('');
  const own = (c.t === 'lib' || c.t === 'txt') && s === 'swap' ? `<div class="opt"><span>${esc(base)}<small>${c.t === 'lib' ? 'Kütüphaneden' : 'Kendi yazdığın'}</small></span>${tick(true)}</div>` : '';
  const mains = it.id !== 'ana' ? '' : `<div class="sect">Bugünün ana yemeği</div><div class="group">${MAINS.map(m => { const q = GROUPS[m.g].perWeek, u = quotaUsed(sel, meal.id, m.g), cur = mainFor(sel, meal.id).id === m.id;
    return `<button class="opt" data-act="main" data-meal="${meal.id}" data-m="${m.id}"><span>${m.name}<small>Bu hafta ${u} / ${q}</small></span>${tick(cur)}</button>`; }).join('')}</div>`;
  showSheet(`<h2>${esc(cap(nm))}</h2><p class="lead">${meal.title} · planda ${esc(P.amt ? P.amt + ' ' + lc(P.n) : P.n)}${KC ? ` · yaklaşık ${num(it.k)} kcal` : ''}</p>
    <div class="sect">Ne kadar yedin?</div>
    <div class="amtbox"><button data-act="it-q" data-n="-1" aria-label="Azalt">${ic('minus')}</button><div><b>${esc(now)}</b><small>${KC ? `${num(V.k)} kcal · ` : ''}${num1(V.p)} g protein</small></div><button data-act="it-q" data-n="1" aria-label="Artır">${ic('plus')}</button></div>
    ${mains}<div class="sect">Ne yedin?</div>
    <div class="group">${plan}${subs}${sugg}${own}</div>
    ${sugg ? `<p class="note">Uygulamanın önerileri aynı besin grubundan yaklaşık eşdeğerlerdir; programında yoksa diyetisyenine danış.</p>` : ''}
    <div class="group"><div class="field"><input id="custom" type="text" placeholder="Başka bir şey… (ara ya da yaz)" enterkeyhint="done" autocomplete="off"><button class="btn" data-act="s-custom">Ekle</button></div></div><div id="csug"></div>
    <button class="primary" data-act="it-ok">${ic('check')}${s && s !== 'skip' ? 'Tamam' : 'Yedim'}</button>
    <div class="tbtns">${s === 'skip' ? '' : `<button data-act="s-skip">Atladım</button>`}${s ? `<button data-act="s-clear">İşareti kaldır</button>` : ''}</div>`);
}
/* Taslağı kayda geçirir. Planlanan seçenek tam porsiyonsa telafinin azalttığı değer korunur. */
function itApply(A) {
  const [meal, it] = findItem(IT.id), c = IT.c, q = IT.q, d = day(sel), V = itVal(it, c, q), sc = q === 1 ? {} : { q, k: V.k, p: V.p };
  lockMain(sel, meal);
  if (c.t === 'opt') { const o = A.over[IT.id]; d.items[IT.id] = q === 1 && !c.i && o ? { s: 'done', name: o.name, k: o.k, p: o.p } : { s: 'done', ...(c.i ? { o: c.i } : {}), ...sc }; }
  else if (c.t === 'sub' || c.t === 'sugg') { const b = itBase(it, c); d.items[IT.id] = { s: 'swap', sub: scaleText(b, q), base: b, ...(c.t === 'sub' ? { alt: 1 } : {}), ...sc }; }
  else if (c.t === 'lib') d.items[IT.id] = { s: 'swap', sub: q === 1 ? c.x.n : `${c.x.n} × ${qLab(q)}`, k: V.k, p: V.p, q, src: { n: c.x.n, k: c.x.k, p: c.x.p, u: c.x.u || '' } };
  else d.items[IT.id] = { s: 'swap', sub: scaleText(c.text, q), base: c.text, ...(q === 1 ? {} : { q }), k: V.k, p: V.p };
}
/* Kod ya da anahtar girilince yarım kalan iş (ör. programı aktarma) kaldığı yerden sürer. */
let afterKey = null;
function needKey(then) { afterKey = then || null; progSheet('ai'); }

/* ---------- Öğün notu ve fotoğraf açıklaması ----------
   days[k].notes = { öğün: 'metin' }: isteğe bağlı açıklama; panelde görünür, haftalık rapora ve asistana gider.
   Fotoğrafla kayıtta çekimden sonra açıklama sorulur; analizde hesaba katılır ve öğünün notu olur. */
let NT = null, PH = null;   /* NT: notu düzenlenen öğün · PH: { meal, full } çekilen fotoğraf */
function noteSheet(mealId) {
  sheet = 'note'; NT = mealId;
  const m = MEALS.find(x => x.id === mealId), v = (peek(sel).notes || {})[mealId] || '';
  showSheet(`<h2>${m.title} notu</h2><p class="lead">İsteğe bağlı. Haftalık raporla diyetisyenine gider; örneğin dışarıda yedin, porsiyon büyüktü ya da canın istemedi.</p>
    <textarea id="notetx" placeholder="Açıklama yaz">${esc(v)}</textarea>
    <button class="primary" data-act="notesave">${ic('check')}Kaydet</button>${v ? `<button class="textbtn" data-act="notedel">Notu sil</button>` : `<button class="textbtn" data-act="close">Vazgeç</button>`}`);
  setTimeout(() => { const t = document.getElementById('notetx'); if (t) t.focus(); }, 320);
}
function photoSheet() {
  sheet = 'photo';
  const m = MEALS.find(x => x.id === PH.meal);
  showSheet(`<h2>${m.title}</h2><p class="lead">Fotoğrafta görünmeyen bir şey varsa yaz; analizde hesaba katılır ve öğünün notu olur.</p>
    <img class="shot" src="data:image/jpeg;base64,${PH.full}" alt="">
    <textarea id="phtx" placeholder="Açıklama (isteğe bağlı) · örn. yarısını yedim, sosu yoktu"></textarea>
    <button class="primary" data-act="phgo">${ic('check')}Analiz et</button><button class="textbtn" data-act="close">Vazgeç</button>`);
}

/* ---------- Yapay zekâ bağlantısı ve rıza ----------
   Bütün çağrılar aiFetch'ten geçer. Bugün tarayıcıdan doğrudan Anthropic'e, kullanıcının anahtarıyla gider;
   sunucu vekiline geçişte değişecek tek yer burası. Sağlık verisi yurt dışına gittiği için ilk kullanımdan önce
   açık rıza alınır (diyet-ai-ok); rıza yoksa yapay zekâ özellikleri çalışmaz, geri kalan her şey çalışır. */
const AI_URL = 'https://api.anthropic.com/v1/messages', OKKEY = 'diyet-ai-ok', CODEKEY = 'diyet-ai-code';
/* Sunucu vekili (server/worker.js). Adres boşken davet kodu seçeneği görünmez, yalnızca kendi anahtarınla çalışır. */
const PROXY_URL = 'https://diyet-api.basedchimpers.workers.dev';
const aiCode = () => { try { return PROXY_URL && localStorage.getItem(CODEKEY) || ''; } catch (e) { return ''; } };
const aiAuth = () => aiCode() || aiKey();
/* Davet kodu varsa vekile, yoksa kullanıcının kendi anahtarıyla doğrudan Anthropic'e. */
const aiFetch = (body, signal) => aiCode()
  ? fetch(PROXY_URL + '/v1/messages', { method: 'POST', body: JSON.stringify(body), signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + aiCode() } })
  : fetch(AI_URL, { method: 'POST', body: JSON.stringify(body), signal,
    headers: { 'content-type': 'application/json', 'x-api-key': aiKey(), 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' } });
const aiErr = (r, j) => new Error(r.status === 401 ? (aiCode() ? (sheet === 'build' ? 'Davet kodu geçersiz.' : 'Davet kodu geçersiz. Program → Yapay zekâ bölümünden kontrol et.') : 'API anahtarı geçersiz. Program sekmesinden yenisini gir.')
  : r.status === 402 ? 'Bu ayın yapay zekâ hakkı doldu. Kütüphane ve geçmişinden kayıt yapmaya devam edebilirsin.'
  : r.status === 429 ? 'Çok fazla istek; biraz sonra yeniden dene.' : r.status === 529 ? 'Servis şu an yoğun; biraz sonra yeniden dene.'
  : r.status === 502 ? 'Servis şu an çalışmıyor; diyetisyenine haber ver.' : (j && j.error && j.error.message) || 'İstek başarısız oldu.');
/* Vekildeki bu ayki kullanım: { name, n, usd, budget }. */
let ME = null;
const loadMe = () => !aiCode() ? Promise.resolve(null) : fetch(PROXY_URL + '/v1/me', { headers: { authorization: 'Bearer ' + aiCode() } })
  .then(r => r.ok ? r.json() : Promise.reject(r.status)).then(j => (ME = j)).catch(x => { ME = { err: x === 401 ? 'Kod geçersiz' : 'Bağlanılamadı' }; return ME; });
/* Yapılandırılmış çıktılı tek istek; sonucu nesne olarak döndürür. */
async function aiJSON(body, refusal) {
  const r = await aiFetch(body), j = await r.json().catch(() => ({}));
  if (!r.ok) throw aiErr(r, j);
  track(body.model, j.usage);
  if (j.stop_reason === 'refusal') throw new Error(refusal);
  return JSON.parse((j.content || []).find(b => b.type === 'text').text);
}
const aiOk = () => { try { return localStorage.getItem(OKKEY) || ''; } catch (e) { return ''; } };
let afterOk = null;
/* Yapay zekâ kapısı: anahtar yoksa ayar sayfası, rıza yoksa aydınlatma metni açılır; onaydan sonra then çalışır. */
function aiReady(then) {
  if (!aiAuth()) { needKey(then); return false; }
  if (!aiOk()) { afterOk = then; consentSheet(); return false; }
  return true;
}
function consentSheet() {
  sheet = 'consent';
  showSheet(`<h2>Yapay zekâ ve verilerin</h2><p class="lead">Fotoğraftan ya da yazıdan kayıt, etiket okuma ve asistan çalışırken bazı bilgiler yanıt üretilmesi için Anthropic'e (ABD) gönderilir.</p>
    <div class="group prose"><p>Gönderilenler<small>Çektiğin fotoğraf ya da yazdığın metin ve ilgili öğünün planı. Asistanda ayrıca programın ve günün kaydı: yediklerin, su, antrenman, son tartın.</small></p>
      <p>Neden önemli<small>Bunlar sağlıkla ilgili kişisel veri sayılır ve yurt dışına aktarılır. Bu yüzden onayın gerekiyor.</small></p>
      <p>Nerede durur<small>Uygulamanın kendi sunucusu yok; kayıtların yalnızca bu cihazda. Anthropic'in ticari koşullarına göre API ile gönderilen veriler model eğitiminde kullanılmaz.</small></p>
      <p>Onay vermezsen<small>Yapay zekâ özellikleri kapalı kalır; geri kalan her şey çalışır. Onayını Program → Yapay zekâ bölümünden geri alabilirsin.</small></p></div>
    <button class="primary" data-act="aiok">${ic('check')}Onaylıyorum</button><button class="textbtn" data-act="close">Şimdi değil</button>`);
}

/* ---------- Claude ile analiz ---------- */
const SCHEMA = { type: 'object', additionalProperties: false, required: ['main', 'items', 'extras', 'note'], properties: {
  main: { type: 'string', enum: ['', ...MAINS.map(m => m.id)] },
  items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'status', 'sub', 'kcal', 'protein'], properties: {
    id: { type: 'string' }, status: { type: 'string', enum: ['done', 'skip', 'swap'] }, sub: { type: 'string' }, kcal: { type: 'number' }, protein: { type: 'number' } } } },
  extras: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'kcal', 'protein'], properties: { name: { type: 'string' }, kcal: { type: 'number' }, protein: { type: 'number' } } } },
  note: { type: 'string' } } };
function shrink(file, max = 1280) {
  return new Promise((ok, no) => { const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); const out = c.toDataURL('image/jpeg', 0.82).split(',')[1]; c.width = c.height = 0; ok(out); };
    img.onerror = () => no(new Error('Fotoğraf okunamadı')); img.src = url; });
}
async function analyze(mealId, { image, text }) {
  const meal = MEALS.find(m => m.id === mealId), its = itemsOf(meal, sel).filter(i => !i.optional);
  const plan = its.map(i => ({ id: i.id, ne: i.opts ? `${i.name}: ${i.opts.join(' / ')}` : i.name + (i.meta ? ` (${i.meta})` : ''), kcal: i.k, protein: i.p }));
  showSheet(`<div class="busy"><div class="spin"></div>${image ? 'Fotoğrafa bakıyorum…' : 'Okuyorum…'}</div>`);
  const system = `Bir diyet takip uygulamasının besin analizcisisin. Kullanıcı "${meal.title}" öğününde yediklerini ${image ? 'fotoğrafla' : 'yazıyla'} bildiriyor; bunu diyetisyeninin planıyla karşılaştırıp kaydı sen çıkarıyorsun. Kayıt, günün kalan öğünlerini dengelemek için kullanılacak; bu yüzden porsiyon tahminlerinin gerçekçi olması, iyimser olmasından önemli.

Planlanan kalemler JSON olarak verilecek. Her kalem için bir karar ver:
- "done": planlandığı gibi ya da kalemin kendi seçeneklerinden biri yendi. sub boş, kcal ve protein planlanan değer.
- "skip": yenmedi ya da görünmüyor. sub boş, kcal ve protein 0.
- "swap": yerine başka bir şey ya da belirgin biçimde farklı miktarda yendi. sub alanına ne yendiğini kısa Türkçe yaz (örn. "1 dilim beyaz ekmek", "200 g pilav"); kcal ve protein yenen şeyin tahmini değerleri.
Plandaki her kalem items listesinde tam bir kez yer almalı. Plandaki hiçbir kaleme karşılık gelmeyen yiyecek ve kalorili içecekleri extras listesine tahmini kcal ve protein ile ekle; su, şekersiz çay ve sade kahveyi ekleme.

Kimliği "ana" olan kalem ana yemektir. Yenen ana yemek şu seçeneklerden birine uyuyorsa main alanına onun kimliğini yaz ve kalemi "done" say: ${MAINS.map(m => m.ai ? `${m.id} (${m.ai})` : m.id).join(', ')}. Hiçbirine uymuyorsa main boş kalsın ve kalemi "swap" olarak işle. Plan "ana" kalemi içermiyorsa main boş kalsın.

Fotoğrafla birlikte kullanıcının açıklaması gelirse onu da hesaba kat (ör. "yarısını yedim", "ekmeği yemedim", "sosu yoktu"); fotoğrafla çelişirse açıklamayı esas al.

Emin olamadığın bir şey varsa note alanında tek cümleyle söyle; yoksa boş bırak.`;
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  content.push({ type: 'text', text: `Planlanan kalemler:\n${JSON.stringify(plan, null, 1)}${text ? `\n\n${image ? 'Kullanıcının açıklaması' : 'Kullanıcının yazdığı'}:\n${text}` : ''}` });
  try {
    const R = await aiJSON({ model: AI_MODEL, max_tokens: 16000, system, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: SCHEMA } } }, 'Bu içerik analiz edilemedi.');
    pending = { meal: mealId, R, its, note: image ? text : '' };
    resultSheet(meal);
  } catch (e) {
    showSheet(`<h2>Olmadı</h2><p class="err" style="padding-top:8px">${esc(e.message || 'Bağlantı kurulamadı.')}</p><button class="textbtn" data-act="close">Kapat</button>`);
  }
}
function resultSheet(meal) {
  const { R, its } = pending, lab = { done: 'Yedin', skip: 'Yok' };
  const rows = its.map(it => { const x = R.items.find(a => a.id === it.id) || { status: 'skip', kcal: 0 };
    const nm = it.id === 'ana' && R.main ? mainById(R.main).name : label(it);
    return `<div class="opt"><span>${esc(x.status === 'swap' ? x.sub : nm)}<small>${x.status === 'swap' ? esc(label(it)) + ' yerine' : lab[x.status]}</small></span><small>${x.status === 'skip' ? '—' : KC ? num(x.kcal) + ' kcal' : ''}</small></div>`; }).join('');
  const ex = R.extras.map(e => `<div class="opt"><span>${esc(e.name)}<small>Plan dışı</small></span><small>${KC ? num(e.kcal) + ' kcal' : ''}</small></div>`).join('');
  showSheet(`<h2>${meal.title}</h2><p class="lead">Gördüklerim doğruysa kaydet; değilse kaydettikten sonra satırlardan düzeltebilirsin.</p>
    <div class="group">${rows}${ex}</div>${R.note ? `<p class="note">${esc(R.note)}</p>` : ''}
    <button class="primary" data-act="applyai">${ic('check')}Kaydet</button><button class="textbtn" data-act="close">Vazgeç</button>`);
}
function applyAI() {
  const { meal: mealId, R, its, note } = pending, d = day(sel), meal = MEALS.find(m => m.id === mealId);
  if (hasMain(meal, sel)) d.main[mealId] = R.main || mainFor(sel, mealId).id;
  /* Fotoğrafa yazılan açıklama öğünün notu olur (varsa eskisinin yerine geçmez). */
  if (note) { const n = d.notes || (d.notes = {}); if (!n[mealId]) n[mealId] = note; }
  its.forEach(it => { const x = R.items.find(a => a.id === it.id) || { status: 'skip' }, id = mealId + '.' + it.id;
    d.items[id] = x.status === 'done' ? { s: 'done' } : x.status === 'skip' ? { s: 'skip' } : { s: 'swap', sub: x.sub || 'Farklı bir şey', k: x.kcal, p: x.protein }; });
  d.extras = d.extras.filter(e => e.meal !== mealId || e.adj).concat(R.extras.map(e => ({ meal: mealId, name: e.name, k: e.kcal, p: e.protein })));
  /* Yapay zekânın tanıdığı her şey kendi kütüphanene girer: bir dahakine çağrısız bulunur. */
  R.extras.forEach(e => remember(mealId, e.name, e.kcal, e.protein));
  R.items.forEach(x => { if (x.status === 'swap' && x.sub) remember(mealId, x.sub, x.kcal, x.protein); });
  delete openEv[sel];
}

/* ---------- Hızlı kayıt ----------
   Plan dışı yeneni yapay zekâya gitmeden kaydeder: önce kullanıcının kendi geçmişi (S.foods), sonra yerel
   kütüphane (FOODS). Bulunamazsa yapay zekâ seçeneği sunulur; yapay zekânın bulduğu her şey de geçmişe girer,
   böylece aynı şey ikinci kez çağrısız kaydedilir. */
const fold = s => String(s).toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, c => 'cgiosuaiu'['çğıöşüâîû'.indexOf(c)]).replace(/[^a-z0-9]+/g, ' ').trim();
/* Gıda ikonu (foods.js ICONS): kimlik adın fold'u, boşluklar tire. Kütüphanedeki yemeğin adı ve eş adları da ikonuna gider;
   böylece kullanıcının "Lahmacun" diye kaydettiği gıda da ikonunu bulur. Fotoğrafı olan gıdada fotoğraf önce gelir. */
const ICON = (() => { const has = new Set(ICONS), m = new Map(), key = s => fold(s).replace(/ /g, '-');
  ICONS.forEach(i => m.set(i, i));
  FOODS.forEach(f => { const i = f.i || key(f.n); if (has.has(i)) [f.n, ...(f.a || [])].forEach(a => m.has(key(a)) || m.set(key(a), i)); });
  return n => n ? m.get(key(n)) : undefined; })();
const icoImg = (i, px) => `<img class="fico" src="img/f/${i}-160.webp" srcset="img/f/${i}-160.webp 160w, img/f/${i}-320.webp 320w" sizes="${px}px" alt="" loading="lazy">`;
const QS = [.25, .5, .75, 1, 1.5, 2, 3];   /* porsiyon ölçekleri */
const qLab = q => { q = Math.round(q * 4) / 4 || .25; const w = Math.floor(q), f = { .25: '¼', .5: '½', .75: '¾' }[q - w] || ''; return (w || '') + f || '0'; };
/* Kullanıcının kendi kütüphanesi: k ve p bir porsiyon içindir; c kaç kez, t son tarih, m öğün başına sayı. */
function remember(meal, n, k, p, u) {
  const id = fold(n); if (!id || !(k >= 0)) return;
  const F = S.foods || (S.foods = {}), f = F[id] || (F[id] = { c: 0, m: {} });
  if (!f.own) { Object.assign(f, { n, k: Math.round(k), p: Math.round((p || 0) * 10) / 10 }); if (u) f.u = u; }
  f.c++; f.t = today; f.m[meal] = (f.m[meal] || 0) + 1;
}
const qScore = (f, meal) => (f.m[meal] || 0) * 3 + f.c + Math.max(0, 14 - (parse(today) - parse(f.t || today)) / 864e5);
function qFind(meal, q) {
  const mine = Object.entries(S.foods || {}).map(([id, f]) => ({ id, n: f.n, u: f.u || '', k: f.k, p: f.p, img: f.img, mine: true, s: qScore(f, meal) })).sort((a, b) => b.s - a.s);
  const t = fold(q).split(' ').filter(Boolean);
  if (!t.length) return mine.slice(0, 8);
  const lib = FOODS.map(f => ({ id: fold(f.n), n: f.n, u: f.u, k: f.k, p: f.p, a: f.a }));
  const hit = x => { const w = fold([x.n, ...(x.a || [])].join(' ')).split(' '); return t.every(y => w.some(z => z.startsWith(y))); };
  const seen = new Set(), head = fold(q), out = [];
  for (const x of [...mine, ...lib]) if (!seen.has(x.id) && hit(x)) { seen.add(x.id); out.push(x); }
  /* Kendi kayıtların önde; sonra adı aranan şeyle başlayanlar. Sıralama kararlı. */
  const rank = x => (x.mine ? 2 : 0) + (fold(x.n).startsWith(head) ? 1 : 0);
  return out.map((x, i) => [x, i]).sort((a, b) => rank(b[0]) - rank(a[0]) || a[1] - b[1]).map(a => a[0]).slice(0, 12);
}

let Q = null;   /* { meal, tray: [{ id, n, u, k, p, q }], mode: null | 'yerine' | 'ek', res: [] } */
const qOpen = meal => itemsOf(meal, sel).filter(i => !i.optional && !stOf(peek(sel), meal, i));
const qMode = () => { const meal = MEALS.find(m => m.id === Q.meal), open = qOpen(meal);
  if (!open.length) return 'ek'; if (Q.mode) return Q.mode;
  /* Kendiliğinden: yenen, öğünün açık kısmının yarısını geçiyorsa planın yerine sayılır. */
  return Q.tray.reduce((t, x) => t + x.k * x.q, 0) >= open.reduce((t, i) => t + i.k, 0) * .5 ? 'yerine' : 'ek'; };
function quickSheet(meal, keep) {
  if (!keep) Q = { meal: meal.id, tray: [], mode: null, res: [] }; sheet = 'quick';
  showSheet(`<h2>${meal.title}: ne yedin?</h2>
    <label class="qbox">${ic('search')}<input id="q" type="search" autocomplete="off" placeholder="Ara: iskender, simit, ayran…" enterkeyhint="done"></label>
    <div id="qtray"></div><div id="qres"></div>`);
  qPaint();
  if (!keep) setTimeout(() => { const t = document.getElementById('q'); t && t.focus(); }, 320);
}
function qPaint() {
  const meal = MEALS.find(m => m.id === Q.meal), inp = document.getElementById('q'), q = inp ? inp.value.trim() : '';
  const tk = Q.tray.reduce((t, x) => t + x.k * x.q, 0), tp = Q.tray.reduce((t, x) => t + x.p * x.q, 0), mode = qMode(), open = qOpen(meal);
  document.getElementById('qtray').innerHTML = !Q.tray.length ? '' : `<div class="group" style="margin-top:12px">${Q.tray.map((x, i) =>
    `<div class="trow"><div class="row"><span class="b"><span class="n">${esc(x.n)}</span><span class="m">${esc(x.u ? x.u + ' · ' : '')}${KC ? num(x.k * x.q) + ' kcal · ' : ''}${num1(x.p * x.q)} g protein</span></span>${x.img ? `<img class="th" src="${x.img}" alt="">` : ICON(x.n) ? `<span class="th fico">${icoImg(ICON(x.n), 40)}</span>` : ''}<button class="more" data-act="qx" data-i="${i}" aria-label="Çıkar">${ic('x')}</button></div>
      <div class="qchips">${QS.map(v => `<button class="${v === x.q ? 'on' : ''}" data-act="qq" data-i="${i}" data-v="${v}">${qLab(v)}</button>`).join('')}</div></div>`).join('')}</div>
    ${open.length ? `<div class="seg" style="margin:0 0 6px"><button class="${mode === 'yerine' ? 'on' : ''}" data-act="qmode" data-m="yerine">Planın yerine</button><button class="${mode === 'ek' ? 'on' : ''}" data-act="qmode" data-m="ek">Plana ek</button></div>
      <p class="note" style="padding:6px 6px 12px">${mode === 'yerine' ? `Öğünün işaretlenmemiş kalemleri atlandı sayılır; kalan öğünler buna göre dengelenir.` : `Öğünün planı olduğu gibi kalır; bu, üstüne eklenir.`}</p>` : ''}
    ${qLater(meal) ? `<button class="primary" data-act="qsave" data-pl="1">${ic('clock')}Planla${KC ? ` · ${num(tk)} kcal` : ''}</button>
      <p class="note" style="padding:10px 6px 0;text-align:center">Gün şimdiden buna göre dengelenir; yiyince onaylarsın.</p><button class="textbtn" data-act="qsave">Yedim, kaydet</button>`
    : `<button class="primary" data-act="qsave">${ic('check')}Kaydet${KC ? ` · ${num(tk)} kcal` : ''}</button>`}`;
  Q.res = qFind(meal.id, q).filter(x => !Q.tray.some(t => t.id === x.id));
  const rows = fgrid(Q.res.map((x, i) => fcard(x, 'qadd', i, 'plus')).join(''));
  const add = `<button class="opt" data-act="fnew" data-ret="${meal.id}" data-q="${esc(q)}"><span>Yeni gıda ekle<small>Kendi ürününü fotoğrafla ya da elle kaydet</small></span>${ic('cam')}</button>`;
  const ai = q ? `<button class="opt" data-act="qai"><span>“${esc(q)}”<small>Yapay zekâyla işle${aiAuth() ? '' : PROXY_URL ? ' · davet kodu gerekli' : ' · API anahtarı gerekli'}</small></span>${ic('pen')}</button>` : '';
  document.getElementById('qres').innerHTML = !q && !Q.res.length
    ? (Q.tray.length ? '' : `<p class="lead" style="padding-top:14px">Yediğin şeyi ara. Kaydettiklerin burada birikir; bir dahakine tek dokunuşla eklersin.</p><div class="group">${add}</div>`)
    : `<div class="sect">${q ? 'Sonuçlar' : 'Senin gıdaların'}</div>${rows}<div class="group">${ai}${add}</div>${q && !Q.res.length ? `<p class="note">Kütüphanede yok. Yapay zekâ işlerse ya da kendin eklersen bir dahakine burada çıkar.</p>` : ''}`;
}
/* Öğünün saati daha gelmediyse (30 dakikadan uzak ya da ileri bir gün) kayıt planlama olur. */
const qLater = meal => sel > today || (sel === today && !!meal.time && minsTo(meal, sel) > 30);
function qSave(pl) {
  const d = day(sel), meal = MEALS.find(m => m.id === Q.meal), mode = qMode(), f = pl ? { pl: true } : {};   /* src: ölçeksiz değerler, onayda kütüphaneye */
  Q.tray.forEach(x => { d.extras.push({ meal: meal.id, name: x.q === 1 ? x.n : `${x.n} × ${qLab(x.q)}`, k: Math.round(x.k * x.q), p: Math.round(x.p * x.q * 10) / 10, q: x.q, src: { n: x.n, k: x.k, p: x.p, u: x.u }, ...(pl ? { pl: true } : {}) }); if (!pl) remember(meal.id, x.n, x.k, x.p, x.u); });
  if (mode === 'yerine') { lockMain(sel, meal); qOpen(meal).forEach(it => d.items[meal.id + '.' + it.id] = { s: 'skip', ...f }); }
  if (mealStat(meal, sel).resolved) delete openEv[sel];
}

/* ---------- Kayıt düzenleme ----------
   Kaydedilmiş bir plan dışı yemeğin ya da kalem yerine yenenin porsiyonu, adı ve değerleri sonradan değişir.
   Kayıtlar ölçeksiz hâlini src ({ n, k, p, u }) ve porsiyonu q olarak taşır; eskilerde değerler tek porsiyon sayılır. */
const baseOf = (n, e) => e.src ? { n: e.src.n, k: e.src.k, p: e.src.p, u: e.src.u || '', q: e.q || 1 } : { n, k: e.k || 0, p: e.p || 0, u: '', q: 1 };
const scaled = (b, q) => ({ name: q === 1 ? b.n : `${b.n} × ${qLab(q)}`, k: Math.round(b.k * q), p: Math.round(b.p * q * 10) / 10, q, src: { n: b.n, k: b.k, p: b.p, u: b.u } });
/* Düzeltilen değer kişisel kütüphaneye geçer (kullanım sayısı artmaz); kullanıcının kendi ürünlerine dokunulmaz. */
function learn(n, k, p, u) {
  const id = fold(n), F = S.foods || (S.foods = {}); if (!id || (F[id] && F[id].own)) return;
  const f = F[id] || (F[id] = { c: 0, m: {}, t: today });
  Object.assign(f, { n, k: Math.round(k), p: Math.round(p * 10) / 10 }); if (u) f.u = u;
}
let XE = null;   /* düzenlenen plan dışı kayıt: { i, meal, n, u, bk, bp, q, pl } */
function xOpen(i) {
  const e = day(sel).extras[i], b = baseOf(e.name, e);
  XE = { i, meal: e.meal, n: b.n, u: b.u, bk: b.k, bp: b.p, q: b.q, pl: !!e.pl }; xSheet();
}
function xSheet() {
  sheet = 'xedit';
  const meal = MEALS.find(m => m.id === XE.meal);
  showSheet(`<h2>Kaydı düzenle</h2><p class="lead">${meal.title}${XE.pl ? ' · planlandı, henüz yenmedi' : ''}</p>
    <div class="group form"><label class="fl"><span>Ad</span><input id="xn" value="${esc(XE.n)}" autocomplete="off"></label>
      ${XE.u ? `<div class="fl"><span>Porsiyon</span><span class="wide" style="color:var(--muted)">${esc(XE.u)}</span></div>` : ''}</div>
    <div class="sect">Ne kadar yedin?</div>${qchips('xq', XE.q)}
    <div class="group form">${KC ? `<label class="fl"><span>Kalori</span><input id="xk" value="${Math.round(XE.bk * XE.q)}" inputmode="decimal"></label>` : ''}
      <label class="fl"><span>Protein</span><input id="xp" value="${num1(XE.bp * XE.q)}" inputmode="decimal"></label></div>
    <p class="note">Değerler yediğin miktar içindir. Düzelttiğin değer bir dahaki seferde de kullanılır.</p>
    <button class="primary" data-act="xsave">${ic('check')}Kaydet</button><button class="textbtn" data-act="xdel">Kaydı sil</button>`);
}
const qchips = (act, cur) => `<div class="qchips free">${QS.map(v => `<button class="${v === cur ? 'on' : ''}" data-act="${act}" data-v="${v}">${qLab(v)}</button>`).join('')}</div>`;
/* Alanlardaki değerler seçili porsiyon içindir; ölçeksiz değere çevrilir. */
const xSync = () => { const n = document.getElementById('xn'), k = document.getElementById('xk'), p = document.getElementById('xp');
  if (n && n.value.trim()) XE.n = n.value.trim(); if (k) XE.bk = fNum(k.value) / XE.q; if (p) XE.bp = fNum(p.value) / XE.q; };
/* Kalem yerine yenen için kütüphane önerileri (#custom yazılırken). */
let CS = [];
function csPaint() {
  const box = document.getElementById('csug'), v = document.getElementById('custom').value.trim(); if (!box) return;
  CS = v ? qFind(sheet.split('.')[0], v).slice(0, 6) : [];
  box.innerHTML = fgrid(CS.map((x, i) => fcard(x, 's-food', i, 'plus')).join(''));
}

/* ---------- Gıdalarım ----------
   Kullanıcının kendi gıda arşivi: S.foods. Hızlı kayıtla ve yapay zekâyla biriken her şey burada; kullanıcı kendi
   ürünlerini (whey, protein bar…) fotoğrafla ya da elle ekler. own: kullanıcı girdi, değerlerinin üstüne yazılmaz.
   img: 160 px kare küçük resim (data URL). */
let FD = null;   /* düzenlenen gıda: { id, n, u, k, p, img, full, ret, busy, err, note, del } */
/* file: dosya ya da base64 JPEG (küçültülmüş fotoğraftan kare küçük resim). */
function thumb(file, size = 160) {
  return new Promise((ok, no) => { const img = new Image(), str = typeof file === 'string', url = str ? 'data:image/jpeg;base64,' + file : URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); if (!str) URL.revokeObjectURL(url); const out = c.toDataURL('image/jpeg', .72); c.width = c.height = 0; ok(out); };
    img.onerror = () => no(new Error('Fotoğraf okunamadı')); img.src = url; });
}
const tile = f => f.img ? `<img class="th" src="${f.img}" alt="">` : `<span class="th">${esc((f.n || '?').trim()[0].toLocaleUpperCase('tr'))}</span>`;
/* Gıda ızgarası: görsel, ad, porsiyon; altında yan yana kalori ve protein (gram protein). Seçimin yapıldığı her yerde aynı kart. */
const fcard = (f, act, i, badge) => `<button class="fcard" data-act="${act}" ${i != null ? `data-i="${i}"` : ''} ${f.id != null && i == null ? `data-id="${esc(f.id)}"` : ''}>
  <span class="fimg">${f.img ? `<img src="${f.img}" alt="">` : ICON(f.n) ? icoImg(ICON(f.n), 64) : `<i>${esc((f.n || '?').trim()[0].toLocaleUpperCase('tr'))}</i>`}${badge ? `<span class="fbadge">${ic(badge)}</span>` : ''}</span>
  <b>${esc(f.n)}</b>${f.u ? `<small class="fu">${esc(f.u)}</small>` : ''}<small class="fv">${KC ? `${num(f.k)} kcal · ${num1(f.p)} g` : `${num1(f.p)} g protein`}</small></button>`;
const fgrid = cards => cards ? `<div class="fgrid">${cards}</div>` : '';
function foodsSheet() {
  sheet = 'foods';
  const list = Object.entries(S.foods || {}).sort(([, a], [, b]) => (b.t || '').localeCompare(a.t || '') || b.c - a.c);
  showSheet(`<div class="between" style="align-items:center;padding-right:6px"><h2>Gıdalarım</h2><button class="pill" data-act="fnew">${ic('plus')}Yeni</button></div>
    <p class="lead">Kendi ürünlerin ve daha önce kaydettiklerin. Öğüne eklerken aramada önce bunlar çıkar.</p>
    ${list.length ? fgrid(list.map(([id, f]) => fcard({ ...f, id }, 'fedit')).join(''))
      : `<button class="primary" data-act="fnew">${ic('plus')}İlk gıdanı ekle</button><p class="note" style="padding-top:12px">Örneğin kendi whey proteinin ya da her zaman aldığın protein bar. Etiketin fotoğrafını çekersen değerleri yapay zekâ doldurur.</p>`}`);
}
function foodForm() {
  sheet = 'food';
  const f = FD, ok = f.n.trim() && f.k !== '' && !isNaN(+String(f.k).replace(',', '.'));
  showSheet(`<h2>${f.id ? 'Gıdayı düzenle' : 'Yeni gıda'}</h2>
    <div class="fphoto"><button class="ph" data-act="fpic" aria-label="Fotoğraf ekle">${f.img ? `<img src="${f.img}" alt="">` : ic('cam')}</button>
      <div><p>${f.img ? 'Fotoğrafı değiştirmek için dokun.' : 'Ürünün ya da besin değerleri etiketinin fotoğrafını ekle.'}</p>
      <button class="pill" data-act="fai" ${f.busy ? 'disabled' : ''}>${f.busy ? 'Okunuyor…' : 'Yapay zekâyla doldur'}</button></div></div>
    <div class="group form">
      <label class="fl"><span>Ad</span><input id="fn" value="${esc(f.n)}" placeholder="Örn. Whey protein" autocomplete="off"></label>
      <label class="fl"><span>Porsiyon</span><input id="fu" value="${esc(f.u)}" placeholder="Örn. 1 ölçek (30 g)" autocomplete="off"></label>
      <label class="fl"><span>Kalori</span><input id="fk" value="${esc(f.k)}" inputmode="decimal" placeholder="kcal"></label>
      <label class="fl"><span>Protein</span><input id="fp" value="${esc(f.p)}" inputmode="decimal" placeholder="g"></label></div>
    ${f.err ? `<p class="err">${esc(f.err)}</p>` : f.note ? `<p class="note">${esc(f.note)}</p>` : `<p class="note">Değerler bir porsiyon içindir. Öğüne eklerken ¼'ten 3 porsiyona kadar ölçekleyebilirsin.</p>`}
    <button class="primary" data-act="fsave" ${ok ? '' : 'disabled'}>${ic('check')}Kaydet</button>
    ${f.id ? `<button class="textbtn ${f.del ? 'over' : ''}" data-act="fdel">${f.del ? 'Silmek için tekrar dokun' : 'Sil'}</button>` : `<button class="textbtn" data-act="fback">Vazgeç</button>`}`);
}
const fSync = () => { if (!FD) return; [['fn', 'n'], ['fu', 'u'], ['fk', 'k'], ['fp', 'p']].forEach(([el, k]) => { const x = document.getElementById(el); if (x) FD[k] = x.value; }); };
const fNum = v => { const x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; };
function fSave() {
  const F = S.foods || (S.foods = {}), n = FD.n.trim(), id = fold(n); if (!id) return null;
  const old = FD.id && F[FD.id] || F[id] || { c: 0, m: {} };
  if (FD.id && FD.id !== id) delete F[FD.id];
  F[id] = { ...old, n, u: FD.u.trim(), k: Math.round(fNum(FD.k)), p: Math.round(fNum(FD.p) * 10) / 10, own: true, t: old.t || today };
  if (FD.img) F[id].img = FD.img; else delete F[id].img;
  return id;
}
const FOOD_SCHEMA = { type: 'object', additionalProperties: false, required: ['name', 'portion', 'kcal', 'protein', 'note'], properties: {
  name: { type: 'string' }, portion: { type: 'string' }, kcal: { type: 'number' }, protein: { type: 'number' }, note: { type: 'string' } } };
async function foodAI() {
  const text = [FD.n && `Ad: ${FD.n}`, FD.u && `Porsiyon: ${FD.u}`].filter(Boolean).join('\n');
  if (!FD.full && !text) { FD.err = 'Önce bir fotoğraf ekle ya da adını yaz.'; return foodForm(); }
  FD.busy = true; FD.err = ''; FD.note = ''; foodForm();
  const system = `Bir diyet uygulamasının gıda arşivine ürün ekleniyor. Ürünün fotoğrafı (ambalaj ya da besin değerleri etiketi) ve/veya kullanıcının yazdığı ad verilir. Tek bir porsiyonun değerlerini çıkar.
- name: ürünün kısa Türkçe adı; marka görünüyorsa markayla birlikte (örn. "Torku Protein Bar Kakaolu").
- portion: porsiyonun tarifi, gramıyla (örn. "1 bar (45 g)", "1 ölçek (30 g)"). Kullanıcı porsiyon yazdıysa onu kullan. Etikette porsiyon varsa onu, yoksa paketteki tek birimi (1 bar, 1 kutu) ya da 100 g'ı kullan.
- kcal ve protein: bu porsiyon için. Etiket 100 g başına veriyorsa porsiyona çevir. Etiket okunuyorsa etiketteki değerleri kullan, tahmin etme.
- note: etiket okunamadıysa ya da değerler tahminse bunu tek cümleyle söyle; yoksa boş bırak.`;
  const content = [];
  if (FD.full) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: FD.full } });
  content.push({ type: 'text', text: text || 'Fotoğraftaki ürün.' });
  try {
    const R = await aiJSON({ model: AI_MODEL, max_tokens: 16000, system, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: FOOD_SCHEMA } } }, 'Bu içerik okunamadı.');
    if (!FD.n.trim()) FD.n = R.name; FD.u = R.portion || FD.u; FD.k = String(Math.round(R.kcal)); FD.p = String(Math.round(R.protein * 10) / 10).replace('.', ',');
    FD.note = R.note || 'Değerleri etiketle karşılaştırıp kaydet.';
  } catch (e) { FD.err = e.message || 'Bağlantı kurulamadı.'; }
  FD.busy = false; if (sheet === 'food') foodForm();
}

/* ---------- Program bağlantısı ----------
   Program tek bir bağlantıyla taşınır: #plan=<kod>. Kod, plan JSON'unun sıkıştırılmış (deflate-raw) base64url hâlidir;
   'z' ile başlar (sıkıştırma yoksa 'j', düz JSON). Diyetisyen paneli de aynı bağlantıyı üretecek.
   iOS'ta ana ekrandaki uygulama Safari'den ayrı depolama kullanır; bu yüzden bağlantı uygulamaya yapıştırılarak da yüklenir. */
const b64u = b => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const pipe = (bytes, T) => new Response(new Blob([bytes]).stream().pipeThrough(new T('deflate-raw'))).arrayBuffer();
async function packPlan(p) {
  const raw = new TextEncoder().encode(JSON.stringify(p));
  return window.CompressionStream ? 'z' + b64u(new Uint8Array(await pipe(raw, CompressionStream))) : 'j' + b64u(raw);
}
async function unpackPlan(text) {
  const m = String(text).trim().match(/(?:#plan=)?([zj][A-Za-z0-9_-]{20,})\s*$/); if (!m) throw new Error('Bağlantıda program bulunamadı.');
  let p;
  try { const bytes = unb64u(m[1].slice(1)), raw = m[1][0] === 'z' ? new Uint8Array(await pipe(bytes, DecompressionStream)) : bytes; p = JSON.parse(new TextDecoder().decode(raw)); }
  catch (e) { throw new Error('Bağlantı bozuk ya da eksik kopyalanmış.'); }
  const err = planCheck(p); if (err) throw new Error(err);
  return p;
}
const planLink = code => location.origin + location.pathname + '#plan=' + code;
let PL = null;   /* program sayfası: { link, err, incoming, set: ayar taslağı, dirty } */
const swi = (k, on) => `<button class="sw ${on ? 'on' : ''}" data-act="pswi" data-k="${k}" role="switch" aria-checked="${on}" aria-label="${k}"><i></i></button>`;
const plSync = () => { const n = document.getElementById('dname'), t = document.getElementById('dphone'); if (n) PL.set.name = n.value; if (t) PL.set.phone = t.value; };
function planSheet() {
  sheet = 'plan';
  if (!PL.set) PL.set = { name: PLAN.dietitian.name || '', phone: PLAN.dietitian.phone || '', kcal: KC, tune: TUNE_ON };
  const P2 = PL.incoming, cur = PLAN;
  if (P2 && PL.built) {
    /* Fotoğraftan oluşturulan: yüklemeden önce öğün öğün gözden geçirilir. */
    /* Döngülü programda gün gün gezilir; 1. günün haftanın hangi gününe denk geldiği buradan seçilir. */
    const C = P2.cycle, di = C ? Math.min(PL.day || 0, C.n - 1) : 0, idsOf = m => C ? m.days[di] : m.main ? ['ana', ...m.items] : m.items;
    /* Ana yemek: haftalık gruplar; toplamda grupların ilk yemeğinin kotaya göre ortalaması sayılır. */
    const MG = Object.entries(P2.groups).map(([g, G]) => ({ G, ds: P2.mains.filter(x => x.g === g) })).filter(x => x.ds.length), wsum = MG.reduce((a, x) => a + x.G.perWeek, 0) || 1;
    const avg = f => MG.reduce((a, x) => a + x.G.perWeek * f(x.ds[0]), 0) / wsum, val = (id, f) => id === 'ana' ? avg(f) : P2.items[id].optional ? 0 : f(P2.items[id]);
    const tk = P2.meals.reduce((t, m) => t + idsOf(m).reduce((a, id) => a + val(id, x => x.k), 0), 0);
    const tp = P2.meals.reduce((t, m) => t + idsOf(m).reduce((a, id) => a + val(id, x => x.p), 0), 0);
    const iname = id => P2.items[id] ? lc(P2.items[id].chip || P2.items[id].name) : id;
    const mainRows = () => MG.map(({ G, ds }) => `<div class="opt"><span>${esc(ds.map(d => d.name).join(' veya '))}<small>${esc([`Haftada ${G.perWeek} gün`, ds[0].drop ? [...new Set(ds[0].drop.map(iname))].join(', ') + ' yok' : ''].filter(Boolean).join(' · '))}</small></span><small>${num(ds[0].k)} kcal</small></div>`).join('');
    const tOf = m => (C && m.dtime && m.dtime[di]) || m.time;
    const w1 = C ? parse(C.start).getDay() : 0;
    const cyc = C ? `<div class="sect">${C.n} günlük program · 1. gün hangi gün?</div>
      <div class="chips pick">${[6, 0, 1, 2, 3, 4, 5].map(w => `<button class="${w === w1 ? 'on' : ''}" data-act="pl1" data-w="${w}">${DAYNAME[w]}</button>`).join('')}</div>
      <div class="sect">Gün</div><div class="chips pick">${Array.from({ length: C.n }, (_, i) => `<button class="${i === di ? 'on' : ''}" data-act="pld" data-i="${i}">${i + 1}. gün<small> · ${DOW[(w1 + i) % 7]}</small></button>`).join('')}</div>` : '';
    return showSheet(`<h2>Programın hazır</h2><p class="lead">Okuduklarım aşağıda. Yanlış ya da eksik bir şey varsa geri dönüp açıklamaya yaz, yeniden oluşturayım.</p>
      ${PL.note ? `<p class="note" style="padding:0 6px 14px">${esc(PL.note)}</p>` : ''}
      ${cyc}${P2.meals.filter(m => idsOf(m).length).map(m => `<div class="sect">${esc(m.title)}${m.time ? ' · ' + tOf(m) + (m.wknd !== m.time && !(C && m.dtime && m.dtime[di]) ? ` (hafta sonu ${m.wknd})` : '') : ''}</div>${idsOf(m).includes('ana') ? `<div class="sect" style="padding-top:0">Her gün birini seç</div><div class="group">${mainRows()}</div><div class="sect" style="padding-top:0">Yanında</div>` : ''}<div class="group">${idsOf(m).filter(id => id !== 'ana').map(id => { const it = P2.items[id], alts = [...(it.opts || []).slice(1), ...(it.subs || [])], sg = it.sugg || [];
        return `<div class="opt"><span>${esc(it.opts ? it.opts[0] : it.name)}<small>${esc([alts.length ? 'veya ' + alts.join(', ') : '', sg.length ? 'önerilen: ' + sg.join(', ') : '', it.optional ? 'isteğe bağlı' : ''].filter(Boolean).join(' · '))}</small></span><small>${num(it.k)} kcal</small></div>`; }).join('')}${m.alt && (!C || m.days[di].join() === m.items.join()) ? m.alt.map(id => `<div class="opt"><span>${esc(P2.items[id].name)}<small>${esc(m.modes[0])} yerine</small></span><small>${num(P2.items[id].k)} kcal</small></div>`).join('') : ''}</div>`).join('')}
      <div class="group"><div class="kv"><span>${C ? `${di + 1}. gün toplamı` : 'Günlük toplam'}</span><span>yaklaşık ${num(tk)} kcal · ${num(tp)} g protein</span></div>${P2.goal.kg ? `<div class="kv"><span>Hedef</span><span>${P2.goal.kg} kg</span></div>` : ''}
        <div class="kv"><span>Kurallar</span><span>${P2.rules.length} madde</span></div><div class="kv"><span>Su</span><span>${P2.daily.water.goal} bardak</span></div></div>
      <p class="note">Değerler tahmindir. Programı yükleyince kayıtların ve gıdaların silinmez.</p>
      <button class="primary" data-act="planload">${ic('check')}Programı yükle</button><button class="textbtn" data-act="pbback">Geri dön, açıklama ekle</button>`);
  }
  if (P2) {
    const meals = P2.meals.filter(m => m.time).map(m => m.title).join(' · ');
    return showSheet(`<h2>Yeni program</h2><p class="lead">Bu program yüklenirse şimdiki programın yerine geçer. Kayıtların ve gıdaların silinmez.</p>
      <div class="group"><div class="kv"><span>Diyetisyen</span><span>${esc(P2.dietitian.name || '—')}</span></div><div class="kv"><span>Tarih</span><span>${P2.date ? fmtDM(P2.date) : '—'}</span></div>
      <div class="kv"><span>Öğünler</span><span>${esc(meals)}</span></div>${P2.goal.kg ? `<div class="kv"><span>Hedef</span><span>${P2.goal.kg} kg</span></div>` : ''}</div>
      <button class="primary" data-act="planload">${ic('check')}Programı yükle</button><button class="textbtn" data-act="plannot">Vazgeç</button>`);
  }
  showSheet(`<h2>Program bağlantısı</h2><p class="lead">Program tek bir bağlantıyla taşınır. Diyetisyenin gönderdiği bağlantıyı buraya yapıştır ya da bu programı paylaş.</p>
    <div class="group"><div class="kv"><span>Şu anki program</span><span>${esc(cur.dietitian.name || 'Diyetisyen programı')} · ${cur.date ? fmtDM(cur.date) : ''}</span></div>
      <div class="kv"><span>Kaynak</span><span>${PLAN_CUSTOM ? 'Bağlantıyla yüklendi' : 'Uygulamayla gelen'}</span></div></div>
    ${CYCLE ? `<div class="sect">${CYCLE.n} günlük program · bugün kaçıncı gün?</div>
      <div class="chips pick">${Array.from({ length: CYCLE.n }, (_, i) => `<button class="${i === cycleIdx(today) ? 'on' : ''}" data-act="cyctoday" data-i="${i}">${i + 1}. gün</button>`).join('')}</div>` : ''}
    <div class="sect">Program yükle</div>
    <div class="group"><div class="field"><input id="plink" type="text" autocomplete="off" placeholder="Bağlantıyı yapıştır"><button class="btn" data-act="planpaste">Aç</button></div></div>
    ${PL.err ? `<p class="err">${esc(PL.err)}</p>` : ''}
    <div class="group"><button class="opt" data-act="build"><span>Kâğıttaki programı aktar<small>Sayfaların fotoğrafından oluştur</small></span>${ic('cam')}</button></div>
    <div class="sect">Diyetisyen ayarları</div>
    <div class="group form"><label class="fl"><span>Ad</span><input id="dname" value="${esc(PL.set.name)}" placeholder="Örn. Dyt. Ayşe Yılmaz" autocomplete="off"></label>
      <label class="fl"><span>Telefon</span><input id="dphone" value="${esc(PL.set.phone)}" inputmode="tel" placeholder="Haftalık rapor için" autocomplete="off"></label>
      <div class="fl"><span class="wide">Danışan kaloriyi görsün</span>${swi('kcal', PL.set.kcal)}</div>
      <div class="fl"><span class="wide">Telafi önerileri</span>${swi('tune', PL.set.tune)}</div></div>
    <p class="note">Normalde diyetisyen belirler; programla birlikte paylaşılır. Kalori gizlense de uygulama arka planda hesaplamaya devam eder.</p>
    <button class="primary" data-act="pset" style="margin-bottom:14px" ${PL.dirty ? '' : 'disabled'}>${ic('check')}Ayarları kaydet</button>
    <div class="sect">Paylaş</div>
    <div class="group"><button class="opt" data-act="planshare"><span>Bu programın bağlantısı<small>${PL.link ? 'Kopyalandı · ' + num(PL.link.length) + ' karakter' : 'Paylaş ya da kopyala'}</small></span>${ic('right')}</button></div>
    ${PLAN_CUSTOM ? `<button class="textbtn" data-act="planreset">Uygulamayla gelen programa dön</button>` : ''}`);
}
const reloadClean = () => { history.replaceState(null, '', location.pathname + location.search); location.reload(); };
/* Açılışta bağlantıyla gelindiyse önce onay sor. */
async function planFromHash() {
  if (!location.hash.startsWith('#plan=')) return;
  try { PL = { incoming: await unpackPlan(location.hash) }; planSheet(); }
  catch (e) { PL = { err: e.message }; planSheet(); history.replaceState(null, '', location.pathname + location.search); }
}

/* ---------- Fotoğraftan program ----------
   Diyetisyen programı bağlantıyla gelmediyse kullanıcı kâğıttaki programın sayfalarını çeker ve açıklama ekler;
   yapay zekâ bunu plan biçimine çıkarır, kullanıcı yüklemeden önce gözden geçirir. Ana yemek dönüşümü, antrenman ve
   telafi kuralları üretilmez (onlar diyetisyenin ayarı). sugg: programda olmayan, uygulamanın önerdiği muadiller. */
const SETUPKEY = 'diyet-setup';
let PB = null;   /* { pics: [{ img, full }], text, busy, err } */
const setupDone = () => { try { localStorage.setItem(SETUPKEY, today); } catch (e) {} };
/* Yeni kişi (karşılamayı görmüş, kendi programı yok): varsayılan program başkasının gerçek programıdır, gösterilmez;
   bütün sekmelerde "Programını ekle" ekranı durur. Örnek programı kendisi seçtiyse (NEWKEY = 'demo') program görünür,
   Bugün'ün başında örnek olduğunu söyleyen satırla. Karşılamayı hiç görmemiş eski kullanıcıda ikisi de görünmez. */
const NEWKEY = 'diyet-new';
const newState = () => { if (PLAN_CUSTOM) return ''; try { return localStorage.getItem(NEWKEY) || (localStorage.getItem(SETUPKEY) ? 'demo' : ''); } catch (e) { return ''; } };
const blank = () => !!newState() && newState() !== 'demo', sample = () => newState() === 'demo';
function blankView() {
  return `<header class="head"><div><p>${fmtLong(today)}</p><h1>Hoş geldin</h1></div></header>
    <section class="card blank"><span class="bic">${ic('list')}</span><h2>Programını ekle</h2>
      <p>Öğünlerin, saatlerin ve muadillerin diyetisyeninin programından gelir. Yüklediğinde burada görünür.</p>
      <button class="primary" data-act="setup">${ic('cam')}Programını ekle</button><button class="textbtn" data-act="welcome" data-w="demo">Örnek programla bak</button></section>`;
}
/* İlk açılış: kayıt da yüklenmiş program da yoksa nasıl başlanacağı sorulur. */
function welcomeSheet() {
  sheet = 'welcome'; setupDone();
  try { if (!PLAN_CUSTOM && !localStorage.getItem(NEWKEY)) { localStorage.setItem(NEWKEY, 'new'); render(); } } catch (e) {}
  const o = (w, icn, n, m) => `<button class="nav-row" data-act="welcome" data-w="${w}"><span class="ic">${ic(icn)}</span><span class="b"><span class="n">${n}</span><span class="m">${m}</span></span>${ic('right')}</button>`;
  showSheet(`<h2>Hoş geldin</h2><p class="lead">Önce diyetisyeninin programını ekleyelim. Öğünlerin, saatlerin ve muadillerin buradan gelir.</p>
    <div class="group">${o('link', 'link', 'Diyetisyenim bağlantı gönderdi', 'Bağlantıyı yapıştır, program hazır gelir')}${o('photo', 'cam', 'Kâğıttaki programımı aktar', 'Sayfaları çek ya da galeriden seç')}${o('demo', 'list', 'Örnek programla bak', 'Sonra Program sekmesinden değiştirebilirsin')}</div>`);
}
const pbSync = () => { const t = document.getElementById('pbtx'); if (t && PB) PB.text = t.value; };
/* Aktarım yarıda kalırsa kaldığı yerden sürer. iOS ana ekran uygulamasını bellek dolunca ya da arka planda kapatabiliyor;
   o zaman sayfa sessizce baştan açılırdı. diyet-pb = { at, st: 'pics' | 'busy' | 'done', text, plan, note }:
   fotoğraflar hazırlanıyor, program okunuyor ya da okundu, yüklenmeyi bekliyor. Fotoğraflar büyük olduğu için saklanmaz. */
const PBKEY = 'diyet-pb';
const pbMark = (st, x = {}) => { try { localStorage.setItem(PBKEY, JSON.stringify({ at: Date.now(), st, text: PB ? PB.text : '', ...x })); } catch (e) {} };
const pbClear = () => { try { localStorage.removeItem(PBKEY); } catch (e) {} };
function pbResume() {
  let o = null; try { o = JSON.parse(localStorage.getItem(PBKEY) || 'null'); } catch (e) {}
  if (!o) return; if (Date.now() - o.at > 3 * 864e5) return pbClear();
  PB = { pics: [], text: o.text || '' };
  if (o.st === 'done' && o.plan && !planCheck(o.plan)) { PL = { incoming: o.plan, built: true, note: o.note }; return planSheet(); }
  PB.err = o.st === 'pics' ? 'Fotoğraflar hazırlanırken uygulama kapandı. Yeniden seç; yine kapanırsa sayfaların ekran görüntüsünü alıp onları seç.'
    : 'Program okunurken uygulama kapandı. Fotoğrafları yeniden seçip dene; sonuç gelene kadar uygulamada kal.';
  pbClear(); buildSheet();
}
/* Fotoğraflar tek tek hazırlanır: iPhone fotoğrafları büyük, hepsini aynı anda açmak belleği doldurup uygulamayı kapatabiliyor. */
async function pbAdd(files) {
  pbSync(); PB.prep = files.length; PB.err = ''; pbMark('pics'); if (sheet === 'build') buildSheet();
  try { for (const f of files) { const full = await shrink(f, 1600), img = await thumb(full, 200); PB.pics.push({ img, full }); PB.prep--; if (sheet === 'build') { pbSync(); buildSheet(); } } }
  catch (x) { PB.err = x.message; }
  PB.prep = 0; pbClear(); if (sheet === 'build') { pbSync(); buildSheet(); }
}
function buildSheet() {
  sheet = 'build'; if (!PB) PB = { pics: [], text: '' };
  if (PB.busy) return showSheet(`<div class="busy"><div class="spin"></div>Programı okuyorum… Birkaç sayfa bir dakikayı bulabilir.<br>Bu sırada uygulamadan çıkma.</div>`);
  const prep = PB.prep || 0, room = 6 - PB.pics.length - prep;
  showSheet(`<h2>Programını aktar</h2><p class="lead">Diyetisyeninin verdiği programın her sayfasını çek ya da galeriden seç. Kâğıtta olmayanları ya da değişenleri altına yaz.</p>
    <div class="pages">${PB.pics.map((p, i) => `<button class="pg" data-act="pbx" data-i="${i}" aria-label="Sayfayı çıkar"><img src="${p.img}" alt=""><i>${ic('x')}</i></button>`).join('')}
      ${Array.from({ length: prep }, () => `<span class="pg add"><span class="spin"></span><small>Hazırlanıyor</small></span>`).join('')}
      ${room > 0 && !prep ? `<button class="pg add" data-act="pbadd" aria-label="Sayfa ekle">${ic('cam')}<small>${PB.pics.length ? 'Sayfa ekle' : 'Fotoğraf ekle'}</small></button>` : ''}</div>
    <textarea id="pbtx" placeholder="Ek açıklama (isteğe bağlı) · örn. kahvaltı 09:00, öğle 13:00; hafta sonu bir saat geç. Hedefim 80 kg. Ara öğünde muz yemiyorum.">${esc(PB.text)}</textarea>
    ${PB.err ? `<p class="err">${esc(PB.err)}</p>` : ''}${aiCode() && PB.err ? `<button class="textbtn" data-act="pbcode">Davet kodunu değiştir</button>` : ''}
    <button class="primary" data-act="pbgo" ${!prep && (PB.pics.length || PB.text.trim()) ? '' : 'disabled'}>${ic('check')}Programı oluştur</button>
    <p class="note" style="padding-top:12px;text-align:center">Yapay zekâ okur; yüklemeden önce sonucu kontrol edersin. Kalori ve protein değerleri tahmindir.</p>`);
}
const PB_DISH = { type: 'object', additionalProperties: false, required: ['name', 'chip', 'meta', 'subs', 'kcal', 'protein'], properties: {
  name: { type: 'string' }, chip: { type: 'string' }, meta: { type: 'string' }, subs: { type: 'array', items: { type: 'string' } }, kcal: { type: 'number' }, protein: { type: 'number' } } };
const PB_SCHEMA = { type: 'object', additionalProperties: false, required: ['dietitian', 'cycle', 'day1', 'meals', 'rules', 'swaps', 'recipes', 'body', 'goal', 'water', 'note'], properties: {
  dietitian: { type: 'string' }, cycle: { type: 'integer' }, day1: { type: 'string', enum: ['', ...DAYNAME] },
  meals: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'time', 'wknd', 'dayTimes', 'items', 'mains', 'mainDays'], properties: {
    title: { type: 'string' }, time: { type: 'string' }, wknd: { type: 'string' },
    dayTimes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['days', 'time'], properties: { days: { type: 'array', items: { type: 'integer' } }, time: { type: 'string' } } } },
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'chip', 'opts', 'subs', 'sugg', 'meta', 'kcal', 'protein', 'optional', 'whole', 'days'], properties: {
      whole: { type: 'boolean' }, days: { type: 'array', items: { type: 'integer' } },
      name: { type: 'string' }, chip: { type: 'string' }, opts: { type: 'array', items: { type: 'string' } }, subs: { type: 'array', items: { type: 'string' } },
      sugg: { type: 'array', items: { type: 'string' } }, meta: { type: 'string' }, kcal: { type: 'number' }, protein: { type: 'number' }, optional: { type: 'boolean' } } } },
    mains: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'perWeek', 'dishes', 'skip'], properties: {
      name: { type: 'string' }, perWeek: { type: 'integer' }, dishes: { type: 'array', items: PB_DISH }, skip: { type: 'array', items: { type: 'integer' } } } } },
    mainDays: { type: 'array', items: { type: 'integer' } } } } },
  rules: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'note'], properties: { text: { type: 'string' }, note: { type: 'string' } } } },
  swaps: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['from', 'to'], properties: { from: { type: 'string' }, to: { type: 'string' } } } },
  recipes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'kcal', 'serving', 'ingredients', 'steps'], properties: {
    name: { type: 'string' }, kcal: { type: 'number' }, serving: { type: 'string' }, ingredients: { type: 'array', items: { type: 'string' } }, steps: { type: 'string' } } } },
  body: { type: 'object', additionalProperties: false, required: ['date', 'rows'], properties: { date: { type: 'string' },
    rows: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'value'], properties: { label: { type: 'string' }, value: { type: 'string' } } } } } },
  goal: { type: 'object', additionalProperties: false, required: ['kg', 'text'], properties: { kg: { type: 'number' }, text: { type: 'string' } } },
  water: { type: 'number' }, note: { type: 'string' } } };
const PB_SYSTEM = `Bir diyet takip uygulamasına diyetisyen programı aktarılıyor. Programın sayfalarının fotoğrafları ve/veya kullanıcının açıklaması verilir. Programı uygulamanın biçimine çıkar. Programda olmayan öğün ya da yiyecek uydurma. Kullanıcının açıklaması programla çelişirse açıklamayı esas al.

Diyetisyen programları çoğu zaman düzensiz yazılır: notlar öğünlerin arasına, seçenekler cümlelerin içine, saatler sayfanın sonuna dağılır. Hepsini okuyup her bilgiyi aşağıdaki yerlerden birine koy; hiçbirini kaybetme, hiçbirini iki kez yazma.

Ana yemek (en önemli kural):
- Öğle ya da akşamda "Haftada 2 gün …", "Haftada 1 gün …" gibi satırlar varsa bunlar o öğünün haftalık dönen ana yemekleridir: her gün bu satırlardan YALNIZCA BİRİ yenir. Bunları asla öğünün ayrı kalemleri yapma; mains'e yaz.
- mains: her "Haftada N gün" satırı bir grup. perWeek N. name grubun 2-4 kelimelik adı ("Nohut / lor salatası", "Musakka / köfte", "Sote / balık"). dishes o satırda "veya" ile verilen yemekler; her biri ayrı, miktarıyla ("8 yk patlıcan musakka", "4 ızgara köfte", "250 g ızgara balık"), kendi kcal ve protein'iyle. Yemeğin pişirme seçenekleri ("ızgara/buğulama/fırında") meta'ya.
- Grupların yanındaki eşlik edenler ("+ 6 yk yoğurt (1 çk keten tohumu) + 2 dilim tam buğday ekmeği + bol salata") öğünün items'ına bir kez yazılır. Bir eşlik eden bazı gruplarda yoksa (ör. bol salata yalnızca iki grupta yazıyorsa) skip, o grupta olmayan items sıralarını verir (0'dan sayılır). Hepsinde varsa skip boş.
- Öğle ve akşamda aynı gruplar yazıyorsa ikisine de aynısını yaz. "Haftada N gün" yoksa mains boş.
- mainDays: ana yemeğin olduğu program günleri (aşağıdaki hafif günler dışındakiler). Her gün varsa ya da mains boşsa boş.

Haftanın bazı günleri farklıysa:
- Programın bir bölümü haftanın belli günlerinde uygulanıyorsa ("son 2 gün (Çarşamba-Perşembe) veya istediğimiz 2 gün", "hafif günler"), cycle 7 ve day1 "Pazartesi" olur; program günleri 1 Pazartesi … 7 Pazar. O bölümün kalemleri days ile o günlere ([3, 4] Çarşamba-Perşembe), asıl programın kalemleri kalan günlere ([1, 2, 5, 6, 7]) yazılır. Aynı adlı öğünleri birleştir: o günlerin Kahvaltı'sı asıl Kahvaltı öğününe days ile girer, ayrı öğün açılmaz. Gün adı verilmemişse son günleri kullan ve note'ta söyle.
- dayTimes: öğünün saati o günlerde farklıysa ({days: [3, 4], time: "18:00"}); yoksa boş.
- "1. gün, 2. gün…" sütunları ya da Pazartesi, Salı… başlıkları olan gün gün değişen programda cycle toplam gün sayısı (ör. 7); bir sütun birden çok gün içeriyorsa ("1. GÜN 2. GÜN") o günlerin hepsini say. Program her gün aynıysa cycle 1, days ve mainDays boş.
- day1: programın 1. günü haftanın hangi gününe denk geliyor; sayfada el yazısıyla ya da başlıkta yazıyorsa ("Cumartesi-Pazar" 1-2. günün üstünde ise Cumartesi), ya da açıklamada söylendiyse. Gün adları Türkçe ve büyük harfle başlar ("Cumartesi"). Bilinmiyorsa boş.

Öğünler ve kalemler:
- meals: öğünler günün sırasıyla. title kısa ve Türkçe ("Uyanınca", "Kahvaltı", "Ara öğün", "Öğle", "İkindi", "Akşam", "Gece"); aynı adı iki kez kullanma. Sabah uyanınca içilen limonlu su gibi bir adım saatsiz "Uyanınca" öğünüdür.
- time hafta içi saati "SS:DD", aralık verilmişse başlangıcı. El yazısıyla düzeltilmiş saat basılı saatin yerine geçer. Saat yoksa açıklamadan al, o da yoksa öğünün olağan saatini tahmin et; yalnızca "Uyanınca" gibi tek kalemli adımın time'ı boş olabilir.
- wknd hafta sonu saati; programda hafta sonu saatleri ayrıca yazıyorsa oradan, yoksa time ile aynı. Hafta sonu saat listesinde programda kalemi olmayan bir öğün geçiyorsa (ör. "ara öğün 12.00") o öğünü ekleme.
- items: öğündeki her ayrı yiyecek bir kalem. Gün gün değişen programda öğünün bütün günlerdeki kalemlerini ver; aynı kalem birden çok günde aynıysa bir kez yaz.
- days: kalemin yer aldığı program günleri (1'den başlar; ör. [1, 2] ya da [3]). Her gün geçerliyse ya da cycle 1 ise boş.
- name programda yazdığı gibi miktarıyla başlasın ("2 dilim tam buğday ekmeği (50 g)", "6 yk yoğurt", "20 g çiğ kabak çekirdeği").
- opts: programda "veya / ya da" ile verilen eşdeğer seçenekler, programın yazdığı sırayla, her biri miktarıyla. Seçenek varsa name grubun kısa adı olsun ("Peynir"); yoksa opts boş. Öğündeki kalemlerin hepsinin birden yerine geçen bir seçenek ("VEYA 1 tane protein bar") ayrı bir kalem olur ve whole true; diğer kalemlerde whole false.
- subs: programın başka bir yerinde verilen alternatifler: "yerine", "muadil", "değişim", "tüketebiliriz" diyen notlar ("2 dilim ekmek yerine 4 yk bulgur pilavı" → ekmek kaleminin subs'u, her öğünde). Miktarıyla. Yoksa boş.
- meta: kalemin yanındaki kısa not ("tuzsuz", "yağsız", "1 çk keten tohumu ile"). Bir seçenek başka bir kalemin hakkını kullanıyorsa (ör. "yağla omlet ya da menemen yaparsak zeytin hakkını kullanmayız") bunu iki kalemin meta'sına da kısaca yaz ("yağlı omlet/menemende zeytin yok"). Yoksa boş.
- sugg: kalemde programın verdiği hiçbir alternatif yoksa ve kalem yaygın bir besin grubundansa (ekmek ve tahıl, et-tavuk-balık-yumurta, peynir, süt ve yoğurt, meyve, yağlı tohum) aynı gruptan 2-4 yaygın yaklaşık eşdeğer, miktarıyla. Programda yazanı buraya koyma; emin değilsen boş bırak.
- chip: 1-2 kelimelik kısa ad ("Ekmek", "Yumurta").
- kcal ve protein: bir porsiyon için Türkiye'deki tipik ürünlere göre gerçekçi tahmin; opts varsa ilk seçeneğin değeri. Tarif sayfasında kalori yazıyorsa onu kullan.
- optional: programda isteğe bağlı denmişse ya da kalorisiz içecekse (şekersiz çay, sade kahve, su) true.

Diğerleri:
- rules: programdaki genel kurallar ve notlar (çay, kahve, su, ara öğün, tartılma, yürüyüş, öğle-akşam yer değiştirme, detoks suyu tarifi…); text kısa kural, note açıklaması ya da boş. Bir kalemin subs'una ya da meta'sına yazdığın notu burada da kısaca tut.
- swaps: programda ayrı bir değişim ya da muadil tablosu varsa satırları (from → to); yoksa boş.
- recipes: tarif sayfaları. name, kcal (yazıyorsa, yoksa 0), serving (bir öğünlük miktar, ör. "8 yemek kaşığı"), ingredients miktarlarıyla, steps yapılışı düz metin. Tarif yoksa boş.
- body: tartı ya da vücut analizi sayfası varsa ölçüm tarihi "YYYY-AA-GG" ve başlıca değerler (Kilo, Boy, BMI, Yağ oranı ve kg, Kas, Yağsız kütle, Sıvı, İç yağlanma, Bazal metabolizma, Metabolik yaş, Bel, Fit puanı), label Türkçe, value birimiyle ("82,3 kg", "%14,1 · 11,6 kg"). Yoksa tarih boş, rows boş. Bu sayfadaki hiçbir şeyi öğün yapma.
- goal: hedef kilo yazıyorsa kg, yoksa 0; text kısa hedef cümlesi ya da boş.
- water: günlük su hedefi, 250 ml bardak olarak; litre aralığı verilmişse üst sınır (2-2,5 litre → 10); yoksa 10.
- dietitian: diyetisyenin adı yazıyorsa; yoksa boş.
- note: okunamayan, emin olmadığın ya da tahmin ettiğin önemli bir şey varsa bir-iki cümleyle; yoksa boş.`;
/* Yapay zekânın çıktısını plan biçimine çevirir; kimlikler addan türetilir. */
function toPlan(R) {
  const used = new Set(['ana', 'yat', 'gym']), uid = (s, pre) => { const b = fold(s).replace(/ /g, '-').slice(0, 18) || pre; let x = b, i = 2; while (used.has(x)) x = b + '-' + i++; used.add(x); return x; };
  const items = {}, meals = [], mains = [], groups = {}, sigs = {}; let prev = '';
  /* Döngü: verilen gün sayısı; verilmemiş ama kalemlerde gün varsa haftalık (7) sayılır. */
  const maxd = Math.max(0, ...R.meals.flatMap(m => [...m.items.flatMap(x => x.days), ...(m.mainDays || [])]));
  const n = Math.round(R.cycle) >= 2 && Math.round(R.cycle) <= 14 ? Math.round(R.cycle) : maxd >= 2 && maxd <= 14 ? Math.max(7, maxd) : 1;
  const inDay = (days, i) => !days || !days.length || days.includes(i + 1);
  const val = (x, f) => Math.max(0, f(x) || 0);
  R.meals.forEach(m => { m.mains = (m.mains || []).filter(G => G.dishes.length); });
  R.meals.filter(m => m.items.length || m.mains.length).forEach((m, mi) => {
    let time = isHM(m.time) ? m.time : '';
    /* Saatsiz çok kalemli öğün zaman çizelgesinde düzgün çalışmaz: öncekinin 2,5 saat sonrasına yerleşir. */
    if (!time && (m.items.length > 1 || m.mains.length || mi > 0)) { const t = prev ? hm(prev) + 150 : 8 * 60; time = `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; }
    if (time) prev = time;
    const ids = m.items.map(x => { const id = uid(x.chip || x.name, 'kalem'), opts = x.opts.filter(Boolean);
      items[id] = { k: val(x.kcal, Math.round), p: val(x.protein, r1), name: x.name.trim(), ...(x.chip ? { chip: x.chip } : {}), ...(opts.length > 1 ? { opts } : {}),
        ...(x.meta ? { meta: x.meta } : {}), ...(x.subs.length ? { subs: x.subs } : {}), ...(x.sugg.length ? { sugg: x.sugg } : {}), ...(x.optional ? { optional: true } : {}) };
      return id; });
    /* "Haftada N gün" satırları: ana yemek grupları. Öğle ve akşamda aynı grup bir kez tanımlanır, kotası her öğün için ayrı sayılır. */
    m.mains.forEach(G => {
      const drop = G.skip.filter(j => ids[j]).map(j => ids[j]), sig = fold(G.dishes.map(d => d.name).join('|'));
      if (sigs[sig]) return mains.filter(x => x.g === sigs[sig]).forEach(x => { x.drop = [...new Set([...(x.drop || []), ...drop])]; if (!x.drop.length) delete x.drop; });
      const g = sigs[sig] = uid(G.name || G.dishes[0].name, 'grup');
      groups[g] = { name: (G.name || G.dishes.map(d => d.chip || d.name).join(' / ')).trim(), perWeek: Math.min(7, Math.max(1, Math.round(G.perWeek) || 1)) };
      G.dishes.forEach(D => mains.push({ id: uid(D.chip || D.name, 'yemek'), g, k: val(D.kcal, Math.round), p: val(D.protein, r1), name: D.name.trim(), chip: D.chip || D.name,
        ...(D.meta ? { meta: D.meta } : {}), ...(D.subs.length ? { subs: D.subs } : {}), ...(drop.length ? { drop } : {}) }));
    });
    const main = m.mains.length > 0;
    const days = n > 1 ? Array.from({ length: n }, (_, i) => [...(main && inDay(m.mainDays, i) ? ['ana'] : []), ...ids.filter((_, j) => inDay(m.items[j].days, i))]) : null;
    const dtime = n > 1 && time ? Array.from({ length: n }, (_, i) => { const t = (m.dayTimes || []).find(x => x.days.includes(i + 1) && isHM(x.time) && x.time !== time); return t ? t.time : ''; }) : null;
    /* Bütün öğünün yerine geçen seçenek (ör. galeta + meyve yerine protein bar): öğünün ikinci biçimi. */
    const whole = ids.filter((_, j) => m.items[j].whole), rest = j => !m.items[j].whole, chips = L => L.map(id => items[id].chip || items[id].name).join(' + ');
    const mode = whole.length && whole.length < ids.length && !main ? { modes: [chips(ids.filter((id, j) => rest(j) && !items[id].optional && inDay(m.items[j].days, 0))), chips(whole)], alt: whole } : null;
    const keep = j => !mode || rest(j);
    if (days) days.forEach((L, i) => { days[i] = L.filter(id => id === 'ana' || keep(ids.indexOf(id))); });
    meals.push({ id: uid(m.title, 'ogun'), title: m.title.trim(), ...(time ? { time, wknd: isHM(m.wknd) ? m.wknd : time } : {}), ...(main ? { main: true } : {}), ...(mode || {}),
      items: ids.filter((_, j) => keep(j) && (!days || inDay(m.items[j].days, 0))), _d: days, _t: dtime });
  });
  /* Günler arasında fark varsa döngü kurulur; 1. gün, verilen haftanın gününe denk gelen en yakın geçmiş tarih. */
  const differs = meals.some(m => (m._d && m._d.some(d => d.join() !== m._d[0].join())) || (m._t && m._t.some(Boolean)));
  const cyc = differs ? { n, start: R.day1 ? addDays(today, -((parse(today).getDay() - DAYNAME.indexOf(R.day1) + 7) % 7)) : today } : null;
  meals.forEach(m => { if (cyc) { m.days = m._d; m.items = m._d[0].filter(id => id !== 'ana'); if (m._t && m._t.some(Boolean)) m.dtime = m._t; } delete m._d; delete m._t; });
  /* Haftalık dağılım: gruplar sırayla dönüşümlü dizilir, ikinci ana öğün bir adım kaydırılır (aynı gün aynı grup gelmesin).
     Ana yemeksiz günler (hafif günler) atlanır; kesin dağılımı uygulama kalan kotaya göre her hafta yeniden yapar. */
  const rota = {}, gs = Object.keys(groups), seq = [], left = Object.fromEntries(gs.map(g => [g, groups[g].perWeek]));
  while (gs.some(g => left[g] > 0)) gs.forEach(g => { if (left[g] > 0) { seq.push(g); left[g]--; } });
  const firstOf = g => mains.find(x => x.g === g).id, wk = weekOf(today);
  meals.filter(m => m.main).forEach((m, j) => { let c = j;
    rota[m.id] = wk.map(k => { const on = !m.days || m.days[((dayDiff(cyc.start, k) % n) + n) % n].includes('ana'); return firstOf(seq[(on ? c++ : 0) % seq.length]); }); });
  const bd = /^\d{4}-\d\d-\d\d$/.test(R.body.date) ? R.body.date : today, rows = R.body.rows.filter(r => r.label && r.value).map(r => [r.label.trim(), r.value.trim()]);
  const fat = (rows.find(r => /yağ/i.test(r[0]) && /%/.test(r[1])) || [])[1];
  return { v: 1, id: 'plan-' + today, date: today, src: 'foto', dietitian: { name: R.dietitian || '', phone: '' }, prefs: { kcal: true, tune: false }, client: { name: '' },
    goal: { kg: R.goal.kg > 30 ? R.goal.kg : 0, text: R.goal.text || '' }, items, mains, groups, rota, meals,
    ...(cyc ? { cycle: cyc } : {}), rules: R.rules.map(r => [r.text, r.note]), swaps: R.swaps.map(s => [s.from, s.to]),
    recipes: R.recipes.filter(r => r.name && (r.ingredients.length || r.steps)).map(r => ({ name: r.name.trim(), k: Math.max(0, Math.round(r.kcal) || 0), serve: r.serving || '', ings: r.ingredients, steps: r.steps || '' })),
    body: { date: bd, fat: fat ? (fat.match(/%\s?[\d,.]+/) || [''])[0].replace(/\s/g, '') : '', rows },
    daily: { water: { goal: Math.round(R.water) > 0 ? Math.round(R.water) : 10, ml: 250 }, coffee: { max: 2, note: '' }, walk: { perWeek: 0, name: 'Yürüyüş' } },
    training: { perWeek: 0, time: '', after: '', lead: '', notes: {}, days: {} }, tune: { protein: [], cuts: [] } };
}
async function buildAI() {
  PB.busy = true; PB.err = ''; buildSheet(); pbMark('busy');
  /* Beklerken ekran kilitlenirse iOS isteği keser; ekran açık tutulur. */
  let wake = null; try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) {}
  const content = PB.pics.map(p => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.full } }));
  content.push({ type: 'text', text: (PB.pics.length ? `Programın ${PB.pics.length} sayfası yukarıda.` : 'Fotoğraf yok; program yalnızca açıklamada.') + (PB.text.trim() ? `\n\nKullanıcının açıklaması:\n${PB.text.trim()}` : '') });
  try {
    const R = await aiJSON({ model: AI_MODEL, max_tokens: 16000, system: PB_SYSTEM, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: PB_SCHEMA } } }, 'Program okunamadı.');
    const p = toPlan(R), err = planCheck(p); if (err) throw new Error(err + ' Sayfaları daha net çekip yeniden dene.');
    PB.busy = false; PL = { incoming: p, built: true, note: R.note }; pbMark('done', { plan: p, note: R.note }); planSheet();
  } catch (e) { PB.busy = false; pbClear();
    PB.err = /load failed|failed to fetch|network/i.test(e.message || '') ? 'Bağlantı kesildi. İnternet açıkken yeniden dene ve sonuç gelene kadar uygulamada kal.' : e.message || 'Bağlantı kurulamadı.';
    buildSheet(); }   /* sayfa kapatıldıysa da hata görünsün */
  finally { if (wake) wake.release().catch(() => {}); }
}

/* ---------- Haftalık rapor ----------
   Diyetisyenin haftalık kontrolü için, kâğıt takip tablolarının yerine. Yerelde üretilir (yapay zekâ yok);
   WhatsApp biçimiyle (*kalın*) düz metin. Telefon numarası varsa doğrudan diyetisyenin sohbetine açılır. */
const fmtNum1 = n => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
function weekReport(k0) {
  const wk = weekOf(k0), past = wk.filter(k => k <= today), fmtD = k => parse(k).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  const L = [`*Haftalık rapor · ${fmtD(wk[0])} – ${fmtD(wk[6])}*`];
  if (PLAN.client && PLAN.client.name) L.push(PLAN.client.name);
  const rec = k => { const d = peek(k); return Object.keys(d.items).length || (d.extras || []).length || d.water || d.gym || d.walk; };
  const logged = past.filter(rec), stats = logged.map(dayScore).filter(Boolean);
  /* Kilo: haftanın ilk ve son tartısı */
  const ws = [...S.weights].filter(w => wk.includes(w.d)).sort((a, b) => a.d < b.d ? -1 : 1);
  const before = [...S.weights].filter(w => w.d < wk[0]).sort((a, b) => a.d < b.d ? -1 : 1).pop();
  const w0 = ws[0] || before, w1 = ws[ws.length - 1];
  L.push('');
  if (w1) L.push(`*Kilo:* ${w0 && w0 !== w1 ? `${fmtNum1(w0.kg)} → ${fmtNum1(w1.kg)} kg (${w1.kg - w0.kg > 0 ? '+' : '−'}${fmtNum1(Math.abs(w1.kg - w0.kg))})` : fmtNum1(w1.kg) + ' kg'}`);
  else if (before) L.push(`*Kilo:* bu hafta tartı yok (son: ${fmtNum1(before.kg)} kg, ${fmtD(before.d)})`);
  L.push(`*Kayıtlı gün:* ${logged.length} / ${past.length}`);
  if (stats.length) L.push(`*Öğünlere uyum:* %${Math.round(stats.reduce((a, s) => a + s.pct, 0) / stats.length)}`);
  const full = logged.map(balance).filter(b => b.any && !b.open.length);
  /* Tamamlanmış günlerin ortalaması; plan değeri de aynı günlerin ortalaması (ana yemeğe göre gün gün değişir). */
  const av = f => num(full.reduce((a, b) => a + f(b), 0) / full.length);
  if (full.length) L.push(KC ? `*Ortalama:* ${av(b => b.ek)} kcal (plan ${av(b => b.tk)}) · ${av(b => b.ep)} g protein (plan ${av(b => b.tp)})`
    : `*Ortalama protein:* ${av(b => b.ep)} g (plan ${av(b => b.tp)})`);
  const waters = past.map(k => peek(k).water).filter(Boolean);
  if (waters.length) L.push(`*Su:* günde ortalama ${fmtNum1(waters.reduce((a, b) => a + b, 0) / waters.length * WATER_ML / 1000)} L (hedef ${WATER_L} L)`);
  const gyms = wk.filter(k => peek(k).gym).length, walks = wk.filter(k => peek(k).walk).length;
  L.push(`*Antrenman:* ${gyms} / ${GYM_GOAL} · *Yürüyüş:* ${walks} / ${WALK_GOAL}`);
  const cof = past.map(k => peek(k).coffee).filter(Boolean); if (cof.some(c => c > COFFEE_MAX)) L.push(`*Kahve:* ${cof.filter(c => c > COFFEE_MAX).length} gün sınırın üstünde`);
  if (SUPS().length && logged.length) L.push(`*Takviye:* ${SUPS().map(s => `${s.n} ${logged.filter(k => supTaken(k, s.id)).length}/${logged.length}`).join(' · ')}`);
  /* Günler: yalnızca plandan farklı olanlar yazılır, gerisi "plana uygun". */
  L.push('', '*Günler*');
  past.forEach(k => {
    const d = peek(k), notes = [];
    if (!rec(k)) { L.push(`${DOW[parse(k).getDay()]} ${parse(k).getDate()}: kayıt yok`); return; }
    MEALS.filter(m => m.time).forEach(m => {
      const st = mealStat(m, k), ex = (d.extras || []).filter(e => e.meal === m.id && !e.adj), names = ex.map(e => e.name + (e.pl ? ' (planlandı)' : '')).join(', ');
      const sw = itemsOf(m, k).map(it => stOf(d, m, it)).filter(s => s && s.s === 'swap').map(s => s.sub);
      /* Porsiyonu değişen kalemler: "Ekmek 1 dilim (plan 2 dilim)". */
      const pq = itemsOf(m, k).map(it => [it, stOf(d, m, it)]).filter(([, s]) => s && s.s === 'done' && s.q && s.q !== 1)
        .map(([it, s]) => { const v = itemView(it, s), p = itemView(it, null); return `${short(it)} ${v.amt || ''} (plan ${p.amt || '1 porsiyon'})`; });
      if (st.resolved && st.skip === st.total) notes.push(ex.length ? `${m.title} yerine ${names}` : `${m.title} atlandı`);
      else { if (st.skip && st.skip < st.total) notes.push(`${m.title}: ${st.skip} kalem atlandı`); if (ex.length) notes.push(`${m.title}: +${names}`); }
      if (sw.length) notes.push(`${m.title}: ${sw.join(', ')} (muadil)`);
      if (pq.length) notes.push(`${m.title}: ${pq.join(', ')}`);
      if ((d.notes || {})[m.id]) notes.push(`${m.title} notu: "${d.notes[m.id]}"`);
      if (!st.resolved && k < today && st.ok + st.skip === 0 && !ex.length) notes.push(`${m.title} işaretlenmemiş`);
    });
    L.push(`${DOW[parse(k).getDay()]} ${parse(k).getDate()}: ${notes.length ? notes.join(' · ') : 'plana uygun'}`);
  });
  L.push('', '_Diyet uygulamasından_');
  return L.join('\n');
}
/* ---------- Döküm ----------
   Seçilen günlerde ne yenip içildiğinin, kalem kalem dökümü. Yazdırılabilir sayfa olarak #print içine basılır ve
   tarayıcının yazdır penceresi açılır; oradan PDF kaydedilir ya da paylaşılır. Yerelde üretilir, yapay zekâ yok. */
let DK = null;   /* { a, b }: başlangıç ve bitiş günü */
const DK_MAX = 62;
const hasRec = k => { const d = S.days[k]; return !!d && (Object.keys(d.items || {}).length || (d.extras || []).length || d.water || d.coffee || d.gym || d.walk || Object.keys(d.supps || {}).length || S.weights.some(w => w.d === k)); };
const dkDays = () => { const out = []; for (let k = DK.a; k <= DK.b; k = addDays(k, 1)) out.push(k); return out; };
function dumpSheet() {
  sheet = 'dump';
  if (!DK) { const wk = weekOf(sel); DK = { a: wk[0], b: wk[6] < today ? wk[6] : today }; }
  const wk = weekOf(today), prev = weekOf(addDays(today, -7));
  const P = [['Bu hafta', wk[0], today], ['Geçen hafta', prev[0], prev[6]], ['Son 7 gün', addDays(today, -6), today], ['Son 14 gün', addDays(today, -13), today], ['Son 30 gün', addDays(today, -29), today]];
  const days = dkDays(), n = days.filter(hasRec).length;
  showSheet(`<h2>Döküm</h2><p class="lead">Seçtiğin günlerde ne yediğin, ne içtiğin, antrenmanın ve tartın; öğün öğün. PDF olarak kaydedip diyetisyenine gönder.</p>
    <div class="chips pick">${P.map(([t, a, b]) => `<button class="${DK.a === a && DK.b === b ? 'on' : ''}" data-act="dkp" data-a="${a}" data-b="${b}">${t}</button>`).join('')}</div>
    <div class="group form"><label class="fl"><span>Başlangıç</span><input id="dka" type="date" value="${DK.a}" max="${today}"></label>
      <label class="fl"><span>Bitiş</span><input id="dkb" type="date" value="${DK.b}" max="${today}"></label></div>
    <p class="note">${days.length} gün · ${n ? `${n} günde kayıt var` : 'bu aralıkta kayıt yok'}</p>
    <button class="primary" data-act="dkgo" ${n ? '' : 'disabled'}>${ic('doc')}PDF oluştur</button>
    <p class="note" style="padding-top:12px;text-align:center">Yazdır penceresi açılır. Bilgisayarda “PDF olarak kaydet”i seç; iPhone'da önizlemeye iki parmakla dokunup büyüt, sonra paylaş düğmesiyle gönder.</p>`);
}
/* Tarih alanları: aralık en çok DK_MAX gün, bitiş bugünden sonra olamaz. */
function dkSet(a, b) {
  if (!/^\d{4}-\d\d-\d\d$/.test(a) || !/^\d{4}-\d\d-\d\d$/.test(b)) return;
  if (b > today) b = today; if (a > b) [a, b] = [b, a];
  if (addDays(a, DK_MAX - 1) < b) a = addDays(b, -(DK_MAX - 1));
  DK = { a, b };
}
/* Bir kalemin dökümdeki satırı. */
function dumpItem(m, it, s, k) {
  const plan = viewText(it, null);
  if (!s) return it.optional ? '' : `<li class="un"><span>${esc(plan)}</span><em>işaretlenmedi</em></li>`;
  if (s.s === 'skip') return `<li class="sk"><span>${esc(plan)}</span><em>${s.pl ? 'yerine başka şey planlandı' : 'atlandı'}</em></li>`;
  const tag = s.s === 'swap' ? `${plan} yerine` : s.q && s.q !== 1 ? `planda ${itemView(it, null).amt || '1 porsiyon'}` : s.name ? 'azaltılmış porsiyon' : '';
  return `<li><span>${esc(viewText(it, s))}</span>${tag ? `<em>${esc(tag)}</em>` : ''}${KC && ateOf(it, s).k ? `<b>${num(ateOf(it, s).k)}</b>` : ''}</li>`;
}
function dumpDay(k) {
  const d = peek(k), B = balance(k), sc = dayScore(k), w = S.weights.find(x => x.d === k), W = WORKOUTS[parse(k).getDay()];
  const title = parse(k).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!hasRec(k)) return `<section class="pday empty"><h2>${title}</h2><p>Kayıt yok.</p></section>`;
  const sup = list => list.filter(s => supTaken(k, s.id)).map(s => s.n + (s.dose ? ' ' + s.dose : ''));
  const meals = MEALS.map(m => {
    const its = itemsOf(m, k), ex = (d.extras || []).filter(e => e.meal === m.id), st = mealStat(m, k), note = (d.notes || {})[m.id];
    const sp = sup(supList(m.id)), head = `<h3>${m.title}${m.time ? `<small>${timeOf(m, k)}</small>` : ''}</h3>`;
    let body;
    if (!st.ok && !st.skip && !ex.length) body = `<p class="un">İşaretlenmedi</p>`;
    else if (st.resolved && st.skip === st.total && !ex.length) body = `<p class="sk">Atlandı</p>`;
    else body = `<ul>${its.map(it => dumpItem(m, it, stOf(d, m, it), k)).join('')}${ex.map(e => `<li><span>${esc(e.name)}</span><em>${e.adj ? 'telafi' : e.pl ? 'planlandı, yenmedi' : 'plan dışı'}</em>${KC ? `<b>${num(e.k)}</b>` : ''}</li>`).join('')}</ul>`;
    return `<div class="pmeal">${head}${body}${sp.length ? `<p class="ps">Takviye: ${esc(sp.join(', '))}</p>` : ''}${note ? `<p class="pn">Not: ${esc(note)}</p>` : ''}</div>`;
  }).join('');
  const other = [...sup(supList('yat')), ...sup(SUPS().filter(s => isHM(anc(s)) || !anc(s)))];
  const facts = [[`Su`, `${fmtNum1(d.water * WATER_ML / 1000)} L (${d.water} bardak)`], d.coffee ? ['Kahve', `${d.coffee} fincan`] : null,
    W || d.gym ? ['Antrenman', d.gym ? `yapıldı${W ? ' · ' + W.name : ''}${d.z2 ? ' · sonrası kardiyo' : ''}` : `yapılmadı (${W.name} günü)`] : null,
    WALK_GOAL || d.walk ? ['Yürüyüş', d.walk ? 'yapıldı' : 'yapılmadı'] : null, w ? ['Tartı', fmtNum1(w.kg) + ' kg'] : null,
    other.length ? ['Takviye', other.join(', ')] : null].filter(Boolean);
  const sum = [sc ? `uyum %${sc.pct}` : '', KC ? `${num(B.ek)} / ${num(B.tk)} kcal` : '', `${num(B.ep)} / ${num(B.tp)} g protein`].filter(Boolean).join(' · ');
  return `<section class="pday"><h2>${title}<small>${sum}</small></h2>${meals}<dl>${facts.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('')}</dl></section>`;
}
function dumpHTML() {
  const days = dkDays(), rec = days.filter(hasRec), fmt = k => parse(k).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const rows = days.map(k => { if (!hasRec(k)) return `<tr class="un"><td>${DOW[parse(k).getDay()]} ${parse(k).getDate()}.${pad(parse(k).getMonth() + 1)}</td><td colspan="${KC ? 6 : 5}">kayıt yok</td></tr>`;
    const d = peek(k), B = balance(k), sc = dayScore(k), w = S.weights.find(x => x.d === k);
    return `<tr><td>${DOW[parse(k).getDay()]} ${parse(k).getDate()}.${pad(parse(k).getMonth() + 1)}</td><td>${sc ? '%' + sc.pct : '—'}</td>${KC ? `<td>${num(B.ek)}</td>` : ''}<td>${num(B.ep)} g</td><td>${fmtNum1(d.water * WATER_ML / 1000)} L</td><td>${d.gym ? 'var' : '—'}</td><td>${w ? fmtNum1(w.kg) : '—'}</td></tr>`; }).join('');
  const who = [PLAN.client && PLAN.client.name, PLAN.dietitian.name && 'Diyetisyen: ' + PLAN.dietitian.name].filter(Boolean).join(' · ');
  const B0 = balance(today);
  return `<div class="pd"><header><h1>Beslenme dökümü</h1><p>${fmt(DK.a)} – ${fmt(DK.b)} · ${rec.length} / ${days.length} gün kayıtlı${who ? ' · ' + esc(who) : ''}</p>
      <p>Günlük plan: ${KC ? `yaklaşık ${num(B0.tk)} kcal, ` : ''}${num(B0.tp)} g protein, ${WATER_L} L su${GYM_GOAL ? `, haftada ${GYM_GOAL} antrenman` : ''}.</p></header>
    <table><thead><tr><th>Gün</th><th>Uyum</th>${KC ? '<th>kcal</th>' : ''}<th>Protein</th><th>Su</th><th>Antr.</th><th>Kilo</th></tr></thead><tbody>${rows}</tbody></table>
    ${days.map(dumpDay).join('')}
    <footer>Diyet uygulamasından · ${fmt(today)}. Kalori ve protein değerleri yaklaşık tahminlerdir${KC ? '; satır sonundaki sayılar kcal' : ''}.</footer></div>`;
}
function dumpPrint() {
  const el = document.getElementById('print'); el.innerHTML = dumpHTML();
  const t = document.title, back = () => { document.title = t; window.removeEventListener('afterprint', back); };
  /* PDF'in dosya adı başlıktan gelir. */
  document.title = `Diyet dökümü ${parse(DK.a).getDate()} ${MON[parse(DK.a).getMonth()]} - ${parse(DK.b).getDate()} ${MON[parse(DK.b).getMonth()]}`;
  window.addEventListener('afterprint', back); setTimeout(back, 60000);
  window.print();
}

const waNum = t => { let x = String(t || '').replace(/\D/g, ''); if (x.startsWith('0')) x = '9' + x; if (x.length === 10 && x[0] === '5') x = '90' + x; return x.length >= 11 ? x : ''; };
function reportSheet() {
  sheet = 'report';
  const text = weekReport(sel), wa = waNum(PLAN.dietitian.phone), who = PLAN.dietitian.name || 'diyetisyenine';
  const html = esc(text).replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<i>$1</i>');
  showSheet(`<h2>Haftalık rapor</h2><p class="lead">Haftalık kontrolden önce ${esc(who)} gönder. Gönderilen, aşağıdaki metnin aynısı.</p>
    <div class="report">${html}</div>
    ${wa ? `<a class="primary" href="https://wa.me/${wa}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${ic('chat')}WhatsApp'ta gönder</a><button class="textbtn" data-act="repshare">Başka yolla paylaş</button>`
      : `<button class="primary" data-act="repshare">${ic('up')}Paylaş</button><p class="note" style="padding-top:10px;text-align:center">Diyetisyenin telefonu Program → Program bağlantısı bölümünde girilirse WhatsApp sohbeti doğrudan açılır.</p>`}`);
}

/* ---------- Kullanım sayacı ----------
   Her çağrının token kullanımı ay ay toplanır; maliyeti tahmin değil ölçümle konuşmak için. */
function track(model, u) {
  if (!u) return;
  try {
    const o = JSON.parse(localStorage.getItem(USEKEY) || '{}'), m = today.slice(0, 7), x = o[m] || (o[m] = { n: 0, usd: 0, in: 0, out: 0 });
    const [pi, po] = PRICE[model] || [0, 0], cw = u.cache_creation_input_tokens || 0, cr = u.cache_read_input_tokens || 0;
    x.n++; x.in += (u.input_tokens || 0) + cw + cr; x.out += u.output_tokens || 0;
    x.usd += ((u.input_tokens || 0) * pi + cw * pi * 1.25 + cr * pi * 0.1 + (u.output_tokens || 0) * po) / 1e6;
    localStorage.setItem(USEKEY, JSON.stringify(o));
  } catch (e) {}
}
function usageRows() {
  let x = null; try { x = JSON.parse(localStorage.getItem(USEKEY) || '{}')[today.slice(0, 7)]; } catch (e) {}
  if (!x || !x.n) return '';
  const usd = x.usd.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: x.usd < 1 ? 3 : 2 });
  return `<div class="sect">Bu ay</div><div class="group"><div class="kv"><span>İstek</span><span>${num(x.n)}</span></div><div class="kv"><span>Yaklaşık maliyet</span><span>${usd} $</span></div></div>`;
}

/* ---------- Asistan ----------
   Genel sohbet: Haiku, düşünme kapalı, akışla. Programın tamamı sistem isteminde (önbelleğe alınır);
   günün anlık durumu her soruyla birlikte <durum> içinde gider. Asistan alt çubukta bir sekmedir; sohbetler
   diyet-chats'te saklanır: [{ id, d: başladığı gün, u: son mesaj zamanı (ms), m: [{ role, content, show?, cut? }] }],
   en yeni önde, en çok 60. Eski tek günlük sohbet (diyet-chat) ilk açılışta buraya taşınır. CUR: açık sohbet, null ise yeni. */
const CHATSKEY = 'diyet-chats';
let CHATS = [], CUR = null, chatBusy = false, chatErr = '', chatAbort = null, chatScroll = false, chatDel = null;
const chatsSave = () => { try { localStorage.setItem(CHATSKEY, JSON.stringify(CHATS.slice(0, 60))); } catch (e) {} };
function chatsLoad() {
  try { CHATS = JSON.parse(localStorage.getItem(CHATSKEY) || '[]'); } catch (e) { CHATS = []; }
  try { const o = JSON.parse(localStorage.getItem(CHATKEY) || 'null');
    if (o && o.m && o.m.length) { CHATS.unshift({ id: 'c' + Date.now().toString(36), d: o.d || today, u: parse(o.d || today).getTime() + 12 * 36e5, m: o.m.filter(x => x.content) }); chatsSave(); }
    localStorage.removeItem(CHATKEY); } catch (e) {}
}
const curChat = () => CHATS.find(c => c.id === CUR) || null;
const chatTitle = c => { const q = c && c.m.find(m => m.role === 'user'); if (!q) return 'Yeni sohbet'; const t = q.show.replace(/\s+/g, ' ').trim(); return t.length > 42 ? t.slice(0, 40).trim() + '…' : t; };

const CHAT_SYSTEM = () => `Bu bir diyet takip uygulamasının içindeki asistansın. Kullanıcı, diyetisyeninin hazırladığı programı uyguluyor. Programın tamamı aşağıda JSON olarak var (k tahmini kcal, p tahmini protein gramı). Her mesajla birlikte <durum> içinde bugünün anlık kaydı gelir: saat, öğünlerin durumu, yenenler, kalan kalori ve protein, uygulamanın kendi hesapladığı telafiler.

Nasıl cevap verirsin:
- Türkçe, kısa ve doğrudan. Cevap telefonda okunacak; çoğu cevap 2-5 cümle. Liste gerekiyorsa satır başına "- " koy. Başlık, tablo, kalın yazı kullanma.
- Program diyetisyenindir. Kendiliğinden program değişikliği, öğün atlamayı ya da kaloriyi daha da kısmayı önerme. Sapmayı programın kendi muadilleriyle (swaps, kalemlerin subs alanı) ve uygulamanın telafi önerileriyle dengele. Programda karşılığı olmayan bir şey için yaklaşık bir öneri ver ve diyetisyenine danışmasını söyle.
${KC ? `- Kalori ve protein söylerken <durum>daki değerleri kullan. Kendin tahmin ediyorsan "yaklaşık" de.` : `- Diyetisyen bu danışanın kalori sayılarını görmesini istemiyor. Kalori sayısı söyleme; porsiyon, öğün ve protein diliyle konuş. <durum>daki kalorileri yalnızca kendi muhakemen için kullan.`}
- Dışarıda yemek, davet, tatil gibi durumlarda suçlama yok. En iyi seçeneği söyle, günün kalanının nasıl dengeleneceğini anlat: tek bir öğün günü bozmaz, kalan öğünlere devam etmek önemli.
- Tıbbi bir şikâyet, ilaç, hastalık, hamilelik ya da yeme bozukluğu işareti varsa diyetisyenine veya doktoruna yönlendir.
- Uygulamada değişiklik yapmak için araçların var: takviyeler, öğün saatleri, su hedefi, görünüm${CYCLE ? ', döngünün hangi günde olduğu' : ''}, kalori görünürlüğü ve program kalemleri. Kullanıcı böyle bir değişiklik isterse "yetkim yok" deme, ilgili aracı çağır. Araç değişikliği hemen yapmaz: cevabının altında bir onay kartı çıkar, kullanıcı "Uygula"ya basarsa yapılır. Bu yüzden "yaptım" deme; tek cümleyle neyi önerdiğini söyle. Birden çok değişiklik varsa hepsini aynı cevapta çağır. Kimlikleri programdan ve <durum>dan al; belirsizse önce sor.
- Takviyeler, görünüm, öğün saatleri, su hedefi ve döngü günü kullanıcının kendi ayarıdır; istenince doğrudan öner. Yeni bir takviyeye başlıyorsa diyetisyenine haber vermesini bir cümleyle hatırlatabilirsin.
- Program kalemlerini eklemek, çıkarmak, miktarını ya da kalorisini değiştirmek ve kalori görünürlüğü diyetisyenin programına müdahaledir. Kullanıcı açıkça isterse aracı çağır ama cevabında bunun diyetisyenin planını değiştirdiğini ve ona danışmasının iyi olacağını kısaca söyle. Kaloriyi belirgin biçimde düşüren ya da proteini azaltan isteklerde açıkça uyar.
- Yenen bir şeyi kaydedemezsin. Kullanıcı bir şey yediğini söylerse uygulamada nasıl kaydedeceğini kısaca hatırlat: öğüne dokununca kalemler açılır; "Hepsini yedim" hepsini işaretler; satırın sağındaki miktar düğmesi porsiyonu değiştirir ve muadil seçtirir; kalem düğmesi yenen şeyi aratır ya da yazdırır; kamera fotoğraftan kaydeder. Plandan sapınca kalan öğünlere telafi satırları kendiliğinden eklenir.
- Programın yapısı: mains haftalık dönen ana yemeklerdir (g kota grubu; groups[g].perWeek haftada kaç gün). main true olan öğüne her gün bunlardan biri düşer; gün listelerinde (meals[].days) "ana" o gün ana yemeğin yeridir, olmadığı günde ana yemek yoktur. drop, o yemek seçilince öğünden çıkan kalemlerdir. dtime o güne özel öğün saatidir. recipes diyetisyenin tarifleridir.

Program:
${JSON.stringify(PLAN)}`;

/* ---------- Asistanın değişiklik araçları ----------
   Asistan bir değişiklik isteyince araç çağırır; araç hiçbir şeyi kendisi değiştirmez. Cevabın altında tek bir onay
   kartı çıkar, kullanıcı "Uygula"ya basınca hepsi birlikte uygulanır. Mesajda: acts = [{ name, input }],
   ast = 'done' | 'no' (yoksa bekliyor). Geçmiş API'ye düz metin olarak gider (araç blokları değil): her önerinin
   özeti ve sonucu cevabın sonuna eklenir; böylece eski sohbetler araç eşleşmesi gerektirmez.
   Program kalemleri diyetisyenin içeriğidir: kart uyarı taşır. Program değişikliği diyet-plan'a yazılır ve sayfa
   yeniden yüklenir (sohbet sekmesine dönülür). */
const ZAMAN = 'Ne zaman: öğün kimliği (o öğünden sonra), "yat" (yatmadan önce), "SS:DD" (belirli saat) ya da "" (saat önemsiz).';
const TOOLS = () => [
  { name: 'takviye', description: 'Kullanıcının kendi takviye listesine takviye ekler, düzenler ya da siler. Takviyeler programın parçası değildir. Her takviye için ayrı çağır.',
    input_schema: { type: 'object', properties: { islem: { type: 'string', enum: ['ekle', 'duzenle', 'sil'] },
      kimlik: { type: 'string', description: 'Düzenle ve silde mevcut takviyenin kimliği (<durum>daki takviye listesinde).' },
      ad: { type: 'string', description: 'Örn. Omega 3' }, miktar: { type: 'string', description: 'Örn. 1 kapsül, 3 damla' },
      zaman: { type: 'string', description: ZAMAN } }, required: ['islem'] } },
  ...(CYCLE ? [{ name: 'dongu_gunu', description: `Programın gün döngüsünü kaydırır: bugünün programın kaçıncı günü olduğunu belirler (1-${CYCLE.n}).`,
    input_schema: { type: 'object', properties: { bugun: { type: 'integer', description: 'Bugün programın kaçıncı günü' } }, required: ['bugun'] } }] : []),
  { name: 'ogun_saati', description: 'Bir öğünün saatini değiştirir.',
    input_schema: { type: 'object', properties: { ogun: { type: 'string', description: 'Öğün kimliği' }, saat: { type: 'string', description: 'Hafta içi saati, SS:DD' },
      hafta_sonu: { type: 'string', description: 'Hafta sonu saati, SS:DD; verilmezse ve önceden aynıysa hafta içiyle aynı olur' } }, required: ['ogun', 'saat'] } },
  { name: 'su_hedefi', description: 'Günlük su hedefini bardak olarak değiştirir.',
    input_schema: { type: 'object', properties: { bardak: { type: 'integer' } }, required: ['bardak'] } },
  { name: 'gorunum', description: 'Uygulamanın temasını değiştirir.',
    input_schema: { type: 'object', properties: { tema: { type: 'string', enum: ['acik', 'koyu', 'sistem'] } }, required: ['tema'] } },
  { name: 'kalori_gorunumu', description: 'Kalori sayılarının uygulamada görünüp görünmeyeceği (diyetisyen ayarı).',
    input_schema: { type: 'object', properties: { goster: { type: 'boolean' } }, required: ['goster'] } },
  { name: 'program_kalemi', description: 'Diyetisyenin programındaki bir kalemi ekler, çıkarır ya da değiştirir. Diyetisyenin programına müdahaledir; yalnızca kullanıcı açıkça isterse kullan.',
    input_schema: { type: 'object', properties: { islem: { type: 'string', enum: ['ekle', 'cikar', 'degistir'] },
      ogun: { type: 'string', description: 'Ekle ve çıkarda öğün kimliği' },
      kalem: { type: 'string', description: 'Çıkar ve değiştirde programdaki kalem kimliği (items anahtarı)' },
      ad: { type: 'string', description: 'Miktarıyla birlikte ad, örn. "1 dilim tam buğday ekmeği (25 g)"' }, kcal: { type: 'number' }, protein: { type: 'number' },
      gunler: { type: 'array', items: { type: 'integer' }, description: 'Döngülü programda hangi günler (1\'den); boş ya da yoksa her gün' } }, required: ['islem'] } },
];
const PLAN_TOOLS = ['dongu_gunu', 'ogun_saati', 'su_hedefi', 'kalori_gorunumu', 'program_kalemi'];
const mealBy = x => PLAN.meals.find(m => m.id === x) || PLAN.meals.find(m => fold(m.title) === fold(x || ''));
const supBy = (id, n) => SUPS().find(s => s.id === id) || (n ? SUPS().find(s => fold(s.n) === fold(n)) : null);
const okHM = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
const zamanOf = z => { z = String(z || '').trim(); if (z === 'yat' || okHM(z) || !z) return z; const m = mealBy(z); return m ? m.id : null; };
const dayList = g => !CYCLE || !Array.isArray(g) || !g.length ? [] : [...new Set(g.map(Math.round))].filter(i => i >= 1 && i <= CYCLE.n).sort((a, b) => a - b);
const daysTxt = L => L.length ? ` (${L.join(', ')}. gün)` : '';
/* Önerinin insan diliyle özeti; err varsa uygulanamaz. */
function actInfo(t) {
  const x = t.input || {};
  switch (t.name) {
    case 'takviye': {
      const z = zamanOf(x.zaman), at = z == null ? null : z;
      if (x.islem === 'ekle') return !x.ad ? { err: 'Takviyenin adı yok.' } : { txt: `Takviye ekle: ${x.ad}${x.miktar ? ', ' + x.miktar : ''} · ${supAt(at || '').toLocaleLowerCase('tr')}` };
      const s = supBy(x.kimlik, x.ad); if (!s) return { err: `"${x.ad || x.kimlik || ''}" takviyesi listende yok.` };
      if (x.islem === 'sil') return { txt: `Takviyeyi sil: ${s.n}` };
      return { txt: `Takviyeyi düzenle: ${x.ad || s.n}${(x.miktar ?? s.dose) ? ', ' + (x.miktar ?? s.dose) : ''} · ${supAt(x.zaman != null && at != null ? at : anc(s)).toLocaleLowerCase('tr')}` };
    }
    case 'dongu_gunu': { const n = Math.round(x.bugun); return !CYCLE || !(n >= 1 && n <= CYCLE.n) ? { err: 'Gün numarası geçersiz.' } : { txt: `Bugünü programın ${n}. günü yap`, plan: 1 }; }
    case 'ogun_saati': { const m = mealBy(x.ogun); if (!m) return { err: 'Öğün bulunamadı.' }; if (!okHM(x.saat) || (x.hafta_sonu && !okHM(x.hafta_sonu))) return { err: 'Saat geçersiz.' };
      return { txt: `${m.title} saati: ${x.saat}${x.hafta_sonu && x.hafta_sonu !== x.saat ? `, hafta sonu ${x.hafta_sonu}` : ''}`, plan: 1 }; }
    case 'su_hedefi': { const n = Math.round(x.bardak); return !(n >= 1 && n <= 30) ? { err: 'Su hedefi geçersiz.' } : { txt: `Su hedefi: günde ${n} bardak`, plan: 1 }; }
    case 'gorunum': return { txt: `Görünüm: ${{ acik: 'açık', koyu: 'koyu', sistem: 'sistemle aynı' }[x.tema] || x.tema}` };
    case 'kalori_gorunumu': return { txt: x.goster ? 'Kalori sayıları görünsün' : 'Kalori sayıları gizlensin', plan: 1, warn: 1 };
    case 'program_kalemi': {
      const it = PLAN.items[x.kalem], m = mealBy(x.ogun), g = dayList(x.gunler);
      if (x.islem === 'ekle') return !m || !x.ad ? { err: 'Öğün ya da kalem adı eksik.' } : { txt: `${m.title} öğününe ekle: ${x.ad}${KC && x.kcal ? ` · ${num(x.kcal)} kcal` : ''}${daysTxt(g)}`, plan: 1, warn: 1 };
      if (!it) return { err: 'Kalem programda bulunamadı.' };
      if (x.islem === 'cikar') return !m ? { err: 'Öğün bulunamadı.' } : { txt: `${m.title} öğününden çıkar: ${it.name}${daysTxt(g)}`, plan: 1, warn: 1 };
      return { txt: `Kalemi değiştir: ${it.name}${x.ad && x.ad !== it.name ? ' → ' + x.ad : ''}${KC && x.kcal != null ? ` · ${num(x.kcal)} kcal` : ''}${x.protein != null ? ` · ${num1(x.protein)} g protein` : ''}`, plan: 1, warn: 1 };
    }
  }
  return { err: 'Bu değişikliği yapamıyorum.' };
}
/* Program kopyası üzerinde bir öneriyi uygular. */
function planApply(p, t) {
  const x = t.input || {}, m = p.meals.find(y => y.id === (mealBy(x.ogun) || {}).id);
  switch (t.name) {
    case 'dongu_gunu': p.cycle.start = addDays(today, -(Math.round(x.bugun) - 1)); break;
    case 'ogun_saati': { const same = !m.wknd || m.wknd === m.time; m.time = x.saat; if (x.hafta_sonu) m.wknd = x.hafta_sonu; else if (same) m.wknd = x.saat; break; }
    case 'su_hedefi': p.daily = p.daily || {}; p.daily.water = { ml: 250, ...(p.daily.water || {}), goal: Math.round(x.bardak) }; break;
    case 'kalori_gorunumu': p.prefs = { ...(p.prefs || {}), kcal: !!x.goster }; break;
    case 'program_kalemi': {
      const g = dayList(x.gunler), all = !p.cycle || !g.length;
      /* Belirli günlere dokunulacaksa öğün gün gün listeye açılır. */
      if (!all && !m.days) m.days = Array.from({ length: p.cycle.n }, () => [...(m.main ? ['ana'] : []), ...m.items]);
      const each = fn => { if (m.days) m.days = m.days.map((L, i) => all || g.includes(i + 1) ? fn(L) : L); else m.items = fn(m.items); if (m.days) m.items = m.days[0].filter(id => id !== 'ana'); };
      if (x.islem === 'ekle') {
        let id = fold(x.ad).replace(/ /g, '-').slice(0, 18) || 'kalem', i = 2; const b = id; while (p.items[id]) id = b + '-' + i++;
        p.items[id] = { k: Math.max(0, +x.kcal || 0), p: Math.max(0, +x.protein || 0), name: x.ad.trim(), chip: (x.ad.replace(/^[\d.,/-]+\s*\S*\s*/, '').split(/[(,]/)[0].trim().slice(0, 24) || x.ad).replace(/^./, c => c.toLocaleUpperCase('tr')) };
        each(L => [...L, id]);
      } else if (x.islem === 'cikar') each(L => L.filter(id => id !== x.kalem));
      else { const it = p.items[x.kalem]; if (x.ad) it.name = x.ad.trim(); if (x.kcal != null) it.k = Math.max(0, +x.kcal); if (x.protein != null) it.p = Math.max(0, +x.protein); }
      break;
    }
  }
}
function actsApply(m) {
  const L = (m.acts || []).filter(t => !actInfo(t).err), P2 = L.filter(t => PLAN_TOOLS.includes(t.name));
  let p2 = null;
  if (P2.length) { p2 = JSON.parse(JSON.stringify(PLAN)); P2.forEach(t => planApply(p2, t)); const e = planCheck(p2); if (e) { chatErr = 'Değişiklik uygulanamadı: ' + e; return; } }
  L.forEach(t => { const x = t.input || {};
    if (t.name === 'gorunum') setTheme(x.tema === 'acik' ? 'light' : x.tema === 'koyu' ? 'dark' : '');
    if (t.name !== 'takviye') return;
    const at = zamanOf(x.zaman), s = supBy(x.kimlik, x.ad);
    if (x.islem === 'ekle') (S.supps || (S.supps = [])).push({ id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: x.ad.trim(), dose: (x.miktar || '').trim(), at: at || '' });
    else if (x.islem === 'sil') S.supps = SUPS().filter(y => y !== s);
    else Object.assign(s, { n: (x.ad || s.n).trim(), dose: (x.miktar ?? s.dose).trim(), ...(x.zaman != null && at != null ? { at } : {}) }); });
  m.ast = 'done'; save(); chatsSave();
  if (p2) { try { localStorage.setItem(PLANKEY, JSON.stringify(p2)); sessionStorage.setItem('diyet-tab', 'chat'); } catch (e) { return; } reloadClean(); }
}
/* Onay kartı: önerilerin listesi, diyetisyen uyarısı, tek ana düğme. */
function actCard(m, i) {
  const L = m.acts.map(actInfo), ok = L.filter(x => !x.err), warn = ok.some(x => x.warn);
  const rows = L.map(x => `<div class="pr ${x.err ? 'bad' : ''}">${ic(x.err ? 'x' : x.plan ? 'list' : 'pill')}<span>${esc(x.err || x.txt)}</span></div>`).join('');
  const foot = m.ast === 'done' ? `<div class="pst">${ic('check')}Uygulandı</div>` : m.ast === 'no' ? `<div class="pst">Vazgeçildi</div>`
    : !ok.length ? '' : chatBusy ? '' : `<button class="primary" data-act="actok" data-i="${i}">${ic('check')}${ok.length > 1 ? `${ok.length} değişikliği uygula` : 'Uygula'}</button><button class="textbtn" data-act="actno" data-i="${i}">Vazgeç</button>`;
  return `<div class="prop"><div class="pt">Önerilen değişiklik${L.length > 1 ? 'ler' : ''}</div>${rows}
    ${warn && !m.ast ? `<p class="pw">Bu, diyetisyeninin programını değiştirir. Uygulamadan önce ona danışmanı öneririm.</p>` : ''}
    ${ok.some(x => x.plan) && !m.ast ? `<p class="pn">Program güncellenir; uygulama yeniden açılır.</p>` : ''}${foot}</div>`;
}
/* Geçmişte asistan mesajı: metin + önerilerin özeti ve sonucu. */
const apiText = m => !m.acts ? m.content : (m.content + '\n\n' + m.acts.map(t => { const x = actInfo(t);
  return `[Araçla önerdin: ${x.err || x.txt}. ${x.err ? 'Uygulanamadı.' : m.ast === 'done' ? 'Kullanıcı uyguladı.' : m.ast === 'no' ? 'Kullanıcı vazgeçti.' : 'Kullanıcı henüz onaylamadı.'}]`; }).join('\n')).trim();

/* Günün anlık durumu, düz metin. */
function dayContext() {
  const k = today, d = peek(k), A = adjust(k), B = balance(k), now = new Date();
  const lines = [`${fmtLong(k)}, saat ${pad(now.getHours())}:${pad(now.getMinutes())}${isWknd(k) ? ' (hafta sonu saatleri)' : ''}${CYCLE ? `. Programın ${cycleName(k)}ü (${CYCLE.n} günlük döngü; menüler programdaki meals[].days içinde, sırayla 1. gün, 2. gün…)` : ''}`];
  MEALS.forEach(m => {
    const its = itemsOf(m, k).filter(i => !i.optional), st = mealStat(m, k);
    const other = (d.extras || []).some(e => e.meal === m.id && !e.adj);
    const head = `${m.title}${m.time ? ' ' + timeOf(m, k) : ''}: ${st.resolved ? (st.skip === st.total ? (other ? 'plan yerine başka şey yendi' : 'atlandı') : 'tamam') : st.ok + st.skip ? 'kısmen' : 'açık'}`;
    const rows = its.map(it => { const s = stOf(d, m, it), key = m.id + '.' + it.id, ov = A.over[key];
      const nm = label(it) + (it.id === 'ana' ? ' (ana yemek)' : '');
      if (!s) return `  - ${ov ? ov.name + ' (bugün için azaltıldı)' : nm}: açık · ${ov ? ov.k : it.k} kcal`;
      if (s.s === 'skip') return `  - ${nm}: atlandı`;
      if (s.s === 'swap') return `  - ${nm} yerine ${s.sub}${s.k != null ? ` · ${s.k} kcal, ${s.p} g protein` : ''}`;
      return `  - ${s.name || (s.q || s.o ? viewText(it, s) : nm)}: yendi${s.q && s.q !== 1 ? ` (planda ${itemView(it, null).amt || '1 porsiyon'})` : ''}`; });
    if ((d.notes || {})[m.id]) rows.push(`  - kullanıcının notu: ${d.notes[m.id]}`);
    (d.extras || []).filter(e => e.meal === m.id).forEach(e => rows.push(`  - ${e.adj ? 'telafi' : e.pl ? 'planlandı, henüz yenmedi' : 'plan dışı'}: ${e.name} · ${num(e.k)} kcal, ${num(e.p)} g protein`));
    A.adds.filter(a => a.meal === m.id && a.xi < 0).forEach(a => rows.push(`  - uygulamanın telafi önerisi${a.off ? ' (kullanıcı gerek yok dedi)' : ''}: ${a.name} · ${a.k} kcal${a.why ? ' · neden: ' + a.why : ''}`));
    lines.push(head, ...rows);
  });
  lines.push(`Planın günlük toplamı: ${num(B.tk)} kcal, ${num(B.tp)} g protein.`,
    `İşaretlenenlerde yenen: ${num(B.ek)} kcal, ${num(B.ep)} g protein.`,
    `İşaretlenen öğünlerde plana göre: ${Math.abs(B.gk) < 30 ? 'dengede' : B.gk > 0 ? num(B.gk) + ' kcal eksik' : num(-B.gk) + ' kcal fazla'}, protein ${Math.abs(B.gp) < 3 ? 'dengede' : B.gp > 0 ? num(B.gp) + ' g eksik' : num(-B.gp) + ' g fazla'}.`);
  if (A.note) lines.push('Uygulamanın notu: ' + A.note);
  MAIN_MEALS.forEach(m => lines.push(`Bu hafta ${m.title.toLocaleLowerCase('tr')} ana yemek kotası: ${Object.entries(GROUPS).map(([g, x]) => `${x.name} ${quotaUsed(k, m.id, g)}/${x.perWeek}`).join(', ')}`));
  const W = WORKOUTS[parse(k).getDay()];
  lines.push(`Su: ${d.water}/${WATER_GOAL} bardak. Kahve: ${d.coffee}/${COFFEE_MAX}. Yürüyüş: ${d.walk ? 'yapıldı' : 'yapılmadı'}.`,
    W ? `Bugün antrenman var (${TRAIN.time}, ${W.name}): ${d.gym ? 'yapıldı' : 'henüz yapılmadı'}.` : 'Bugün planlı antrenman yok.');
  if (SUPS().length) lines.push('Kullanıcının kendi takviyeleri (programın parçası değil): ' + SUPS().map(s => `${s.n}${s.dose ? ' ' + s.dose : ''} (${supAt(anc(s)).toLocaleLowerCase('tr')}, kimlik ${s.id}): ${supTaken(k, s.id) ? 'alındı' : 'alınmadı'}`).join('; ') + '.');
  const ws = [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1);
  if (ws.length) lines.push(`Son tartı: ${ws[ws.length - 1].kg.toLocaleString('tr-TR')} kg (${fmtDM(ws[ws.length - 1].d)}); ilk kayıt ${ws[0].kg.toLocaleString('tr-TR')} kg. Hedef ${PLAN.goal.kg} kg.`);
  return lines.join('\n');
}

const SUGGEST = ['Akşam ne yesem?', 'Dışarıda yiyeceğim, ne sipariş edeyim?', 'Protein açığımı nasıl kapatırım?', 'Canım tatlı çekti, ne yapayım?'];
/* Cevap düz metin; **kalın** kalın olur, "- " ile başlayan satırlar madde olur. */
const fmtMsg = t => esc(t.replace(/^#+\s*/gm, '').trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^- (.*)(\n|$)/gm, '<span class="li">$1</span>');
const TYPING = '<span class="typing"><i></i><i></i><i></i></span>';
/* Sohbet sayfası. Yazı kutusu (#ask) sayfanın dışında durur; yeniden çizimde taslak ve odak kaybolmaz. */
function chatView() {
  const c = curChat(), M = c ? c.m : [], last = M.length - 1;
  const msgs = M.map((m, i) => m.role === 'user' ? `<div class="msg u">${esc(m.show || '')}</div>`
    : `<div class="msg a" ${i === last ? 'id="live"' : ''}>${m.content ? fmtMsg(m.content) : m.acts ? '' : TYPING}${m.cut ? '<span class="cut">Yarıda kesildi</span>' : ''}</div>
      ${m.acts && !(chatBusy && i === last) ? actCard(m, i) : ''}
      ${m.content && !(chatBusy && i === last) ? `<div class="mact"><button data-act="chatcopy" data-i="${i}" aria-label="Kopyala">${ic('copy')}</button></div>` : ''}`).join('');
  return `<div class="cbar"><button class="round" data-act="chathist" aria-label="Sohbetler">${ic('hist')}</button><b>${c ? esc(chatTitle(c)) : 'Asistan'}</b><button class="round" data-act="chatnew" aria-label="Yeni sohbet" ${!c ? 'disabled' : ''}>${ic('compose')}</button></div>
    ${M.length ? `<div class="chat">${msgs}</div>` : `<div class="cempty"><span class="cico">${ic('chat')}</span><h2>Ne sormak istersin?</h2><p>Programın ve ${sel === today ? 'bugünün' : 'günün'} kaydı elimde; cevaplar buna göre.</p>
      <div class="sugg">${SUGGEST.map(q => `<button data-act="chatq">${q}</button>`).join('')}</div></div>`}
    ${chatErr ? `<p class="err cerr">${esc(chatErr)}</p>` : ''}`;
}
/* Gönder düğmesi: boşken sönük, cevap gelirken durdurma. */
function askPaint() {
  const b = document.querySelector('#ask .send'), t = document.getElementById('said2'); if (!b) return;
  b.innerHTML = ic(chatBusy ? 'stop' : 'up'); b.setAttribute('aria-label', chatBusy ? 'Durdur' : 'Gönder');
  b.disabled = !chatBusy && !(t && t.value.trim());
}
const grow = t => { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; };
const nearEnd = () => innerHeight + scrollY > document.documentElement.scrollHeight - 200;
const toEnd = smooth => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
/* Geçmiş: son kullanılana göre gruplanmış sohbetler; silmek iki dokunuş ister. */
function histSheet() {
  sheet = 'hist';
  const day0 = parse(today).getTime(), grp = c => { const d = Math.floor((day0 - new Date(new Date(c.u).toDateString()).getTime()) / 864e5);
    return d <= 0 ? 'Bugün' : d === 1 ? 'Dün' : d < 7 ? 'Son 7 gün' : d < 30 ? 'Son 30 gün' : 'Daha önce'; };
  const G = {}; CHATS.forEach(c => (G[grp(c)] = G[grp(c)] || []).push(c));
  const when = c => { const t = new Date(c.u); return grp(c) === 'Bugün' || grp(c) === 'Dün' ? `${pad(t.getHours())}:${pad(t.getMinutes())}` : t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }); };
  showSheet(`<div class="between" style="align-items:center;padding-right:6px"><h2>Sohbetler</h2><button class="pill" data-act="chatnew">${ic('compose')}Yeni sohbet</button></div>
    ${CHATS.length ? `<p class="lead">Her soruda o günün kaydı da gider; eski bir sohbete devam edersen bugünkü kaydınla cevaplanır.</p>${Object.entries(G).map(([g, L]) => `<div class="sect">${g}</div><div class="group">${L.map(c => `<div class="hrow ${c.id === CUR ? 'on' : ''}">
      <button class="opt" data-act="chatopen" data-id="${c.id}"><span>${esc(chatTitle(c))}<small>${when(c)} · ${c.m.filter(m => m.role === 'user').length} soru</small></span></button>
      <button class="hdel ${chatDel === c.id ? 'over' : ''}" data-act="chatdel" data-id="${c.id}" aria-label="Sil">${chatDel === c.id ? 'Sil' : ic('trash')}</button></div>`).join('')}</div>`).join('')}`
      : `<p class="lead">Henüz sohbet yok. Sorduğun her şey burada birikir; istediğine dönüp devam edebilirsin.</p>`}`);
}
async function chatSend(text) {
  text = (text || '').trim();
  if (chatBusy || !text) return;
  if (!aiReady(() => { tab = 'chat'; render(); chatSend(text); })) return;
  let c = curChat();
  if (!c) { c = { id: 'c' + Date.now().toString(36), d: today, u: Date.now(), m: [] }; CUR = c.id; }
  CHATS = [c, ...CHATS.filter(x => x !== c)];
  chatBusy = true; chatErr = '';
  const q = { role: 'user', content: `<durum>\n${dayContext()}\n</durum>\n\n${text}`, show: text }, a = { role: 'assistant', content: '' };
  c.m.push(q, a); c.u = Date.now();
  const t0 = document.getElementById('said2'); if (t0) { t0.value = ''; grow(t0); }
  if (tab === 'chat') { render(); toEnd(true); } askPaint();
  const paint = () => { const el = document.getElementById('live'); if (!el) return; const end = nearEnd(); el.innerHTML = fmtMsg(a.content); if (end) toEnd(); };
  const ctl = new AbortController(); chatAbort = ctl;
  try {
    const r = await aiFetch({ model: CHAT_MODEL, max_tokens: 4000, stream: true, thinking: { type: 'disabled' }, output_config: { effort: 'low' },
      system: [{ type: 'text', text: CHAT_SYSTEM(), cache_control: { type: 'ephemeral' } }],
      tools: TOOLS(), messages: c.m.slice(0, -1).map(m => ({ role: m.role, content: m.role === 'assistant' ? apiText(m) : m.content })).filter(m => m.content) }, ctl.signal);
    if (!r.ok) throw aiErr(r, await r.json().catch(() => ({})));
    const rd = r.body.getReader(), dec = new TextDecoder(), usage = {}, blk = {}; let buf = '', stop = '';
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const ev = JSON.parse(line.slice(5));
        if (ev.type === 'message_start') Object.assign(usage, ev.message.usage);
        else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { a.content += ev.delta.text; paint(); }
        /* Araç çağrısı: girdi parça parça JSON olarak gelir, blok bitince öneri olur. */
        else if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') blk[ev.index] = { name: ev.content_block.name, j: '' };
        else if (ev.type === 'content_block_delta' && ev.delta.type === 'input_json_delta' && blk[ev.index]) blk[ev.index].j += ev.delta.partial_json;
        else if (ev.type === 'content_block_stop' && blk[ev.index]) { const b = blk[ev.index]; let input = {}; try { input = JSON.parse(b.j || '{}'); } catch (x) {}
          (a.acts || (a.acts = [])).push({ name: b.name, input }); delete blk[ev.index]; }
        else if (ev.type === 'message_delta') { stop = ev.delta.stop_reason || stop; Object.assign(usage, ev.usage); }
        else if (ev.type === 'error') throw new Error(ev.error && ev.error.message || 'Akış kesildi.');
      }
    }
    track(CHAT_MODEL, usage);
    if (stop === 'refusal' && !a.content) throw new Error('Bu soruya cevap veremiyorum.');
    if (!a.content && !a.acts) throw new Error('Boş cevap geldi; yeniden dene.');
  } catch (e) {
    if (e.name === 'AbortError' && (a.content || a.acts)) a.cut = true;   /* durdurulan cevabın gelen kısmı kalır */
    else {
      /* Başarısız soru-cevap çifti geçmişten çıkar, soru kutuya geri döner. */
      c.m.splice(c.m.indexOf(q), 2); if (!c.m.length) { CHATS = CHATS.filter(x => x !== c); CUR = null; }
      chatErr = e.name === 'AbortError' ? '' : e.message || 'Bağlantı kurulamadı.';
      const t = document.getElementById('said2'); if (t && !t.value) { t.value = text; grow(t); }
    }
  }
  chatBusy = false; chatAbort = null; chatsSave(); if (tab === 'chat') render(); askPaint();
}
/* Klavye açılınca yazı kutusu klavyenin üstüne çıkar, alt çubuk gizlenir. */
(() => { const vv = window.visualViewport, set = () => { const kb = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0;
    document.documentElement.style.setProperty('--kb', kb + 'px'); };
  if (vv) { vv.addEventListener('resize', set); vv.addEventListener('scroll', set); }
  document.addEventListener('focusin', e => { if (e.target.id === 'said2') document.body.classList.add('typing'); });
  document.addEventListener('focusout', e => { if (e.target.id === 'said2') setTimeout(() => { if (document.activeElement.id !== 'said2') document.body.classList.remove('typing'); }, 60); });
})();

/* ---------- Etkileşim ---------- */
const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, d = day(sel), meal = MEALS.find(m => m.id === el.dataset.meal), A = adjust(sel);
  const o0 = openNow(), s0 = sel;
  const eaten = id => { const o = A.over[id]; return o ? { s: 'done', name: o.name, k: o.k, p: o.p } : { s: 'done' }; };
  const setAll = (m, fn) => itemsOf(m, sel).forEach(i => { const k = m.id + '.' + i.id, v = fn(d.items[k], i, k); v ? d.items[k] = v : delete d.items[k]; });
  switch (a) {
    case 'tab': if (tab === el.dataset.t && tab === 'chat') { toEnd(true); return; } tab = el.dataset.t; window.scrollTo(0, 0); if (tab === 'chat') chatScroll = true; break;
    case 'day': sel = el.dataset.k; if (el.dataset.go) { tab = 'today'; window.scrollTo(0, 0); } break;
    case 'week': { sel = addDays(sel, 7 * +el.dataset.n); const max = addDays(today, AHEAD); if (sel > max) sel = max; break; }
    case 'gotoday': sel = today; break;
    case 'ev': { const cur = openEv[sel] !== undefined ? openEv[sel] : defOpen(sel); openEv[sel] = cur === el.dataset.id ? '' : el.dataset.id; break; }
    case 'sup': { const s = d.supps || (d.supps = {}), id = el.dataset.id, x = SUPS().find(y => y.id === id); if (!x) return;
      if (s[id]) delete s[id]; else s[id] = 1;
      if (openEv[sel] === 'sp:' + anc(x) && supList(anc(x)).every(y => s[y.id])) delete openEv[sel]; buzz(); break; }
    case 'supall': { const s = d.supps || (d.supps = {}); supList(el.dataset.at).forEach(y => s[y.id] = 1); delete openEv[sel]; buzz(); break; }
    case 'spnew': { const m = MEALS.find(x => x.time); SP = { n: '', dose: '', at: m ? m.id : '' }; supForm(); return; }
    case 'spedit': { const x = SUPS().find(y => y.id === el.dataset.id); if (!x) return; SP = { ...x, at: anc(x) }; supForm(); return; }
    case 'spat': { spSync(); const v = el.dataset.at; SP.at = v === 'saat' ? (isHM(SP.at) ? SP.at : '08:00') : v; SP.del = false; supForm(); return; }
    case 'spsave': spSync(); spSave(); SP = null; supsSheet(); break;
    case 'spdel': if (!SP.del) { spSync(); SP.del = true; return supForm(); } S.supps = SUPS().filter(y => y.id !== SP.id); SP = null; supsSheet(); break;
    case 'spback': SP = null; supsSheet(); return;
    case 'theme': setTheme(el.dataset.v); progSheet('gorunum'); return;
    case 'toggle': { const id = el.dataset.id, m = MEALS.find(x => x.id === id.split('.')[0]);
      if (d.items[id]) delete d.items[id]; else { lockMain(sel, m); d.items[id] = eaten(id); }
      if (mealStat(m, sel).resolved && m.time) delete openEv[sel]; buzz(); break; }
    case 'add': { const x = A.adds[+el.dataset.i]; if (x.xi >= 0) d.extras.splice(x.xi, 1);
      else if (x.off) { delete d.noadj[x.id]; if (!Object.keys(d.noadj).length) delete d.noadj; }
      else { const { xi, why, off, ...keep } = x; d.extras.push({ ...keep, adj: true }); } buzz(); break; }
    case 'noadj': (d.noadj || (d.noadj = {}))[A.adds[+el.dataset.i].id] = 1; buzz(); break;
    case 'unextra': d.extras.splice(+el.dataset.i, 1); break;
    case 'xedit': xOpen(+el.dataset.i); return;
    case 'xq': xSync(); XE.q = +el.dataset.v; xSheet(); buzz(); return;
    case 'xsave': { xSync(); const e = d.extras[XE.i]; if (!e) return closeSheet();
      Object.assign(e, scaled({ n: XE.n, k: XE.bk, p: XE.bp, u: XE.u }, XE.q)); learn(XE.n, XE.bk, XE.bp, XE.u); XE = null; closeSheet(); buzz(); break; }
    case 'xdel': d.extras.splice(XE.i, 1); XE = null; closeSheet(); break;
    case 'it-o': IT.c = { t: el.dataset.t, i: +el.dataset.i }; IT.q = 1; itApply(A); save(); render(); itemSheet(); buzz(); return;
    case 'it-q': { const [, it] = findItem(IT.id), st = stepOf(IT.c.t === 'lib' ? null : parseAmt(itBase(it, IT.c)));
      IT.q = Math.round(Math.max(st, Math.min(3, Math.round((IT.q + st * +el.dataset.n) / st) * st)) * 1000) / 1000;
      itApply(A); save(); render(); itemSheet(); buzz(); return; }
    case 'it-ok': if (!d.items[sheet] || d.items[sheet].s === 'skip') itApply(A); IT = null; closeSheet(); buzz(); break;
    case 's-food': { const x = CS[+el.dataset.i]; IT.c = { t: 'lib', x: { n: x.n, k: x.k, p: x.p, u: x.u || '' } }; IT.q = 1; itApply(A);
      remember(sheet.split('.')[0], x.n, x.k, x.p, x.u); save(); render(); itemSheet(); buzz(); return; }
    case 'sheet': openSheet(el.dataset.id); return;
    case 'score': scoreSheet(el.dataset.k || ''); return;
    case 'note': noteSheet(el.dataset.meal); return;
    case 'notesave': case 'notedel': { const v = a === 'notesave' ? document.getElementById('notetx').value.trim() : '', n = d.notes || (d.notes = {});
      if (v) n[NT] = v; else delete n[NT]; closeSheet(); break; }
    case 'phgo': { const t = document.getElementById('phtx').value.trim(), p = PH; PH = null; analyze(p.meal, { image: p.full, text: t }); return; }
    case 'setup': return welcomeSheet();
    case 'welcome': { const w = el.dataset.w; if (w === 'link') { PL = {}; return planSheet(); } if (w === 'photo') return buildSheet();
      if (w === 'demo') try { localStorage.setItem(NEWKEY, 'demo'); } catch (x) {} } closeSheet(); render(); return;
    case 'build': return buildSheet();
    case 'pbadd': pbSync(); if (PB.pics.length < 6) document.getElementById('pages').click(); return;
    case 'pbx': pbSync(); PB.pics.splice(+el.dataset.i, 1); return buildSheet();
    case 'pbgo': pbSync(); if (!PB.pics.length && !PB.text.trim()) return; if (aiReady(buildAI)) buildAI(); return;
    case 'pbback': PL = null; pbClear(); return buildSheet();
    case 'cyctoday': { const p2 = JSON.parse(JSON.stringify(PLAN)); p2.cycle.start = addDays(today, -+el.dataset.i);
      try { localStorage.setItem(PLANKEY, JSON.stringify(p2)); } catch (x) { return; } reloadClean(); return; }
    case 'pld': PL.day = +el.dataset.i; return planSheet();
    case 'pl1': { const C = PL.incoming.cycle, w = +el.dataset.w; C.start = addDays(today, -((parse(today).getDay() - w + 7) % 7)); return planSheet(); }
    case 'prog': if (el.dataset.p === 'gidalar') return foodsSheet(); if (el.dataset.p === 'takviye') return supsSheet(); if (el.dataset.p === 'baglanti') { PL = {}; return planSheet(); } progSheet(el.dataset.p); if (el.dataset.p === 'ai' && aiCode()) loadMe().then(() => { if (sheet === 'ai') progSheet('ai'); }); return;
    case 'planpaste': { const v = document.getElementById('plink').value.trim(); if (!v) return;
      unpackPlan(v).then(p2 => { PL = { incoming: p2 }; planSheet(); }).catch(x => { PL = { err: x.message || 'Bağlantı okunamadı.' }; planSheet(); }); return; }
    case 'planload': try { localStorage.setItem(PLANKEY, JSON.stringify(PL.incoming)); } catch (x) { PL = { err: 'Program kaydedilemedi.' }; return planSheet(); } pbClear(); setupDone(); reloadClean(); return;
    case 'plannot': PL = null; history.replaceState(null, '', location.pathname + location.search); closeSheet(); return;
    case 'pswi': plSync(); PL.set[el.dataset.k] = !PL.set[el.dataset.k]; PL.dirty = true; planSheet(); return;
    case 'pset': { plSync(); const p2 = JSON.parse(JSON.stringify(PLAN));
      p2.dietitian = { ...(p2.dietitian || {}), name: PL.set.name.trim(), phone: PL.set.phone.trim() }; p2.prefs = { ...(p2.prefs || {}), kcal: PL.set.kcal, tune: PL.set.tune };
      if (planCheck(p2)) return; try { localStorage.setItem(PLANKEY, JSON.stringify(p2)); } catch (x) { return; } reloadClean(); return; }
    case 'report': reportSheet(); return;
    case 'dump': DK = null; dumpSheet(); return;
    case 'dkp': dkSet(el.dataset.a, el.dataset.b); dumpSheet(); return;
    case 'dkgo': dumpPrint(); return;
    case 'repshare': { const text = weekReport(sel);
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => { el.textContent = 'Kopyalandı'; }).catch(() => {});
      return; }
    case 'planreset': try { localStorage.removeItem(PLANKEY); } catch (x) {} reloadClean(); return;
    case 'planshare': packPlan(PLAN).then(code => { const url = planLink(code); PL.link = url;
      if (navigator.share) navigator.share({ title: 'Diyet programı', url }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
      planSheet(); }); return;
    case 'chat': tab = 'chat'; chatScroll = true; break;
    case 'chathist': chatDel = null; histSheet(); return;
    case 'chatopen': CUR = el.dataset.id; chatErr = ''; chatDel = null; closeSheet(); tab = 'chat'; chatScroll = true; break;
    case 'chatdel': { const id = el.dataset.id; if (chatDel !== id) { chatDel = id; return histSheet(); }
      if (chatBusy && id === CUR) return; CHATS = CHATS.filter(c => c.id !== id); if (CUR === id) CUR = null; chatDel = null; chatsSave(); histSheet(); break; }
    case 'chatcopy': { const m = (curChat() || { m: [] }).m[+el.dataset.i]; if (!m) return;
      const done = () => { el.innerHTML = ic('check'); setTimeout(() => { el.innerHTML = ic('copy'); }, 1400); };
      try { navigator.clipboard.writeText(m.content).then(done, () => {}); } catch (x) {} return; }
    case 'chatq': chatSend(el.textContent); return;
    case 'chatsend': if (chatBusy) { if (chatAbort) chatAbort.abort(); return; } chatSend(document.getElementById('said2').value); return;
    case 'actok': { const m = (curChat() || { m: [] }).m[+el.dataset.i]; if (!m || chatBusy || m.ast) return; chatErr = ''; actsApply(m); buzz(); break; }
    case 'actno': { const m = (curChat() || { m: [] }).m[+el.dataset.i]; if (!m || chatBusy || m.ast) return; m.ast = 'no'; chatsSave(); break; }
    case 'chatnew': if (chatBusy) return; CUR = null; chatErr = ''; closeSheet(); tab = 'chat'; render(); window.scrollTo(0, 0); { const t = document.getElementById('said2'); t && t.focus(); } return;
    case 'close': closeSheet(); return;
    case 'all': lockMain(sel, meal); A.adds.filter(x => x.meal === meal.id && x.xi < 0 && !x.off).forEach(({ xi, why, off, ...x }) => d.extras.push({ ...x, adj: true }));
      setAll(meal, (c, i, k) => c || (i.optional ? null : eaten(k))); if (supLeft(meal, sel).length) openEv[sel] = meal.id; else delete openEv[sel]; buzz(); break;
    case 'skipmeal': lockMain(sel, meal); setAll(meal, (c, i) => i.optional ? null : { s: 'skip' }); delete openEv[sel]; break;
    case 'clear': setAll(meal, () => null); d.extras = d.extras.filter(x => x.meal !== meal.id); openEv[sel] = meal.id; break;
    case 'mode': d.mode[meal.id] = +el.dataset.i; break;
    case 'main': d.main[meal.id] = el.dataset.m; closeSheet(); break;
    case 'photo': { const go = () => { camMeal = meal.id; document.getElementById('cam').click(); }; if (aiReady(go)) go(); return; }
    case 'aiok': { try { localStorage.setItem(OKKEY, today); } catch (x) {} const f = afterOk; afterOk = null; closeSheet(); if (f) f(); return; }
    case 'aino': try { localStorage.removeItem(OKKEY); } catch (x) {} progSheet('ai'); return;
    case 'write': quickSheet(meal); return;
    case 'qadd': { const x = Q.res[+el.dataset.i], had = Q.tray.find(t => t.id === x.id); if (had) had.q += 1; else Q.tray.push({ ...x, q: 1 });
      const t = document.getElementById('q'); t.value = ''; qPaint(); buzz(); return; }
    case 'qq': Q.tray[+el.dataset.i].q = +el.dataset.v; qPaint(); buzz(); return;
    case 'qx': Q.tray.splice(+el.dataset.i, 1); qPaint(); return;
    case 'fnew': FD = { n: el.dataset.q || '', u: '', k: '', p: '', img: '', ret: el.dataset.ret || '' }; foodForm(); return;
    case 'fedit': { const f = S.foods[el.dataset.id]; FD = { id: el.dataset.id, n: f.n, u: f.u || '', k: String(f.k), p: String(f.p).replace('.', ','), img: f.img || '' }; foodForm(); return; }
    case 'fpic': fSync(); document.getElementById('pic').click(); return;
    case 'fai': fSync(); if (!aiAuth()) { FD.err = 'Yapay zekâ için Program → Yapay zekâ bölümünden ' + (PROXY_URL ? 'davet kodunu' : 'API anahtarı') + ' gir. Değerleri elle de girebilirsin.'; return foodForm(); }
      if (aiReady(foodAI)) foodAI(); return;
    case 'fdel': if (!FD.del) { FD.del = true; fSync(); return foodForm(); } delete S.foods[FD.id]; FD = null; foodsSheet(); break;
    case 'fback': if (FD && FD.ret) { const m = MEALS.find(x => x.id === FD.ret); FD = null; quickSheet(m, true); return; } FD = null; foodsSheet(); return;
    case 'fsave': { fSync(); const id = fSave(); if (!id) return; const ret = FD.ret; FD = null;
      if (ret) { const f = S.foods[id], m = MEALS.find(x => x.id === ret); if (!Q.tray.some(t => t.id === id)) Q.tray.push({ id, n: f.n, u: f.u, k: f.k, p: f.p, img: f.img, mine: true, q: 1 }); save(); quickSheet(m, true); return; }
      foodsSheet(); break; }
    case 'qmode': Q.mode = el.dataset.m; qPaint(); return;
    case 'qai': { const v = document.getElementById('q').value.trim(); if (!v) return; const go = () => analyze(Q.meal, { text: v }); if (aiReady(go)) go(); return; }
    case 'qsave': if (!Q.tray.length) return; qSave(!!el.dataset.pl); closeSheet(); buzz(); break;
    case 'plok': { /* plan gerçekleşti: işaretler kalkar, yenenler kütüphaneye girer */
      d.extras.forEach(e => { if (e.meal === meal.id && e.pl) { delete e.pl; if (e.src) remember(meal.id, e.src.n, e.src.k, e.src.p, e.src.u); } });
      Object.entries(d.items).forEach(([k, v]) => { if (k.startsWith(meal.id + '.') && v.pl) delete v.pl; }); delete openEv[sel]; buzz(); break; }
    case 'plno': d.extras = d.extras.filter(e => !(e.meal === meal.id && e.pl));
      Object.entries(d.items).forEach(([k, v]) => { if (k.startsWith(meal.id + '.') && v.pl) delete d.items[k]; }); break;
    case 'applyai': applyAI(); closeSheet(); buzz(); break;
    case 'savekey': { const v = document.getElementById('aikey').value.trim(); if (!v) return; try { localStorage.setItem(AIKEY, v); } catch (x) {}
      if (afterKey) { const f = afterKey; afterKey = null; if (aiReady(f)) f(); return; } closeSheet(); break; }
    case 'delkey': try { localStorage.removeItem(AIKEY); } catch (x) {} closeSheet(); break;
    case 'pbcode': pbSync(); PB.err = ''; return needKey(buildSheet);
    /* Tire unutulursa (AILE6S7N) son dört karakterin önüne konur. */
    case 'savecode': { const v = document.getElementById('aicode').value.trim().toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]+)([A-Z0-9]{4})$/, '$1-$2'); if (!v) return;
      try { localStorage.setItem(CODEKEY, v); } catch (x) {} ME = null;
      if (afterKey) { const f = afterKey; afterKey = null; if (aiReady(f)) f(); return; }
      progSheet('ai'); loadMe().then(() => { if (sheet === 'ai') progSheet('ai'); }); return; }
    case 'delcode': try { localStorage.removeItem(CODEKEY); } catch (x) {} ME = null; progSheet('ai'); return;
    case 'water': d.water = Math.max(0, d.water + +el.dataset.n); buzz(); break;
    case 'coffee': d.coffee = Math.max(0, d.coffee + +el.dataset.n); break;
    case 'walk': d.walk = !d.walk; buzz(); break;
    case 'gym': d.gym = !d.gym; if (d.gym && openEv[sel] === 'gym') delete openEv[sel]; buzz(); break;
    case 'z2': d.z2 = !d.z2; break;
    case 'weight': { const v = parseFloat(document.getElementById('kg').value.replace(',', '.'));
      if (!(v > 30 && v < 300)) return; S.weights = S.weights.filter(w => w.d !== today).concat({ d: today, kg: v }); break; }
    case 's-skip': lockMain(sel, MEALS.find(x => x.id === sheet.split('.')[0])); d.items[sheet] = { s: 'skip' }; IT = null; closeSheet(); break;
    case 's-clear': delete d.items[sheet]; IT = null; closeSheet(); break;
    case 's-custom': { const v = document.getElementById('custom').value.trim(); if (!v) return; IT.c = { t: 'txt', text: v }; IT.q = 1; itApply(A); IT = null; closeSheet(); break; }
    case 'export': { const u = URL.createObjectURL(new Blob([JSON.stringify(PLAN_CUSTOM ? { ...S, plan: PLAN } : S)], { type: 'application/json' }));
      const l = document.createElement('a'); l.href = u; l.download = `diyet-yedek-${today}.json`; l.click(); return; }
    case 'import': document.getElementById('file').click(); return;
  }
  save(); render();
  if (sel === s0 && openNow() && openNow() !== o0) centerOpen();
});
document.addEventListener('change', e => {
  if ((e.target.id === 'dka' || e.target.id === 'dkb') && DK) { dkSet(document.getElementById('dka').value, document.getElementById('dkb').value); return dumpSheet(); }
  const f = e.target.files && e.target.files[0]; if (!f) return;
  if (e.target.id === 'pic' && FD) { e.target.value = '';
    Promise.all([thumb(f), shrink(f)]).then(([img, full]) => { FD.img = img; FD.full = full; FD.err = ''; if (sheet !== 'food') return; if (aiAuth() && aiOk()) foodAI(); else foodForm(); })
      .catch(x => { FD.err = x.message; foodForm(); }); return; }
  if (e.target.id === 'cam') { e.target.value = ''; shrink(f).then(full => { PH = { meal: camMeal, full }; photoSheet(); }).catch(() => {}); }
  if (e.target.id === 'pages' && PB) { const fs = [...e.target.files].slice(0, 6 - PB.pics.length); e.target.value = ''; pbAdd(fs); return; }
  if (e.target.id === 'file') f.text().then(t => { const o = JSON.parse(t); if (!o || !o.days) return;
    /* Yedekte bağlantıyla yüklenmiş bir program varsa o da geri gelir. */
    const p2 = o.plan; delete o.plan; S = o; save();
    if (p2 && !planCheck(p2)) { try { localStorage.setItem(PLANKEY, JSON.stringify(p2)); } catch (x) {} return location.reload(); }
    closeSheet(); render(); }).catch(() => {});
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'q') { e.preventDefault(); const b = document.querySelector('[data-act="qadd"]'); b ? b.click() : e.target.blur(); }
  if (e.key === 'Enter' && e.target.id === 'custom') document.querySelector('[data-act="s-custom"]').click();
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'said2') { e.preventDefault(); if (!chatBusy) chatSend(e.target.value); }
});
document.addEventListener('input', e => {
  if ((e.target.id === 'dname' || e.target.id === 'dphone') && PL) { PL.dirty = true; const b = document.querySelector('[data-act="pset"]'); if (b) b.disabled = false; }
  if (e.target.id === 'said2') { grow(e.target); askPaint(); }
  if (e.target.id === 'q') qPaint();
  if (e.target.id === 'custom') csPaint();
  if (e.target.id === 'spn') { const b = document.querySelector('[data-act="spsave"]'); if (b) b.disabled = !e.target.value.trim(); }
  if (e.target.id === 'fn' || e.target.id === 'fk') { const n = document.getElementById('fn').value.trim(), k = document.getElementById('fk').value.trim(), b = document.querySelector('[data-act="fsave"]');
    if (b) b.disabled = !(n && k && !isNaN(+k.replace(',', '.'))); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return; const t = key(new Date());
  if (t !== today) { if (sel === today) sel = t; today = t; } if (!document.body.classList.contains('sheet-open')) render();
});
chatsLoad();
/* Asistanın program değişikliğinden sonra sayfa yeniden yüklenince sohbete dönülür. */
try { if (sessionStorage.getItem('diyet-tab') === 'chat') { sessionStorage.removeItem('diyet-tab'); if (CHATS.length) { tab = 'chat'; CUR = CHATS[0].id; chatScroll = true; } } } catch (e) {}
setInterval(() => { if (!document.hidden && tab === 'today' && !document.body.classList.contains('sheet-open')) render(); }, 60000);
/* Açık öğünün başlığı ekranın tepesine yapışınca gölge alır. */
const stuck = () => { const h = document.querySelector('.mh'); if (!h) return; const c = h.parentElement.getBoundingClientRect(), t = parseFloat(getComputedStyle(h).top) || 0;
  h.classList.toggle('stuck', c.top < t - 1 && c.bottom > h.offsetHeight + t + 8); };
window.addEventListener('scroll', stuck, { passive: true });
/* Gün başlığında yatay kaydırma (Bugün sekmesi, sayfa kapalıyken). Klavyede sol ve sağ ok tuşları. */
(() => { let x0 = null, y0 = 0;
  document.addEventListener('touchstart', e => { x0 = null; if (tab !== 'today' || document.body.classList.contains('sheet-open') || e.touches.length !== 1 || !e.target.closest('#dayhead, .tiles')) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', e => { if (x0 == null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftDay(dx < 0 ? 1 : -1); }, { passive: true });
  document.addEventListener('keydown', e => { if (tab !== 'today' || document.body.classList.contains('sheet-open') || /input|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') shiftDay(-1); if (e.key === 'ArrowRight') shiftDay(1); });
})();
render();
planFromHash();
window.addEventListener('hashchange', planFromHash);
/* İlk açılış: kayıt, yüklenmiş program ve gelen bağlantı yoksa nasıl başlanacağını sor. */
try { if (!localStorage.getItem(KEY) && !localStorage.getItem(PLANKEY) && !localStorage.getItem(SETUPKEY) && !location.hash.startsWith('#plan=')) welcomeSheet(); } catch (e) {}
/* Yarıda kalan program aktarımı: okunmuş program gözden geçirmeye, yarım kalan iş nedeniyle birlikte aktarma sayfasına döner. */
if (!location.hash.startsWith('#plan=')) pbResume();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  /* Yeni sürüm devreye girince sayfayı bir kez yenile. */
  const had = !!navigator.serviceWorker.controller; let done = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !done) { done = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
