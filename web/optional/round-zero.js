(function () {
  'use strict';
  const storage = 'brta-r0-state';
  const messages = ['This result has not been entered.', 'This result is still not available.',
    'You have already checked this result.', 'There is nothing else to see here.'];
  const state = () => { try { return JSON.parse(localStorage.getItem(storage)) || {}; } catch { return {}; } };
  const save = value => localStorage.setItem(storage, JSON.stringify(value));
  const section = () => String(D?.meta?.section_code || '');
  const eligible = () => D?.meta?.is_archive && !D.meta.is_custom && activePage === 'results';
  function show() {
    document.querySelector('[data-round-zero]')?.remove();
    if (!eligible()) return;
    const s = state();
    if (s.hidden === section()) return;
    const holder = document.querySelector('#resultsList');
    if (!holder || !D.results?.length) return;
    holder.insertAdjacentHTML('beforeend', '<section class="result-round" data-round-zero><details><summary class="result-round-head"><h2>Round 0</h2></summary><div class="result-round-matches"><button type="button" class="button secondary" data-round-zero-open>Home — Away <small>Result unavailable</small></button></div></details></section>');
  }
  window.addEventListener('brta-section-ready', show);
  const original = renderResults;
  renderResults = function () { original(); show(); };
  document.addEventListener('click', event => {
    if (event.target.closest('[data-round-zero-open]')) {
      const s = state(); s.visits = (s.visits || 0) + 1; save(s);
      const result = document.querySelector('#resultOverlay');
      const message = messages[Math.min(s.visits - 1, 3)];
      document.querySelector('#resultContent').innerHTML = s.visits < 5
        ? '<div class="result-detail-head"><h2>Home <b>6–6</b> Away</h2><p>' + message + '</p>' + (s.visits === 4 ? '<small>Last checked: tomorrow</small>' : '') + '</div><div class="result-summary"><div>Rubbers <b>6–6</b></div><div>Games <b>6–6</b></div><div>Points <b>6–6</b></div></div><div class="rubber-list">' + Array.from({length:6}, (_, i) => '<div class="rubber-row"><small class="rubber-code">' + (i < 2 ? 'D' + (i + 1) : 'S' + (i - 1)) + '</small><span>—</span><strong>6–6</strong><span>—</span></div>').join('') + '</div>'
        : '<button type="button" class="export-link" data-round-zero-player>View player</button>';
      eightRaise(result); result.classList.remove('hidden'); document.body.classList.add('modal-open');
    }
    if (event.target.closest('[data-round-zero-player]')) {
      close('#resultOverlay');
      const profile = document.querySelector('#profileOverlay');
      document.querySelector('#profileContent').innerHTML = '<div class="profile-head"><div class="kicker">Player Lab</div><h2>—</h2></div><div class="lab-metric"><span>Last seen</span><strong>Just now</strong></div><button type="button" class="button secondary" data-round-zero-return>Return to Round 0</button>';
      const s = state(); s.hidden = section(); save(s); document.querySelector('[data-round-zero]')?.remove();
      eightRaise(profile); profile.classList.remove('hidden'); document.body.classList.add('modal-open');
    }
    if (event.target.closest('[data-round-zero-return]')) close('#profileOverlay');
  });
})();
