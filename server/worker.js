/* Diyet API vekili (Cloudflare Worker).
   Uygulama Anthropic anahtarını hiç görmez: danışan, diyetisyenin verdiği davet koduyla bu vekile gelir,
   vekil isteği kendi anahtarıyla Anthropic'e iletir ve kodun aylık bütçesini sayar.

   Ortam:
   - ANTHROPIC_API_KEY (secret): Anthropic anahtarı.
   - DIYET (KV): code:<kod> → { name, usd } aylık bütçe (dolar); use:<kod>:<YYYY-AA> → { n, usd }.
   - ORIGINS (var): izin verilen kökenler, virgülle (ör. https://fdemirci52.github.io).

   Uçlar:
   - POST /v1/messages  Anthropic Messages API'nin aynısı (akışlı ya da değil). Authorization: Bearer <kod>.
                        Araç olarak yalnızca istemcinin kendi (custom) araçları geçer.
   - GET  /v1/me        { name, month, n, usd, budget }: kodun bu ayki kullanımı.

   Hesap ve eşitleme (DB: D1, şema migrations/ içinde). Oturum belirteci Authorization: Bearer <belirteç> ile gelir.
   - POST   /v1/auth/start   { email } → e-postaya 6 haneli kod gider (RESEND_KEY, MAIL_FROM).
                             DEV_CODES = "1" iken ve RESEND_KEY yokken kod cevapta döner (yalnızca yerel deneme).
   - POST   /v1/auth/verify  { email, code } → { token, email }. Hesap yoksa açılır.
   - POST   /v1/auth/logout  bu oturumu kapatır.
   - POST   /v1/sync         { since, put: [{ k, v }] } → { rev, docs: [{ k, v }] }. v metin (JSON) ya da null (silindi).
                             Önce since'ten sonra başka cihazların yazdıkları okunur, sonra put yazılır; aynı işlemde.
   - DELETE /v1/account      hesabı ve buluttaki bütün kayıtları siler. */

const API = 'https://api.anthropic.com/v1/messages', VERSION = '2026-10-21';
/* Milyon token başına dolar (girdi, çıktı). Yalnızca bu modellere izin verilir. */
const PRICE = { 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] };
const MAX_TOKENS = 16000, DEFAULT_BUDGET = 2;

const month = () => new Date().toISOString().slice(0, 7);
const cost = (model, u = {}) => { const [pi, po] = PRICE[model] || [0, 0], cw = u.cache_creation_input_tokens || 0, cr = u.cache_read_input_tokens || 0;
  return ((u.input_tokens || 0) * pi + cw * pi * 1.25 + cr * pi * 0.1 + (u.output_tokens || 0) * po) / 1e6; };

function cors(req, env) {
  const o = req.headers.get('origin') || '', ok = (env.ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return ok.includes(o) ? { 'access-control-allow-origin': o, 'access-control-allow-headers': 'authorization, content-type, anthropic-version',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS', 'access-control-max-age': '86400', vary: 'origin' } : {};
}
const json = (body, status, h) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...h } });
/* Anthropic'in hata biçimiyle, uygulama aynı yoldan okusun. */
const fail = (status, type, message, h) => json({ type: 'error', error: { type, message } }, status, h);

async function account(req, env) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+([A-Za-z0-9-]{4,64})$/);
  if (!m) return null;
  const code = m[1].toUpperCase(), c = await env.DIYET.get('code:' + code, 'json');
  if (!c) return null;
  const key = `use:${code}:${month()}`, use = (await env.DIYET.get(key, 'json')) || { n: 0, usd: 0 };
  return { code, name: c.name || '', budget: c.usd ?? DEFAULT_BUDGET, key, use };
}
const charge = (env, a, model, usage) => env.DIYET.put(a.key, JSON.stringify({ n: a.use.n + 1, usd: Math.round((a.use.usd + cost(model, usage)) * 1e6) / 1e6 }));

/* ---------- Hesap ve eşitleme ---------- */
const now = () => Date.now();
const b64u = a => btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha = async t => b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))));
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const OTP_TTL = 10 * 60e3, OTP_GAP = 60e3, OTP_TRIES = 5, DOC_MAX = 1e6, PUT_MAX = 400;

