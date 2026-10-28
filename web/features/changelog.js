(function (root) {
  'use strict';

  const releases = root.BRTA_RELEASES;
  const latest = releases[0];
  const parentRelease=releases.find(r=>['major','large'].includes(r.size))||latest,patches=releases.slice(0,releases.indexOf(parentRelease));
  let overlay;
  let returnFocus;
  let inertState = [];
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

  function dateLabel(release) {
    const minutes = {major:60, large:60, small:30, tiny:10}[release.size];
    const interval = minutes * 60000;
    const rounded = new Date(Math.round(Date.parse(release.committedAt) / interval) * interval);
    return new Intl.DateTimeFormat('en-AU', {
      timeZone:'Australia/Melbourne', weekday:'long', day:'numeric', month:'long', year:'numeric',
      hour:'numeric', minute:minutes === 60 ? undefined : '2-digit', hour12:true
    }).format(rounded);
  }

  function time(release) {
    return '<time datetime="'+escape(release.committedAt)+'">'+escape(dateLabel(release))+'</time>';
  }

  function points(release) {
    return '<ul class="release-points">'+release.changes.map(change => '<li>'+escape(change)+'</li>').join('')+'</ul>';
  }

  function settingsHTML() {
    return '<div class="settings-group settings-wide version-settings"><div><h3>Version</h3><strong class="site-version">'+escape(latest.version)+'</strong><p>See what’s new in BRTA Power Ratings.</p></div><button class="button primary" type="button" data-changelog-open aria-haspopup="dialog" aria-controls="changelogOverlay">Changelog</button></div>';
  }

  function setTab(name, focus = false) {
    overlay.querySelectorAll('[data-changelog-tab]').forEach(tab => {
      const selected = tab.dataset.changelogTab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    overlay.querySelectorAll('[role="tabpanel"]').forEach(panel => {
      panel.hidden = panel.id !== 'changelog-'+name;
    });
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'changelogOverlay';
    overlay.className = 'overlay changelog-overlay hidden';
    overlay.innerHTML = '<div class="overlay-backdrop" data-changelog-close></div>'+
      '<section class="changelog-sheet" role="dialog" aria-modal="true" aria-labelledby="changelogTitle" aria-describedby="changelogTimezone">'+
      '<header class="changelog-header"><div><div class="kicker">BRTA POWER RATINGS</div><h2 id="changelogTitle">Changelog</h2><p id="changelogTimezone">Update times shown in Melbourne time.</p></div><button class="changelog-close" type="button" data-changelog-close aria-label="Close changelog">×</button></header>'+
      '<div class="changelog-tabs" role="tablist" aria-label="Changelog views">'+
      '<button id="changelog-latest-tab" type="button" role="tab" aria-selected="true" aria-controls="changelog-latest" data-changelog-tab="latest">Latest update</button>'+
      '<button id="changelog-history-tab" type="button" role="tab" aria-selected="false" aria-controls="changelog-history" tabindex="-1" data-changelog-tab="history">Full history</button></div>'+
      '<div class="changelog-panels"><div id="changelog-latest" role="tabpanel" aria-labelledby="changelog-latest-tab" tabindex="0">'+
      '<article class="release-latest"><div class="release-latest-label">LATEST UPDATE</div><div class="release-heading"><h3>'+escape(parentRelease.version)+'</h3>'+(parentRelease.title?'<span>'+escape(parentRelease.title)+'</span>':'')+'</div>'+time(parentRelease)+points(parentRelease)+patches.slice().reverse().map(r=>'<div class="release-patch" data-release-version="'+escape(r.version)+'"><b>'+escape(r.version)+'</b>'+time(r)+points(r)+'</div>').join('')+'</article></div>'+
      '<div id="changelog-history" role="tabpanel" aria-labelledby="changelog-history-tab" tabindex="0" hidden><p class="changelog-history-hint">Choose an update to see what changed.</p><div class="release-history">'+releases.map(release =>
        '<details class="release-entry'+' release-'+release.size+'"><summary><span class="release-version">'+escape(release.version)+'</span><span class="release-name">'+escape(release.title||'')+'</span><span class="release-chevron" aria-hidden="true">⌄</span>'+time(release)+'</summary><div class="release-details">'+points(release)+'</div></details>'
      ).join('')+'</div></div></div></section>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => {
      if (event.target.closest('[data-changelog-close]')) close();
      const tab = event.target.closest('[data-changelog-tab]');
      if (tab) setTab(tab.dataset.changelogTab);
    });
  }

  function open() {
    ensureOverlay();
    if (!overlay.classList.contains('hidden')) return;
    returnFocus = document.activeElement;
    inertState = [...document.body.children].filter(element => element !== overlay).map(element => [element, element.inert]);
    inertState.forEach(([element]) => { element.inert = true; });
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
    setTab('latest', true);
  }

  function close() {
    if (!overlay || overlay.classList.contains('hidden')) return;
    overlay.classList.add('hidden');
    inertState.forEach(([element, wasInert]) => { element.inert = wasInert; });
    inertState = [];
    if (!document.querySelector('.overlay:not(.hidden)')) document.body.classList.remove('modal-open');
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-changelog-open]')) open();
  });

  // Handle this dialog before the site's Escape shortcut, keeping Settings open underneath.
  document.addEventListener('keydown', event => {
    if (!overlay || overlay.classList.contains('hidden')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    const tab = event.target.closest('[data-changelog-tab]');
    if (tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();
      setTab(event.key === 'Home' ? 'latest' : event.key === 'End' ? 'history' : tab.dataset.changelogTab === 'latest' ? 'history' : 'latest', true);
    }
    if (event.key === 'Tab') {
      const focusable = [...overlay.querySelectorAll('button, summary, [tabindex="0"]')].filter(element => !element.closest('[hidden]') && element.tabIndex >= 0 && element.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
  }, true);

  // Only returning visitors with a previously observed release get an automatic tour.
  const seenKey = 'brta-last-seen-release';
  let previousVersion;
  try { previousVersion = localStorage.getItem(seenKey); } catch {}
  let offered = false;
  function rememberVersion() {
    try { localStorage.setItem(seenKey, latest.version); } catch {}
  }
  function offerUpdate() {
    if (offered) return;
    if (!previousVersion || previousVersion === latest.version) {
      offered = true;
      rememberVersion();
      return;
    }
    const previousIndex = releases.findIndex(release => release.version === previousVersion);
    // An old cached page must not announce a downgrade.
    if (previousIndex < 1) { offered = true; return; }
    if (document.visibilityState === 'hidden' || document.querySelector('.overlay:not(.hidden)')) {
      setTimeout(offerUpdate, 1000);
      return;
    }
    offered = true;
    open();
    rememberVersion();
    const target = [...overlay.querySelectorAll('[data-release-version]')].find(element => element.dataset.releaseVersion === latest.version) || overlay.querySelector('.release-latest');
    let reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    try { reduced ||= localStorage.getItem('brta-animations') === 'off'; } catch {}
    setTimeout(() => {
      if (overlay.classList.contains('hidden')) return;
      target.scrollIntoView({behavior: reduced ? 'instant' : 'smooth', block:'center'});
      target.classList.add('release-arrival');
    }, reduced ? 0 : 350);
  }
  root.addEventListener('brta-section-ready', offerUpdate, {once:true});
  root.addEventListener('load', () => setTimeout(offerUpdate, 700), {once:true});

  root.BRTAChangelog = Object.freeze({version:latest.version, settingsHTML, open, close});
})(window);
