/* ---------- Program (k: tahmini kcal, p: tahmini protein g) ---------- */
const BREAD_SUBS = ['4 yk yulaf ezmesi (40 g)', '6 yk bulgur pilavı', '6 yk tam buğday makarna / esmer pirinç', '1 orta boy haşlanmış patates (~180 g)', '1 küçük tam buğday lavaş (50 g)'];
const YOG = { id: 'yogurt', k: 45, p: 3, name: 'Yoğurt veya ayran', opts: ['3-4 yk yoğurt + 1 çk keten tohumu', '1 bardak ayran'], subs: ['1 küçük kase cacık (yağsız)', '1 çay bardağı kefir'] };
const BREAD = { id: 'ekmek', k: 125, p: 5, name: '2 dilim tam buğday ekmeği', meta: '50 g · eksik yeme', subs: BREAD_SUBS };
const SALAD = { id: 'salata', k: 70, p: 1, name: 'Bol salata', meta: '1 tatlı kaşığı sıvıyağ', subs: ['Haşlama / ızgara sebze (1 tatlı kaşığı yağ)', 'Yağsız söğüş + 5 zeytin'] };
const MAINS = [
  { id: 'bakla', g: 'bakla', k: 250, p: 15, chip: 'Kurubaklagil', name: '8 yk kurubaklagil yemeği', meta: 'Susuz · kurufasulye, nohut, barbunya', subs: ['8 yk yeşil mercimek yemeği', '8 yk börülce / bakla'] },
  { id: 'kofte', g: 'kofte', k: 330, p: 27, chip: 'Köfte', name: '5 ızgara köfte', meta: 'Izgara veya tost makinesinde', subs: ['150 g yağsız ızgara et (bonfile, antrikot)', '150 g hindi / tavuk köfte'] },
  { id: 'tavuk', g: 'tb', k: 250, p: 35, chip: 'Tavuk', name: '150 g tavuk', meta: 'Izgara, haşlama veya fırın', subs: ['150 g hindi göğsü', '5 ızgara köfte'] },
  { id: 'balik', g: 'tb', k: 330, p: 40, chip: 'Balık', name: '250 g balık', meta: 'Izgara, buğulama veya fırın', subs: ['150 g tavuk', '160 g ton balığı'] },
  { id: 'ton', g: 'ton', k: 260, p: 35, chip: 'Ton balıklı', name: '160 g ton balıklı salata', meta: 'Salatası içinde', noSalad: true, subs: ['150 g tavuklu salata', '3 haşlanmış yumurtalı salata'] },
];
const QUOTA = { bakla: ['Kurubaklagil', 2], kofte: ['Köfte', 2], tb: ['Tavuk / balık', 2], ton: ['Ton balıklı salata', 1] };
/* Pazartesi'den Pazar'a varsayılan dağılım: her öğün kendi kotasını tutturur. */
const ROTA = { ogle: ['bakla', 'tavuk', 'kofte', 'bakla', 'balik', 'kofte', 'ton'], aksam: ['kofte', 'bakla', 'balik', 'ton', 'kofte', 'tavuk', 'bakla'] };
const MEALS = [
  { id: 'sabah', title: 'Uyanınca', items: [
    { id: 'limon', k: 0, p: 0, name: '2 bardak ılık su', meta: 'İçine 2-3 damla limon' } ] },
  { id: 'kahvalti', title: 'Kahvaltı', time: '11:00', wknd: '10:00', items: [
    { id: 'peynir', k: 160, p: 10, name: 'Peynir', opts: ['2 dilim beyaz peynir (60 g)', '4 yk tuzsuz lor', '4 yk çökelek'], subs: ['60 g az tuzlu kaşar', '1 yumurta + 1 dilim peynir'] },
    { id: 'yumurta', k: 150, p: 13, name: '2 haşlanmış yumurta', meta: 'Tuzsuz', subs: ['2 yumurtalı yağsız omlet', 'Yağsız menemen (2 yumurta)'] },
    { id: 'sebze', k: 30, p: 1, name: 'Domates, salatalık, yeşillik', meta: 'Tuzsuz, yağsız' },
    { id: 'yag', k: 110, p: 2, name: 'Avokado veya ceviz', opts: ['Yarım avokado', '2-3 tam ceviz'], subs: ['6-8 çiğ badem / fındık', '1 tatlı kaşığı zeytinyağı', '5-6 zeytin'] },
    { ...BREAD },
    { id: 'cay', k: 0, p: 0, name: '1 fincan açık şekersiz çay', meta: 'İsteğe bağlı', optional: true } ] },
  { id: 'ogle', title: 'Öğle', time: '14:00', wknd: '14:00', main: true, items: [YOG, BREAD, SALAD] },
  { id: 'ikindi', title: 'İkindi', time: '16:00', wknd: '16:30', modes: ['Galeta + meyve', 'Protein bar'], items: [
    { id: 'galeta', k: 100, p: 3, name: 'Galeta veya leblebi', opts: ['5 karabuğdaylı-yulaflı galeta', '5-6 minik kepekli galeta', '2 kalın uzun kepekli galeta', '½ çay bardağı leblebi'], subs: ['1 dilim tam buğday ekmeği (25 g)', '2 yk yulaf ezmesi', '2 pirinç patlağı'] },
    { id: 'meyve', k: 70, p: 1, name: '1 porsiyon meyve', meta: '1 küçük elma · 1 portakal · 2 mandalina · 1 küçük muz', subs: ['10-12 çilek', '3 kayısı / 2 kivi', '1 ince dilim kavun / karpuz', '15 üzüm'] } ],
    alt: [{ id: 'bar', k: 200, p: 20, name: '1 protein bar' }] },
  { id: 'aksam', title: 'Akşam', time: '20:00', wknd: '19:00', main: true, items: [YOG, BREAD, SALAD] },
  { id: 'gece', title: 'Gece', time: '21:00', wknd: '21:00', items: [
    { id: 'psut', k: 160, p: 22, name: 'Protein süt veya quark', opts: ['1 bardak protein süt', '1 kutu sek quark protein'], subs: ['200 g yüksek proteinli yoğurt (skyr)', '1 ölçü whey + su'] },
    { id: 'kabak', k: 115, p: 6, name: '1 avuç içi çiğ kabak çekirdeği', subs: ['6-8 çiğ badem / fındık', '2 tam ceviz'] } ] },
];
const RULES = [
  ['Çay açık ve şekersiz', 'Yemekten en az 40 dk sonra; demir emilimini bozmasın diye'],
  ['Kahve günde en fazla 2 fincan', 'Sade; her fincanla birlikte 2 bardak su'],
  ['Ara öğün atlama', ''], ['Ekmekleri eksik yeme', ''],
  ['Bir öğün sebze, diğer öğün et ya da kurubaklagil', 'Öğle ve akşam haftada en çok 2 gün yer değiştirebilir'],
  ['Her gün tartılma', ''], ['Günde 2-2,5 litre su', ''],
  ['Haftada 3 gün 45 dk yürüyüş', 'veya 5K / 3 mil Leslie'],
  ['Yazanları ne eksik ne fazla ye', ''],
];
const SWAPS = [
  ['2 dilim tam buğday ekmeği (50 g)', BREAD_SUBS.join(' · ')],
  ['30 g et / tavuk / balık', '1 köfte · 1 yumurta · 1 dilim (30 g) peynir · 2 yk lor'],
  ['3-4 yk yoğurt', '1 bardak ayran · 1 çay bardağı kefir · 1 küçük kase cacık'],
  ['1 tatlı kaşığı sıvıyağ', '5-6 zeytin · 2 ceviz içi · 6 badem / fındık'],
  ['1 porsiyon meyve', '1 küçük elma · 1 portakal · 2 mandalina · 1 küçük muz · 10-12 çilek'],
  ['1 bardak protein süt', '1 kutu quark · 200 g skyr · 1 ölçü whey'],
];
const BODY = [['Kilo', '83,9 kg'], ['Boy', '188 cm'], ['BMI', '23,7'], ['Yağ', '%14,5 · 12,2 kg'], ['Kas', '68,2 kg'], ['İç yağlanma', '3 (1-13)'], ['Bazal metabolizma', '2.093 kcal'], ['Metabolik yaş', '24'], ['Bel', '86 cm'], ['Fit puanı', '95 / 100']];
/* Haftalık ağırlık programı: anahtar haftanın günü (1 Pzt, 3 Çar, 5 Cum). */
const WORKOUTS = {
  1: { name: 'Üst', pre: 'İp 6 dk: 60 sn rahat tempo, 30 sn dinlenme, 4 tur', post: '10-15 dk Zone 2 · bisiklet ya da %5-10 eğimli yürüyüş', ex: [
    ['Bench', '3×5-8'], ['Ağırlıklı barfiks', '3×5-8'], ['OHP', '2×6-10'], ['Row', '3×8-10'], ['Peck Deck', '2×10-15'], ['Hammer Curl', '2×8-12'], ['Lateral Raise', '3×12-20']] },
  3: { name: 'Alt', pre: 'İp yok; istersen 2 dk çok rahat ısınma', post: '8-10 dk çok hafif bisiklet · koşu yok', ex: [
    ['Zercher Squat', '3×5-8'], ['RDL', '3×6-10'], ['Bulgarian Split Squat', '2×8-12'], ['Leg Curl', '2×10-15'], ['Calf Raise', '3×12-20'], ['Boyun 4 yön', '1×15-20'], ['Ab Roller', '2×8-15']] },
  5: { name: 'Full body', pre: 'İp: 90 sn orta tempo, 60 sn dinlenme, 3 tur', post: '10-15 dk Zone 2 · tercihen bisiklet; sert koşu ya da interval yok', ex: [
    ['Barbell Squat', '3×5'], ['Paused Bench', '2×6-8'], ['Weighted Dips', '3×6-10'], ['Lat Pulldown', '3×8-12'], ['Leg Curl', '2×10-15'], ['Face Pull', '2×15-20'], ['Lateral Raise', '2×12-20']] },
};
const GYM_GOAL = 3;
const WATER_GOAL = 10, WATER_ML = 250, COFFEE_MAX = 2, WALK_GOAL = 3;
const AI_MODEL = 'claude-opus-5-5';

