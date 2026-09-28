/*
 * Surf nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Surf nos Trilhos — service worker (offline). Suba VERSAO a cada deploy.
const VERSAO = 'surf-v1.1.0';
const ARQUIVOS = ['./', './index.html', './estilo.css?v=1.1.0', './jogo.js?v=1.1.0', './lib/three.module.min.js', './personagens.js?v=1.1.0', './objetos.js?v=1.1.0', './itens.js?v=1.1.0', './icones.js?v=1.1.0',
  './manifest.webmanifest', './icone-192.png?v=3', './icone-512.png?v=3', './icone-maskable.png?v=3', './apple-touch-icon.png?v=3'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('surf-') && k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // página: rede primeiro (pega atualização), cache se estiver offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSAO).then(ca => ca.put('./', c)); return r; })
      .catch(() => caches.match('./')));
    return;
  }
  // arquivos do jogo e fontes: cache primeiro
  if (url.origin === location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')) {
    e.respondWith(caches.match(req).then(h => h || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSAO).then(ca => ca.put(req, c)); }
      return r;
    })));
  }
});
