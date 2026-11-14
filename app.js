/* ---------- Program ----------
   Varsayılan plan plan.js içinde (PLAN_DEFAULT). Bağlantıyla yüklenen bir plan varsa localStorage['diyet-plan']
   içindedir ve onun yerine geçer. Buradakiler yalnızca plandan türetilir. */
const PLANKEY = 'diyet-plan';
/* Eksik isteğe bağlı bölümleri doldurur, kimlik bağlarını denetler. Hata varsa açıklamasını döndürür. */
function planCheck(p) {
  if (!p || p.v !== 1) return 'Program biçimi tanınmadı.';
  if (!p.items || !Array.isArray(p.meals) || !p.meals.length) return 'Programda öğün yok.';
  p.mains = p.mains || []; p.groups = p.groups || {}; p.rota = p.rota || {}; p.rules = p.rules || []; p.swaps = p.swaps || [];
  p.dietitian = p.dietitian || { name: '' }; p.client = p.client || { name: '' }; p.goal = p.goal || { kg: 0, text: '' };
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
  if (k !== today || !b.any) return out;
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
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${P[n] || ''}</svg>`;
const ring = (pct, size, w, color) => { const r = (size - w) / 2, C = 2 * Math.PI * r, c = size / 2;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="--c:${color}"><circle class="t" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}"/><circle class="p" cx="${c}" cy="${c}" r="${r}" stroke-width="${w}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.max(0, Math.min(1, pct)))}"/></svg>`; };
const label = it => it.opts ? it.opts[0] : it.name;
const hint = it => it.opts ? 'veya ' + it.opts.slice(1).join(' · ') : it.meta || '';
const short = it => it.chip || it.name;
const nextMeal = () => MEALS.find(m => m.time && !mealStat(m, today).resolved);
const openEv = {};