/* ---------- Durum ---------- */
const KEY = 'diyet-v1', AIKEY = 'diyet-ai-key';
let S = { days: {}, weights: [{ d: '2026-11-13', kg: 83.9 }] };
try { const raw = localStorage.getItem(KEY); if (raw) S = JSON.parse(raw); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const aiKey = () => { try { return localStorage.getItem(AIKEY) || ''; } catch (e) { return ''; } };

const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
const weekOf = k => { const d = parse(k); const off = (d.getDay() + 6) % 7; const mon = addDays(k, -off); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); };
const isWknd = k => [0, 6].includes(parse(k).getDay());
const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const fmtLong = k => parse(k).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = n => Math.round(n).toLocaleString('tr-TR');

let today = key(new Date()), sel = today, tab = 'today', opened = {}, sheet = null, pending = null, camMeal = null;
const EMPTY = () => ({ items: {}, main: {}, mode: {}, extras: [], water: 0, coffee: 0, walk: false });
const day = k => { const d = S.days[k] || (S.days[k] = EMPTY()); d.extras = d.extras || []; return d; };
const peek = k => S.days[k] || EMPTY();
const mainById = id => MAINS.find(m => m.id === id);

/* Haftanın geri kalanı: seçilmemiş günlere, kalan kotaya göre ana yemek dağıtılır. */
function mainFor(k, mealId) {
  const own = peek(k).main[mealId]; if (own) return mainById(own);
  const wk = weekOf(k), pool = {}; Object.entries(QUOTA).forEach(([g, [, q]]) => pool[g] = q);
  wk.forEach(x => { const m = mainById(peek(x).main[mealId]); if (m) pool[m.g]--; });
  for (let i = 0; i < 7; i++) {
    if (peek(wk[i]).main[mealId]) continue;
    let m = mainById(ROTA[mealId][i]);
    /* Aynı gün iki öğüne aynı ana yemek düşmesin. */
    const av = mealId === 'aksam' ? mainFor(wk[i], 'ogle').g : (mainById(peek(wk[i]).main.aksam) || {}).g;
    if (pool[m.g] <= 0 || m.g === av) {
      const by = (x, y) => pool[y] - pool[x], left = Object.keys(pool).filter(g => pool[g] > 0);
      const g = left.filter(g => g !== av).sort(by)[0] || (pool[m.g] <= 0 ? left.sort(by)[0] : null);
      if (g) m = MAINS.find(x => x.g === g);
    }
    pool[m.g]--;
    if (wk[i] === k) return m;
  }
}
function itemsOf(meal, k) {
  const d = peek(k);
  if (meal.modes && d.mode[meal.id] === 1) return meal.alt;
  if (!meal.main) return meal.items;
  const m = mainFor(k, meal.id);
  return [{ ...m, id: 'ana' }, ...meal.items.filter(i => !(m.noSalad && i.id === 'salata'))];
}
const lockMain = (k, meal) => { if (meal.main && !day(k).main[meal.id]) day(k).main[meal.id] = mainFor(k, meal.id).id; };
const stOf = (d, meal, it) => d.items[meal.id + '.' + it.id];
function mealStat(meal, k) {
  const d = peek(k), its = itemsOf(meal, k).filter(i => !i.optional);
  let ok = 0, skip = 0;
  its.forEach(i => { const s = stOf(d, meal, i); if (s) s.s === 'skip' ? skip++ : ok++; });
  return { total: its.length, ok, skip, resolved: ok + skip === its.length };
}
function dayStat(k) {
  let total = 0, ok = 0, skipped = 0;
  MEALS.forEach(m => { const s = mealStat(m, k); total += s.total; ok += s.ok; if (s.skip === s.total) skipped++; });
  return { total, ok, pct: total ? Math.round(ok / total * 100) : 0, skipped };
}
function quotaUsed(k, mealId, g) {
  return weekOf(k).filter(x => { const m = mainById(peek(x).main[mealId]); return m && m.g === g; }).length;
}
const timeOf = (meal, k) => meal.time ? (isWknd(k) ? meal.wknd : meal.time) : '';
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
const CUTS = { salata: ['Bol salata, yağsız', 45, 0], kabak: ['½ avuç kabak çekirdeği', 57, 3], yag: ['¼ avokado veya 1 ceviz', 55, 1], ekmek: ['1 dilim tam buğday ekmeği', 62, 2.5] };
function balance(k) {
  const d = peek(k), open = []; let gk = 0, gp = 0, tk = 0, tp = 0, rk = 0, rp = 0, any = false;
  MEALS.forEach(m => itemsOf(m, k).forEach(it => {
    if (it.optional) return; tk += it.k; tp += it.p;
    const st = stOf(d, m, it);
    if (!st) return open.push({ m, it, key: m.id + '.' + it.id });
    any = true; rk += it.k; rp += it.p;
    const skip = st.s === 'skip'; gk += it.k - (skip ? 0 : st.k ?? it.k); gp += it.p - (skip ? 0 : st.p ?? it.p);
  }));
  (d.extras || []).forEach(e => { gk -= e.k; gp -= e.p; any = true; });
  return { gk, gp, tk, tp, open, any, ek: rk - gk, ep: rp - gp };
}
function adjust(k) {
  const b = balance(k), out = { over: {}, adds: [], why: '', note: '' };
  if (k !== today || !b.any) return out;
  let { gk, gp } = b;
  const meals = [...new Set(b.open.map(o => o.m))].filter(m => m.time);
  if (!meals.length) return out;
  const add = (meal, id, name, kk, pp) => { out.adds.push({ meal: meal.id, id, name, k: kk, p: pp }); gk -= kk; gp -= pp; };
  if (gp >= 8 && gk > -100) {
    const main = meals.find(m => m.main), gece = meals.find(m => m.id === 'gece');
    if (main) { const n = Math.min(3, Math.max(1, Math.round(gp / 7))); add(main, 'x-prot', `+${n * 30} g et / tavuk (${n} köfte kadar)`, n * 55, n * 7); }
    else if (gece) add(gece, 'x-prot', '+2 haşlanmış yumurta ya da 1 kutu quark', 150, 14);
    else add(meals[0], 'x-prot', '+1 haşlanmış yumurta', 75, 6.5);
  }
  if (gk >= 60) { const n = Math.min(2, Math.max(1, Math.round(gk / 62))); add(meals[0], 'x-ekmek', `+${n} dilim tam buğday ekmeği`, 62 * n, 2.5 * n); }
  if (gk >= 90) add(meals.find(m => m.id === 'ikindi' || m.id === 'gece') || meals[meals.length - 1], 'x-ara', '+1 porsiyon meyve ya da 2 ceviz', 80, 1);
  if (out.adds.length) out.why = 'Eksik kalanı dengelemek için eklendi';
  if (gk <= -80) {
    let need = -gk, cut = 0;
    for (const id of ['salata', 'kabak', 'yag', 'ekmek']) for (const o of b.open) {
      if (o.it.id !== id || need < 40 || cut >= 300) continue;
      const [name, dk, dp] = CUTS[id]; out.over[o.key] = { name, k: o.it.k - dk, p: o.it.p - dp }; need -= dk; cut += dk;
    }
    if (cut) out.why = 'Fazlayı dengelemek için azaltıldı';
    if (need >= 150) out.note = 'Fazlanın kalanını telafi etmeye çalışma; yarın programa normal devam et.';
  }
  return out;
}

