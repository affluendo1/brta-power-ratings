/* Foreground work reports completed milestones. Network and worker time vary. */
(function (root) {
  'use strict';
  const overlay = document.getElementById('modeSwitchOverlay');
  const ring = document.getElementById('progressRing');
  const percent = document.getElementById('progressPct');
  const status = document.getElementById('switchStatus');
  const heading = overlay.querySelector('h2');
  const pending = new Set();
  let visible, returnFocus;

  function draw() {
    const next = [...pending].filter(job => job.ready).sort((a, b) => a.priority - b.priority).at(-1);
    if (!next) {
      const restore = document.activeElement === overlay;
      visible = null;
      overlay.classList.add('hidden');
      if (restore && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
      return;
    }
    const opening = !visible;
    visible = next;
    heading.textContent = next.title;
    status.textContent = next.message;
    ring.style.setProperty('--progress', next.percent * 3.6 + 'deg');
    ring.setAttribute('aria-valuenow', String(next.percent));
    percent.textContent = next.percent + '%';
    overlay.classList.remove('hidden');
    if (opening) {
      returnFocus = document.activeElement;
      overlay.focus({ preventScroll: true });
    }
  }

  function paint() {
    // Hidden tabs suspend animation frames. They should still finish loading.
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
    const job = { title, message, percent: 0, priority, key, ready: false };
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
        job.percent = Math.max(job.percent, Math.min(99, value));
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
        await paint();
      }
      return result;
    } finally {
      clearTimeout(timer);
      pending.delete(job);
      if (visible === job) draw();
    }
  }

  root.addEventListener('keydown', event => {
    if (!visible || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  overlay.addEventListener('wheel', event => event.preventDefault(), { passive: false });
  root.BRTAActivity = { run };
})(window);
