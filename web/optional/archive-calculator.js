(function () {
  'use strict';
  let phrase;
  async function matches(value) {
    phrase ||= Promise.all(['extras/9013/tools/metrics.json', 'assets/display-index.json'].map(async path => {
      const response = await fetch(path);
      if (!response.ok) throw Error('Archive resources unavailable');
      return response.json();
    })).then(([mask, bytes]) => String.fromCharCode(...bytes.map((byte, i) => byte ^ mask[i])))
      .catch(() => { phrase = null; return null; });
    return value === await phrase;
  }
  const search = document.querySelector('#search');
  let typed = '', code, overlay;

  function archive() {
    const meta = typeof D !== 'undefined' ? D?.meta : null;
    return meta?.is_archive && meta.competition_code === 'AA' &&
      BRTASiteRoutes.sameSeason(meta.season_label, 'autumn-2014') &&
      BRTASiteRoutes.sectionMatches(meta, 'section-2');
  }

  function qualifies() {
    try {
      const baseline = BRTAExport853.toBackup(D).sections[0];
      const copies = JSON.parse(localStorage.getItem('brta-custom-sections-v1') || '[]');
      return copies.some(copy => {
        if (!copy.id.startsWith('local-') || copy.sourceSectionCode !== baseline.sourceSectionCode) return false;
        const candidate = structuredClone(copy);
        candidate.id = baseline.id;
        candidate.updatedAt = baseline.updatedAt;
        let flipped = 0;
        for (const [ri, round] of baseline.rounds.entries()) {
          for (const [fi, fixture] of round.fixtures.entries()) {
            for (const [mi, match] of fixture.rubbers.entries()) {
              const edit = candidate.rounds[ri]?.fixtures[fi]?.rubbers[mi];
              if (!edit) return false;
              delete edit.quickWinner;
              if (match.type !== 'Doubles' || !['Completed','Retired','Forfeit'].includes(match.status) || match.status !== edit.status) continue;
              const before = CustomSectionModel.score(match, baseline).winner;
              const after = CustomSectionModel.score(edit, candidate).winner;
              if (before && after && before !== after) {
                flipped++;
                edit.sets = match.sets;
                edit.winner = match.winner;
              }
            }
          }
        }
        const canonical = value => JSON.stringify(value, (_, item) =>
          item && !Array.isArray(item) && typeof item === 'object'
            ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
        return flipped === 1 && canonical(candidate) === canonical(baseline);
      });
    } catch { return false; }
  }

  async function open() {
    if (overlay && !overlay.classList.contains('hidden')) return;
    overlay ||= document.createElement('div');
    overlay.id = 'archiveCalculatorOverlay';
    overlay.className = 'overlay archive-calculator';
    overlay.innerHTML = '<div class="overlay-backdrop"></div><section class="settings-sheet" role="dialog" aria-modal="true" aria-label="Calculator">' +
      '<form><select name="left" aria-label="First number" disabled></select><span>+</span><select name="right" aria-label="Second number" disabled></select>' +
      '<button type="submit" class="button primary" disabled>=</button><output aria-live="polite"></output></form></section>';
    document.body.append(overlay);
    const dismiss = () => close('#archiveCalculatorOverlay');
    BRTAOverlays.register(overlay.id, dismiss);
    overlay.querySelector('.overlay-backdrop').onclick = dismiss;
    eightRaise(overlay);
    const form = overlay.querySelector('form'), output = form.querySelector('output');
    try {
      const response = await fetch('extras/9013/answers.json');
      if (!response.ok) throw Error();
      const { operands, answers } = await response.json();
      const addition = answers.add;
      const { left, right } = form.elements;
      for (const input of [left, right]) {
        input.replaceChildren(...[...new Set([...operands.map(String), '20', '26'])].map(value => new Option(value, value)));
        input.disabled = false;
      }
      form.querySelector('button').disabled = false;
      form.onsubmit = event => {
        event.preventDefault();
        if ([left.value, right.value].sort().join(',') === '20,26') {
          if (!event.isTrusted || overlay.classList.contains('hidden') || document.hidden || !output.getClientRects().length) return;
          code ||= String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
          output.textContent = code;
        } else output.textContent = addition?.[left.value]?.[right.value] ??
          (left.value === '26' || right.value === '26' ? Number(left.value) + Number(right.value) : 'Unavailable');
      };
      if (!overlay.classList.contains('hidden')) left.focus({ preventScroll: true });
    } catch { output.textContent = 'Answer table unavailable.'; }
  }

  search.addEventListener('beforeinput', event => {
    if (!event.isTrusted || event.isComposing || event.inputType !== 'insertText' || !/^[a-z]$/.test(event.data || '')) {
      typed = '';
      return;
    }
    typed = search.value === typed ? typed + event.data : '';
  });
  search.addEventListener('keydown', async event => {
    if (!event.isTrusted || event.key !== 'Enter' || typed.length !== 9 || search.value !== typed ||
        activePage !== 'ratings' || ratingView !== 'orthographic' || !archive()) return;
    const value = typed;
    typed = '';
    event.preventDefault();
    if (!await matches(value) || search.value !== value || activePage !== 'ratings' || ratingView !== 'orthographic' || !archive() || !qualifies()) return;
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    void open();
  }, true);
  window.BRTAArchiveCalculator = { redeem(value) {
    if (!code || value.trim() !== code) return false;
    code = undefined;
    const content = '𝚃𝚑𝚒𝚜 𝚠𝚊𝚜 𝚊 𝚠𝚊𝚜𝚝𝚎 𝚘𝚏 𝚝𝚒𝚖𝚎. 😂\n\n\n\nBRTA Power Ratings says: code_code_47_brta_power_code\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'brta-power-ratings.txt';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } };
})();