/* ---------- Görünümler ---------- */
const CHECK = '<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5"/></svg>';
const DASH = '<svg viewBox="0 0 16 16"><path d="M4 8h8"/></svg>';
const SWAPI = '<svg viewBox="0 0 16 16"><path d="M3 5.5h9l-2.5-2.5M13 10.5H4l2.5 2.5"/></svg>';
const DOTS = '<svg viewBox="0 0 20 20"><circle cx="4" cy="10" r="1.7"/><circle cx="10" cy="10" r="1.7"/><circle cx="16" cy="10" r="1.7"/></svg>';
const CAM = '<svg viewBox="0 0 20 20"><path d="M2.5 7a1.5 1.5 0 011.5-1.5h2l1.2-2h5.6l1.2 2h2A1.5 1.5 0 0117.5 7v7.5A1.5 1.5 0 0116 16H4a1.5 1.5 0 01-1.5-1.5z"/><circle cx="10" cy="10.5" r="3"/></svg>';
const PEN = '<svg viewBox="0 0 20 20"><path d="M3.5 16.5l1-4 9-9 3 3-9 9zM12 5l3 3"/></svg>';

function rowHTML(meal, it, d, ov) {
  const id = meal.id + '.' + it.id, st = d.items[id], s = st ? st.s : '';
  const alt = st && st.alt != null ? st.alt : 0;
  let name = it.opts && s ? it.opts[alt] : it.name, meta = it.opts ? '' : it.meta || '';
  if (!s && ov) { name = ov.name; meta = 'Güncellendi · ' + it.name + ' yerine'; }
  if (s === 'done' && st.name) { name = st.name; meta = 'Güncellenmiş porsiyon'; }
  if (s === 'swap') { name = st.sub; meta = 'Muadil · ' + it.name + ' yerine'; }
  if (s === 'skip') { name = it.name; meta = 'Atlandı'; }
  const chips = it.opts && !ov && s !== 'swap' && s !== 'skip' ? `<span class="chips">${it.opts.map((o, i) =>
    `<button class="chip ${i === alt && s === 'done' ? 'on' : ''}" data-act="opt" data-id="${id}" data-i="${i}">${esc(o)}</button>`).join('')}</span>` : '';
  return `<div class="row ${s}" data-act="toggle" data-id="${id}">
    <span class="chk">${s === 'skip' ? DASH : s === 'swap' ? SWAPI : CHECK}</span>
    <span class="body"><span class="name">${esc(name)}</span>${meta ? `<span class="meta">${esc(meta)}</span>` : ''}${chips}</span>
    <button class="more" data-act="sheet" data-id="${id}" aria-label="Seçenekler">${DOTS}</button></div>`;
}
const MICON = {
  sabah: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600l1.400 1.400M17 17l1.400 1.400M5.600 18.400L7 17M17 7l1.400-1.400"/>',
  kahvalti: '<path d="M5 9h11v5a4 4 0 01-4 4H9a4 4 0 01-4-4zM16 10h1.500a2.500 2.500 0 010 5H16M8 3v2M12 3v2"/>',
  ogle: '<path d="M7 3v18M5 3v4a2 2 0 004 0V3M16.500 3c-1.700 1.500-2.500 4-2.500 7h2.500zM16.500 10v11"/>',
  ikindi: '<path d="M12 8c-1.500-1.500-5-1.600-6 1.500-1 3 .8 8.500 3.500 9.500 1 .4 1.700-.2 2.500-.2s1.500.6 2.500.2c2.700-1 4.500-6.500 3.500-9.500-1-3.100-4.500-3-6-1.500zM12 8c0-2 1-3.500 2.500-4"/>',
  aksam: '<path d="M4 12h16a8 8 0 01-16 0zM9 21h6M9 8c0-1 1-1 1-2s-1-1-1-2M14 8c0-1 1-1 1-2s-1-1-1-2"/>',
  gece: '<path d="M20 14.500A8 8 0 019.500 4a8 8 0 1010.500 10.500z"/>',
  gym: '<path d="M6.500 6.500v11M3.500 9v6M17.500 6.500v11M20.500 9v6M6.500 12h11"/>',
};
const svg = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
function mealHTML(meal, k, A, isNext) {
  const d = peek(k), st = mealStat(meal, k), t = timeOf(meal, k), W = WORKOUTS[parse(k).getDay()];
  const folded = st.resolved && !opened[k + meal.id], allSkip = st.skip === st.total;
  const tag = W && meal.id === 'ikindi' ? ' · antrenman öncesi' : W && meal.id === 'aksam' ? ' · antrenman sonrası' : '';
  const late = isLate(meal, k);
  const sub = st.resolved ? (allSkip ? 'Atlandı' : st.skip ? `${st.ok} / ${st.total} kalem` : 'Tamam') : (t ? t + tag : 'Güne başlarken') + (late ? ' · gecikti' : '');
  let h = `<section class="card ${folded ? 'folded' : ''} ${folded && allSkip ? 'skipped' : ''} ${isNext ? 'now' : ''}"><header data-act="fold" data-meal="${meal.id}">
    <span class="ico">${folded ? (allSkip ? DASH : CHECK) : svg(MICON[meal.id])}</span>
    <div class="ttl"><h2>${meal.title}</h2><span class="sub ${late ? 'late' : ''}">${sub}</span></div>`;
  if (folded) return h + `<span class="link quiet">Göster</span></header></section>`;
  h += st.resolved ? `<button class="link quiet" data-act="clear" data-meal="${meal.id}">Sıfırla</button>` : `<button class="link quiet" data-act="skipmeal" data-meal="${meal.id}">Atla</button>`;
  h += '</header>';
  if (meal.modes) h += `<div class="seg">${meal.modes.map((m, i) => `<button class="${(d.mode[meal.id] || 0) === i ? 'on' : ''}" data-act="mode" data-meal="${meal.id}" data-i="${i}">${m}</button>`).join('')}</div>`;
  if (meal.main) { const cur = mainFor(k, meal.id).id;
    h += `<div class="pick chips">${MAINS.map(m => { const [, q] = QUOTA[m.g], u = quotaUsed(k, meal.id, m.g);
      return `<button class="chip ${cur === m.id ? 'on' : ''} ${u >= q ? 'full' : ''}" data-act="main" data-meal="${meal.id}" data-m="${m.id}">${m.chip}<em>${u}/${q}</em></button>`; }).join('')}</div>`; }
  h += itemsOf(meal, k).map(it => rowHTML(meal, it, d, A.over[meal.id + '.' + it.id])).join('');
  h += A.adds.filter(a => a.meal === meal.id).map(a => `<div class="row plus" data-act="add" data-meal="${meal.id}" data-i="${A.adds.indexOf(a)}"><span class="chk">${CHECK}</span><span class="body"><span class="name">${esc(a.name)}</span><span class="meta">${A.why}</span></span></div>`).join('');
  h += (d.extras || []).map((e, i) => e.meal !== meal.id ? '' : `<div class="row done" data-act="unextra" data-i="${i}"><span class="chk">${CHECK}</span><span class="body"><span class="name">${esc(e.name)}</span><span class="meta">Plan dışı · yaklaşık ${num(e.k)} kcal</span></span></div>`).join('');
  if (!st.resolved && meal.time) h += `<div class="acts"><button data-act="all" data-meal="${meal.id}">${CHECK.replace('<svg', '<svg style="stroke-width:2.4"')}Yedim</button><button data-act="photo" data-meal="${meal.id}">${CAM}Fotoğraf</button><button data-act="write" data-meal="${meal.id}">${PEN}Yaz</button></div>`;
  else if (!st.resolved) h += '<div style="height:4px"></div>';
  return h + '</section>';
}
function counterHTML(act, title, val, over, barPct) {
  return `<div class="counter"><span class="body">${title}<span class="val ${over ? 'over' : ''}">${val}</span>${barPct != null ? `<span class="bar"><u style="width:${barPct}%"></u></span>` : ''}</span>
    <button class="step" data-act="${act}" data-n="-1" aria-label="Azalt">−</button><button class="step" data-act="${act}" data-n="1" aria-label="Artır">+</button></div>`;
}
const ringSVG = (pct, color) => { const C = 2 * Math.PI * 18;
  return `<svg class="ring" viewBox="0 0 44 44" style="--c:${color}"><circle class="t" cx="22" cy="22" r="18"/><circle class="p" cx="22" cy="22" r="18" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(1, pct))}"/></svg>`; };
