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
  for (const m of p.meals) {
    for (const id of [...(m.items || []), ...(m.alt || [])]) if (!p.items[id]) return `"${m.title}" öğünündeki "${id}" kalemi katalogda yok.`;
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
const MEALS = PLAN.meals.map(m => ({ ...m, items: m.items.map(item), alt: m.alt && m.alt.map(item) }));
const MAIN_MEALS = MEALS.filter(m => m.main);
const TRAIN = PLAN.training, WORKOUTS = TRAIN.days, GYM_GOAL = TRAIN.perWeek;
const WATER_GOAL = PLAN.daily.water.goal, WATER_ML = PLAN.daily.water.ml, COFFEE_MAX = PLAN.daily.coffee.max, WALK_GOAL = PLAN.daily.walk.perWeek;
const WATER_L = (WATER_GOAL * WATER_ML / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
const AI_MODEL = 'claude-sonnet-5-5', CHAT_MODEL = 'claude-haiku-5-5';
/* Milyon token başına dolar (girdi, çıktı); kullanım sayacı için. */
const PRICE = { 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] };

/* ---------- Durum ---------- */
const KEY = 'diyet-v1', AIKEY = 'diyet-ai-key', USEKEY = 'diyet-ai-use', CHATKEY = 'diyet-chat';
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

/* Haftanın geri kalanı: seçilmemiş günlere, kalan kotaya göre ana yemek dağıtılır. */
function mainFor(k, mealId) {
  const own = peek(k).main[mealId]; if (own) return mainById(own);
  const wk = weekOf(k), pool = {}; Object.entries(GROUPS).forEach(([g, x]) => pool[g] = x.perWeek);
  wk.forEach(x => { const m = mainById(peek(x).main[mealId]); if (m) pool[m.g]--; });
  for (let i = 0; i < 7; i++) {
    if (peek(wk[i]).main[mealId]) continue;
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
  const ate = new Set((peek(k).extras || []).filter(e => !e.adj).map(e => e.meal));
  MEALS.forEach(m => { const s = mealStat(m, k); total += s.total; ok += s.ok; if (s.skip === s.total && !ate.has(m.id)) skipped++; });
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
const TUNE = PLAN.tune;
/* Önerinin düşeceği öğün: 'main', 'first', 'last' ya da öğün kimliği; liste ise ilk bulunan. */
const mealAt = (meals, at) => [].concat(at).map(a => a === 'main' ? meals.find(m => m.main) : a === 'first' ? meals[0] : a === 'last' ? meals[meals.length - 1] : meals.find(m => m.id === a)).find(Boolean);
const fill = (t, n, x) => t.replace('{n}', n).replace('{g}', n * (x.g || 1));
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
  if (k !== today || !b.any || !TUNE_ON) return out;
  let { gk, gp } = b;
  const meals = [...new Set(b.open.map(o => o.m))].filter(m => m.time);
  if (!meals.length) return out;
  /* Kabul edilen telafiler öneriyi değiştirmesin: açık öğünlerdeki telafi kayıtları farka geri eklenir,
     öneriler hep aynı farktan hesaplanır ve kabul edilenler işaretli görünür. */
  const d0 = peek(k), openIds = new Set(b.open.map(o => o.m.id));
  (d0.extras || []).forEach(e => { if (e.adj && openIds.has(e.meal)) { gk += e.k; gp += e.p; } });
  /* Telafi zincirlenmesin: önceki öğünlerde yenen telafi 250 kcal'i geçtiyse yenisi önerilmez. */
  const paid = (d0.extras || []).reduce((t, e) => t + (e.adj && !openIds.has(e.meal) ? e.k : 0), 0);
  const add = (meal, id, name, kk, pp) => { if (paid >= 250) return; out.adds.push({ meal: meal.id, id, name, k: kk, p: pp }); gk -= kk; gp -= pp; };
  /* Birimli öneri: max varsa açığa göre 1..max birim, yoksa tek birim. */
  const offer = (x, id, gap, per) => { const m = mealAt(meals, x.at); if (!m) return false;
    const n = x.max ? Math.min(x.max, Math.max(1, Math.round(gap / per))) : 1; add(m, id, fill(x.name, n, x), x.k * n, x.p * n); return true; };
  if (gp >= 8 && gk > -100) TUNE.protein.some(x => offer(x, 'x-prot', gp, x.p));
  if (gk >= 60 && TUNE.carb) offer(TUNE.carb, 'x-ekmek', gk, TUNE.carb.k);
  if (gk >= 90 && TUNE.snack) offer(TUNE.snack, 'x-ara', gk, TUNE.snack.k);
  out.adds.forEach(a => a.xi = (d0.extras || []).findIndex(e => e.adj && e.id === a.id && e.meal === a.meal));
  if (out.adds.length) out.why = 'Eksik kalanı dengelemek için eklendi';
  if (gk <= -80) {
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
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  link: '<path d="M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1 1M14 10a4 4 0 00-5.700 0l-3 3a4 4 0 005.700 5.700l1-1"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M20 20l-4.200-4.200"/>',
  pill: '<path d="M10.500 20.500l10-10a4.950 4.950 0 10-7-7l-10 10a4.950 4.950 0 107 7zM8.500 8.500l7 7"/>',
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${P[n] || ''}</svg>`;
const ring = (pct, size, w, color) => { const r = (size - w) / 2, C = 2 * Math.PI * r, c = size / 2;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="--c:${color}"><circle class="t" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}"/><circle class="p" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.max(0, Math.min(1, pct)))}"/></svg>`; };
const label = it => it.opts ? it.opts[0] : it.name;
const hint = it => it.opts ? 'veya ' + it.opts.slice(1).join(' · ') : it.meta || '';
const short = it => it.chip || it.name;
/* Önceden planlanmış sapma: henüz yenmemiş, plan dışı bir öğün. extras ve atlanan kalemler pl: true taşır;
   motor onları yenmiş sayar ki gün yemekten önce dengelensin. Kullanıcı yiyince "Yedim" ile onaylar. */
const planned = (m, k) => (peek(k).extras || []).some(e => e.meal === m.id && e.pl);
const nextMeal = () => MEALS.find(m => m.time && (!mealStat(m, today).resolved || planned(m, today)));
const openEv = {};

function rowHTML(meal, it, d, ov) {
  const id = meal.id + '.' + it.id, st = d.items[id], s = st ? st.s : '';
  let n = label(it), m = hint(it);
  if (!s && ov) { n = ov.name; m = 'Bugün için azaltıldı'; }
  if (s === 'done' && st.name) { n = st.name; m = 'Azaltılmış porsiyon'; }
  if (s === 'swap') { n = st.sub; m = label(it) + ' yerine'; }
  if (s === 'skip') m = st.pl ? 'Yerine başka şey planlandı' : 'Atlandı';
  return `<div class="row ${s}" data-act="toggle" data-id="${id}"><span class="chk">${ic(s === 'skip' ? 'dash' : s === 'swap' ? 'swap' : 'check')}</span>
    <span class="b"><span class="n">${esc(n)}</span>${m ? `<span class="m">${esc(m)}</span>` : ''}</span>
    <button class="more" data-act="sheet" data-id="${id}" aria-label="Seçenekler">${ic('dots')}</button></div>`;
}
function mealPanel(meal, k, A, st) {
  const d = peek(k), W = WORKOUTS[parse(k).getDay()];
  const cap = W && TRAIN.notes[meal.id] || '';
  let h = cap ? `<p class="cap">${cap}</p>` : '';
  if (meal.modes) h += `<div class="seg">${meal.modes.map((m, i) => `<button class="${(d.mode[meal.id] || 0) === i ? 'on' : ''}" data-act="mode" data-meal="${meal.id}" data-i="${i}">${m}</button>`).join('')}</div>`;
  h += itemsOf(meal, k).map(it => rowHTML(meal, it, d, A.over[meal.id + '.' + it.id])).join('');
  h += A.adds.filter(a => a.meal === meal.id).map(a => `<div class="row ${a.xi >= 0 ? 'done' : 'plus'}" data-act="add" data-i="${A.adds.indexOf(a)}"><span class="chk">${ic('check')}</span><span class="b"><span class="n">${esc(a.name)}</span><span class="m">${A.why}</span></span></div>`).join('');
  h += (d.extras || []).map((e, i) => e.meal !== meal.id || (e.adj && A.adds.some(a => a.xi === i)) ? '' : `<div class="row ${e.pl ? '' : 'done'}" data-act="${e.adj ? 'unextra' : 'xedit'}" data-i="${i}"><span class="chk">${ic('check')}</span><span class="b"><span class="n">${esc(e.name)}</span><span class="m">${e.adj ? 'Telafi' : e.pl ? 'Planlandı' : 'Plan dışı'}${KC ? ` · yaklaşık ${num(e.k)} kcal` : ''}</span></span></div>`).join('');
  if (planned(meal, k)) return h + `<div class="actions" style="grid-template-columns:1fr"><button class="primary" data-act="plok" data-meal="${meal.id}">${ic('check')}Yedim</button></div>
    <button class="textbtn" data-act="plno" data-meal="${meal.id}">Planı kaldır</button>`;
  if (st.resolved) return h + `<button class="textbtn" data-act="clear" data-meal="${meal.id}">İşaretleri sıfırla</button>`;
  return h + `<div class="actions"><button class="primary" data-act="all" data-meal="${meal.id}">${ic('check')}${st.ok + st.skip ? 'Kalanını yedim' : 'Hepsini yedim'}</button>
      <button class="sq" data-act="photo" data-meal="${meal.id}" aria-label="Fotoğrafla kaydet">${ic('cam')}</button>
      <button class="sq" data-act="write" data-meal="${meal.id}" aria-label="Yazarak kaydet">${ic('pen')}</button></div>
    <button class="textbtn" data-act="skipmeal" data-meal="${meal.id}">Bu öğünü atladım</button>`;
}
function eventHTML({ id, cls, node, title, sub, right, panel, act }) {
  return `<div class="ev ${cls} ${panel ? 'open' : ''}"><span class="node">${ic(node)}</span><div>
    <button class="evh" ${act}><div><h3>${title}</h3><p>${esc(sub)}</p></div>${right}</button></div>${panel ? `<div class="panel">${panel}</div>` : ''}</div>`;
}
function mealEvent(meal, k, A, next, open) {
  const d = peek(k), st = mealStat(meal, k), ate = (d.extras || []).filter(e => e.meal === meal.id && !e.adj), allSkip = st.skip === st.total && !ate.length, isNow = meal === next;
  const pl = planned(meal, k), done = st.resolved && !pl;
  const cls = done ? (allSkip ? 'skipd' : 'done') : isNow ? 'now' : '';
  let sub = pl ? 'Planlandı · ' + ate.filter(e => e.pl).map(e => e.name).join(' · ')
    : st.resolved ? (allSkip ? 'Atlandı' : st.skip === st.total ? ate.map(e => e.name).join(' · ') : st.skip ? `${st.ok} / ${st.total} kalem` : 'Tamam')
    : itemsOf(meal, k).filter(i => !i.optional).map(short).join(' · ') + (A.adds.some(a => a.meal === meal.id) ? ' · + telafi' : '');
  let right = meal.time ? `<span class="t">${timeOf(meal, k)}</span>` : '';
  if (open === meal.id && !st.resolved && !pl) sub = itemsOf(meal, k).filter(i => !i.optional).length + ' kalem';
  if (isNow) { const mt = minsTo(meal, k); sub = timeOf(meal, k) + ' · ' + sub;
    right = `<span class="pill ${mt < -90 ? 'late' : mt <= 30 ? 'hot' : ''}">${mt > 0 ? (mt >= 60 ? `${Math.floor(mt / 60)} sa ${mt % 60} dk` : `${mt} dk`) : mt > -90 ? 'Şimdi' : 'Gecikti'}</span>`; }
  else if (isLate(meal, k)) right = `<span class="pill late">Gecikti</span>`;
  if (!meal.time) { const it = meal.items[0], id = meal.id + '.' + it.id, s = d.items[id];   /* saatsiz tek kalem: satıra dokunmak yeter */
    const sub = [label(it), it.meta && it.meta[0].toLocaleLowerCase('tr') + it.meta.slice(1)].filter(Boolean).join(', ');
    return eventHTML({ cls, node: s ? 'check' : meal.id, title: meal.title, sub: s ? 'Tamam' : sub, right: '', act: `data-act="toggle" data-id="${id}"` }); }
  return eventHTML({ cls, node: done ? (allSkip ? 'dash' : 'check') : meal.id, title: meal.title, sub, right,
    act: `data-act="ev" data-id="${meal.id}"`, panel: open === meal.id ? mealPanel(meal, k, A, st) : '' });
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
  if (g && (!next || mt > 30 || mt < -90)) return 'sp:' + g.at;
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
    <p class="lead">Aldığın takviyeler ve ne zaman aldığın. Öğüne bağlı olanlar öğünün hemen ardından çıkar; öğünü işaretleyince sırada onlar olur.</p>
    ${L.length ? `<div class="group">${L.map(s => `<button class="opt" data-act="spedit" data-id="${esc(s.id)}"><span>${esc(s.n)}<small>${[s.dose, supAt(anc(s))].filter(Boolean).map(esc).join(' · ')}</small></span>${ic('right')}</button>`).join('')}</div>`
      : `<button class="primary" data-act="spnew">${ic('plus')}İlk takviyeni ekle</button><p class="note" style="padding-top:12px">Örneğin omega 3 kahvaltıdan sonra, magnezyum yatmadan önce, kreatin günün herhangi bir saatinde.</p>`}
    <p class="note">Bu liste senin kaydın; diyetisyenin programını değiştirmez. Yeni bir takviyeye başlamadan önce ona danış.</p>`);
}
function supForm() {
  sheet = 'sup';
  const f = SP, at = f.at, kind = isHM(at) ? 'saat' : at;
  const ch = (v, n) => `<button class="${kind === v ? 'on' : ''}" data-act="spat" data-at="${v}">${n}</button>`;
  const m = MEALS.find(x => x.id === at);
  const how = at === 'yat' ? 'Günün sonunda, gece öğününden sonra hatırlatılır.' : isHM(at) ? 'Zaman çizelgesinde bu saate yerleşir.'
    : !at ? 'Gün boyu bölümünde durur; ne zaman alırsan işaretle.' : `${m.title} işaretlenince sırada bu olur.`;
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
function todayView() {
  const d = peek(sel), st = dayStat(sel), A = adjust(sel), B = balance(sel), wk = weekOf(sel);
  const next = sel === today ? nextMeal() : null, W = WORKOUTS[parse(sel).getDay()];
  const open = openEv[sel] !== undefined ? openEv[sel] : defOpen(sel);
  /* Takviyeler: öğüne bağlı olan öğünün ardından, saatli olan saatine göre, yatarken olan en sonda. */
  const G = supGroups(), sp = at => G.filter(g => g.at === at).map(g => supEvent(g, sel, open)).join('');
  const timed = G.filter(g => isHM(g.at)).sort((a, b) => a.at < b.at ? -1 : 1);
  const before = m => { if (!m.time) return ''; const t = timeOf(m, sel), out = timed.filter(g => !g.put && g.at < t); out.forEach(g => g.put = true); return out.map(g => supEvent(g, sel, open)).join(''); };
  const anytime = SUPS().filter(s => !anc(s));
  const strip = wk.map(k => { const dt = parse(k);
    return `<button class="day ${k === sel ? 'sel' : ''} ${k === today ? 'today' : ''}" data-act="day" data-k="${k}"><small>${DOW[dt.getDay()]}</small><span class="disc" style="--p:${dayStat(k).pct}"><b>${dt.getDate()}</b></span></button>`; }).join('');
  const litres = (d.water * WATER_ML / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const tile = (name, val, unit, of, pct, color) => `<div class="tile"><div class="top"><span class="label">${name}</span>${ring(pct, 30, 4.5, color)}</div><strong>${val}${unit ? `<em>${unit}</em>` : ''}</strong><small>${of}</small></div>`;
  const walks = wk.filter(x => peek(x).walk).length, gyms = wk.filter(x => peek(x).gym).length;
  return `<header class="head"><div><p>${fmtLong(sel)}</p><h1>${sel === today ? 'Bugün' : parse(sel).toLocaleDateString('tr-TR', { weekday: 'long' })}</h1></div>
      <div class="hright"><button class="round" data-act="chat" aria-label="Asistana sor">${ic('chat')}</button>
      ${sel !== today ? `<button class="pill" data-act="gotoday">Bugüne dön</button>` : `<div class="dayring">${ring(st.pct / 100, 54, 5, 'var(--accent)')}<b>%${st.pct}</b></div>`}</div></header>
    <div class="strip">${strip}</div>
    <div class="tiles">${KC ? tile('Kalori', num(B.ek), '', `/ ${num(B.tk)} kcal`, B.ek / B.tk, 'var(--fg)') : (() => { const ms = MEALS.filter(m => m.time), r = ms.filter(m => mealStat(m, sel).resolved).length; return tile('Öğün', r, '', `/ ${ms.length} öğün`, r / ms.length, 'var(--fg)'); })()}${tile('Protein', num(B.ep), 'g', `/ ${num(B.tp)} g`, B.ep / B.tp, 'var(--accent)')}${tile('Su', litres, 'L', `/ ${WATER_L} L`, d.water / WATER_GOAL, 'var(--blue)')}</div>
    ${A.note ? `<p class="note">${A.note}</p>` : ''}
    <div class="tl">${MEALS.map(m => before(m) + mealEvent(m, sel, A, next, open) + sp(m.id) + (m.id === TRAIN.after && W ? gymEvent(sel, W, open) : '')).join('')}${timed.filter(g => !g.put).map(g => supEvent(g, sel, open)).join('')}${sp('yat')}</div>
    <div class="sect">Gün boyu</div>
    <section class="card">
      <div class="row"><span class="b"><span class="n">Su</span><span class="m">${d.water} bardak · ${litres} / ${WATER_L} L</span></span>${stepper('water', d.water)}</div>
      <div class="row"><span class="b"><span class="n">Kahve</span><span class="m ${d.coffee > COFFEE_MAX ? 'over' : ''}">${d.coffee > COFFEE_MAX ? 'Günlük sınır aşıldı' : PLAN.daily.coffee.note}</span></span>${stepper('coffee', d.coffee, d.coffee > COFFEE_MAX)}</div>
      <div class="row ${d.walk ? 'done' : ''}" data-act="walk"><span class="b"><span class="n">${PLAN.daily.walk.name}</span><span class="m">Bu hafta ${walks} / ${WALK_GOAL}</span></span><span class="chk">${ic('check')}</span></div>
      ${anytime.map(s => `<div class="row ${supTaken(sel, s.id) ? 'done' : ''}" data-act="sup" data-id="${esc(s.id)}"><span class="b"><span class="n">${esc(s.n)}</span><span class="m">${esc(s.dose ? s.dose + ' · saat önemsiz' : 'Takviye · saat önemsiz')}</span></span><span class="chk">${ic('check')}</span></div>`).join('')}
      ${W ? '' : `<div class="row ${d.gym ? 'done' : ''}" data-act="gym"><span class="b"><span class="n">Ağırlık antrenmanı</span><span class="m">Bugün planlı değil · bu hafta ${gyms} / ${GYM_GOAL}</span></span><span class="chk">${ic('check')}</span></div>`}
    </section>`;
}
function weekView() {
  const wk = weekOf(sel), stats = wk.map(dayStat), logged = stats.filter(s => s.ok > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, s) => a + s.pct, 0) / logged.length) : 0;
  const skipped = stats.reduce((a, s, i) => a + (wk[i] <= today && s.ok + s.skipped > 0 ? s.skipped : 0), 0);
  const bal = wk.filter(k => k <= today).map(balance).filter(b => b.any);
  const gk = bal.reduce((a, b) => a + b.gk, 0), full = bal.filter(b => !b.open.length);
  const pavg = full.length ? full.reduce((a, b) => a + b.ep, 0) / full.length : 0;
  const waters = wk.map(k => peek(k).water).filter(Boolean), wavg = waters.length ? waters.reduce((a, b) => a + b, 0) / waters.length * WATER_ML / 1000 : 0;
  const walks = wk.filter(k => peek(k).walk).length, gyms = wk.filter(k => peek(k).gym).length;
  const dots = n => `<span class="dots">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
  const ws = [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1), last = ws[ws.length - 1], first = ws[0];
  let spark = '';
  if (ws.length > 1) { const v = ws.map(w => w.kg), mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
    spark = `<svg class="spark" viewBox="0 0 300 56" preserveAspectRatio="none"><polyline points="${ws.map((w, i) => `${4 + i * (292 / (ws.length - 1))},${6 + (1 - (w.kg - mn) / r) * 44}`).join(' ')}"/></svg>`; }
  const diff = last && first && last !== first ? last.kg - first.kg : 0;
  const stat = (name, val, unit, sub) => `<div class="tile"><span class="label">${name}</span><strong style="margin-top:10px">${val}${unit ? `<em>${unit}</em>` : ''}</strong><small>${sub}</small></div>`;
  return `<header class="head"><div><p>${fmtDM(wk[0])} – ${fmtDM(wk[6])}</p><h1>Hafta</h1></div>
      <div style="display:flex;gap:8px"><button class="round" data-act="week" data-n="-1" aria-label="Önceki hafta">${ic('left')}</button><button class="round" data-act="week" data-n="1" aria-label="Sonraki hafta" ${wk[6] >= today ? 'disabled' : ''}>${ic('right')}</button></div></header>
    <section class="card pad"><div class="between"><div><span class="label">Ortalama uyum</span><div class="num">%${avg}</div></div><span class="pill">${logged.length} gün kayıtlı</span></div>
      <div class="bars">${wk.map((k, i) => `<button class="barcol ${k === today ? 'today' : ''}" data-act="day" data-k="${k}" data-go="1" aria-label="${fmtDM(k)}"><span><u style="height:${stats[i].pct}%"></u></span><small>${DOW[parse(k).getDay()]}</small></button>`).join('')}</div></section>
    <div class="tiles two">${KC ? stat('Kalori dengesi', Math.abs(gk) < 50 ? 'Dengede' : (gk > 0 ? '−' : '+') + num(Math.abs(gk)), Math.abs(gk) < 50 ? '' : 'kcal', Math.abs(gk) < 50 ? 'Plana göre' : gk > 0 ? 'Plandan eksik' : 'Plandan fazla')
        : stat('Plan dışı', wk.filter(k => k <= today).reduce((t, k) => t + (peek(k).extras || []).filter(e => !e.adj).length, 0), '', 'Bu hafta kayıt')}
      ${stat('Protein', pavg ? num(pavg) : '—', pavg ? 'g' : '', 'Günlük ortalama')}${stat('Atlanan öğün', skipped, '', 'Bu hafta')}${stat('Su', wavg ? wavg.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) : '—', wavg ? 'L' : '', 'Günlük ortalama')}</div>
    <section class="card"><div class="kv"><span>Ağırlık antrenmanı</span><span style="display:flex;align-items:center;gap:10px">${gyms} / ${GYM_GOAL}${dots(gyms)}</span></div>
      <div class="kv"><span>Yürüyüş</span><span style="display:flex;align-items:center;gap:10px">${walks} / ${WALK_GOAL}${dots(walks)}</span></div></section>
    <div class="sect">Haftanın ana yemekleri</div>
    <section class="card" style="padding:10px 8px"><div class="menu h"><span></span>${MAIN_MEALS.map(m => `<span>${m.title}</span>`).join('')}</div>
      ${wk.map(k => `<button class="menu ${k === today ? 'today' : k < today ? 'past' : ''}" data-act="day" data-k="${k}" data-go="1"><b>${DOW[parse(k).getDay()]}</b>${MAIN_MEALS.map(m => `<span>${mainFor(k, m.id).chip}</span>`).join('')}</button>`).join('')}</section>
    <p class="note">Bir gün farklı yersen kalan günler kotaya göre yeniden dağıtılır.</p>
    <div class="sect">Kilo</div>
    <section class="card pad"><div class="between"><div><span class="label">Son ölçüm · ${last ? parse(last.d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : ''}</span><div class="num">${last ? last.kg.toLocaleString('tr-TR') : '—'}<em>kg</em></div></div>
      ${diff ? `<span class="pill">${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} kg</span>` : ''}</div>
      ${spark}<div class="field" style="padding-bottom:0"><input id="kg" type="text" inputmode="decimal" placeholder="Bugünkü kilo"><button class="btn" data-act="weight">Kaydet</button></div></section>
    <p class="note">Haftada bir, aynı saatte tartıl.</p>
    <button class="primary" data-act="report" style="margin:8px 0 4px">${ic('up')}Haftalık raporu gönder</button>
    <p class="note" style="text-align:center">Haftalık kontrolden önce diyetisyenine.</p>`;
}
const PROG = [['kurallar', 'list', 'Kurallar', `${RULES.length} madde`], ['saatler', 'clock', 'Öğün saatleri', 'Hafta içi ve hafta sonu'], ['muadil', 'swap', 'Muadiller', 'Neyin yerine ne yenir'], ['gidalar', 'ogle', 'Gıdalarım', ''], ['takviye', 'pill', 'Takviyeler', ''],
  ['antrenman', 'gym', 'Antrenman', Object.entries(WORKOUTS).map(([n, w]) => `${DOW[n]} ${w.name.toLocaleLowerCase('tr')}`).join(' · ')], ['vucut', 'person', 'Vücut analizi', `${fmtDM(PLAN.body.date)} ölçümü`], ['ai', 'chat', 'Yapay zekâ', ''], ['baglanti', 'link', 'Program bağlantısı', 'Yükle ya da paylaş'], ['veri', 'down', 'Yedek', 'İndir ya da geri yükle']];
function planView() {
  const t = balance(today), last = [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1).pop();
  return `<header class="head"><div><p>${esc(PLAN.dietitian.name || 'Diyetisyen programı')} · ${fmtDM(PLAN.date)}</p><h1>Program</h1></div></header>
    <section class="card pad"><span class="label">Hedef</span><div class="num">${PLAN.goal.kg.toLocaleString('tr-TR')}<em>kg</em></div><p class="note" style="padding:8px 0 14px">${esc(PLAN.goal.text)}</p>
      <div class="tiles two" style="margin:0"><div class="tile" style="background:var(--ctl);box-shadow:none"><span class="label">Şu an</span><strong style="margin-top:8px">${last.kg.toLocaleString('tr-TR')}<em>kg</em></strong><small>${PLAN.body.fat} yağ</small></div>
        <div class="tile" style="background:var(--ctl);box-shadow:none"><span class="label">Günlük plan</span>${KC ? `<strong style="margin-top:8px">${num(t.tk)}<em>kcal</em></strong><small>${num(t.tp)} g protein</small>` : `<strong style="margin-top:8px">${num(t.tp)}<em>g</em></strong><small>protein</small>`}</div></div></section>
    <section class="card">${PROG.map(([id, icn, n, m]) => `<button class="nav-row" data-act="prog" data-p="${id}"><span class="ic">${ic(icn)}</span><span class="b"><span class="n">${n}</span><span class="m">${id === 'ai' ? (aiCode() ? 'Davet kodu kayıtlı' : aiKey() ? 'API anahtarı kayıtlı' : PROXY_URL ? 'Davet kodu gerekli' : 'API anahtarı gerekli') : id === 'gidalar' ? (Object.keys(S.foods || {}).length ? `${Object.keys(S.foods).length} gıda` : 'Kendi ürünlerin') : id === 'takviye' ? (SUPS().length ? `${SUPS().length} takviye` : 'Ne zaman alacağını hatırlat') : m}</span></span>${ic('right')}</button>`).join('')}</section>
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
    veri: () => `<h2>Yedek</h2><p class="lead">Kayıtların bu cihazda durur. Telefon değiştirmeden önce yedek al.</p><div class="group"><button class="opt" data-act="export"><span>Yedeği indir</span>${ic('down')}</button><button class="opt" data-act="import"><span>Yedekten yükle</span>${ic('right')}</button></div>`,
  };
  showSheet(S2[p]());
}
function render() {
  document.getElementById('app').innerHTML = tab === 'today' ? todayView() : tab === 'week' ? weekView() : planView();
  document.getElementById('dock').innerHTML = `<div class="tabs">${[['today', 'today', 'Bugün'], ['week', 'week', 'Hafta'], ['plan', 'list', 'Program']].map(([t, i, n]) =>
    `<button class="${tab === t ? 'on' : ''}" data-act="tab" data-t="${t}">${ic(i)}${n}</button>`).join('')}</div><button class="fab" data-act="quick" aria-label="Sıradaki öğünü fotoğrafla">${ic('cam')}</button>`;
}

/* ---------- Alt sayfalar ---------- */
const $sheet = () => document.getElementById('sheet');
const showSheet = html => { $sheet().innerHTML = '<div class="grab"></div>' + html; $sheet().scrollTop = 0; document.body.classList.add('sheet-open'); };
const closeSheet = () => { document.body.classList.remove('sheet-open'); sheet = null; pending = null; };
function findItem(id) { const [mid, iid] = id.split('.'), meal = MEALS.find(m => m.id === mid); return [meal, itemsOf(meal, sel).find(i => i.id === iid)]; }
function openSheet(id) {
  const [meal, it] = findItem(id), st = peek(sel).items[id], s = st ? st.s : ''; sheet = id;
  const tick = on => on ? ic('check') : '';
  const mains = it.id !== 'ana' ? '' : `<div class="sect">Ana yemeği değiştir</div><div class="group">${MAINS.map(m => { const q = GROUPS[m.g].perWeek, u = quotaUsed(sel, meal.id, m.g), cur = mainFor(sel, meal.id).id === m.id;
    return `<button class="opt" data-act="main" data-meal="${meal.id}" data-m="${m.id}"><span>${m.name}<small>Bu hafta ${u} / ${q}</small></span>${tick(cur)}</button>`; }).join('')}</div>`;
  showSheet(`<h2>${esc(label(it))}</h2><p class="lead">${meal.title}${hint(it) ? ' · ' + esc(hint(it)) : ''}</p>
    <div class="group"><button class="opt" data-act="s-done"><span>Yedim</span>${tick(s === 'done')}</button><button class="opt" data-act="s-skip"><span>Atladım</span>${tick(s === 'skip')}</button></div>
    ${s === 'swap' && st.k != null ? `<div class="sect">${esc(st.src ? st.src.n : st.sub)}: ne kadar?</div>${qchips('sq', st.q || 1)}` : ''}
    ${mains}<div class="sect">Yerine bunu yedim</div>
    <div class="group">${(it.subs || []).map((x, i) => `<button class="opt" data-act="s-sub" data-i="${i}"><span>${esc(x)}</span>${tick(s === 'swap' && st.sub === x)}</button>`).join('')}
      <div class="field"><input id="custom" type="text" placeholder="Başka bir şey… (ara ya da yaz)" enterkeyhint="done" autocomplete="off"><button class="btn" data-act="s-custom">Ekle</button></div><div id="csug"></div></div>
    ${s ? `<button class="textbtn" data-act="s-clear">İşareti kaldır</button>` : ''}`);
}
function needKey() { progSheet('ai'); }

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
const aiFetch = body => aiCode()
  ? fetch(PROXY_URL + '/v1/messages', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', authorization: 'Bearer ' + aiCode() } })
  : fetch(AI_URL, { method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-api-key': aiKey(), 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' } });
const aiErr = (r, j) => new Error(r.status === 401 ? (aiCode() ? 'Davet kodu geçersiz. Program → Yapay zekâ bölümünden kontrol et.' : 'API anahtarı geçersiz. Program sekmesinden yenisini gir.')
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
  if (!aiAuth()) { needKey(); return false; }
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

Kimliği "ana" olan kalem ana yemektir. Yenen ana yemek şu seçeneklerden birine uyuyorsa main alanına onun kimliğini yaz ve kalemi "done" say: ${MAINS.map(m => m.ai ? `${m.id} (${m.ai})` : m.id).join(', ')}. Hiçbirine uymuyorsa main boş kalsın ve kalemi "swap" olarak işle. Plan "ana" kalemi içermiyorsa main boş kalsın.

Emin olamadığın bir şey varsa note alanında tek cümleyle söyle; yoksa boş bırak.`;
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  content.push({ type: 'text', text: `Planlanan kalemler:\n${JSON.stringify(plan, null, 1)}${text ? `\n\nKullanıcının yazdığı:\n${text}` : ''}` });
  try {
    const R = await aiJSON({ model: AI_MODEL, max_tokens: 16000, system, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: SCHEMA } } }, 'Bu içerik analiz edilemedi.');
    pending = { meal: mealId, R, its };
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
  const { meal: mealId, R, its } = pending, d = day(sel), meal = MEALS.find(m => m.id === mealId);
  if (meal.main) d.main[mealId] = R.main || mainFor(sel, mealId).id;
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
const QS = [.25, .5, .75, 1, 1.5, 2, 3];   /* porsiyon ölçekleri */
const qLab = q => { const w = Math.floor(q), f = { .25: '¼', .5: '½', .75: '¾' }[q - w] || ''; return (w || '') + f || '0'; };
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
    `<div class="trow"><div class="row"><span class="b"><span class="n">${esc(x.n)}</span><span class="m">${esc(x.u ? x.u + ' · ' : '')}${KC ? num(x.k * x.q) + ' kcal · ' : ''}${num1(x.p * x.q)} g protein</span></span>${x.img ? `<img class="th" src="${x.img}" alt="">` : ''}<button class="more" data-act="qx" data-i="${i}" aria-label="Çıkar">${ic('x')}</button></div>
      <div class="qchips">${QS.map(v => `<button class="${v === x.q ? 'on' : ''}" data-act="qq" data-i="${i}" data-v="${v}">${qLab(v)}</button>`).join('')}</div></div>`).join('')}</div>
    ${open.length ? `<div class="seg" style="margin:0 0 6px"><button class="${mode === 'yerine' ? 'on' : ''}" data-act="qmode" data-m="yerine">Planın yerine</button><button class="${mode === 'ek' ? 'on' : ''}" data-act="qmode" data-m="ek">Plana ek</button></div>
      <p class="note" style="padding:6px 6px 12px">${mode === 'yerine' ? `Öğünün işaretlenmemiş kalemleri atlandı sayılır; kalan öğünler buna göre dengelenir.` : `Öğünün planı olduğu gibi kalır; bu, üstüne eklenir.`}</p>` : ''}
    ${qLater(meal) ? `<button class="primary" data-act="qsave" data-pl="1">${ic('clock')}Planla${KC ? ` · ${num(tk)} kcal` : ''}</button>
      <p class="note" style="padding:10px 6px 0;text-align:center">Gün şimdiden buna göre dengelenir; yiyince onaylarsın.</p><button class="textbtn" data-act="qsave">Yedim, kaydet</button>`
    : `<button class="primary" data-act="qsave">${ic('check')}Kaydet${KC ? ` · ${num(tk)} kcal` : ''}</button>`}`;
  Q.res = qFind(meal.id, q).filter(x => !Q.tray.some(t => t.id === x.id));
  const rows = Q.res.map((x, i) => `<button class="opt" data-act="qadd" data-i="${i}"><span>${esc(x.n)}<small>${esc(x.u || '')}${KC ? `${x.u ? ' · ' : ''}${num(x.k)} kcal` : ''}${x.mine ? ' · senin' : ''}</small></span><span class="fi">${x.img ? `<img class="th" src="${x.img}" alt="">` : ''}${ic('plus')}</span></button>`).join('');
  const add = `<button class="opt" data-act="fnew" data-ret="${meal.id}" data-q="${esc(q)}"><span>Yeni gıda ekle<small>Kendi ürününü fotoğrafla ya da elle kaydet</small></span>${ic('cam')}</button>`;
  const ai = q ? `<button class="opt" data-act="qai"><span>“${esc(q)}”<small>Yapay zekâyla işle${aiAuth() ? '' : PROXY_URL ? ' · davet kodu gerekli' : ' · API anahtarı gerekli'}</small></span>${ic('pen')}</button>` : '';
  document.getElementById('qres').innerHTML = !q && !Q.res.length
    ? (Q.tray.length ? '' : `<p class="lead" style="padding-top:14px">Yediğin şeyi ara. Kaydettiklerin burada birikir; bir dahakine tek dokunuşla eklersin.</p><div class="group">${add}</div>`)
    : `<div class="sect">${q ? 'Sonuçlar' : 'Senin gıdaların'}</div><div class="group">${rows}${ai}${add}</div>${q && !Q.res.length ? `<p class="note">Kütüphanede yok. Yapay zekâ işlerse ya da kendin eklersen bir dahakine burada çıkar.</p>` : ''}`;
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
  CS = v ? qFind(sheet.split('.')[0], v).slice(0, 4) : [];
  box.innerHTML = CS.map((x, i) => `<button class="opt" data-act="s-food" data-i="${i}"><span>${esc(x.n)}<small>${esc(x.u || '')}${KC ? `${x.u ? ' · ' : ''}${num(x.k)} kcal` : ''}</small></span>${ic('plus')}</button>`).join('');
}

/* ---------- Gıdalarım ----------
   Kullanıcının kendi gıda arşivi: S.foods. Hızlı kayıtla ve yapay zekâyla biriken her şey burada; kullanıcı kendi
   ürünlerini (whey, protein bar…) fotoğrafla ya da elle ekler. own: kullanıcı girdi, değerlerinin üstüne yazılmaz.
   img: 160 px kare küçük resim (data URL). */
let FD = null;   /* düzenlenen gıda: { id, n, u, k, p, img, full, ret, busy, err, note, del } */
function thumb(file, size = 160) {
  return new Promise((ok, no) => { const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', .72)); };
    img.onerror = () => no(new Error('Fotoğraf okunamadı')); img.src = url; });
}
const tile = f => f.img ? `<img class="th" src="${f.img}" alt="">` : `<span class="th">${esc((f.n || '?').trim()[0].toLocaleUpperCase('tr'))}</span>`;
function foodsSheet() {
  sheet = 'foods';
  const list = Object.entries(S.foods || {}).sort(([, a], [, b]) => (b.t || '').localeCompare(a.t || '') || b.c - a.c);
  showSheet(`<div class="between" style="align-items:center;padding-right:6px"><h2>Gıdalarım</h2><button class="pill" data-act="fnew">${ic('plus')}Yeni</button></div>
    <p class="lead">Kendi ürünlerin ve daha önce kaydettiklerin. Öğüne eklerken aramada önce bunlar çıkar.</p>
    ${list.length ? `<div class="group">${list.map(([id, f]) => `<button class="opt" data-act="fedit" data-id="${esc(id)}"><span class="fi">${tile(f)}<span>${esc(f.n)}<small>${esc(f.u ? f.u + ' · ' : '')}${KC ? num(f.k) + ' kcal · ' : ''}${num1(f.p)} g protein</small></span></span>${ic('right')}</button>`).join('')}</div>`
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
    <div class="sect">Program yükle</div>
    <div class="group"><div class="field"><input id="plink" type="text" autocomplete="off" placeholder="Bağlantıyı yapıştır"><button class="btn" data-act="planpaste">Aç</button></div></div>
    ${PL.err ? `<p class="err">${esc(PL.err)}</p>` : ''}
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

/* ---------- Haftalık rapor ----------
   Diyetisyenin haftalık kontrolü için, kâğıt takip tablolarının yerine. Yerelde üretilir (yapay zekâ yok);
   WhatsApp biçimiyle (*kalın*) düz metin. Telefon numarası varsa doğrudan diyetisyenin sohbetine açılır. */
const fmtNum1 = n => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
function weekReport(k0) {
  const wk = weekOf(k0), past = wk.filter(k => k <= today), fmtD = k => parse(k).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  const L = [`*Haftalık rapor · ${fmtD(wk[0])} – ${fmtD(wk[6])}*`];
  if (PLAN.client && PLAN.client.name) L.push(PLAN.client.name);
  const rec = k => { const d = peek(k); return Object.keys(d.items).length || (d.extras || []).length || d.water || d.gym || d.walk; };
  const logged = past.filter(rec), stats = logged.map(dayStat);
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
      if (st.resolved && st.skip === st.total) notes.push(ex.length ? `${m.title} yerine ${names}` : `${m.title} atlandı`);
      else { if (st.skip && st.skip < st.total) notes.push(`${m.title}: ${st.skip} kalem atlandı`); if (ex.length) notes.push(`${m.title}: +${names}`); }
      if (sw.length) notes.push(`${m.title}: ${sw.join(', ')} (muadil)`);
      if (!st.resolved && k < today && st.ok + st.skip === 0 && !ex.length) notes.push(`${m.title} işaretlenmemiş`);
    });
    L.push(`${DOW[parse(k).getDay()]} ${parse(k).getDate()}: ${notes.length ? notes.join(' · ') : 'plana uygun'}`);
  });
  L.push('', '_Diyet uygulamasından_');
  return L.join('\n');
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
   günün anlık durumu her soruyla birlikte <durum> içinde gider. Sohbet gün boyu saklanır, ertesi gün sıfırlanır. */
