(() => {
  'use strict';

  const { extrasKey, snapshots } = BRTAPastSoftware;
  const tikituffScope = new URL('./', location.href);
  const tikituffWorker = new URL('sw.js', tikituffScope);
  const currentSite = new URL('../../', tikituffScope);
  const request = new URLSearchParams(location.search);
  const alias = request.get('release');
  const status = document.querySelector('#pastSoftwareStatus');

  async function launch() {
    if (localStorage.getItem(extrasKey) !== '1') {
      location.replace(currentSite);
      return;
    }
    if (!Object.hasOwn(snapshots, alias)) {
      status.textContent = 'This historical release is unavailable.';
      return;
    }

    const route = request.get('route') || '';
    const target = new URL(alias + '/' + (/^(current|history)\/[a-z0-9][a-z0-9_/-]*$/i.test(route) ? route : ''), tikituffScope);
    if (!navigator.serviceWorker) throw new Error('Service workers are unavailable.');
    const registration = await navigator.serviceWorker.register(tikituffWorker, { scope: tikituffScope.href });
    const worker = registration.active || registration.installing || registration.waiting;
    if (!worker) throw new Error('The historical viewer did not start.');
    if (worker.state !== 'activated') {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          worker.removeEventListener('statechange', check);
          reject(new Error('The historical viewer took too long to start.'));
        }, 12000);
        function check() {
          if (worker.state !== 'activated' && worker.state !== 'redundant') return;
          clearTimeout(timer);
          worker.removeEventListener('statechange', check);
          if (worker.state === 'activated') resolve();
          else reject(new Error('The historical viewer did not start.'));
        }
        worker.addEventListener('statechange', check);
        check();
      });
    }
    // Recheck in case Extras was turned off in another tab during activation.
    if (localStorage.getItem(extrasKey) !== '1') {
      location.replace(currentSite);
      return;
    }
    location.replace(target);
  }

  launch().catch(() => {
    status.textContent = 'Couldn’t start the historical viewer. Reload this page on a supported browser to try again.';
  });
})();
