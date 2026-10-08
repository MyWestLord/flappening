// FLAPPENING world leaderboard — a tiny Cloudflare Worker backed by one KV namespace.
// Deploy: see worker/README.md. Then paste the worker URL into js/config.js -> leaderboardUrl.

const MAPS = ['cloud', 'code', 'city', 'moon'];
const CHARS = ['wurst', 'moon', 'duck', 'pigeon', 'capy', 'toast', 'gull', 'brick'];
const KEEP = 50;

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);

    if (url.pathname === '/top' && req.method === 'GET') {
      const map = url.searchParams.get('map');
      if (!MAPS.includes(map)) return json({ error: 'bad map' }, 400);
      const list = JSON.parse((await env.LB.get(map)) || '[]');
      return json({ scores: list.slice(0, 20) });
    }

    if (url.pathname === '/submit' && req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      const map = body.map, char = body.char;
      const score = Number(body.score);
      const name = String(body.name || '').toUpperCase().replace(/[^A-Z0-9 _.\-]/g, '').trim().slice(0, 12);
      if (!MAPS.includes(map) || !CHARS.includes(char) || !name || !Number.isInteger(score) || score < 1 || score > 999) {
        return json({ error: 'rejected' }, 400);
      }
      // one submit per ip per 10 seconds
      const ip = req.headers.get('cf-connecting-ip') || 'x';
      const rl = 'rl:' + ip;
      if (await env.LB.get(rl)) return json({ error: 'slow down' }, 429);
      await env.LB.put(rl, '1', { expirationTtl: 60 });

      const list = JSON.parse((await env.LB.get(map)) || '[]');
      const i = list.findIndex((r) => r.name === name);
      if (i >= 0 && list[i].score >= score) return json({ ok: true, rank: i + 1 });
      if (i >= 0) list.splice(i, 1);
      list.push({ name, score, char, at: Date.now() });
      list.sort((a, b) => b.score - a.score);
      const top = list.slice(0, KEEP);
      await env.LB.put(map, JSON.stringify(top));
      return json({ ok: true, rank: top.findIndex((r) => r.name === name) + 1 });
    }

    return json({ error: 'not found' }, 404);
  }
};
