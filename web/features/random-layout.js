(function () {
  'use strict';

  const preference = 'brta-random-layout';
  const controls = 'button, [role="button"], [role="tab"], input[type="button"], input[type="submit"]';
  const sheets = ':is([role="dialog"], dialog, [aria-modal="true"]):not(.overlay), .overlay > :is(aside, section, article):not(.overlay-backdrop)';
  const placements = new WeakMap();
  const styled = new Set();
  let enabled = localStorage.getItem(preference) === 'on';
  let frame = 0;

  const rules = document.createElement('style');
  rules.textContent = `
    .random-layout-item {
      translate: var(--random-x, 0px) var(--random-y, 0px) !important;
      rotate: var(--random-angle, 0deg) !important;
      background: var(--random-colour) !important;
      color: var(--random-ink) !important;
    }
  `;
  document.head.append(rules);

  function clear() {
    for (const element of styled) {
      element.classList.remove('random-layout-item');
      for (const property of ['x', 'y', 'angle', 'colour', 'ink']) {
        element.style.removeProperty('--random-' + property);
      }
    }
    styled.clear();
  }

  function visible(element, rect) {
    return rect.width && rect.height && !element.closest('[hidden], .hidden, [inert]') &&
      getComputedStyle(element).visibility === 'visible';
  }

  function bounds(element, viewport) {
    const area = {...viewport};
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.overflowX === 'visible' && style.overflowY === 'visible' && !styled.has(parent)) continue;
      const box = parent.getBoundingClientRect();
      if (style.overflowX !== 'visible' || styled.has(parent)) {
        area.left = Math.max(area.left, box.left);
        area.right = Math.min(area.right, box.right);
      }
      if (style.overflowY !== 'visible' || styled.has(parent)) {
        area.top = Math.max(area.top, box.top);
        area.bottom = Math.min(area.bottom, box.bottom);
      }
    }
    return area;
  }

  function place(element, rect, area, maxAngle) {
    const width = area.right - area.left;
    const height = area.bottom - area.top;
    if (width <= 0 || height <= 0 || rect.bottom < area.top || rect.top > area.bottom ||
        rect.right < area.left || rect.left > area.right) return;
    if (!placements.has(element)) {
      placements.set(element, {
        x: Math.random(), y: Math.random(), angle: Math.random() * 2 - 1,
        hue: Math.floor(Math.random() * 360), dark: Math.random() < 0.5
      });
    }
    const choice = placements.get(element);
    const angle = choice.angle * maxAngle;
    const radians = Math.abs(angle) * Math.PI / 180;
    const rotatedWidth = rect.width * Math.cos(radians) + rect.height * Math.sin(radians);
    const rotatedHeight = rect.height * Math.cos(radians) + rect.width * Math.sin(radians);
    const x = area.left + (width - rotatedWidth) / 2 + (choice.x - 0.5) * Math.max(0, width - rotatedWidth - 12);
    const y = area.top + (height - rotatedHeight) / 2 + (choice.y - 0.5) * Math.max(0, height - rotatedHeight - 12);
    const dx = x + (rotatedWidth - rect.width) / 2 - rect.left;
    const dy = y + (rotatedHeight - rect.height) / 2 - rect.top;
    const parentSheet = element.parentElement?.closest(sheets);
    const parentAngle = parentSheet && styled.has(parentSheet) ? (placements.get(parentSheet)?.angle || 0) * 3 : 0;
    const skew = -parentAngle * Math.PI / 180;
    element.style.setProperty('--random-x', (dx * Math.cos(skew) - dy * Math.sin(skew)) + 'px');
    element.style.setProperty('--random-y', (dx * Math.sin(skew) + dy * Math.cos(skew)) + 'px');
    element.style.setProperty('--random-angle', angle + 'deg');
    element.style.setProperty('--random-colour', 'hsl(' + choice.hue + ' 62% ' + (choice.dark ? 24 : 82) + '%)');
    element.style.setProperty('--random-ink', choice.dark ? '#fff' : '#171717');
    element.classList.add('random-layout-item');
    styled.add(element);
  }

  function layout() {
    frame = 0;
    clear();
    if (!enabled) return;
    const viewport = {left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight};
    const dialogs = [...document.querySelectorAll(sheets)];
    for (const element of dialogs) {
      if (element.parentElement?.closest(sheets)) continue;
      const rect = element.getBoundingClientRect();
      if (visible(element, rect)) place(element, rect, viewport, 3);
    }
    const buttons = [...document.querySelectorAll(controls)].flatMap(element => {
      const rect = element.getBoundingClientRect();
      return visible(element, rect) ? [{element, rect, area: bounds(element, viewport)}] : [];
    });
    for (const {element, rect, area} of buttons) place(element, rect, area, 16);
  }

  function schedule() {
    if (enabled && !frame) frame = requestAnimationFrame(layout);
  }

  function setEnabled(value) {
    if (value && !enabled && !window.confirm('Random Layout moves, rotates and recolours controls. Press Ctrl or Command + Shift + Alt + R to restore the normal layout. Turn it on?')) {
      return false;
    }
    enabled = value;
    localStorage.setItem(preference, value ? 'on' : 'off');
    if (enabled) schedule();
    else {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      clear();
    }
    return enabled;
  }

  function bindSettings(host) {
    const display = host.querySelector('.display-settings');
    if (!display) return;
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML = '<label><input id="randomLayoutToggle" type="checkbox"> Random Layout</label>' +
      '<p class="settings-help">Moves, tilts and recolours buttons and dialogs on each launch. Ctrl or Command + Shift + Alt + R restores the normal layout.</p>';
    display.append(row);
    const toggle = row.querySelector('input');
    toggle.checked = enabled;
    toggle.addEventListener('change', () => { toggle.checked = setEnabled(toggle.checked); });
  }

  new MutationObserver(records => {
    if (records.some(record => {
      if (record.attributeName !== 'class') return true;
      const state = value => (value || '').split(/\s+/).filter(name => name === 'hidden' || name === 'active').join(' ');
      return state(record.oldValue) !== state(record.target.getAttribute('class'));
    })) schedule();
  }).observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeOldValue: true,
    attributeFilter: ['class', 'hidden', 'inert']
  });
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('keydown', event => {
    if (!enabled || !(event.ctrlKey || event.metaKey) || !event.shiftKey || !event.altKey || event.code !== 'KeyR') return;
    event.preventDefault();
    setEnabled(false);
    const toggle = document.getElementById('randomLayoutToggle');
    if (toggle) toggle.checked = false;
  }, true);

  window.BRTARandomLayout = {bindSettings};
  schedule();
})();