const nextMeal = () => MEALS.find(m => m.time && !mealStat(m, today).resolved);
function todayView() {
  const d = peek(sel), st = dayStat(sel), A = adjust(sel), B = balance(sel);
  const walks = weekOf(sel).filter(x => peek(x).walk).length;
  const strip = weekOf(sel).map(k => { const p = dayStat(k).pct, dt = parse(k);
    return `<button class="day ${k === sel ? 'sel' : ''} ${k === today ? 'today' : ''}" data-act="day" data-k="${k}"><small>${DOW[dt.getDay()]}</small><span class="disc" style="--p:${p}"><b>${dt.getDate()}</b></span></button>`; }).join('');
  const next = sel === today ? nextMeal() : null;
  const litres = d.water * WATER_ML / 1000;
  let top, big, what;
  if (next) { const mt = minsTo(next, sel), rel = mt > 0 ? (mt >= 60 ? `${Math.floor(mt / 60)} sa ${mt % 60} dk sonra` : `${mt} dk sonra`) : mt > -90 ? 'Şimdi' : 'Gecikti';
    top = `<span class="eyebrow">Sıradaki öğün</span><span class="pill ${rel === 'Gecikti' ? 'late' : mt <= 30 ? 'hot' : ''}">${rel}</span>`;
    big = `${next.title}<small>${timeOf(next, sel)}</small>`;
    what = itemsOf(next, sel).filter(i => !i.optional).map(i => (A.over[next.id + '.' + i.id] || i).name).concat(A.adds.filter(a => a.meal === next.id).map(a => a.name)).join(' · '); }
  else { top = `<span class="eyebrow">${sel === today ? 'Bugün' : 'Günün özeti'}</span><span class="pill">${st.ok} / ${st.total} kalem</span>`;
    big = `%${st.pct}<small>uyum</small>`; what = sel === today ? 'Bugünün öğünleri tamam.' : st.skipped ? `${st.skipped} öğün atlandı.` : ''; }
  const hero = `<section class="hero"><div class="hero-top">${top}</div><div class="big">${big}</div>${what ? `<div class="what">${esc(what)}</div>` : ''}
    <div class="tiles">
      <div class="tile"><div><span>Kalori</span><strong>${num(B.ek)}</strong><span>/ ${num(B.tk)}</span></div>${ringSVG(B.ek / B.tk, 'var(--fg)')}</div>
      <div class="tile"><div><span>Protein</span><strong>${num(B.ep)} g</strong><span>/ ${num(B.tp)} g</span></div>${ringSVG(B.ep / B.tp, 'var(--accent)')}</div>
      <div class="tile"><div><span>Su</span><strong>${litres.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} L</strong><span>/ 2,5 L</span></div>${ringSVG(d.water / WATER_GOAL, 'var(--blue)')}</div>
    </div></section>`;
  const W = WORKOUTS[parse(sel).getDay()], gyms = weekOf(sel).filter(x => peek(x).gym).length;
  const gymRow = `<div class="row ${d.gym ? 'done' : ''}" data-act="gym"><span class="chk">${CHECK}</span><span class="body"><span class="name">${W ? W.name + ' antrenmanı' : 'Ağırlık antrenmanı'}</span><span class="meta">${W ? '' : 'Bugün planlı değil · '}Bu hafta ${gyms} / ${GYM_GOAL}</span></span></div>`;
  const gymCard = !W ? '' : `<section class="card"><header data-act="foldgym"><span class="ico">${svg(MICON.gym)}</span><div class="ttl"><h2>Antrenman</h2><span class="sub">${W.name} · 18:00-19:00</span></div><span class="link quiet">${opened.gym ? 'Gizle' : 'Hareketler'}</span></header>
    ${opened.gym ? `<div class="prose"><p>Öncesi<small>${W.pre}</small></p></div>${W.ex.map(([n, x]) => `<div class="kv"><span>${n}</span><span>${x}</span></div>`).join('')}<div class="prose"><p>Sonrası<small>${W.post}</small></p></div>` : ''}
    ${gymRow}<div class="row ${d.z2 ? 'done' : ''}" data-act="z2"><span class="chk">${CHECK}</span><span class="body"><span class="name">Antrenman sonrası kardiyo</span><span class="meta">İsteğe bağlı</span></span></div></section>`;
  return `<div class="head"><div><div class="sub">${fmtLong(sel)}</div><h1>${sel === today ? 'Bugün' : DOW[parse(sel).getDay()] + ' ' + parse(sel).getDate()}</h1></div>
      ${sel !== today ? `<button class="pill" data-act="gotoday">Bugüne dön</button>` : ''}</div>
    <div class="strip">${strip}</div>${hero}
    ${A.note ? `<p class="note">${A.note}</p>` : ''}
    ${MEALS.map(m => mealHTML(m, sel, A, m === next) + (m.id === 'ikindi' ? gymCard : '')).join('')}
    <section class="card">
      ${counterHTML('water', 'Su', `${d.water} bardak · her dokunuş 250 ml`, false, Math.min(100, d.water / WATER_GOAL * 100)).replace('class="bar"', 'class="bar" style="--c:var(--blue)"')}
      ${counterHTML('coffee', 'Kahve', d.coffee > COFFEE_MAX ? `${d.coffee} fincan · sınır ${COFFEE_MAX}` : `${d.coffee} / ${COFFEE_MAX} fincan`, d.coffee > COFFEE_MAX)}
      <div class="row ${d.walk ? 'done' : ''}" data-act="walk"><span class="chk">${CHECK}</span><span class="body"><span class="name">45 dk yürüyüş</span><span class="meta">Bu hafta ${walks} / ${WALK_GOAL}</span></span></div>${W ? '' : gymRow}
    </section>`;
}
function weekView() {
  const wk = weekOf(sel), stats = wk.map(dayStat), logged = stats.filter(s => s.ok > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, s) => a + s.pct, 0) / logged.length) : 0;
  const walks = wk.filter(k => peek(k).walk).length, skipped = stats.reduce((a, s, i) => a + (wk[i] <= today && s.ok + s.skipped > 0 ? s.skipped : 0), 0);
  const bal = wk.filter(k => k <= today).map(balance).filter(b => b.any);
  const gk = bal.reduce((a, b) => a + b.gk, 0), full = bal.filter(b => !b.open.length);
  const pavg = full.length ? full.reduce((a, b) => a + b.tp - b.gp, 0) / full.length : 0;
  const left = wk.filter(k => k >= today).length, needWalk = Math.max(0, WALK_GOAL - walks);
  const ws = [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1), last = ws[ws.length - 1];
  let spark = '';
  if (ws.length > 1) { const v = ws.map(w => w.kg), mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
    const pts = ws.map((w, i) => [8 + i * (284 / (ws.length - 1)), 8 + (1 - (w.kg - mn) / r) * 48]);
    spark = `<svg class="spark" viewBox="0 0 300 64" preserveAspectRatio="none"><polyline points="${pts.map(p => p.join(',')).join(' ')}"/></svg>`; }
  const dm = (k, id) => mainFor(k, id).chip;
  return `<div class="head"><div><div class="sub">${parse(wk[0]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} – ${parse(wk[6]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</div><h1>Hafta</h1></div>
      <div><button class="link" data-act="week" data-n="-1">‹ Önceki</button>${wk[6] < today ? ` &nbsp;<button class="link" data-act="week" data-n="1">Sonraki ›</button>` : ''}</div></div>
    <div class="stats"><div class="stat"><strong>%${avg}</strong><span>Ortalama uyum</span></div><div class="stat"><strong>${skipped}</strong><span>Atlanan öğün</span></div>
      <div class="stat"><strong>${Math.abs(gk) < 50 ? 'Dengede' : (gk > 0 ? '−' : '+') + num(Math.abs(gk))}</strong><span>${Math.abs(gk) < 50 ? 'Plana göre kalori' : gk > 0 ? 'kcal plandan eksik' : 'kcal plandan fazla'}</span></div>
      <div class="stat"><strong>${pavg ? num(pavg) + ' g' : '—'}</strong><span>Günlük protein ort.</span></div></div>
    <section class="card">${wk.map((k, i) => `<button class="wrow" data-act="day" data-k="${k}" data-go="1"><span class="d">${parse(k).toLocaleDateString('tr-TR', { weekday: 'long' })}<small>${dm(k, 'ogle')} · ${dm(k, 'aksam')}</small></span><span class="bar"><u style="width:${stats[i].pct}%"></u></span><span class="pct">%${stats[i].pct}</span></button>`).join('')}</section>
    <p class="note">Gün adlarının altında öğle ve akşam ana yemeği yazar. Bir günü değiştirirsen haftanın kalanı kotaya göre yeniden dağıtılır.</p>
    <section class="card"><div class="kv"><span>Ağırlık antrenmanı</span><span>${wk.filter(k => peek(k).gym).length} / ${GYM_GOAL} · Pzt üst, Çar alt, Cum full body</span></div><div class="kv"><span>Yürüyüş</span><span>${walks} / ${WALK_GOAL}${needWalk ? ` · kalan ${left} günde ${needWalk} kez` : ' · tamam'}</span></div>
      ${Object.entries(QUOTA).map(([g, [n, q]]) => `<div class="kv"><span>${n}</span><span>öğle ${quotaUsed(sel, 'ogle', g)}/${q} · akşam ${quotaUsed(sel, 'aksam', g)}/${q}</span></div>`).join('')}</section>
    <div class="sect">Kilo · haftada bir, aynı saatte</div>
    <section class="card"><div class="kv"><span>Son ölçüm</span><span>${last ? last.kg.toLocaleString('tr-TR') + ' kg · ' + parse(last.d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '—'}</span></div>
      ${spark}<div class="field"><input id="kg" type="text" inputmode="decimal" placeholder="Bugünkü kilo (kg)"><button class="btn" data-act="weight">Kaydet</button></div></section>`;
}
function planView() {
  const t = balance(today);
  return `<div class="head"><div><div class="sub">13 Kasım 2026 · 1,2 g/kg protein</div><h1>Program</h1></div></div>
    <div class="sect">Hedef</div><section class="card"><div class="kv"><span>Nihai hedef</span><span>85 kg · göbeksiz, kas ağırlıklı</span></div>
      <div class="kv"><span>Bugünkü plan</span><span>≈ ${num(t.tk)} kcal · ${num(t.tp)} g protein</span></div></section>
    <div class="sect">Kurallar</div><section class="card prose">${RULES.map(([a, b]) => `<p>${a}${b ? `<small>${b}</small>` : ''}</p>`).join('')}</section>
    <div class="sect">Saatler</div><section class="card">${MEALS.filter(m => m.time).map(m => `<div class="kv"><span>${m.title}</span><span>${m.time} · hafta sonu ${m.wknd}</span></div>`).join('')}</section>
    <div class="sect">Muadiller</div><section class="card prose">${SWAPS.map(([a, b]) => `<p>${a}<small>${b}</small></p>`).join('')}</section>
    <p class="note">Muadiller ve kalori değerleri standart değişim listesine göre yaklaşık tahminlerdir; diyetisyenin onayladıklarını kullan.</p>
    <div class="sect">Vücut analizi · 13 Kasım</div><section class="card">${BODY.map(([a, b]) => `<div class="kv"><span>${a}</span><span>${b}</span></div>`).join('')}</section>
    <div class="sect">Fotoğraf ve yazıyla kayıt</div><section class="card"><div class="kv"><span>Anthropic API anahtarı</span><span>${aiKey() ? 'Kayıtlı' : 'Yok'}</span></div>
      <div class="field"><input id="aikey" type="password" autocomplete="off" placeholder="sk-ant-…"><button class="btn" data-act="savekey">Kaydet</button></div></section>
    <p class="note">Anahtar yalnızca bu cihazda saklanır, yedeğe girmez. Fotoğraflar analiz için doğrudan Anthropic'e gönderilir.${aiKey() ? ' <button class="link" data-act="delkey" style="font-size:13px;padding:0">Anahtarı sil</button>' : ''}</p>
    <div class="sect">Veri</div><section class="card"><div class="kv"><button class="link" data-act="export">Yedeği indir</button><button class="link" data-act="import">Yedekten yükle</button></div></section>
    <p class="note">Kayıtlar yalnızca bu cihazda tutulur.</p><input id="file" type="file" accept="application/json" hidden>`;
}
const ICON = { today: '<circle cx="13" cy="13" r="9"/><path d="M9 13.2l2.8 2.8 5.2-5.6"/>', week: '<path d="M5 20V12M10.5 20V6M16 20v-9M21.5 20V9"/>', plan: '<path d="M8 7h13M8 13h13M8 19h13"/><circle cx="4" cy="7" r=".6"/><circle cx="4" cy="13" r=".6"/><circle cx="4" cy="19" r=".6"/>' };
function render() {
  document.getElementById('app').innerHTML = tab === 'today' ? todayView() : tab === 'week' ? weekView() : planView();
  const b = ([t, n]) => `<button class="${tab === t ? 'on' : ''}" data-act="tab" data-t="${t}" aria-label="${n}"><svg viewBox="0 0 26 26">${ICON[t]}</svg><span>${n}</span></button>`;
  document.getElementById('nav').innerHTML = b(['today', 'Bugün']) + b(['week', 'Hafta']) + b(['plan', 'Program'])
    + `<button class="cam" data-act="quick" aria-label="Sıradaki öğünü fotoğrafla">${CAM.replace('viewBox="0 0 20 20"', 'viewBox="-2 -2 24 24"')}</button>`;
}

