/* The Ratings footer clue and its optional Neon + reward. */
(() => {
  'use strict';
  const root = document.documentElement;
  const archiveKey = 'brta-secret-archive', rewardKey = 'brta-neon-plus-unlocked';
  const zoomKey = 'brta-secret-archive-fit', colorKey = 'brta-neon-plus-color';
  const themeId = 'neon-plus', defaultColor = '#3bff72';
  const codes = ['ModelCongress', 'CongressOfModels', 'MelodyParliament'];
  const code = codes[Math.floor(Math.random() * codes.length)];
  const archiveEnabled = localStorage.getItem(archiveKey) === '1';

  const door = document.createElement('button');
  door.type = 'button';
  door.className = 'archive-secret-door';
  door.hidden = true;
  door.setAttribute('aria-label', 'Open a distant door');
  door.innerHTML = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 28h18M9 28V5h14v23M12 28V9l8 2v17"/><path d="M17 19h1"/></svg>';
  document.body.append(door);

  let fit = sessionStorage.getItem(zoomKey) === '1';
  function syncZoom() {
    // Desktop browser zoom changes the CSS viewport, while the browser
    // window width stays in screen units. The page can compensate its own scale.
    const ratio = innerWidth && outerWidth > 0 ? outerWidth / innerWidth : 1;
    if (fit && ratio >= .94) {
      fit = false;
      sessionStorage.removeItem(zoomKey);
    }
    root.style.setProperty('--archive-zoom', fit ? String(Math.min(5, 1 / ratio)) : '1');
    door.hidden = fit || ratio > .56;
  }
  window.addEventListener('resize', syncZoom);
  syncZoom();

  function overlay(id, title, content) {
    const layer = document.createElement('div');
    layer.id = id;
    layer.className = 'overlay hidden archive-secret-overlay';
    layer.innerHTML = `<div class="overlay-backdrop"></div>
      <section class="archive-secret-sheet" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
        <button type="button" class="close-btn" aria-label="Close">×</button>
        <h2 id="${id}-title">${title}</h2>${content}
      </section>`;
    document.body.append(layer);
    const hide = () => {
      layer.classList.add('hidden');
      BRTAOverlays.unlock(layer);
    };
    layer.querySelector('.close-btn').addEventListener('click', hide);
    layer.querySelector('.overlay-backdrop').addEventListener('click', hide);
    BRTAOverlays.register(id, hide);
    return layer;
  }
  function open(layer) {
    layer.classList.remove('hidden');
    BRTAOverlays.lock(layer);
    layer.querySelector('.close-btn').focus({ preventScroll: true });
  }
  let menu, clue;
  door.addEventListener('click', () => {
    fit = true;
    sessionStorage.setItem(zoomKey, '1');
    syncZoom();
    if (!menu) {
      menu = overlay('archiveSecretMenu', 'The Archive',
        '<label class="archive-secret-check"><input type="checkbox"> Enable The Archive</label>');
      const checkbox = menu.querySelector('input');
      checkbox.checked = archiveEnabled;
      checkbox.addEventListener('change', () => {
        localStorage.setItem(archiveKey, checkbox.checked ? '1' : '0');
        location.reload();
      });
    }
    open(menu);
  });

  const footer = $('#siteIndependence'), title = footer.querySelector('b');
  const link = document.createElement('a');
  link.className = 'archive-secret-link';
  link.href = '#archive-clue';
  link.addEventListener('click', event => {
    event.preventDefault();
    if (!archiveEnabled || activePage !== 'ratings') return;
    if (!clue) {
      clue = overlay('archiveSecretClue', 'Congrats, you found me.',
        '<p>Nice. Here’s a Vault code. Remember this one!</p><code class="archive-vault-code"></code><p class="archive-code-hint">Case-sensitive. This code changes when you reload.</p>');
      clue.querySelector('code').textContent = code;
    }
    open(clue);
  });
  function syncFooter() {
    if (archiveEnabled && activePage === 'ratings') {
      if (!link.isConnected) {
        title.replaceWith(link);
        link.append(title);
      }
    } else if (link.isConnected) {
      link.replaceWith(title);
    }
  }
  const previousSwitch = switchPage;
  switchPage = function (page) {
    previousSwitch(page);
    syncFooter();
  };
  syncFooter();

  window.BRTAArchiveSecret = {
    redeem(value) {
      if (!archiveEnabled || value !== code) return false;
      localStorage.setItem(rewardKey, '1');
      syncThemeOption();
      return true;
    },
  };

  function neonColor() {
    const value = localStorage.getItem(colorKey);
    return /^#[\da-f]{6}$/i.test(value || '') ? value : defaultColor;
  }
  function paintNeon(value) {
    const [r, g, b] = value.slice(1).match(/../g).map(part => parseInt(part, 16) / 255);
    const high = Math.max(r, g, b), low = Math.min(r, g, b), delta = high - low;
    const hue = !delta ? 145 : high === r ? (g - b) / delta : high === g ? 2 + (b - r) / delta : 4 + (r - g) / delta;
    root.style.setProperty('--neon-hue', String(delta ? (hue * 60 + 360) % 360 : hue));
    if (theme === themeId) applyTheme();
  }
  function syncThemeOption() {
    const select = $('#themeSelect');
    if (!select || localStorage.getItem(rewardKey) !== '1') return;
    if (!select.querySelector('[value="neon-plus"]')) select.add(new Option('Neon +', themeId));
    select.value = theme;
    let setting = $('#neonColorSetting');
    if (!setting) {
      $('.display-settings').insertAdjacentHTML('beforeend',
        '<label id="neonColorSetting" class="setting-row"><b>Neon + colour</b><input type="color" aria-label="Neon + colour"></label>');
      setting = $('#neonColorSetting');
      const input = setting.querySelector('input');
      input.value = neonColor();
      input.addEventListener('input', () => {
        localStorage.setItem(colorKey, input.value);
        paintNeon(input.value);
      });
    }
    setting.hidden = theme !== themeId;
    select.addEventListener('change', syncThemeOption);
  }
  const previousSettings = openSettings;
  openSettings = function () {
    previousSettings();
    syncThemeOption();
  };
  $('#settingsBtn').onclick = openSettings;
  if (theme === themeId && localStorage.getItem(rewardKey) !== '1') BRTASitePreferences.setTheme('dark');
  paintNeon(neonColor());
})();