let CHAT = [], chatBusy = false, chatErr = '';
const chatLoad = () => { try { const o = JSON.parse(localStorage.getItem(CHATKEY) || 'null'); CHAT = o && o.d === today ? o.m : []; } catch (e) { CHAT = []; } };
const chatSave = () => { try { localStorage.setItem(CHATKEY, JSON.stringify({ d: today, m: CHAT })); } catch (e) {} };

const CHAT_SYSTEM = () => `Bu bir diyet takip uygulamasının içindeki asistansın. Kullanıcı, diyetisyeninin hazırladığı programı uyguluyor. Programın tamamı aşağıda JSON olarak var (k tahmini kcal, p tahmini protein gramı). Her mesajla birlikte <durum> içinde bugünün anlık kaydı gelir: saat, öğünlerin durumu, yenenler, kalan kalori ve protein, uygulamanın kendi hesapladığı telafiler.

Nasıl cevap verirsin:
- Türkçe, kısa ve doğrudan. Cevap telefonda okunacak; çoğu cevap 2-5 cümle. Liste gerekiyorsa satır başına "- " koy. Başlık, tablo, kalın yazı kullanma.
- Program diyetisyenindir. Programı değiştirmeyi, öğün atlamayı ya da kaloriyi daha da kısmayı önerme. Sapmayı programın kendi muadilleriyle (swaps, kalemlerin subs alanı) ve uygulamanın telafi önerileriyle dengele. Programda karşılığı olmayan bir şey için yaklaşık bir öneri ver ve diyetisyenine danışmasını söyle.
${KC ? `- Kalori ve protein söylerken <durum>daki değerleri kullan. Kendin tahmin ediyorsan "yaklaşık" de.` : `- Diyetisyen bu danışanın kalori sayılarını görmesini istemiyor. Kalori sayısı söyleme; porsiyon, öğün ve protein diliyle konuş. <durum>daki kalorileri yalnızca kendi muhakemen için kullan.`}
- Dışarıda yemek, davet, tatil gibi durumlarda suçlama yok. En iyi seçeneği söyle, günün kalanının nasıl dengeleneceğini anlat: tek bir öğün günü bozmaz, kalan öğünlere devam etmek önemli.
- Tıbbi bir şikâyet, ilaç, hastalık, hamilelik ya da yeme bozukluğu işareti varsa diyetisyenine veya doktoruna yönlendir.
- Kayıt yapamazsın. Kullanıcı bir şey yediğini söylerse uygulamada nasıl kaydedeceğini kısaca hatırlat: öğüne dokununca kalemler açılır; "Hepsini yedim" hepsini işaretler; satırdaki üç nokta muadil seçtirir; kalem düğmesi yenen şeyi aratır ya da yazdırır; kamera fotoğraftan kaydeder. Plandan sapınca kalan öğünlere telafi satırları kendiliğinden eklenir.

Program:
${JSON.stringify(PLAN)}`;