/* ---------- Alt sayfalar ---------- */
const $sheet = () => document.getElementById('sheet');
const showSheet = html => { $sheet().innerHTML = '<div class="grab"></div>' + html; document.body.classList.add('sheet-open'); };
const closeSheet = () => { document.body.classList.remove('sheet-open'); sheet = null; pending = null; };
function findItem(id) { const [mid, iid] = id.split('.'), meal = MEALS.find(m => m.id === mid); return [meal, itemsOf(meal, sel).find(i => i.id === iid)]; }
function openSheet(id) {
  const [meal, it] = findItem(id); sheet = id;
  showSheet(`<h3>${esc(it.name)}</h3><div class="sub">${meal.title}${it.meta ? ' · ' + esc(it.meta) : ''}</div>
    <div class="group"><button data-act="s-done"><span>Yedim</span></button><button data-act="s-skip"><span>Atladım</span></button><button class="accent" data-act="s-clear"><span>İşareti kaldır</span></button></div>
    <div class="sect" style="padding-top:4px">Yerine bunu yedim</div>
    <div class="group">${(it.subs || []).map((s, i) => `<button data-act="s-sub" data-i="${i}"><span>${esc(s)}</span></button>`).join('')}
      <div class="field"><input id="custom" type="text" placeholder="Başka bir şey…" enterkeyhint="done"><button class="btn" data-act="s-custom">Ekle</button></div></div>`);
}
function needKey() {
  showSheet(`<h3>API anahtarı gerekli</h3><div class="sub">Fotoğraf ve yazıyla kayıt için bir Anthropic API anahtarı gir. Yalnızca bu cihazda saklanır.</div>
    <div class="group"><div class="field"><input id="aikey" type="password" autocomplete="off" placeholder="sk-ant-…"><button class="btn" data-act="savekey">Kaydet</button></div></div>
    <button class="cancel" data-act="close">Vazgeç</button>`);
}
function writeSheet(meal) {
  camMeal = meal.id;
  showSheet(`<h3>${meal.title}'de ne yedin?</h3><div class="sub">Yaz, plana göre işleyeyim.</div>
    <textarea id="said" placeholder="Örn. 2 yumurta, peynir, 1 dilim ekmek. Avokado yoktu, yerine 5 zeytin yedim."></textarea>
    <button class="btn" data-act="sendtext">Gönder</button><button class="cancel" data-act="close">Vazgeç</button>`);
  setTimeout(() => { const t = document.getElementById('said'); t && t.focus(); }, 300);
}

