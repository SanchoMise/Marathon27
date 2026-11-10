// Hors ligne : l'app (page, styles, scripts, plan, icônes, polices vues) est gardée en mémoire.
// Réseau d'abord avec un délai court (3,5 s), puis copie en mémoire : en mode avion ou avec un mauvais réseau, l'accueil s'affiche quand même.
const V = 'm27-v4';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/plan.json', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png', '/icons/favicon-16.png', '/favicon.ico'];
const WAIT = 3500;
const tell = () => self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage({ type: 'update' })));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).pathname.startsWith('/api/')) return; // la synchro échoue vite, sans passer par la mémoire
  e.respondWith((async () => {
    const cache = await caches.open(V);
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; });
    net.catch(() => {}); // évite une erreur non gérée si le réseau répond après le délai
    try {
      return await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('lent')), WAIT))]);
    } catch (err) {
      const hit = (await cache.match(req, { ignoreSearch: true })) ||
        (req.mode === 'navigate' ? (await cache.match('/index.html')) || (await cache.match('/')) : undefined);
      if (hit) {
        // On a servi la copie en mémoire parce que le réseau était lent : si la version fraîche arrive ensuite, on prévient la page.
        net.then(r => { if (r && r.ok && (req.mode === 'navigate' || /\/(app\.js|styles\.css|plan\.json)$/.test(new URL(req.url).pathname))) tell(); }).catch(() => {});
        return hit;
      }
      return net; // rien en mémoire : on attend le réseau
    }
  })());
});