/* Günün anlık durumu, düz metin. */
function dayContext() {
  const k = today, d = peek(k), A = adjust(k), B = balance(k), now = new Date();
  const lines = [`${fmtLong(k)}, saat ${pad(now.getHours())}:${pad(now.getMinutes())}${isWknd(k) ? ' (hafta sonu saatleri)' : ''}`];
  MEALS.forEach(m => {
    const its = itemsOf(m, k).filter(i => !i.optional), st = mealStat(m, k);
    const other = (d.extras || []).some(e => e.meal === m.id && !e.adj);
    const head = `${m.title}${m.time ? ' ' + timeOf(m, k) : ''}: ${st.resolved ? (st.skip === st.total ? (other ? 'plan yerine başka şey yendi' : 'atlandı') : 'tamam') : st.ok + st.skip ? 'kısmen' : 'açık'}`;
    const rows = its.map(it => { const s = stOf(d, m, it), key = m.id + '.' + it.id, ov = A.over[key];
      const nm = label(it) + (it.id === 'ana' ? ' (ana yemek)' : '');
      if (!s) return `  - ${ov ? ov.name + ' (bugün için azaltıldı)' : nm}: açık · ${ov ? ov.k : it.k} kcal`;
      if (s.s === 'skip') return `  - ${nm}: atlandı`;
      if (s.s === 'swap') return `  - ${nm} yerine ${s.sub}${s.k != null ? ` · ${s.k} kcal, ${s.p} g protein` : ''}`;
      return `  - ${s.name || nm}: yendi`; });
    (d.extras || []).filter(e => e.meal === m.id).forEach(e => rows.push(`  - ${e.adj ? 'telafi' : e.pl ? 'planlandı, henüz yenmedi' : 'plan dışı'}: ${e.name} · ${num(e.k)} kcal, ${num(e.p)} g protein`));
    A.adds.filter(a => a.meal === m.id && a.xi < 0).forEach(a => rows.push(`  - uygulamanın telafi önerisi: ${a.name} · ${a.k} kcal`));
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
  if (SUPS().length) lines.push('Kullanıcının kendi takviyeleri (programın parçası değil): ' + SUPS().map(s => `${s.n}${s.dose ? ' ' + s.dose : ''} (${supAt(anc(s)).toLocaleLowerCase('tr')}): ${supTaken(k, s.id) ? 'alındı' : 'alınmadı'}`).join('; ') + '.');
  const ws = [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1);
  if (ws.length) lines.push(`Son tartı: ${ws[ws.length - 1].kg.toLocaleString('tr-TR')} kg (${fmtDM(ws[ws.length - 1].d)}); ilk kayıt ${ws[0].kg.toLocaleString('tr-TR')} kg. Hedef ${PLAN.goal.kg} kg.`);
  return lines.join('\n');
}

const SUGGEST = ['Akşam ne yesem?', 'Dışarıda yiyeceğim, ne sipariş edeyim?', 'Protein açığımı nasıl kapatırım?', 'Canım tatlı çekti, ne yapayım?'];
const fmtMsg = t => esc(t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/gm, '').trim());
function chatSheet() {
  sheet = 'chat';
  const msgs = CHAT.map((m, i) => `<div class="msg ${m.role === 'user' ? 'u' : 'a'}" ${i === CHAT.length - 1 && m.role === 'assistant' ? 'id="live"' : ''}>${m.role === 'user' ? esc(m.show) : m.content ? fmtMsg(m.content) : '<span class="typing"><i></i><i></i><i></i></span>'}</div>`).join('');
  const intro = CHAT.length ? '' : `<p class="lead">Programın ve bugünün kaydı elimde. Ne istersen sor.</p><div class="chips">${SUGGEST.map(q => `<button data-act="chatq">${q}</button>`).join('')}</div>`;
  const keep = document.getElementById('said2'), draft = keep ? keep.value : '';
  showSheet(`<div class="between" style="align-items:center;padding-right:6px"><h2>Asistan</h2>${CHAT.length ? `<button class="pill" data-act="chatnew">Yeni sohbet</button>` : ''}</div>
    ${intro}<div class="chat">${msgs}</div>${chatErr ? `<p class="err">${esc(chatErr)}</p>` : ''}
    <div class="ask"><textarea id="said2" rows="1" placeholder="Bir şey sor…" enterkeyhint="send"></textarea><button class="send" data-act="chatsend" aria-label="Gönder" ${chatBusy ? 'disabled' : ''}>${ic('up')}</button></div>`);
  const t = document.getElementById('said2'); t.value = draft; grow(t);
  $sheet().scrollTop = $sheet().scrollHeight;
}
const grow = t => { t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight) + 'px'; };
function openChat() {
  if (!aiReady(openChat)) return;
  chatLoad(); chatErr = ''; chatSheet();
  if (!CHAT.length) setTimeout(() => { const t = document.getElementById('said2'); t && t.focus(); }, 320);
}
async function chatSend(text) {
  if (chatBusy || !text) return;
  chatBusy = true; chatErr = '';
  const q = { role: 'user', content: `<durum>\n${dayContext()}\n</durum>\n\n${text}`, show: text }, a = { role: 'assistant', content: '' };
  CHAT.push(q, a); const t0 = document.getElementById('said2'); if (t0) t0.value = ''; chatSheet();
  const paint = () => { const el = document.getElementById('live'); if (el) { el.innerHTML = fmtMsg(a.content); $sheet().scrollTop = $sheet().scrollHeight; } };
  try {
    const r = await aiFetch({ model: CHAT_MODEL, max_tokens: 4000, stream: true, thinking: { type: 'disabled' }, output_config: { effort: 'low' },
      system: [{ type: 'text', text: CHAT_SYSTEM(), cache_control: { type: 'ephemeral' } }],
      messages: CHAT.slice(0, -1).map(({ role, content }) => ({ role, content })) });
    if (!r.ok) throw aiErr(r, await r.json().catch(() => ({})));
    const rd = r.body.getReader(), dec = new TextDecoder(), usage = {}; let buf = '', stop = '';
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const ev = JSON.parse(line.slice(5));
        if (ev.type === 'message_start') Object.assign(usage, ev.message.usage);
        else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { a.content += ev.delta.text; paint(); }
        else if (ev.type === 'message_delta') { stop = ev.delta.stop_reason || stop; Object.assign(usage, ev.usage); }
        else if (ev.type === 'error') throw new Error(ev.error && ev.error.message || 'Akış kesildi.');
      }
    }
    track(CHAT_MODEL, usage);
    if (stop === 'refusal' && !a.content) throw new Error('Bu soruya cevap veremiyorum.');
    if (!a.content) throw new Error('Boş cevap geldi; yeniden dene.');
  } catch (e) {
    /* Başarısız soru-cevap çifti geçmişten çıkar, soru kutuya geri döner. */
    CHAT.splice(CHAT.indexOf(q), 2); chatErr = e.message || 'Bağlantı kurulamadı.';
    chatBusy = false; if (sheet !== 'chat') return; chatSheet(); const t = document.getElementById('said2'); if (t) { t.value = text; grow(t); } return;
  }
  chatBusy = false; chatSave(); if (sheet === 'chat') chatSheet();
}