/* ---------- Claude ile analiz ---------- */
const SCHEMA = { type: 'object', additionalProperties: false, required: ['main', 'items', 'extras', 'note'], properties: {
  main: { type: 'string', enum: ['', 'bakla', 'kofte', 'tavuk', 'balik', 'ton'] },
  items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'status', 'sub', 'kcal', 'protein'], properties: {
    id: { type: 'string' }, status: { type: 'string', enum: ['done', 'skip', 'swap'] }, sub: { type: 'string' }, kcal: { type: 'number' }, protein: { type: 'number' } } } },
  extras: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'kcal', 'protein'], properties: { name: { type: 'string' }, kcal: { type: 'number' }, protein: { type: 'number' } } } },
  note: { type: 'string' } } };
function shrink(file) {
  return new Promise((ok, no) => { const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const r = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.82).split(',')[1]); };
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

Kimliği "ana" olan kalem ana yemektir. Yenen ana yemek şu seçeneklerden birine uyuyorsa main alanına onun kimliğini yaz ve kalemi "done" say: bakla (kurubaklagil yemeği), kofte (ızgara köfte), tavuk, balik, ton (ton balıklı salata). Hiçbirine uymuyorsa main boş kalsın ve kalemi "swap" olarak işle. Plan "ana" kalemi içermiyorsa main boş kalsın.

