// Post-traitement de l'export web (npx expo export -p web) pour en faire une PWA installable :
//  - génère dist/sw.js (service worker : pré-cache de tous les fichiers exportés, hors-ligne)
//  - copie index.html -> 404.html (routage SPA sur GitHub Pages)
//  - ajoute .nojekyll (GitHub Pages ignore sinon le dossier _expo)
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html introuvable — lancez d’abord `npx expo export -p web`.');
  process.exit(1);
}
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
const base = (app.experiments?.baseUrl ?? '').replace(/\/$/, '');

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(dist, p).split('\\').join('/'));
  }
})(dist);

// pdf.js (≈ 1,8 Mo) : chargé seulement quand l’utilisateur importe un PDF, jamais pré-caché ni gardé hors-ligne.
// Paysages : un seul fichier est demandé quand le thème est choisi (puis mis en cache à cette occasion).
const ON_DEMAND = /^pdfjs\/|\/landscapes\/[^/]+\.webp$/;
const precache = files.filter((f) => !/(^|\/)(sw\.js|404\.html|metadata\.json|\.nojekyll)$/.test(f) && !f.endsWith('.map') && !ON_DEMAND.test(f));
const hash = createHash('sha256');
for (const f of precache) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);
const urls = [base + '/', ...precache.map((f) => `${base}/${f}`)];

const sw = `/* Service worker généré par scripts/pwa-postbuild.mjs — version ${version} */
const CACHE = '${app.slug}-${version}';
const BASE = '${base}';
const PRECACHE = ${JSON.stringify(urls)};
// Récitations téléchargées par l'utilisateur (écran « Téléchargements ») : jamais supprimées par une mise à jour.
const AUDIO = 'zikru-audio-v1';
const AUDIO_HOSTS = ['everyayah.com', 'cdn.islamic.network'];
function fromAudioCache(req) {
  return caches.open(AUDIO).then((c) => c.match(req.url)).then((hit) => {
    if (!hit) return fetch(req);
    const range = req.headers.get('range');
    if (!range) return hit;
    // Safari demande l'audio par plages (Range) : on répond 206 depuis le fichier en cache.
    return hit.arrayBuffer().then((buf) => {
      const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const size = buf.byteLength;
      let start = m[1] ? Number(m[1]) : 0;
      let end = m[2] ? Number(m[2]) : size - 1;
      if (!m[1] && m[2]) { start = Math.max(0, size - Number(m[2])); end = size - 1; }
      end = Math.min(end, size - 1);
      if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
      return new Response(buf.slice(start, end + 1), {
        status: 206,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(end - start + 1), 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Accept-Ranges': 'bytes' },
      });
    });
  }).catch(() => fetch(req));
}
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && !k.startsWith('zikru-audio')).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method === 'GET' && AUDIO_HOSTS.includes(url.hostname) && url.pathname.endsWith('.mp3')) {
    e.respondWith(fromAudioCache(req));
    return;
  }
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // pdf.js : réseau uniquement, à la demande (pas de cache hors-ligne)
  if (url.pathname.startsWith(BASE + '/pdfjs/')) return;
  if (req.mode === 'navigate') {
    // Réseau d'abord pour les pages, repli hors-ligne sur l'app (SPA)
    e.respondWith(fetch(req).catch(() => caches.match(BASE + '/index.html').then((r) => r || caches.match(BASE + '/'))));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
`;
writeFileSync(join(dist, 'sw.js'), sw);
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`PWA prête : ${precache.length} fichiers pré-cachés (version ${version}), base « ${base || '/'} ».`);
