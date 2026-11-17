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
   - GET  /v1/me        { name, month, n, usd, budget }: kodun bu ayki kullanımı. */

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
    'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '86400', vary: 'origin' } : {};
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

export default {
  async fetch(req, env, ctx) {
    const h = cors(req, env), url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: h['access-control-allow-origin'] ? 204 : 403, headers: h });
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