Emin olamadığın bir şey varsa note alanında tek cümleyle söyle; yoksa boş bırak.`;
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  content.push({ type: 'text', text: `Planlanan kalemler:\n${JSON.stringify(plan, null, 1)}${text ? `\n\nKullanıcının yazdığı:\n${text}` : ''}` });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': aiKey(), 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 16000, system, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: SCHEMA } } }) });
    const j = await r.json();
    if (!r.ok) throw new Error(r.status === 401 ? 'API anahtarı geçersiz. Program sekmesinden yenisini gir.' : r.status === 429 ? 'Çok fazla istek; biraz sonra yeniden dene.' : (j.error && j.error.message) || 'İstek başarısız oldu.');
    if (j.stop_reason === 'refusal') throw new Error('Bu içerik analiz edilemedi.');
    const block = (j.content || []).find(b => b.type === 'text');
    const R = JSON.parse(block.text);
    pending = { meal: mealId, R, its };
    resultSheet(meal);
  } catch (e) {
    showSheet(`<h3>Olmadı</h3><p class="err">${esc(e.message || 'Bağlantı kurulamadı.')}</p><button class="cancel" data-act="close">Kapat</button>`);
  }
}
function resultSheet(meal) {
  const { R, its } = pending, lab = { done: 'Yedin', skip: 'Yok' };
  const rows = its.map(it => { const x = R.items.find(a => a.id === it.id) || { status: 'skip', kcal: 0 };
    const nm = it.id === 'ana' && R.main ? mainById(R.main).name : it.name;
    return `<div class="res"><span>${esc(x.status === 'swap' ? x.sub : nm)}<small>${x.status === 'swap' ? esc(it.name) + ' yerine' : lab[x.status]}</small></span><span>${x.status === 'skip' ? '—' : num(x.kcal) + ' kcal'}</span></div>`; }).join('');
  const ex = R.extras.map(e => `<div class="res"><span>${esc(e.name)}<small>Plan dışı</small></span><span>${num(e.kcal)} kcal</span></div>`).join('');
  showSheet(`<h3>${meal.title}</h3><div class="sub">Gördüklerim doğruysa kaydet; değilse kaydettikten sonra satırlardan düzeltebilirsin.</div>
    <div class="group">${rows}${ex}</div>${R.note ? `<p class="note">${esc(R.note)}</p>` : ''}
    <button class="btn" data-act="applyai">Kaydet</button><button class="cancel" data-act="close">Vazgeç</button>`);
}
function applyAI() {
  const { meal: mealId, R, its } = pending, d = day(sel), meal = MEALS.find(m => m.id === mealId);
  if (meal.main) d.main[mealId] = R.main || mainFor(sel, mealId).id;
  its.forEach(it => { const x = R.items.find(a => a.id === it.id) || { status: 'skip' }, id = mealId + '.' + it.id;
    d.items[id] = x.status === 'done' ? { s: 'done', alt: 0 } : x.status === 'skip' ? { s: 'skip' } : { s: 'swap', sub: x.sub || 'Farklı bir şey', k: x.kcal, p: x.protein }; });
  d.extras = d.extras.filter(e => e.meal !== mealId || e.adj).concat(R.extras.map(e => ({ meal: mealId, name: e.name, k: e.kcal, p: e.protein })));
  delete opened[sel + mealId];
}

/* ---------- Etkileşim ---------- */
const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, d = day(sel), meal = MEALS.find(m => m.id === el.dataset.meal), A = adjust(sel);
  const eaten = id => { const o = A.over[id]; return o ? { s: 'done', alt: 0, name: o.name, k: o.k, p: o.p } : { s: 'done', alt: 0 }; };
  const setAll = (m, fn) => itemsOf(m, sel).forEach(i => { const k = m.id + '.' + i.id, v = fn(d.items[k], i, k); v ? d.items[k] = v : delete d.items[k]; });
  switch (a) {
    case 'tab': tab = el.dataset.t; window.scrollTo(0, 0); break;
    case 'day': sel = el.dataset.k; if (el.dataset.go) { tab = 'today'; window.scrollTo(0, 0); } break;
    case 'week': sel = addDays(sel, 7 * +el.dataset.n); if (sel > today) sel = today; break;
    case 'gotoday': sel = today; break;
    case 'toggle': { const id = el.dataset.id, m = MEALS.find(x => x.id === id.split('.')[0]);
      if (d.items[id]) delete d.items[id]; else { lockMain(sel, m); d.items[id] = eaten(id); } buzz(); break; }
    case 'opt': { const id = el.dataset.id, i = +el.dataset.i, c = d.items[id];
      c && c.s === 'done' && c.alt === i ? delete d.items[id] : d.items[id] = { s: 'done', alt: i }; buzz(); break; }
    case 'add': { const x = A.adds[+el.dataset.i]; d.extras.push({ ...x, adj: true }); buzz(); break; }
    case 'unextra': d.extras.splice(+el.dataset.i, 1); break;
    case 'sheet': openSheet(el.dataset.id); return;
    case 'close': closeSheet(); return;
    case 'fold': if (e.target.closest('button')) return; { const k = sel + el.dataset.meal; opened[k] = !opened[k]; break; }
    case 'all': lockMain(sel, meal); A.adds.filter(x => x.meal === meal.id).forEach(x => d.extras.push({ ...x, adj: true }));
      setAll(meal, (c, i, k) => c || (i.optional ? null : eaten(k))); delete opened[sel + meal.id]; buzz(); break;
    case 'skipmeal': lockMain(sel, meal); setAll(meal, (c, i) => i.optional ? null : { s: 'skip' }); delete opened[sel + meal.id]; break;
    case 'clear': setAll(meal, () => null); d.extras = d.extras.filter(x => x.meal !== meal.id); break;
    case 'mode': d.mode[meal.id] = +el.dataset.i; break;
    case 'main': d.main[meal.id] === el.dataset.m ? delete d.main[meal.id] : d.main[meal.id] = el.dataset.m; break;
    case 'quick': { const m = nextMeal(); sel = today; tab = 'today'; if (!m) break; if (!aiKey()) { render(); return needKey(); } camMeal = m.id; render(); document.getElementById('cam').click(); return; }
    case 'photo': if (!aiKey()) return needKey(); camMeal = meal.id; document.getElementById('cam').click(); return;
    case 'write': if (!aiKey()) return needKey(); writeSheet(meal); return;
    case 'sendtext': { const v = document.getElementById('said').value.trim(); if (v) analyze(camMeal, { text: v }); return; }
    case 'applyai': applyAI(); closeSheet(); buzz(); break;
    case 'savekey': { const v = document.getElementById('aikey').value.trim(); if (!v) return; try { localStorage.setItem(AIKEY, v); } catch (x) {} closeSheet(); break; }
    case 'delkey': try { localStorage.removeItem(AIKEY); } catch (x) {} break;
    case 'water': d.water = Math.max(0, d.water + +el.dataset.n); buzz(); break;
    case 'coffee': d.coffee = Math.max(0, d.coffee + +el.dataset.n); break;
    case 'walk': d.walk = !d.walk; buzz(); break;
    case 'gym': d.gym = !d.gym; buzz(); break;
    case 'z2': d.z2 = !d.z2; break;
    case 'foldgym': opened.gym = !opened.gym; break;
    case 'weight': { const v = parseFloat(document.getElementById('kg').value.replace(',', '.'));
      if (!(v > 30 && v < 300)) return; S.weights = S.weights.filter(w => w.d !== today).concat({ d: today, kg: v }); break; }
    case 's-done': d.items[sheet] = { s: 'done', alt: (d.items[sheet] || {}).alt || 0 }; closeSheet(); break;
    case 's-skip': d.items[sheet] = { s: 'skip' }; closeSheet(); break;
    case 's-clear': delete d.items[sheet]; closeSheet(); break;
    case 's-sub': d.items[sheet] = { s: 'swap', sub: findItem(sheet)[1].subs[+el.dataset.i] }; closeSheet(); break;
    case 's-custom': { const v = document.getElementById('custom').value.trim(); if (!v) return; d.items[sheet] = { s: 'swap', sub: v }; closeSheet(); break; }
    case 'export': { const u = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
      const l = document.createElement('a'); l.href = u; l.download = `diyet-yedek-${today}.json`; l.click(); return; }
    case 'import': document.getElementById('file').click(); return;
  }
  save(); render();
});
document.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  if (e.target.id === 'cam') { e.target.value = ''; shrink(f).then(image => analyze(camMeal, { image })).catch(() => {}); }
  if (e.target.id === 'file') f.text().then(t => { const o = JSON.parse(t); if (o && o.days) { S = o; save(); render(); } }).catch(() => {});
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'custom') document.querySelector('[data-act="s-custom"]').click(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return; const t = key(new Date());
  if (t !== today) { if (sel === today) sel = t; today = t; } render();
});
setInterval(() => { if (!document.hidden && tab === 'today' && !document.body.classList.contains('sheet-open')) render(); }, 60000);
render();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  /* Yeni sürüm devreye girince sayfayı bir kez yenile. */
  const had = !!navigator.serviceWorker.controller; let done = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !done) { done = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
