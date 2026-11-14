(() => {
  'use strict';

  const { extrasKey, unlockKey, snapshots } = BRTAPastSoftware;
  const tikituffScript = new URL(document.currentScript.src);
  const tikituffScope = new URL('./', tikituffScript);
  const alias = location.pathname.slice(tikituffScope.pathname.length).split('/')[0];
  const currentSite = new URL('../../', tikituffScope);
  const liveStorage = window.localStorage;
  const liveSession = window.sessionStorage;
  const allowed = () => liveStorage.getItem(extrasKey) === '1' && liveSession.getItem(unlockKey) === '1';

  if (!Object.hasOwn(snapshots, alias) || !allowed()) {
    // Stop the old page before its inline settings and application scripts run.
    window.stop();
    location.replace(currentSite);
    return;
  }

  function tikituffStorage(storage) {
    const prefix = alias + ':';
    const keys = () => Object.keys(storage).filter(key => key.startsWith(prefix));
    return {
      get length() { return keys().length; },
      key(index) { return keys()[index]?.slice(prefix.length) ?? null; },
      getItem(key) { return storage.getItem(prefix + key); },
      setItem(key, value) { storage.setItem(prefix + key, value); },
      removeItem(key) { storage.removeItem(prefix + key); },
      clear() { keys().forEach(key => storage.removeItem(key)); },
    };
  }

  // Old display settings and custom competitions belong to their own release.
  Object.defineProperties(window, {
    localStorage: { value: tikituffStorage(liveStorage) },
    sessionStorage: { value: tikituffStorage(liveSession) },
  });
  window.addEventListener('storage', event => {
    if (event.storageArea === liveStorage && !allowed()) location.replace(currentSite);
    if (event.storageArea === liveStorage && !event.key?.startsWith(alias + ':')) event.stopImmediatePropagation();
  });
  window.addEventListener('pageshow', () => {
    if (!allowed()) location.replace(currentSite);
  });
})();
