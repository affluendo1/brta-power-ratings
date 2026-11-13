(function () {
  'use strict';

  const storageKey = 'brta-scoreline-vault';
  const normal = value => String(value || '').replace(/[–−]/g, '-').replace(/\s+/g, ' ').trim();
  let portal, overlay, archive, taps, query = '', revision = 0;
  const canonical = value => {
    const match = normal(value).match(/^(\[)?(\d{1,3})-(\d{1,3})(\])?$/);
    if (!match || !!match[1] !== !!match[4] || +match[2] === +match[3]) return '';
    const score = Math.max(+match[2], +match[3]) + '-' + Math.min(+match[2], +match[3]);
    return match[1] ? '[' + score + ']' : score;
  };
  const scoreOptions = () => ['6-0', '6-1', '6-2', '6-3', '6-4', '7-5', '7-6', '8-0', '8-6', '9-8'];
  const ring = (share, label) => {
    const value = Math.max(0, Math.min(100, share)), dash = (value * 2.513).toFixed(2);
    return '<svg class="vault-frequency-ring" viewBox="0 0 100 100" role="img" aria-label="' + esc(label) + '">' +
      '<circle class="vault-ring-track" cx="50" cy="50" r="40"/><circle class="vault-ring-value" cx="50" cy="50" r="40" pathLength="251.3" stroke-dasharray="' + dash + ' 251.3"/>' +
      '<text x="50" y="47" text-anchor="middle">' + value.toFixed(value < 10 ? 2 : 1) + '%</text><text x="50" y="61" text-anchor="middle">of sets</text></svg>';
  };

  function loadRecords() {
    return archive ||= Promise.all(['archive', 'current'].map(async scope => {
      const response = await fetch('data/' + scope + '/scorelines.json?v=' + encodeURIComponent(DATA.globalSync.checkedAt || ''));
      if (!response.ok) throw Error('The scoreline index could not be loaded.');
      return response.json();
    })).catch(error => { archive = null; throw error; });
  }

  function certificate(score, count, total) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650" viewBox="0 0 1000 650">' +
      '<rect width="1000" height="650" fill="#f5f1df"/><rect x="35" y="35" width="930" height="580" fill="none" stroke="#525a2b" stroke-width="4"/>' +
      '<g text-anchor="middle" font-family="Georgia, serif" fill="#232618"><text x="500" y="150" font-size="25" letter-spacing="4">SCORELINE VAULT</text>' +
      '<text x="500" y="310" font-size="95">' + esc(score) + '</text><text x="500" y="425" font-size="28">' + count.toLocaleString() +
      ' matching scorelines out of ' + total.toLocaleString() + ' recorded</text><text x="500" y="525" font-size="22">BRTA Power Ratings</text></g></svg>';
    downloadFile(svg, 'scoreline-' + BRTAFileName(score) + '.svg', 'image/svg+xml;charset=utf-8');
  }
  const BRTAFileName = value => value.replace(/[^0-9]+/g, '-').replace(/^-|-$/g, '');

  async function search() {
    const request = ++revision;
    const score = canonical(overlay.querySelector('input').value);
    const status = overlay.querySelector('[data-vault-status]');
    const output = overlay.querySelector('[data-vault-output]');
    output.innerHTML = '';
    if (!score) {
      status.textContent = 'Enter one set score, such as 7-5, or a match tiebreak such as [10-6].';
      return;
    }
    query = score;
    status.textContent = 'Loading the archive…';
    try {
      const scope = overlay.querySelector('[data-vault-scope]').value;
      const all = await BRTAActivity.run('Presenting the Stats', async task => {
        task.stage(24, 'Reading the scoreline indexes…');
        const indexes = await loadRecords();
        task.stage(82, 'Comparing sets across competitions…');
        await task.paint();
        return indexes;
      }, { key: 'scoreline-vault', game: true });
      const sources = scope === 'archive' ? [{ index: all[0], isArchive: true }] :
        scope === 'current' ? [{ index: all[1], isArchive: false }] :
          [{ index: all[0], isArchive: true }, { index: all[1], isArchive: false }];
      const indexes = sources.map(source => source.index);
      if (request !== revision) return;
      const entries = sources.map(source => ({ ...source, entry: source.index.scores[score] })).filter(source => source.entry);
      const count = entries.reduce((sum, source) => sum + source.entry[0], 0);
      const total = indexes.reduce((sum, index) => sum + index.total, 0);
      const share = total ? 100 * count / total : 0;
      const earliest = entries.map(source => source.entry[1] ? [...source.entry[1], source.isArchive] : null).filter(Boolean).sort((a, b) => a[0].localeCompare(b[0]))[0];
      const latest = entries.map(source => source.entry[2] ? [...source.entry[2], source.isArchive] : null).filter(Boolean).sort((a, b) => b[0].localeCompare(a[0]))[0];
      const best = entries.map(source => source.entry[3]).filter(Boolean).sort((a, b) => b[3] / b[4] - a[3] / a[4] || b[4] - a[4])[0];
      const label = (season, competition, section) => [season, competitionLabel(competition), section].join(' · ');
      const example = row => {
        if (!row) return '<p>Date unavailable</p>';
        const [, date, round, stage, home, away, fixtureId, season_label, competition_code, section_label, is_archive] = row;
        const path = BRTASiteRoutes.path({ season_label, competition_code, section_label, is_archive }, 'results', {
          fixture: { round, stage, home, away, fixtureId }
        });
        return '<p><a href="' + esc(new URL(path, document.baseURI).href) + '">' + esc(home + ' v ' + away) +
          '</a><small>' + esc(date + ' · ' + label(season_label, competition_code, section_label)) + '</small></p>';
      };
      status.textContent = indexes.reduce((sum, index) => sum + index.sections, 0) +
        ' published sections searched. Every rubber is split into individual sets; 6-0 and 0-6 are the same winner-first score. Match tiebreaks use brackets.';
      const competitions = [...new Set(indexes.flatMap(index => Object.keys(index.competitionTotals || {})))];
      const stats = competitions.map(code => ({
        name: competitionLabel(code),
        total: indexes.reduce((sum,index) => sum + (index.competitionTotals?.[code] || 0), 0),
        count: indexes.reduce((sum,index) => sum + (index.breakdown?.[score]?.[code] || 0), 0)
      })).sort((a,b) => b.count / b.total - a.count / a.total);
      const usefulStats = stats.filter(row => row.total && row.count).slice(0, 8);
      const highest = Math.max(0, ...usefulStats.map(row => row.count / row.total));
      const allScores = new Map();
      for (const index of indexes) for (const [key, row] of Object.entries(index.scores || {})) allScores.set(key, (allScores.get(key) || 0) + row[0]);
      const rank = [...allScores].sort((a,b) => b[1] - a[1]).findIndex(([key]) => key === score) + 1;
      const graph = highest ? '<section class="vault-chart"><header><div><span class="kicker">Competition comparison</span><h3>Where ' + esc(score) + ' appears most</h3></div><small>Rate within each competition</small></header><div class="vault-bars">' + usefulStats.map((row,index) => {
        const value = 100 * row.count / row.total, width = 100 * (row.count / row.total) / highest;
        return '<div class="vault-chart-row" style="--vault-width:' + width.toFixed(2) + '%;--vault-order:' + index + '"><span>' + esc(row.name) + '</span><div class="vault-bar" role="img" aria-label="' + esc(row.name + ' ' + value.toFixed(2) + ' percent') + '"><i></i></div><b>' +
          value.toFixed(2) + '%</b><small>' + row.count.toLocaleString() + ' of ' + row.total.toLocaleString() + ' sets</small></div>';
      }).join('') + '</div></section>' : '';
      const rarity = count && share ? 'about 1 in ' + Math.max(1, Math.round(100 / share)).toLocaleString() + ' sets' : 'not recorded';
      output.innerHTML = count ? '<section class="scoreline-vault-result"><div class="vault-result-hero">' + ring(share, score + ' accounts for ' + share.toFixed(2) + ' percent of recorded sets') +
        '<div><span class="kicker">Archive result</span><h3>' + esc(score) + '</h3><p><b>' + count.toLocaleString() + '</b> individual sets ended with this score—regardless of which side the winner appeared on.</p></div></div>' +
        '<div class="scoreline-vault-metrics"><div><span>Archive frequency</span><b>' + rarity + '</b></div><div><span>Scoreline rank</span><b>#' + rank + '<small> of ' + allScores.size + '</small></b></div><div><span>Recorded sample</span><b>' + total.toLocaleString() + '<small> sets</small></b></div></div>' +
        '<div class="scoreline-vault-examples"><section><span class="vault-example-label">First trace</span><h3>Earliest recorded</h3>' + example(earliest) +
        '</section><section><span class="vault-example-label">Latest trace</span><h3>Most recent</h3>' + example(latest) + '</section></div>' +
        (best ? '<div class="vault-peak"><span>Highest-density section</span><b>' + esc(label(...best.slice(0, 3))) + '</b><small>' + best[3] + ' of ' + best[4] + ' sets · minimum 40 recorded</small></div>' : '') +
        graph + '<div class="vault-result-actions"><button class="button secondary" data-vault-certificate>Download certificate</button></div></section>' : '<div class="vault-empty"><b>No exact scoreline found</b><p>Try a completed set such as 6-4 or a bracketed match tiebreak such as [10-6].</p></div>';
      output.querySelector('[data-vault-certificate]')?.addEventListener('click', () => certificate(score, count, total));
    } catch (error) {
      if (request === revision) status.textContent = error.message;
    }
  }

  function open(fromTransition = false) {
    window.BRTARouteUI?.secret();
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'scorelineVaultOverlay';
      overlay.className = 'overlay hidden';
      overlay.innerHTML = '<div class="overlay-backdrop" data-scoreline-close></div><aside class="settings-sheet scoreline-vault-sheet" role="dialog" aria-modal="true" aria-label="Scoreline Vault">' +
        '<button class="close-btn" aria-label="Close" data-scoreline-close>×</button><div class="overlay-title"><h2>Scoreline Vault</h2>' +
        '<p>Look up a set score from singles or doubles. Scores like 6–0 and 0–6 count together.</p></div><form><label>Scoreline ' +
        '<input required list="vaultScores" autocomplete="off" placeholder="7-5"></label><label>Scope<select data-vault-scope><option value="all">All recorded seasons</option><option value="current">Current seasons</option><option value="archive">Archived seasons</option></select></label><datalist id="vaultScores">' +
        scoreOptions().map(score => '<option value="' + score + '">').join('') + '</datalist><button class="button primary vault-present">Present the Stats</button></form>' +
        '<p class="small-note" role="status" data-vault-status></p><div data-vault-output></div></aside>';
      overlay.querySelector('form').addEventListener('submit', event => { event.preventDefault(); search(); });
      document.body.append(overlay);
    }
    overlay.classList.remove('hidden');
    overlay.classList.toggle('scoreline-arriving', fromTransition);
    document.body.classList.add('modal-open');
    eightRaise(overlay);
    overlay.querySelector('input').value = query;
    overlay.querySelector('.close-btn').focus({ preventScroll: true });
  }

  function unlock(element) {
    query = canonical(normal(element.textContent).split(" ")[0]);
    const first = localStorage.getItem(storageKey) !== '1';
    localStorage.setItem(storageKey, '1');
    if (!first || matchMedia('(prefers-reduced-motion: reduce)').matches || !window.BRTAVaultTransition) return open();
    if (portal) return;
    portal = true;
    BRTAVaultTransition.play(element, () => {
      portal = null;
      open(true);
    });

  }

  document.addEventListener('click', event => {
    const element = event.target.closest('#resultContent [data-scoreline]');
    if (element && !portal) {
      const now = performance.now();
      taps = { element, time: now, count: taps?.element === element && now - taps.time < 800 ? taps.count + 1 : 1 };
      if (taps.count === 5) { taps = null; unlock(element); }
    } else taps = null;
    if (event.target.closest('[data-scoreline-close]')) close('#scorelineVaultOverlay');
    if (event.target.closest('[data-scoreline-vault-open]')) open();
  });

  const settings = openSettings;
  openSettings = function () {
    settings();
    if (localStorage.getItem(storageKey) === '1') $('#settingsContent').insertAdjacentHTML('beforeend',
      '<button type="button" class="button secondary" data-scoreline-vault-open>Scoreline Vault</button>');
  };
  $('#settingsBtn').onclick = openSettings;
})();
