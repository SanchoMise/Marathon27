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

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const valid = v => typeof v === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(v);
function newShareCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 20; i++) c += A[crypto.randomInt(A.length)];
  return c.match(/.{5}/g).join('-');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'storage not configured' });
  const { code, share, action, state } = req.body || {};
  try {
    // Lecture seule : le code de partage ne donne accès qu'à la progression, jamais à l'écriture.
    if (action === 'read') {
      if (!valid(share)) return res.status(400).json({ error: 'share' });
      const ownerKey = await redis(['GET', 'm27s:' + sha(share)]);
      if (!ownerKey) return res.status(404).json({ error: 'share' });
      const raw = await redis(['GET', ownerKey]);
      return res.status(200).json({ state: raw ? JSON.parse(raw) : null });
    }
    if (!valid(code)) return res.status(400).json({ error: 'code' });
    const key = 'm27:' + sha(code);
    if (action === 'get') {
      const raw = await redis(['GET', key]);
      const sc = await redis(['GET', 'm27ss:' + key]);
      return res.status(200).json({ state: raw ? JSON.parse(raw) : null, share: sc || null });
    }
    if (action === 'put') {
      const json = JSON.stringify(state);
      if (!state || typeof state !== 'object' || json.length > 100000) return res.status(400).json({ error: 'state' });
      await redis(['SET', key, json]);
      return res.status(200).json({ ok: true });
    }
    if (action === 'share-create' || action === 'share-revoke') {
      const old = await redis(['GET', 'm27ss:' + key]);
      if (old) { await redis(['DEL', 'm27s:' + sha(old)]); await redis(['DEL', 'm27ss:' + key]); }
      if (action === 'share-revoke') return res.status(200).json({ share: null });
      const sc = newShareCode();
      await redis(['SET', 'm27s:' + sha(sc), key]);
      await redis(['SET', 'm27ss:' + key, sc]);
      return res.status(200).json({ share: sc });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e) {
    return res.status(502).json({ error: 'storage' });
  }
};
