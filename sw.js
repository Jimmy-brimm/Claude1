/* Polyweb's offline support.
   After the first visit the game, its fonts and its icons are kept on the device, so single-player,
   Pass & Play and the map editor work with no connection. Online play still needs the network.

   - The page itself is fetched fresh whenever there is a connection (so a new version arrives at once)
     and comes from the cache when there isn't, or when the network is too slow to answer.
   - game.js, style.css and config.js carry a version (?v=...) stamped at deploy time, so each version is
     downloaded once and then served from the cache. Versions no longer used by the page are dropped.
   - Fonts come from Google Fonts; the lettering every style uses is fetched once and kept.
   - Everything else (the online play server) always goes straight to the network.
   Change CACHE when this file's behaviour changes. */
const CACHE = 'polyweb-app-v1', FONTS = 'polyweb-fonts-v1';
const SHELL = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
const PAGE = './'; // the cache key for the game's page, whatever query string it was opened with

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    try {
      const res = await fetch(PAGE, { cache: 'no-cache' });
      if (res.ok) { const html = await res.clone().text(); if (await keepAssets(c, html)) await c.put(PAGE, res); await keepFonts(html); }
    } catch (err) { /* offline while installing: the next visit fills the cache */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('polyweb-') && k !== CACHE && k !== FONTS) await caches.delete(k);
    await self.clients.claim();
  })());
});

// The game's own scripts and stylesheet named in the page.
const assetsIn = html => [...html.matchAll(/(?:src|href)="([^"#]+?\.(?:js|css)(?:\?[^"]*)?)"/g)].map(m => m[1]).filter(u => !/^[a-z]+:/i.test(u) && !u.startsWith('//'));
async function keepAssets(c, html) { // true when every file the page needs is in the cache
  const want = assetsIn(html), wantUrls = new Set(want.map(u => new URL(u, self.registration.scope).href));
  const got = await Promise.all(want.map(async u => { if (await c.match(u)) return true; const r = await fetch(u).catch(() => null); if (!r || !r.ok) return false; await c.put(u, r); return true; }));
  if (!got.every(Boolean)) return false; // keep the old page and its files until the new ones are all here
  for (const req of await c.keys()) { // drop old versions of the game files
    const url = new URL(req.url);
    if (url.search.includes('v=') && /\.(js|css)$/.test(url.pathname) && !wantUrls.has(url.href)) await c.delete(req);
  }
  return true;
}
async function keepFonts(html) {
  const m = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/);
  if (!m) return;
  const url = m[1].replace(/&amp;/g, '&'), fc = await caches.open(FONTS);
  if (await fc.match(url)) return; // this set of fonts is already kept
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    await fc.put(url, res.clone());
    const css = await res.text();
    // keep the Latin lettering of every style (the other alphabets are fetched only if ever needed)
    const files = css.split('/*').filter(b => /^\s*latin\s*\*\//.test(b)).map(b => (b.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/) || [])[1]).filter(Boolean);
    await Promise.all(files.map(async f => { if (!(await fc.match(f))) { const r = await fetch(f, { mode: 'cors' }).catch(() => null); if (r && r.ok) await fc.put(f, r); } }));
  } catch (err) { /* fonts fall back to the system's until the next visit */ }
}

const timeout = (ms, p) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('slow')), ms))]);
async function fromCacheFirst(req, cacheName) {
  const c = await caches.open(cacheName), hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') c.put(req, res.clone());
  return res;
}
async function fromNetworkFirst(req, key, ms, store = true) {
  const c = await caches.open(CACHE);
  try {
    const res = await timeout(ms, fetch(req));
    if (res.ok && store) c.put(key || req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(key || req);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') { // the page: fresh when online, from the cache when not
      e.respondWith(fromNetworkFirst(req, PAGE, 5000, false).then(res => {
        if (res.ok && !res.redirected) { // keep this version of the page once all its files are kept too
          const copy = res.clone();
          e.waitUntil((async () => { const c = await caches.open(CACHE), html = await copy.clone().text(); if (await keepAssets(c, html)) { await c.put(PAGE, copy); await keepFonts(html); } })().catch(() => {}));
        }
        return res;
      }));
      return;
    }
    if (url.search.includes('v=')) { e.respondWith(fromCacheFirst(req, CACHE)); return; } // a stamped version never changes
    if (url.pathname.endsWith('/sw.js')) return;
    e.respondWith(fromNetworkFirst(req, null, 5000)); // unversioned files (development, icons): fresh, else cached
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(fromCacheFirst(req, FONTS)); return; }
  // anything else, such as the online play server, is left to the network
});
