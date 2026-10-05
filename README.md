# Marathon 27

Suivi de prépa marathon (4 avril 2027). Site statique + une fonction Vercel `api/sync.js` pour la synchro.

- `plan.json` : le plan (généré par `tools/make_plan.py` depuis `tools/plan.v1.json`).
- Test de date : `?date=2027-01-22`.
- Synchro : base Upstash Redis (Marketplace Vercel). La fonction lit `KV_REST_API_URL` / `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`), que Vercel injecte quand la base est connectée au projet. La progression est stockée sous le hash SHA-256 d'un code secret généré dans l'app (Plus > Synchro et sauvegarde).
