window.BRTAPlayerFollowing = (() => {
  'use strict';
  const icon = '<svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.8Z"/></svg>';
  const storageKey = 'brta-association-following-v1';
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  const latestName = person => person.rows[0].player;
  const locations = rows => [...new Set(rows.map(row =>
    [row.team, row.competitionLabel, row.sectionLabel].filter(Boolean).join(' · ')))];
  function setup({host, badge, careers, open, analytics, notice, loadResults, openResults}) {
    const saved = read(storageKey, {});
    const state = {
      pins: Array.isArray(saved.pins) ? saved.pins.filter(pin => Array.isArray(pin.anchors)) : [],
      checkedLegacy: !!saved.checkedLegacy,
    };
    let model, report, request, visible, resultRequest, opening = false, checkedAt = 0;
    let sections = new Map(), loadingPaths = new Set(), feed = {slides:[], unread:[], tracking:[]};
    const candidates = new Map();
    const notifications = new Map();
    const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
    const anchor = row => ({
      player: row.player, team: row.team, seasonKey: row.seasonKey, seasonLabel: row.seasonLabel,
      sectionCode: row.sectionCode, competitionCode: row.competitionCode,
    });
    function related(pin) {
      const people = new Map();
      for (const id of pin.ids) {
        const person = id.startsWith('linked:') ? model?.get(id) : null;
        if (person) people.set(id, person);
      }
      for (const row of pin.anchors) {
        const person = model?.reconcileAppearance(row);
        if (person) people.set(person.id, person);
      }
      return [...people.values()];
    }
    const pinFor = person => state.pins.find(pin => (person.linked && pin.ids.includes(person.id)) ||
      pin.anchors.some(row => model?.reconcileAppearance(row)?.id === person.id));
    function create(person) {
      const rows = person.rows;
      return {
        name: latestName(person), ids: [person.id], anchors: rows.map(anchor),
        wasCurrent: [...new Set(rows.filter(row => row.isCurrent).map(row => row.seasonLabel + '|' + row.competitionCode))],
        dismissed: [],
      };
    }
    function star(person) {
      const on = !!pinFor(person), historical = !person.rows.some(row => row.isCurrent);
      const label = on ? 'Unfollow player' : historical ? 'Watch for this player’s return' : 'Follow player';
      return '<button type="button" class="follow82-star player-follow-star" data-player-follow="' + esc(person.id) +
        '" aria-label="' + label + '" aria-pressed="' + on + '" title="' + label + '">' + icon + '</button>';
    }
    function placeSectionStar(content, person) {
      const heading = content.querySelector('.profile-head h2');
      if (heading && !heading.querySelector('[data-player-follow]')) heading.insertAdjacentHTML('beforeend', star(person));
    }
    function refreshStars() {
      document.querySelectorAll('[data-player-follow]').forEach(button => {
        const person = model?.get(button.dataset.playerFollow);
        if (person) button.outerHTML = star(person);
      });
    }
    function migrate() {
      if (state.checkedLegacy) return;
      const legacy = read('brta-following-v1', {});
      for (const item of Array.isArray(legacy.pins) ? legacy.pins : []) {
        if (item.kind !== 'player' || item.isCustom) continue;
        const code = item.scope?.split('|')[0];
        const people = model.named(item.name).filter(person => person.rows.some(row =>
          row.competitionCode === code && (row.sectionCode === item.sectionCode || row.sectionCode.endsWith('-' + item.sectionCode)) &&
          (item.seasonKey ? item.seasonKey === row.seasonKey : item.seasonId === 'current' || !item.seasonId ? row.isCurrent :
            row.seasonKey === code + ':' + item.seasonId || row.seasonId === item.seasonId)));
        if (people.length === 1 && !pinFor(people[0])) state.pins.push(create(people[0]));
      }
      state.checkedLegacy = true;
      save();
    }
    const followed = () => state.pins.map(pin => {
      const known = related(pin);
      const current = known.flatMap(person => person.rows.filter(row => row.isCurrent));
      return {pin, known, current};
    });
    function paintResults(items = followed()) {
      feed = BRTAFollowingResults.collect(items, sections);
      if (feed.tracking.length) {
        BRTAFollowingResults.track(feed.tracking);
        save();
      }
      const n = candidates.size + notifications.size + feed.unread.length;
      badge.textContent = n ? String(n) : '';
      badge.title = n ? n + ' following updates' : '';
      notice.hidden = !feed.unread.length;
      const names = feed.unread.join(', ');
      notice.innerHTML = feed.unread.length ?
        '<span role="status"><b>New followed results</b> · ' + esc(names) + '</span> <button class="button secondary" type="button" data-follow-results>View all</button>' : '';
    }
    async function refreshResults(task, force = false) {
      if (!model || !force && !resultRequest && Date.now() - checkedAt < 30000) return feed;
      const paths = [...new Set(followed().flatMap(item => item.current.map(row => row.dataPath)))];
      if (resultRequest) {
        if (!force || paths.every(path => loadingPaths.has(path))) return resultRequest;
        await resultRequest;
        return refreshResults(task, true);
      }
      loadingPaths = new Set(paths);
      resultRequest = (async () => {
        const fresh = new Map(sections);
        let next = 0, completed = 0;
        await Promise.all(Array.from({length: Math.min(4, paths.length)}, async () => {
          while (next < paths.length) {
            const path = paths[next++];
            try { fresh.set(path, await loadResults(path)); }
            catch { fresh.delete(path); }
            task?.stage(20 + 65 * ++completed / paths.length, 'Checked ' + completed + ' of ' + paths.length + ' followed sections');
          }
        }));
        sections = fresh;
        checkedAt = Date.now();
        paintResults();
        if (!host.hidden && !opening) draw();
        return feed;
      })().finally(() => { resultRequest = null; });
      return resultRequest;
    }
    async function viewResults(button) {
      if (opening) return;
      opening = button.disabled = true;
      try {
        await BRTAActivity.run('Finding followed scorecards', async task => {
          if (!model) await refresh();
          await refreshResults(task, true);
          task.stage(92, 'Matching players to their fixtures…');
          await task.paint();
          if (!openResults(feed.slides)) return false;
          BRTAFollowingResults.acknowledge(feed.slides);
          save();
          paintResults();
          return true;
        }, {key:'following-scorecards', message:'Reading the latest published results…'});
      } catch {
        if (!host.hidden) draw();
      } finally {
        opening = button.disabled = false;
      }
    }
    notice.addEventListener('click', event => {
      const button = event.target.closest('[data-follow-results]');
      if (button) void viewResults(button);
    });
    const reviewKey = person => person.id + '|' + person.rows.filter(row => row.isCurrent)
      .map(row => row.seasonLabel + ':' + row.competitionCode).sort().join('|');
    function update() {
      candidates.clear();
      notifications.clear();
      for (const pin of state.pins) {
        const known = related(pin);
        const current = known.flatMap(person => person.rows.filter(row => row.isCurrent));
        const changed = [...new Set(current.map(row => row.seasonLabel + '|' + row.competitionCode))].filter(key =>
          !pin.wasCurrent.includes(key));
        if (changed.length) notifications.set(pin, changed);
        // An active name elsewhere can still be somebody else. Ask before linking even when the known player also has current entries.
        const possible = model.named(pin.name).filter(person => !known.some(item => item.id === person.id) &&
          person.rows.some(row => row.isCurrent) && !pin.dismissed.includes(reviewKey(person)) && !pinFor(person));
        if (possible.length) candidates.set(pin, possible);
      }
      paintResults();
    }
    function refresh() {
      if (request) return request;
      request = Promise.all([careers(), analytics()]).then(([found, comparison]) => {
        model = found;
        report = comparison;
        migrate();
        update();
        refreshStars();
        if (!host.hidden) draw();
        return refreshResults();
      }).catch(() => { if (!host.hidden) host.innerHTML = '<p>Player records could not be loaded.</p><button type="button" class="button secondary" data-follow-retry>Try again</button>'; })
        .finally(() => { request = null; });
      return request;
    }
    function ranking(people) {
      const records = new Map();
      for (const person of people) for (const row of report?.ranks?.[person.id] || []) {
        const [pool, rank, count, matches, wins, ladders] = row;
        const previous = records.get(pool);
        if (!previous || matches > previous.matches) records.set(pool, {pool, rank, count, matches, wins, ladders});
      }
      return [...records.values()].sort((a, b) => a.rank / a.count - b.rank / b.count).map(({pool, rank, count, matches, wins, ladders}) =>
        '<div class="following-rank"><div><span>Rank</span><strong>#' + rank + '<small> / ' + count + '</small></strong></div>' +
        '<div><span>Match record</span><strong>' + wins + '–' + (matches - wins) + '</strong></div>' +
        '<small class="following-rank-context">' +
        (ladders > 1 ? ladders + ' calibrated BRTA ladders' : esc(competitionLabel(pool.split('/')[0]).split(' - ')[0]) + ' comparison group') +
        '</small></div>').join('');
    }
    function draw() {
      if (!model) {
        host.innerHTML = '<p role="status">Loading followed players…</p>';
        return;
      }
      visible = followed().sort((a, b) => Number(!!b.current.length) - Number(!!a.current.length) || a.pin.name.localeCompare(b.pin.name));
      const activeCount = visible.filter(row => row.current.length).length;
      const card = ({pin, known, current}, i) => {
        const active = !!current.length;
        const review = (candidates.get(pin) || []).map((person, j) =>
          '<div class="following-review"><b>Same name in a current season</b><p>' +
          esc(locations(person.rows.filter(row => row.isCurrent)).join(' / ')) +
          '</p><div><button class="button secondary" data-follow-candidate="' + i + ':' + j +
          '">View Career Lab</button><button class="button secondary" data-follow-confirm="' + i + ':' + j +
          '">Same player</button><button class="button secondary" data-follow-dismiss="' + i + ':' + j +
          '">Different player</button></div></div>').join('');
        const notice = notifications.has(pin) ? '<p class="following-return" role="status">New season or competition found. ' +
          '<button class="export-link" data-follow-seen="' + i + '">Mark seen</button></p>' : '';
        const primary = known.find(person => person.rows.some(row => row.isCurrent)) || known[0];
        const locationsHTML = active ? '<ul class="following-locations">' +
          locations(current).map(location => '<li>' + esc(location) + '</li>').join('') + '</ul>' :
          '<p>' + esc(primary ? 'Last seen ' + primary.rows[0].seasonLabel + ' · ' + primary.rows[0].team : 'Saved history unavailable') + '</p>';
        return '<article class="association-follow-row"><header><div><h4>' +
          (primary ? '<button type="button" class="person" data-follow-open="' + i + '">' + esc(pin.name) + '</button>' : esc(pin.name)) +
          '</h4>' + locationsHTML + '</div><button type="button" class="following-remove" data-follow-remove="' + i +
          '" aria-label="Unfollow ' + esc(pin.name) + '" title="Unfollow">' + icon + '</button></header>' +
          (active ? ranking(known) || '<p class="following-no-rank">Comparison available after three scored matches.</p>' : '') +
          notice + review + '</article>';
      };
      const group = (title, rows, offset = 0) => rows.length ? '<section class="following-group"><h3>' + title +
        ' <span>' + rows.length + '</span></h3><div class="following-grid">' + rows.map((row, i) => card(row, offset + i)).join('') +
        '</div></section>' : '';
      const resultHeader = '<div class="following-result-summary"><div><b>Latest results</b><p>' +
        (feed.unread.length ? esc(feed.unread.join(', ')) + ' · new results' : 'Browse the latest published scorecards.') +
        '</p></div><button class="button primary" type="button" data-follow-results>View all</button></div>';
      host.innerHTML = visible.length ? resultHeader +
        group('Playing now', visible.slice(0, activeCount)) +
        group('Watching for a return', visible.slice(activeCount), activeCount) +
        (activeCount ? '<details class="following-method"><summary>How the comparison works</summary><p>Section level is weighted with win rate and game share. The comparison combines ladders only where there is enough evidence from players who played both. This estimate uses published match records.</p></details>' : '') :
        '<div class="following-empty"><h3>No players followed yet</h3><p>Star a player in their Lab to see their results here and track when they return.</p></div>';
    }
    host.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const data = button.dataset;
      if ('followResults' in data) { void viewResults(button); return; }
      if ('followRetry' in data) { draw(); refresh(); return; }
      const key = ['followOpen','followRemove','followSeen','followCandidate','followConfirm','followDismiss'].find(key => key in data);
      if (!key) return;
      const [i, j] = data[key].split(':').map(Number);
      const item = visible?.[i];
      if (!item) return;
      const {pin, known, current} = item;
      const candidate = candidates.get(pin)?.[j];
      if (key === 'followOpen') {
        const person = known.find(person => person.rows.some(row => row.isCurrent)) || known[0];
        if (person) {
          const rows = known.flatMap(record => record.rows).sort((a, b) =>
            Number(b.isCurrent) - Number(a.isCurrent) || BRTACareers.order(b.seasonLabel) - BRTACareers.order(a.seasonLabel));
          const seasons = [...new Set(rows.map(row => row.seasonLabel))];
          open({...person, rows, seasons});
        }
        return;
      }
      if (key === 'followCandidate' && candidate) { open(candidate); return; }
      if (key === 'followRemove') state.pins = state.pins.filter(item => item !== pin);
      if (key === 'followSeen') pin.wasCurrent = [...new Set([...pin.wasCurrent, ...current.map(row => row.seasonLabel + '|' + row.competitionCode)])];
      if (key === 'followConfirm' && candidate) {
        pin.ids.push(candidate.id);
        pin.anchors.push(...candidate.rows.map(anchor));
        pin.wasCurrent = [...new Set([...pin.wasCurrent, ...create(candidate).wasCurrent])];
      }
      if (key === 'followDismiss' && candidate) pin.dismissed.push(reviewKey(candidate));
      save();
      update();
      if (key === 'followConfirm') void refreshResults(null, true);
      refreshStars();
      draw();
      const next = host.querySelector('[data-follow-open="' + Math.min(i, visible.length - 1) + '"]') ||
        host.closest('.players-following-sheet').querySelector('[data-following-close]');
      next.focus({preventScroll: true});
    });
    document.addEventListener('click', async event => {
      const button = event.target.closest('[data-player-follow]');
      if (!button) return;
      if (!model) await refresh();
      const person = model?.get(button.dataset.playerFollow);
      if (!person) return;
      const pin = pinFor(person);
      if (pin) state.pins = state.pins.filter(item => item !== pin);
      else state.pins.push(create(person));
      save();
      update();
      if (!pin) void refreshResults(null, true);
      refreshStars();
      if (!host.hidden) draw();
      const active = [...document.querySelectorAll('[data-player-follow]')].find(item =>
        item.dataset.playerFollow === person.id && item.getClientRects().length);
      active?.focus({preventScroll: true});
    });
    window.addEventListener('brta-section-ready', () => {
      if (state.pins.length) refresh();
    });
    window.setInterval(() => {
      if (state.pins.length && !document.hidden) void refresh();
    }, 60000);
    document.addEventListener('visibilitychange', () => {
      if (state.pins.length && !document.hidden) void refresh();
    });
    if (state.pins.length || !state.checkedLegacy) queueMicrotask(() => { void refresh(); });
    return {star, placeSectionStar, refresh, draw};
  }
  return {setup, icon};
})();
/* BRTA Power Ratings 9.9g */
