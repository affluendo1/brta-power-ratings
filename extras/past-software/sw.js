/* Serve each historical website from immutable GitHub blobs, under its own URL subtree. */
importScripts('releases.js?v=9111');

const { snapshots } = BRTAPastSoftware;
const tikituffScope = new URL(self.registration.scope);
const tikituffSource = 'https://raw.githubusercontent.com/affluendo1/brta-power-ratings/';
const currentSite = new URL('../../', tikituffScope);
const types = {
  css: 'text/css; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  gz: 'application/gzip',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  mp3: 'audio/mpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webmanifest: 'application/manifest+json',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function tikituffPage(html, path, snapshot, base) {
  const mount = new URL('./', new URL(path, base));
  const bridge = '<meta name="robots" content="noindex">' +
    '<base href="' + mount.href + '">' +
    '<script src="' + new URL('releases.js?v=9111', tikituffScope).href + '"></script>' +
    '<script src="' + new URL('snapshot.js?v=9111', tikituffScope).href + '"></script>' +
    '<style>#pastSoftwareBanner{position:relative;z-index:2;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:.3em 1em;padding:.55em .8em;background:#29241a;color:#fff4d2;text-align:center;font:600 .85rem/1.4 system-ui,sans-serif}' +
    '#pastSoftwareBanner a{color:#ffe28a;text-decoration:underline}#pastSoftwareMark{margin-inline-end:.4em;color:inherit;font:800 .65em/1 system-ui,sans-serif;letter-spacing:.06em;white-space:nowrap}</style>';
  const banner = '<aside id="pastSoftwareBanner" aria-label="Historical release"><strong>PAST · ' + snapshot.version +
    '</strong><span>You’re viewing a historical release of BRTA Power Ratings.</span><a href="' +
    currentSite.href + '">Return to the current site</a></aside>';
  return html.replace(/<link\b[^>]*\brel=["']manifest["'][^>]*>/gi, '')
    .replace(/<head\b[^>]*>/i, head => head + bridge)
    .replace(/<body\b[^>]*>/i, body => body + banner)
    .replace(/<div class="brand">/i, brand => brand + '<span id="pastSoftwareMark">PAST</span>');
}

async function tikituffFetch(request, alias, path) {
  const snapshot = snapshots[alias];
  const base = new URL(alias + '/', tikituffScope);
  const rootRoute = /^(?:current|history)\/[a-z0-9][a-z0-9_/-]*$/i.test(path);
  const file = !path || rootRoute ? 'index.html' : path.endsWith('/') ? path + 'index.html' : path;
  const extension = file.split('.').pop().toLowerCase();
  const navigation = request.mode === 'navigate';
  try {
    const commit = snapshot.archive && file.startsWith('data/archive/') ? snapshot.archive : snapshot.commit;
    const source = new URL(commit + '/' + file, tikituffSource);
    const range = request.headers.get('Range');
    const response = await fetch(source, range ? {headers: {Range: range}} : undefined);
    if (!response.ok) {
      if (navigation) throw new Error('Historical page unavailable.');
      return new Response(null, { status: response.status });
    }

    if (extension === 'html') {
      const html = tikituffPage(await response.text(), file, snapshot, base);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Archived installs would compete with the current site's service-worker caches.
    if (file === 'pwa.js' || file === 'web/core/pwa.js') {
      const js = (await response.text()).replace(/if\("serviceWorker" in navigator\)\{[\s\S]*?\n  \}/, '');
      return new Response(js, { headers: { 'Content-Type': types.js } });
    }

    const headers = new Headers({ 'Content-Type': types[extension] || response.headers.get('Content-Type') || 'application/octet-stream' });
    const contentRange = response.headers.get('Content-Range');
    if (contentRange) headers.set('Content-Range', contentRange);
    return new Response(response.body, { status: response.status, headers });
  } catch {
    if (!navigation) return new Response(null, { status: 503 });
    return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Historical release unavailable</title>' +
      '<h1>Historical release unavailable</h1><p>Reload this page to try again.</p><p><a href="' + currentSite.href + '">Return to the current site</a></p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== tikituffScope.origin || !url.pathname.startsWith(tikituffScope.pathname)) return;
  const [alias, ...segments] = url.pathname.slice(tikituffScope.pathname.length).split('/');
  if (!Object.hasOwn(snapshots, alias)) return;
  const path = segments.join('/');
  if (/%(?:2f|5c|2e)/i.test(path)) return;
  event.respondWith(tikituffFetch(request, alias, path));
});
