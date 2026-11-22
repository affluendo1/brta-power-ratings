(function (root) {
  'use strict';
  const overlay = document.getElementById('modeSwitchOverlay');
  const ring = document.getElementById('progressRing');
  const percent = document.getElementById('progressPct');
  const status = document.getElementById('switchStatus');
  const heading = overlay.querySelector('h2');
  const pending = new Set();
  let visible, returnFocus, stopGame, frame = 0, shown = 0, target = -1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animationsOff = () => reduced.matches || localStorage.getItem('brta-animations') === 'off';
  function present(value) {
    ring.style.setProperty('--progress', value * 3.6 + 'deg');
    const display = Math.floor(value);
    if (percent.firstChild?.nodeType === 3) percent.firstChild.data = display + '%';
    else percent.textContent = display + '%';
    if (ring.getAttribute('aria-valuenow') !== String(display)) ring.setAttribute('aria-valuenow', String(display));
  }
  function advance(value) {
    if (value === target) return;
    target = value;
    cancelAnimationFrame(frame);
    if (document.hidden || animationsOff() || value <= shown) {
      shown = value;
      present(shown);
      return;
    }
    const initial = shown, start = performance.now();
    const duration = value === 100 ? 160 : 310;
    const tick = time => {
      const step = Math.min(1, (time - start) / duration);
      shown = initial + (value - initial) * (1 - (1 - step) ** 3);
      present(shown);
      if (step < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  function draw() {
    const next = [...pending].filter(job => job.ready).sort((a, b) => a.priority - b.priority).at(-1);
    if (!next) {
      const restore = document.activeElement === overlay;
      stopGame?.();
      stopGame = null;
      visible = null;
      cancelAnimationFrame(frame);
      shown = 0;
      target = -1;
      present(0);
      overlay.classList.add('hidden');
      if (restore && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
      return;
    }
    const opening = !visible;
    if (visible !== next) {
      stopGame?.();
      stopGame = root.BRTAWaitingGame?.mount(overlay, Math.max(0, 3000 - (performance.now() - next.started)));
      shown = 0;
      target = -1;
      present(0);
    }
    visible = next;
    if (heading.textContent !== next.title) heading.textContent = next.title;
    if (status.textContent !== next.message) status.textContent = next.message;
    advance(next.percent);
    overlay.classList.remove('hidden');
    if (opening) {
      returnFocus = document.activeElement;
      overlay.focus({ preventScroll: true });
    }
  }

  function paint() {
    // hidden tabs suspend animation frames. they should still finish loading.
    if (document.hidden || !root.requestAnimationFrame) return Promise.resolve();
    return new Promise(resolve => {
      const fallback = setTimeout(resolve, 50);
      root.requestAnimationFrame(() => root.requestAnimationFrame(() => {
        clearTimeout(fallback);
        resolve();
      }));
    });
  }

  async function run(title, work, { priority = 0, message = 'Getting ready…', key = priority ? 'navigation' : null } = {}) {
    const job = { title, message, percent: 2, priority, key, started: performance.now(), ready: false };
    if (key) for (const previous of pending) {
      if (previous.key !== key) continue;
      job.ready ||= visible === previous;
      pending.delete(previous);
    }
    pending.add(job);
    if (job.ready) draw();
    const timer = setTimeout(() => {
      if (!pending.has(job)) return;
      job.ready = true;
      draw();
    }, 100);
    const task = {
      stage(value, label) {
        if (!pending.has(job)) return;
        job.percent = Math.max(job.percent, Math.min(99, Math.round(value)));
        job.message = label;
        if (visible === job) draw();
      },
      paint() { return visible === job ? paint() : Promise.resolve(); }
    };
    try {
      const result = await work(task);
      if (visible === job && result !== false) {
        job.percent = 100;
        job.message = 'Ready';
        draw();
        if (!document.hidden && !animationsOff()) await new Promise(resolve => setTimeout(resolve, 170));
        else await paint();
      }
      return result;
    } finally {
      clearTimeout(timer);
      pending.delete(job);
      if (visible === job) draw();
    }
  }

  root.addEventListener('keydown', event => {
    if (event.target.closest?.('.wg-layout') && overlay.contains(event.target)) return;
    if (!visible || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  overlay.addEventListener('wheel', event => event.preventDefault(), { passive: false });
  root.BRTAActivity = { run };
})(window);
