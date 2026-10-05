// Fonction Vercel : stocke la progression dans Upstash Redis, sous une clé dérivée du code secret.
const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('upstash ' + r.status);
  return (await r.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'storage not configured' });
  const { code, action, state } = req.body || {};
  if (typeof code !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(code)) return res.status(400).json({ error: 'code' });
  const key = 'm27:' + crypto.createHash('sha256').update(code).digest('hex');
  try {
    if (action === 'get') {
      const raw = await redis(['GET', key]);
      return res.status(200).json({ state: raw ? JSON.parse(raw) : null });
    }
    if (action === 'put') {
      const json = JSON.stringify(state);
      if (!state || typeof state !== 'object' || json.length > 100000) return res.status(400).json({ error: 'state' });
      await redis(['SET', key, json]);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e) {
    return res.status(502).json({ error: 'storage' });
  }
};