/* ---------- Etkileşim ---------- */
const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, d = day(sel), meal = MEALS.find(m => m.id === el.dataset.meal), A = adjust(sel);
  const eaten = id => { const o = A.over[id]; return o ? { s: 'done', name: o.name, k: o.k, p: o.p } : { s: 'done' }; };
  const setAll = (m, fn) => itemsOf(m, sel).forEach(i => { const k = m.id + '.' + i.id, v = fn(d.items[k], i, k); v ? d.items[k] = v : delete d.items[k]; });
  switch (a) {
    case 'tab': tab = el.dataset.t; window.scrollTo(0, 0); break;
    case 'day': sel = el.dataset.k; if (el.dataset.go) { tab = 'today'; window.scrollTo(0, 0); } break;
    case 'week': sel = addDays(sel, 7 * +el.dataset.n); if (sel > today) sel = today; break;
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
    case 'toggle': { const id = el.dataset.id, m = MEALS.find(x => x.id === id.split('.')[0]);
      if (d.items[id]) delete d.items[id]; else { lockMain(sel, m); d.items[id] = eaten(id); }
      if (mealStat(m, sel).resolved && m.time) delete openEv[sel]; buzz(); break; }
    case 'add': { const x = A.adds[+el.dataset.i]; if (x.xi >= 0) d.extras.splice(x.xi, 1); else { const { xi, ...keep } = x; d.extras.push({ ...keep, adj: true }); } buzz(); break; }
    case 'unextra': d.extras.splice(+el.dataset.i, 1); break;
    case 'xedit': xOpen(+el.dataset.i); return;
    case 'xq': xSync(); XE.q = +el.dataset.v; xSheet(); buzz(); return;
    case 'xsave': { xSync(); const e = d.extras[XE.i]; if (!e) return closeSheet();
      Object.assign(e, scaled({ n: XE.n, k: XE.bk, p: XE.bp, u: XE.u }, XE.q)); learn(XE.n, XE.bk, XE.bp, XE.u); XE = null; closeSheet(); buzz(); break; }
    case 'xdel': d.extras.splice(XE.i, 1); XE = null; closeSheet(); break;
    case 'sq': { const st = d.items[sheet], b = baseOf(st.sub, st), x = scaled(b, +el.dataset.v);
      d.items[sheet] = { s: 'swap', sub: x.name, k: x.k, p: x.p, q: x.q, src: x.src }; save(); render(); openSheet(sheet); buzz(); return; }
    case 's-food': { const x = CS[+el.dataset.i], meal2 = sheet.split('.')[0];
      d.items[sheet] = { s: 'swap', sub: x.n, k: x.k, p: x.p, q: 1, src: { n: x.n, k: x.k, p: x.p, u: x.u || '' } }; remember(meal2, x.n, x.k, x.p, x.u); closeSheet(); buzz(); break; }
    case 'sheet': openSheet(el.dataset.id); return;
    case 'prog': if (el.dataset.p === 'gidalar') return foodsSheet(); if (el.dataset.p === 'takviye') return supsSheet(); if (el.dataset.p === 'baglanti') { PL = {}; return planSheet(); } progSheet(el.dataset.p); if (el.dataset.p === 'ai' && aiCode()) loadMe().then(() => { if (sheet === 'ai') progSheet('ai'); }); return;
    case 'planpaste': { const v = document.getElementById('plink').value.trim(); if (!v) return;
      unpackPlan(v).then(p2 => { PL = { incoming: p2 }; planSheet(); }).catch(x => { PL = { err: x.message || 'Bağlantı okunamadı.' }; planSheet(); }); return; }
    case 'planload': try { localStorage.setItem(PLANKEY, JSON.stringify(PL.incoming)); } catch (x) { PL = { err: 'Program kaydedilemedi.' }; return planSheet(); } reloadClean(); return;
    case 'plannot': PL = null; history.replaceState(null, '', location.pathname + location.search); closeSheet(); return;
    case 'pswi': plSync(); PL.set[el.dataset.k] = !PL.set[el.dataset.k]; PL.dirty = true; planSheet(); return;
    case 'pset': { plSync(); const p2 = JSON.parse(JSON.stringify(PLAN));
      p2.dietitian = { ...(p2.dietitian || {}), name: PL.set.name.trim(), phone: PL.set.phone.trim() }; p2.prefs = { ...(p2.prefs || {}), kcal: PL.set.kcal, tune: PL.set.tune };
      if (planCheck(p2)) return; try { localStorage.setItem(PLANKEY, JSON.stringify(p2)); } catch (x) { return; } reloadClean(); return; }
    case 'report': reportSheet(); return;
    case 'repshare': { const text = weekReport(sel);
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => { el.textContent = 'Kopyalandı'; }).catch(() => {});
      return; }
    case 'planreset': try { localStorage.removeItem(PLANKEY); } catch (x) {} reloadClean(); return;
    case 'planshare': packPlan(PLAN).then(code => { const url = planLink(code); PL.link = url;
      if (navigator.share) navigator.share({ title: 'Diyet programı', url }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
      planSheet(); }); return;
    case 'chat': openChat(); return;
    case 'chatq': chatSend(el.textContent); return;
    case 'chatsend': chatSend(document.getElementById('said2').value.trim()); return;
    case 'chatnew': if (chatBusy) return; CHAT = []; chatErr = ''; chatSave(); chatSheet(); return;
    case 'close': closeSheet(); return;
    case 'all': lockMain(sel, meal); A.adds.filter(x => x.meal === meal.id && x.xi < 0).forEach(({ xi, ...x }) => d.extras.push({ ...x, adj: true }));
      setAll(meal, (c, i, k) => c || (i.optional ? null : eaten(k))); delete openEv[sel]; buzz(); break;
    case 'skipmeal': lockMain(sel, meal); setAll(meal, (c, i) => i.optional ? null : { s: 'skip' }); delete openEv[sel]; break;
    case 'clear': setAll(meal, () => null); d.extras = d.extras.filter(x => x.meal !== meal.id); openEv[sel] = meal.id; break;
    case 'mode': d.mode[meal.id] = +el.dataset.i; break;
    case 'main': d.main[meal.id] = el.dataset.m; closeSheet(); break;
    case 'quick': { const m = nextMeal(); sel = today; tab = 'today'; render(); if (!m) return; const go = () => { camMeal = m.id; document.getElementById('cam').click(); }; if (aiReady(go)) go(); return; }
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
    case 'savekey': { const v = document.getElementById('aikey').value.trim(); if (!v) return; try { localStorage.setItem(AIKEY, v); } catch (x) {} closeSheet(); break; }
    case 'delkey': try { localStorage.removeItem(AIKEY); } catch (x) {} closeSheet(); break;
    case 'savecode': { const v = document.getElementById('aicode').value.trim().toUpperCase().replace(/\s+/g, ''); if (!v) return;
      try { localStorage.setItem(CODEKEY, v); } catch (x) {} ME = null; progSheet('ai'); loadMe().then(() => { if (sheet === 'ai') progSheet('ai'); }); return; }
    case 'delcode': try { localStorage.removeItem(CODEKEY); } catch (x) {} ME = null; progSheet('ai'); return;
    case 'water': d.water = Math.max(0, d.water + +el.dataset.n); buzz(); break;
    case 'coffee': d.coffee = Math.max(0, d.coffee + +el.dataset.n); break;
    case 'walk': d.walk = !d.walk; buzz(); break;
    case 'gym': d.gym = !d.gym; if (d.gym && openEv[sel] === 'gym') delete openEv[sel]; buzz(); break;
    case 'z2': d.z2 = !d.z2; break;
    case 'weight': { const v = parseFloat(document.getElementById('kg').value.replace(',', '.'));
      if (!(v > 30 && v < 300)) return; S.weights = S.weights.filter(w => w.d !== today).concat({ d: today, kg: v }); break; }
    case 's-done': d.items[sheet] = { s: 'done' }; closeSheet(); break;
    case 's-skip': d.items[sheet] = { s: 'skip' }; closeSheet(); break;
    case 's-clear': delete d.items[sheet]; closeSheet(); break;
    case 's-sub': d.items[sheet] = { s: 'swap', sub: findItem(sheet)[1].subs[+el.dataset.i] }; closeSheet(); break;
    case 's-custom': { const v = document.getElementById('custom').value.trim(); if (!v) return; d.items[sheet] = { s: 'swap', sub: v }; closeSheet(); break; }
    case 'export': { const u = URL.createObjectURL(new Blob([JSON.stringify(PLAN_CUSTOM ? { ...S, plan: PLAN } : S)], { type: 'application/json' }));
      const l = document.createElement('a'); l.href = u; l.download = `diyet-yedek-${today}.json`; l.click(); return; }
    case 'import': document.getElementById('file').click(); return;
  }
  save(); render();
});
document.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  if (e.target.id === 'pic' && FD) { e.target.value = '';
    Promise.all([thumb(f), shrink(f)]).then(([img, full]) => { FD.img = img; FD.full = full; FD.err = ''; if (sheet !== 'food') return; if (aiAuth() && aiOk()) foodAI(); else foodForm(); })
      .catch(x => { FD.err = x.message; foodForm(); }); return; }
  if (e.target.id === 'cam') { e.target.value = ''; shrink(f).then(image => analyze(camMeal, { image })).catch(() => {}); }
  if (e.target.id === 'file') f.text().then(t => { const o = JSON.parse(t); if (!o || !o.days) return;
    /* Yedekte bağlantıyla yüklenmiş bir program varsa o da geri gelir. */
    const p2 = o.plan; delete o.plan; S = o; save();
    if (p2 && !planCheck(p2)) { try { localStorage.setItem(PLANKEY, JSON.stringify(p2)); } catch (x) {} return location.reload(); }
    closeSheet(); render(); }).catch(() => {});
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'q') { e.preventDefault(); const b = document.querySelector('[data-act="qadd"]'); b ? b.click() : e.target.blur(); }
  if (e.key === 'Enter' && e.target.id === 'custom') document.querySelector('[data-act="s-custom"]').click();
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'said2') { e.preventDefault(); document.querySelector('[data-act="chatsend"]').click(); }
});
document.addEventListener('input', e => {
  if ((e.target.id === 'dname' || e.target.id === 'dphone') && PL) { PL.dirty = true; const b = document.querySelector('[data-act="pset"]'); if (b) b.disabled = false; }
  if (e.target.id === 'said2') grow(e.target);
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
setInterval(() => { if (!document.hidden && tab === 'today' && !document.body.classList.contains('sheet-open')) render(); }, 60000);
render();
planFromHash();
window.addEventListener('hashchange', planFromHash);
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  /* Yeni sürüm devreye girince sayfayı bir kez yenile. */
  const had = !!navigator.serviceWorker.controller; let done = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !done) { done = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