function rowHTML(meal, it, d, ov) {
  const id = meal.id + '.' + it.id, st = d.items[id], s = st ? st.s : '';
  let n = label(it), m = hint(it);
  if (!s && ov) { n = ov.name; m = 'Bugün için azaltıldı'; }
  if (s === 'done' && st.name) { n = st.name; m = 'Azaltılmış porsiyon'; }
  if (s === 'swap') { n = st.sub; m = label(it) + ' yerine'; }
  if (s === 'skip') m = 'Atlandı';
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
  h += (d.extras || []).map((e, i) => e.meal !== meal.id || (e.adj && A.adds.some(a => a.xi === i)) ? '' : `<div class="row done" data-act="unextra" data-i="${i}"><span class="chk">${ic('check')}</span><span class="b"><span class="n">${esc(e.name)}</span><span class="m">${e.adj ? 'Telafi' : 'Plan dışı'} · yaklaşık ${num(e.k)} kcal</span></span></div>`).join('');
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
  const cls = st.resolved ? (allSkip ? 'skipd' : 'done') : isNow ? 'now' : '';
  let sub = st.resolved ? (allSkip ? 'Atlandı' : st.skip === st.total ? ate.map(e => e.name).join(' · ') : st.skip ? `${st.ok} / ${st.total} kalem` : 'Tamam')
    : itemsOf(meal, k).filter(i => !i.optional).map(short).join(' · ') + (A.adds.some(a => a.meal === meal.id) ? ' · + telafi' : '');
  let right = meal.time ? `<span class="t">${timeOf(meal, k)}</span>` : '';
  if (open === meal.id && !st.resolved) sub = itemsOf(meal, k).filter(i => !i.optional).length + ' kalem';
  if (isNow) { const mt = minsTo(meal, k); sub = timeOf(meal, k) + ' · ' + sub;
    right = `<span class="pill ${mt < -90 ? 'late' : mt <= 30 ? 'hot' : ''}">${mt > 0 ? (mt >= 60 ? `${Math.floor(mt / 60)} sa ${mt % 60} dk` : `${mt} dk`) : mt > -90 ? 'Şimdi' : 'Gecikti'}</span>`; }
  else if (isLate(meal, k)) right = `<span class="pill late">Gecikti</span>`;
  if (!meal.time) { const it = meal.items[0], id = meal.id + '.' + it.id, s = d.items[id];   /* saatsiz tek kalem: satıra dokunmak yeter */
    const sub = [label(it), it.meta && it.meta[0].toLocaleLowerCase('tr') + it.meta.slice(1)].filter(Boolean).join(', ');
    return eventHTML({ cls, node: s ? 'check' : meal.id, title: meal.title, sub: s ? 'Tamam' : sub, right: '', act: `data-act="toggle" data-id="${id}"` }); }
  return eventHTML({ cls, node: st.resolved ? (allSkip ? 'dash' : 'check') : meal.id, title: meal.title, sub, right,
    act: `data-act="ev" data-id="${meal.id}"`, panel: open === meal.id ? mealPanel(meal, k, A, st) : '' });
}
function gymEvent(k, W, open) {
  const d = peek(k);
  const panel = open !== 'gym' ? '' : `<p class="cap">Öncesi · ${W.pre}</p>${W.ex.map(([n, x]) => `<div class="kv"><span>${n}</span><span>${x}</span></div>`).join('')}<p class="cap" style="padding-bottom:8px">Sonrası · ${W.post}</p>
    <div class="row ${d.z2 ? 'done' : ''}" data-act="z2"><span class="chk">${ic('check')}</span><span class="b"><span class="n">Antrenman sonrası kardiyo</span><span class="m">İsteğe bağlı</span></span></div>
    <div class="actions" style="grid-template-columns:1fr"><button class="primary ${d.gym ? 'is-done' : ''}" data-act="gym">${ic('check')}${d.gym ? 'Yapıldı' : 'Antrenmanı yaptım'}</button></div>`;
  return eventHTML({ cls: d.gym ? 'done' : '', node: d.gym ? 'check' : 'gym', title: 'Antrenman', sub: d.gym ? 'Tamam' : `${W.name} · ${W.ex.length} hareket`, right: `<span class="t">${TRAIN.time}</span>`, act: 'data-act="ev" data-id="gym"', panel });
}
function stepper(act, val, over) {
  return `<span class="stepper"><button data-act="${act}" data-n="-1" aria-label="Azalt">${ic('minus')}</button><b class="${over ? 'over' : ''}">${val}</b><button data-act="${act}" data-n="1" aria-label="Artır">${ic('plus')}</button></span>`;
}
function todayView() {
  const d = peek(sel), st = dayStat(sel), A = adjust(sel), B = balance(sel), wk = weekOf(sel);
  const next = sel === today ? nextMeal() : null, W = WORKOUTS[parse(sel).getDay()];
  const open = openEv[sel] !== undefined ? openEv[sel] : next ? next.id : '';
  const strip = wk.map(k => { const dt = parse(k);
    return `<button class="day ${k === sel ? 'sel' : ''} ${k === today ? 'today' : ''}" data-act="day" data-k="${k}"><small>${DOW[dt.getDay()]}</small><span class="disc" style="--p:${dayStat(k).pct}"><b>${dt.getDate()}</b></span></button>`; }).join('');
  const litres = (d.water * WATER_ML / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const tile = (name, val, unit, of, pct, color) => `<div class="tile"><div class="top"><span class="label">${name}</span>${ring(pct, 30, 4.5, color)}</div><strong>${val}${unit ? `<em>${unit}</em>` : ''}</strong><small>${of}</small></div>`;
  const walks = wk.filter(x => peek(x).walk).length, gyms = wk.filter(x => peek(x).gym).length;
  return `<header class="head"><div><p>${fmtLong(sel)}</p><h1>${sel === today ? 'Bugün' : parse(sel).toLocaleDateString('tr-TR', { weekday: 'long' })}</h1></div>
      <div class="hright"><button class="round" data-act="chat" aria-label="Asistana sor">${ic('chat')}</button>
      ${sel !== today ? `<button class="pill" data-act="gotoday">Bugüne dön</button>` : `<div class="dayring">${ring(st.pct / 100, 54, 5, 'var(--accent)')}<b>%${st.pct}</b></div>`}</div></header>
    <div class="strip">${strip}</div>
    <div class="tiles">${tile('Kalori', num(B.ek), '', `/ ${num(B.tk)} kcal`, B.ek / B.tk, 'var(--fg)')}${tile('Protein', num(B.ep), 'g', `/ ${num(B.tp)} g`, B.ep / B.tp, 'var(--accent)')}${tile('Su', litres, 'L', `/ ${WATER_L} L`, d.water / WATER_GOAL, 'var(--blue)')}</div>
    ${A.note ? `<p class="note">${A.note}</p>` : ''}
    <div class="tl">${MEALS.map(m => mealEvent(m, sel, A, next, open) + (m.id === TRAIN.after && W ? gymEvent(sel, W, open) : '')).join('')}</div>
    <div class="sect">Gün boyu</div>
    <section class="card">
      <div class="row"><span class="b"><span class="n">Su</span><span class="m">${d.water} bardak · ${litres} / ${WATER_L} L</span></span>${stepper('water', d.water)}</div>
      <div class="row"><span class="b"><span class="n">Kahve</span><span class="m ${d.coffee > COFFEE_MAX ? 'over' : ''}">${d.coffee > COFFEE_MAX ? 'Günlük sınır aşıldı' : PLAN.daily.coffee.note}</span></span>${stepper('coffee', d.coffee, d.coffee > COFFEE_MAX)}</div>
      <div class="row ${d.walk ? 'done' : ''}" data-act="walk"><span class="b"><span class="n">${PLAN.daily.walk.name}</span><span class="m">Bu hafta ${walks} / ${WALK_GOAL}</span></span><span class="chk">${ic('check')}</span></div>
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
    <div class="tiles two">${stat('Kalori dengesi', Math.abs(gk) < 50 ? 'Dengede' : (gk > 0 ? '−' : '+') + num(Math.abs(gk)), Math.abs(gk) < 50 ? '' : 'kcal', Math.abs(gk) < 50 ? 'Plana göre' : gk > 0 ? 'Plandan eksik' : 'Plandan fazla')}
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
    <p class="note">Haftada bir, aynı saatte tartıl.</p>`;
}
const PROG = [['kurallar', 'list', 'Kurallar', `${RULES.length} madde`], ['saatler', 'clock', 'Öğün saatleri', 'Hafta içi ve hafta sonu'], ['muadil', 'swap', 'Muadiller', 'Neyin yerine ne yenir'], ['gidalar', 'ogle', 'Gıdalarım', ''],
  ['antrenman', 'gym', 'Antrenman', Object.entries(WORKOUTS).map(([n, w]) => `${DOW[n]} ${w.name.toLocaleLowerCase('tr')}`).join(' · ')], ['vucut', 'person', 'Vücut analizi', `${fmtDM(PLAN.body.date)} ölçümü`], ['ai', 'chat', 'Yapay zekâ', ''], ['baglanti', 'link', 'Program bağlantısı', 'Yükle ya da paylaş'], ['veri', 'down', 'Yedek', 'İndir ya da geri yükle']];
function planView() {
  const t = balance(today), last = [...S.weights].sort((a, b) => a.d < b.d ? -1 : 1).pop();
  return `<header class="head"><div><p>${esc(PLAN.dietitian.name || 'Diyetisyen programı')} · ${fmtDM(PLAN.date)}</p><h1>Program</h1></div></header>
    <section class="card pad"><span class="label">Hedef</span><div class="num">${PLAN.goal.kg.toLocaleString('tr-TR')}<em>kg</em></div><p class="note" style="padding:8px 0 14px">${esc(PLAN.goal.text)}</p>
      <div class="tiles two" style="margin:0"><div class="tile" style="background:var(--ctl);box-shadow:none"><span class="label">Şu an</span><strong style="margin-top:8px">${last.kg.toLocaleString('tr-TR')}<em>kg</em></strong><small>${PLAN.body.fat} yağ</small></div>
        <div class="tile" style="background:var(--ctl);box-shadow:none"><span class="label">Günlük plan</span><strong style="margin-top:8px">${num(t.tk)}<em>kcal</em></strong><small>${num(t.tp)} g protein</small></div></div></section>
    <section class="card">${PROG.map(([id, icn, n, m]) => `<button class="nav-row" data-act="prog" data-p="${id}"><span class="ic">${ic(icn)}</span><span class="b"><span class="n">${n}</span><span class="m">${id === 'ai' ? (aiKey() ? 'API anahtarı kayıtlı' : 'API anahtarı gerekli') : id === 'gidalar' ? (Object.keys(S.foods || {}).length ? `${Object.keys(S.foods).length} gıda` : 'Kendi ürünlerin') : m}</span></span>${ic('right')}</button>`).join('')}</section>
    <p class="note">Kayıtlar yalnızca bu cihazda tutulur. Kalori ve protein değerleri yaklaşık tahminlerdir.</p>`;
}
function progSheet(p) {
  const kv = rows => `<div class="group">${rows.map(([a, b]) => `<div class="kv"><span>${a}</span><span>${b}</span></div>`).join('')}</div>`;
  const prose = rows => `<div class="group prose">${rows.map(([a, b]) => `<p>${a}${b ? `<small>${b}</small>` : ''}</p>`).join('')}</div>`;
  const S2 = {
    kurallar: () => `<h2>Kurallar</h2><p class="lead">Diyetisyenin notları.</p>${prose(RULES)}`,
    saatler: () => `<h2>Öğün saatleri</h2><p class="lead">Hafta sonu saatleri kendiliğinden uygulanır.</p><div class="sect">Hafta içi</div>${kv(MEALS.filter(m => m.time).map(m => [m.title, m.time]))}<div class="sect">Hafta sonu</div>${kv(MEALS.filter(m => m.time).map(m => [m.title, m.wknd]))}`,
    muadil: () => `<h2>Muadiller</h2><p class="lead">Aynı grup içinde değişim programı bozmaz. Yaklaşık eşdeğerlerdir; diyetisyenin onayladıklarını kullan.</p>${prose(SWAPS)}`,
    antrenman: () => `<h2>Antrenman</h2><p class="lead">${TRAIN.lead}</p>${Object.entries(WORKOUTS).map(([n, w]) => { const g = DAYNAME[n];
      return `<div class="sect">${g} · ${w.name}</div><div class="group"><p class="cap">Öncesi · ${w.pre}</p>${w.ex.map(([a, b]) => `<div class="kv"><span>${a}</span><span>${b}</span></div>`).join('')}<p class="cap" style="padding-bottom:12px">Sonrası · ${w.post}</p></div>`; }).join('')}`,
    vucut: () => `<h2>Vücut analizi</h2><p class="lead">${parse(PLAN.body.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} ölçümü.</p>${kv(BODY)}`,
    ai: () => `<h2>Yapay zekâ</h2><p class="lead">Fotoğraftan ya da yazıdan kayıt ve asistan için bir Anthropic API anahtarı gerekir. Kütüphanede ve geçmişinde bulunanlar anahtarsız kaydedilir. Anahtar yalnızca bu cihazda saklanır, fotoğraflar analiz için doğrudan Anthropic'e gider.</p>
      <div class="group"><div class="kv"><span>Durum</span><span>${aiKey() ? 'Anahtar kayıtlı' : 'Anahtar yok'}</span></div><div class="field"><input id="aikey" type="password" autocomplete="off" placeholder="sk-ant-…"><button class="btn" data-act="savekey">Kaydet</button></div></div>
      ${usageRows()}${aiKey() ? `<button class="textbtn" data-act="delkey">Anahtarı sil</button>` : ''}`,
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
    ${mains}<div class="sect">Yerine bunu yedim</div>
    <div class="group">${(it.subs || []).map((x, i) => `<button class="opt" data-act="s-sub" data-i="${i}"><span>${esc(x)}</span>${tick(s === 'swap' && st.sub === x)}</button>`).join('')}
      <div class="field"><input id="custom" type="text" placeholder="Başka bir şey…" enterkeyhint="done"><button class="btn" data-act="s-custom">Ekle</button></div></div>
    ${s ? `<button class="textbtn" data-act="s-clear">İşareti kaldır</button>` : ''}`);
}
function needKey() { progSheet('ai'); }

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
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': aiKey(), 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 16000, system, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: SCHEMA } } }) });
    const j = await r.json();
    if (r.ok) track(AI_MODEL, j.usage);
    if (!r.ok) throw new Error(r.status === 401 ? 'API anahtarı geçersiz. Program sekmesinden yenisini gir.' : r.status === 429 ? 'Çok fazla istek; biraz sonra yeniden dene.' : (j.error && j.error.message) || 'İstek başarısız oldu.');
    if (j.stop_reason === 'refusal') throw new Error('Bu içerik analiz edilemedi.');
    const R = JSON.parse((j.content || []).find(b => b.type === 'text').text);
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
    return `<div class="opt"><span>${esc(x.status === 'swap' ? x.sub : nm)}<small>${x.status === 'swap' ? esc(label(it)) + ' yerine' : lab[x.status]}</small></span><small>${x.status === 'skip' ? '—' : num(x.kcal) + ' kcal'}</small></div>`; }).join('');
  const ex = R.extras.map(e => `<div class="opt"><span>${esc(e.name)}<small>Plan dışı</small></span><small>${num(e.kcal)} kcal</small></div>`).join('');
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
    `<div class="trow"><div class="row"><span class="b"><span class="n">${esc(x.n)}</span><span class="m">${esc(x.u ? x.u + ' · ' : '')}${num(x.k * x.q)} kcal · ${num1(x.p * x.q)} g protein</span></span>${x.img ? `<img class="th" src="${x.img}" alt="">` : ''}<button class="more" data-act="qx" data-i="${i}" aria-label="Çıkar">${ic('x')}</button></div>
      <div class="qchips">${QS.map(v => `<button class="${v === x.q ? 'on' : ''}" data-act="qq" data-i="${i}" data-v="${v}">${qLab(v)}</button>`).join('')}</div></div>`).join('')}</div>
    ${open.length ? `<div class="seg" style="margin:0 0 6px"><button class="${mode === 'yerine' ? 'on' : ''}" data-act="qmode" data-m="yerine">Planın yerine</button><button class="${mode === 'ek' ? 'on' : ''}" data-act="qmode" data-m="ek">Plana ek</button></div>
      <p class="note" style="padding:6px 6px 12px">${mode === 'yerine' ? `Öğünün işaretlenmemiş kalemleri atlandı sayılır; kalan öğünler buna göre dengelenir.` : `Öğünün planı olduğu gibi kalır; bu, üstüne eklenir.`}</p>` : ''}
    <button class="primary" data-act="qsave">${ic('check')}Kaydet · ${num(tk)} kcal</button>`;
  Q.res = qFind(meal.id, q).filter(x => !Q.tray.some(t => t.id === x.id));
  const rows = Q.res.map((x, i) => `<button class="opt" data-act="qadd" data-i="${i}"><span>${esc(x.n)}<small>${esc(x.u ? x.u + ' · ' : '')}${num(x.k)} kcal${x.mine ? ' · senin' : ''}</small></span><span class="fi">${x.img ? `<img class="th" src="${x.img}" alt="">` : ''}${ic('plus')}</span></button>`).join('');
  const add = `<button class="opt" data-act="fnew" data-ret="${meal.id}" data-q="${esc(q)}"><span>Yeni gıda ekle<small>Kendi ürününü fotoğrafla ya da elle kaydet</small></span>${ic('cam')}</button>`;
  const ai = q ? `<button class="opt" data-act="qai"><span>“${esc(q)}”<small>Yapay zekâyla işle${aiKey() ? '' : ' · API anahtarı gerekli'}</small></span>${ic('pen')}</button>` : '';
  document.getElementById('qres').innerHTML = !q && !Q.res.length
    ? (Q.tray.length ? '' : `<p class="lead" style="padding-top:14px">Yediğin şeyi ara. Kaydettiklerin burada birikir; bir dahakine tek dokunuşla eklersin.</p><div class="group">${add}</div>`)
    : `<div class="sect">${q ? 'Sonuçlar' : 'Senin gıdaların'}</div><div class="group">${rows}${ai}${add}</div>${q && !Q.res.length ? `<p class="note">Kütüphanede yok. Yapay zekâ işlerse ya da kendin eklersen bir dahakine burada çıkar.</p>` : ''}`;
}
function qSave() {
  const d = day(sel), meal = MEALS.find(m => m.id === Q.meal), mode = qMode();
  Q.tray.forEach(x => { d.extras.push({ meal: meal.id, name: x.q === 1 ? x.n : `${x.n} × ${qLab(x.q)}`, k: Math.round(x.k * x.q), p: Math.round(x.p * x.q * 10) / 10 }); remember(meal.id, x.n, x.k, x.p, x.u); });
  if (mode === 'yerine') { lockMain(sel, meal); qOpen(meal).forEach(it => d.items[meal.id + '.' + it.id] = { s: 'skip' }); }
  if (mealStat(meal, sel).resolved) delete openEv[sel];
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
    ${list.length ? `<div class="group">${list.map(([id, f]) => `<button class="opt" data-act="fedit" data-id="${esc(id)}"><span class="fi">${tile(f)}<span>${esc(f.n)}<small>${esc(f.u ? f.u + ' · ' : '')}${num(f.k)} kcal · ${num1(f.p)} g protein</small></span></span>${ic('right')}</button>`).join('')}</div>`
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
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': aiKey(), 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 16000, system, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: FOOD_SCHEMA } } }) });
    const j = await r.json();
    if (r.ok) track(AI_MODEL, j.usage);
    if (!r.ok) throw new Error(r.status === 401 ? 'API anahtarı geçersiz. Program sekmesinden yenisini gir.' : r.status === 429 ? 'Çok fazla istek; biraz sonra yeniden dene.' : (j.error && j.error.message) || 'İstek başarısız oldu.');
    if (j.stop_reason === 'refusal') throw new Error('Bu içerik okunamadı.');
    const R = JSON.parse((j.content || []).find(b => b.type === 'text').text);
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
let PL = null;   /* program sayfası: { link, err, incoming } */
function planSheet() {
  sheet = 'plan';
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
- Kalori ve protein söylerken <durum>daki değerleri kullan. Kendin tahmin ediyorsan "yaklaşık" de.
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
    (d.extras || []).filter(e => e.meal === m.id).forEach(e => rows.push(`  - ${e.adj ? 'telafi' : 'plan dışı'}: ${e.name} · ${num(e.k)} kcal, ${num(e.p)} g protein`));
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
  if (!aiKey()) return needKey();
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
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': aiKey(), 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: CHAT_MODEL, max_tokens: 4000, stream: true, thinking: { type: 'disabled' }, output_config: { effort: 'low' },
        system: [{ type: 'text', text: CHAT_SYSTEM(), cache_control: { type: 'ephemeral' } }],
        messages: CHAT.slice(0, -1).map(({ role, content }) => ({ role, content })) }) });
    if (!r.ok) { const j = await r.json().catch(() => ({}));
      throw new Error(r.status === 401 ? 'API anahtarı geçersiz. Program sekmesinden yenisini gir.' : r.status === 429 ? 'Çok fazla istek; biraz sonra yeniden dene.' : r.status === 529 ? 'Servis şu an yoğun; biraz sonra yeniden dene.' : (j.error && j.error.message) || 'İstek başarısız oldu.'); }
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
    case 'ev': { const next = sel === today ? nextMeal() : null, cur = openEv[sel] !== undefined ? openEv[sel] : next ? next.id : ''; openEv[sel] = cur === el.dataset.id ? '' : el.dataset.id; break; }
    case 'toggle': { const id = el.dataset.id, m = MEALS.find(x => x.id === id.split('.')[0]);
      if (d.items[id]) delete d.items[id]; else { lockMain(sel, m); d.items[id] = eaten(id); }
      if (mealStat(m, sel).resolved && m.time) delete openEv[sel]; buzz(); break; }
    case 'add': { const x = A.adds[+el.dataset.i]; if (x.xi >= 0) d.extras.splice(x.xi, 1); else { const { xi, ...keep } = x; d.extras.push({ ...keep, adj: true }); } buzz(); break; }
    case 'unextra': d.extras.splice(+el.dataset.i, 1); break;
    case 'sheet': openSheet(el.dataset.id); return;
    case 'prog': if (el.dataset.p === 'gidalar') return foodsSheet(); if (el.dataset.p === 'baglanti') { PL = {}; return planSheet(); } progSheet(el.dataset.p); return;
    case 'planpaste': { const v = document.getElementById('plink').value.trim(); if (!v) return;
      unpackPlan(v).then(p2 => { PL = { incoming: p2 }; planSheet(); }).catch(x => { PL = { err: x.message || 'Bağlantı okunamadı.' }; planSheet(); }); return; }
    case 'planload': try { localStorage.setItem(PLANKEY, JSON.stringify(PL.incoming)); } catch (x) { PL = { err: 'Program kaydedilemedi.' }; return planSheet(); } reloadClean(); return;
    case 'plannot': PL = null; history.replaceState(null, '', location.pathname + location.search); closeSheet(); return;
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
    case 'quick': { const m = nextMeal(); sel = today; tab = 'today'; render(); if (!m) return; if (!aiKey()) return needKey(); camMeal = m.id; document.getElementById('cam').click(); return; }
    case 'photo': if (!aiKey()) return needKey(); camMeal = meal.id; document.getElementById('cam').click(); return;
    case 'write': quickSheet(meal); return;
    case 'qadd': { const x = Q.res[+el.dataset.i], had = Q.tray.find(t => t.id === x.id); if (had) had.q += 1; else Q.tray.push({ ...x, q: 1 });
      const t = document.getElementById('q'); t.value = ''; qPaint(); buzz(); return; }
    case 'qq': Q.tray[+el.dataset.i].q = +el.dataset.v; qPaint(); buzz(); return;
    case 'qx': Q.tray.splice(+el.dataset.i, 1); qPaint(); return;
    case 'fnew': FD = { n: el.dataset.q || '', u: '', k: '', p: '', img: '', ret: el.dataset.ret || '' }; foodForm(); return;
    case 'fedit': { const f = S.foods[el.dataset.id]; FD = { id: el.dataset.id, n: f.n, u: f.u || '', k: String(f.k), p: String(f.p).replace('.', ','), img: f.img || '' }; foodForm(); return; }
    case 'fpic': fSync(); document.getElementById('pic').click(); return;
    case 'fai': fSync(); if (!aiKey()) { FD.err = 'Yapay zekâ için Program → Yapay zekâ bölümünden API anahtarı gir. Değerleri elle de girebilirsin.'; return foodForm(); } foodAI(); return;
    case 'fdel': if (!FD.del) { FD.del = true; fSync(); return foodForm(); } delete S.foods[FD.id]; FD = null; foodsSheet(); break;
    case 'fback': if (FD && FD.ret) { const m = MEALS.find(x => x.id === FD.ret); FD = null; quickSheet(m, true); return; } FD = null; foodsSheet(); return;
    case 'fsave': { fSync(); const id = fSave(); if (!id) return; const ret = FD.ret; FD = null;
      if (ret) { const f = S.foods[id], m = MEALS.find(x => x.id === ret); if (!Q.tray.some(t => t.id === id)) Q.tray.push({ id, n: f.n, u: f.u, k: f.k, p: f.p, img: f.img, mine: true, q: 1 }); save(); quickSheet(m, true); return; }
      foodsSheet(); break; }
    case 'qmode': Q.mode = el.dataset.m; qPaint(); return;
    case 'qai': { const v = document.getElementById('q').value.trim(); if (!v) return; if (!aiKey()) return needKey(); analyze(Q.meal, { text: v }); return; }
    case 'qsave': if (!Q.tray.length) return; qSave(); closeSheet(); buzz(); break;
    case 'applyai': applyAI(); closeSheet(); buzz(); break;
    case 'savekey': { const v = document.getElementById('aikey').value.trim(); if (!v) return; try { localStorage.setItem(AIKEY, v); } catch (x) {} closeSheet(); break; }
    case 'delkey': try { localStorage.removeItem(AIKEY); } catch (x) {} closeSheet(); break;
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
    Promise.all([thumb(f), shrink(f)]).then(([img, full]) => { FD.img = img; FD.full = full; FD.err = ''; if (sheet !== 'food') return; if (aiKey()) foodAI(); else foodForm(); })
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
  if (e.target.id === 'said2') grow(e.target);
  if (e.target.id === 'q') qPaint();
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