async function sendCode(env, email, code) {
  if (!env.RESEND_KEY) return env.DEV_CODES === '1' ? { dev: code } : null;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST',
    headers: { authorization: 'Bearer ' + env.RESEND_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM || 'Diyet <onboarding@resend.dev>', to: [email], subject: `Giriş kodun: ${code}`,
      text: `Diyet uygulamasına giriş kodun: ${code}\n\nKod 10 dakika geçerli. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.` }) });
  return r.ok ? {} : null;
}

async function session(req, env) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+([A-Za-z0-9_-]{40,64})$/);
  if (!m) return null;
  const hash = await sha(m[1]), s = await env.DB.prepare('SELECT s.uid, u.email FROM sessions s JOIN users u ON u.id = s.uid WHERE s.hash = ?').bind(hash).first();
  if (s) await env.DB.prepare('UPDATE sessions SET seen = ? WHERE hash = ?').bind(now(), hash).run();
  return s && { uid: s.uid, email: s.email, hash };
}

async function hesap(req, env, url, h) {
  const p = url.pathname, body = req.method === 'POST' ? await req.json().catch(() => null) : null;
  if (req.method === 'POST' && !body) return fail(400, 'invalid_request_error', 'İstek okunamadı.', h);

  if (p === '/v1/auth/start') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL.test(email)) return fail(400, 'invalid_request_error', 'E-posta adresi geçersiz.', h);
    const o = await env.DB.prepare('SELECT sent FROM otps WHERE email = ?').bind(email).first();
    if (o && now() - o.sent < OTP_GAP) return fail(429, 'rate_limit_error', 'Yeni kod için bir dakika bekle.', h);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
    await env.DB.prepare('INSERT OR REPLACE INTO otps (email, hash, exp, tries, sent) VALUES (?, ?, ?, 0, ?)').bind(email, await sha(email + ':' + code), now() + OTP_TTL, now()).run();
    const r = await sendCode(env, email, code);
    if (!r) return fail(503, 'api_error', 'Kod e-postası gönderilemedi. Biraz sonra yeniden dene.', h);
    return json({ ok: true, ...r }, 200, h);
  }
  if (p === '/v1/auth/verify') {
    const email = String(body.email || '').trim().toLowerCase(), code = String(body.code || '').replace(/\D/g, '');
    const o = await env.DB.prepare('SELECT hash, exp, tries FROM otps WHERE email = ?').bind(email).first();
    if (!o || o.exp < now() || o.tries >= OTP_TRIES) return fail(400, 'invalid_request_error', 'Kodun süresi doldu. Yeni kod iste.', h);
    if (code.length !== 6 || await sha(email + ':' + code) !== o.hash) {
      await env.DB.prepare('UPDATE otps SET tries = tries + 1 WHERE email = ?').bind(email).run();
      return fail(400, 'invalid_request_error', 'Kod yanlış.', h);
    }
    await env.DB.prepare('INSERT OR IGNORE INTO users (email, created) VALUES (?, ?)').bind(email, now()).run();
    const u = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    const token = b64u(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.batch([
      env.DB.prepare('DELETE FROM otps WHERE email = ?').bind(email),
      env.DB.prepare('INSERT INTO sessions (hash, uid, created, seen) VALUES (?, ?, ?, ?)').bind(await sha(token), u.id, now(), now()),
    ]);
    return json({ token, email }, 200, h);
  }

  const s = await session(req, env);
  if (!s) return fail(401, 'authentication_error', 'Oturum kapandı. Yeniden giriş yap.', h);
  if (p === '/v1/auth/logout' && req.method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE hash = ?').bind(s.hash).run();
    return json({ ok: true }, 200, h);
  }
  if (p === '/v1/account' && req.method === 'DELETE') {
    await env.DB.batch(['docs', 'sessions'].map(t => env.DB.prepare(`DELETE FROM ${t} WHERE uid = ?`).bind(s.uid))
      .concat(env.DB.prepare('DELETE FROM users WHERE id = ?').bind(s.uid)));
    return json({ ok: true }, 200, h);
  }
  if (p === '/v1/sync' && req.method === 'POST') {
    const since = Math.max(0, +body.since || 0), put = Array.isArray(body.put) ? body.put : [];
    if (put.length > PUT_MAX) return fail(413, 'invalid_request_error', 'Tek seferde çok fazla kayıt.', h);
    for (const d of put) if (!d || typeof d.k !== 'string' || !d.k || d.k.length > 200 || (d.v !== null && typeof d.v !== 'string') || (d.v && d.v.length > DOC_MAX))
      return fail(400, 'invalid_request_error', 'Kayıt biçimi tanınmadı.', h);
    /* Tek işlem: önce başkalarının yazdıkları okunur, sonra sayaç artar ve bu istekteki belgeler yeni sayaçla yazılır. */
    const q = [env.DB.prepare('SELECT k, v FROM docs WHERE uid = ? AND ts > ? ORDER BY ts').bind(s.uid, since)];
    if (put.length) q.push(env.DB.prepare('UPDATE users SET rev = rev + 1 WHERE id = ?').bind(s.uid),
      ...put.map(d => env.DB.prepare('INSERT OR REPLACE INTO docs (uid, k, v, ts) VALUES (?1, ?2, ?3, (SELECT rev FROM users WHERE id = ?1))').bind(s.uid, d.k, d.v)));
    q.push(env.DB.prepare('SELECT rev FROM users WHERE id = ?').bind(s.uid));
    const r = await env.DB.batch(q), mine = new Set(put.map(d => d.k));
    return json({ rev: r[r.length - 1].results[0].rev, email: s.email, docs: r[0].results.filter(d => !mine.has(d.k)) }, 200, h);
  }
  return fail(404, 'not_found_error', 'Bulunamadı.', h);
}

