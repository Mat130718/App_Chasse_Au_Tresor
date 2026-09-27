// Service worker : permet d'ouvrir l'application sans réseau (dans un parc,
// en forêt…). Le réseau reste prioritaire pour toujours servir la dernière
// version ; la copie locale ne sert qu'en secours.
const CACHE = 'chasse-v3';
const ESSENTIELS = [
  './',
  'pilote.html',
  'joueur.html',
  'css/pilote.css?v=6',
  'css/joueur.css?v=10',
  'js/pilote.js?v=6',
  'js/stockage.js?v=3',
  'js/joueur.js?v=10',
  'js/vendor/qrcode.js',
  'js/vendor/jsQR.js',
  'js/vendor/leaflet/leaflet.js',
  'js/vendor/leaflet/leaflet.css',
  'icones/parent.svg',
  'icones/carte.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(ESSENTIELS.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const memeSite = url.origin === self.location.origin;
  const polices = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!memeSite && !polices) return; // tuiles de carte, etc. : directement au réseau

  e.respondWith(repondre(req, url));
});

async function chercherEnCache(cache, req, url) {
  return (
    (await cache.match(req)) ||
    (req.mode === 'navigate' && (await cache.match(url.origin + url.pathname))) ||
    (await cache.match(req, { ignoreSearch: true }))
  );
}

async function repondre(req, url) {
  const cache = await caches.open(CACHE);
  const reseau = fetch(req).then((rep) => {
    if (rep && (rep.ok || rep.type === 'opaque')) {
      // Les pages sont rangées sans leurs paramètres (?lat=…) pour servir de secours.
      const cle = req.mode === 'navigate' ? url.origin + url.pathname : req;
      cache.put(cle, rep.clone()).catch(() => {});
    }
    return rep;
  });
  // Réseau lent ou absent : la copie locale prend le relais après 4 secondes.
  reseau.catch(() => {});
  const delai = new Promise((resolve) => setTimeout(resolve, 4000, 'lent'));
  try {
    const premier = await Promise.race([reseau, delai]);
    if (premier !== 'lent') return premier;
    return (await chercherEnCache(cache, req, url)) || (await reseau);
  } catch (err) {
    const copie = await chercherEnCache(cache, req, url);
    if (copie) return copie;
    throw err;
  }
}