export default {
  async fetch(req, env, ctx) {
    const h = cors(req, env), url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: h['access-control-allow-origin'] ? 204 : 403, headers: h });
    if (/^\/v1\/(auth\/|sync$|account$)/.test(url.pathname)) {
      if (!env.DB) return fail(503, 'api_error', 'Hesaplar henüz açık değil.', h);
      return hesap(req, env, url, h);
    }
    const a = await account(req, env);
    if (!a) return fail(401, 'authentication_error', 'Davet kodu geçersiz.', h);

    if (req.method === 'GET' && url.pathname === '/v1/me')
      return json({ name: a.name, month: month(), n: a.use.n, usd: a.use.usd, budget: a.budget }, 200, h);
    if (req.method !== 'POST' || url.pathname !== '/v1/messages') return fail(404, 'not_found_error', 'Bulunamadı.', h);
    if (a.use.usd >= a.budget) return fail(402, 'budget_exceeded', 'Bu ayın yapay zekâ hakkı doldu.', h);

    let body;
    try { body = await req.json(); } catch (e) { return fail(400, 'invalid_request_error', 'İstek okunamadı.', h); }
    if (!PRICE[body.model]) return fail(400, 'invalid_request_error', 'Bu model kullanılamaz.', h);
    /* Yalnızca uygulamanın kendi araçları (istemcide çalışır); sunucu araçları (web araması, kod çalıştırma…) kapalı. */
    if (body.mcp_servers || body.container) return fail(400, 'invalid_request_error', 'Araç kullanımı kapalı.', h);
    if (body.tools != null && (!Array.isArray(body.tools) || body.tools.length > 16
      || body.tools.some(t => !t || (t.type != null && t.type !== 'custom') || typeof t.name !== 'string' || !t.input_schema)))
      return fail(400, 'invalid_request_error', 'Bu araç kullanılamaz.', h);
    body.max_tokens = Math.min(body.max_tokens || MAX_TOKENS, MAX_TOKENS);

    const r = await fetch(API, { method: 'POST', body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': VERSION } });
    if (!r.ok) {
      /* Anthropic'in kendi kimlik hatası danışana "kodun geçersiz" diye görünmesin. */
      const status = r.status === 401 || r.status === 403 ? 502 : r.status, t = await r.text();
      return new Response(t, { status, headers: { 'content-type': 'application/json', ...h } });
    }

    if (!body.stream) {
      const j = await r.json();
      ctx.waitUntil(charge(env, a, body.model, j.usage));
      return json(j, 200, h);
    }
    /* Akış: olaylar olduğu gibi geçer; kullanım message_start ve message_delta'dan toplanır, akış bitince yazılır. */
    const usage = {}, dec = new TextDecoder(); let buf = '';
    const tap = new TransformStream({
      transform(chunk, ctl) {
        ctl.enqueue(chunk); buf += dec.decode(chunk, { stream: true }); let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          try { const ev = JSON.parse(line.slice(5));
            if (ev.type === 'message_start') Object.assign(usage, ev.message.usage);
            if (ev.type === 'message_delta' && ev.usage) Object.assign(usage, ev.usage); } catch (e) {}
        }
      },
      flush() { ctx.waitUntil(charge(env, a, body.model, usage)); },
    });
    return new Response(r.body.pipeThrough(tap), { status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...h } });
  },
};
