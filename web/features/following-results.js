(function (root) {
  'use strict';
  const participants = (rubber, side) => String(rubber[side] || '').split(/\s*\/\s*/);
  const matchesPlayer = (fixture, rubber, side, row) =>
    (!row.team || fixture[side] === row.team) && participants(rubber, side).includes(row.player);
  const order = group => Number(group.round);
  const sectionKey = row => JSON.stringify([row.competitionCode, row.seasonLabel, row.sectionCode]);

  function collect(items, sections) {
    const cards = new Map(), tracking = [];
    function add(key, card, player) {
      if (!cards.has(key)) cards.set(key, {...card, players: new Map(), unread: false});
      const saved = cards.get(key);
      const id = JSON.stringify([player.pin.name, player.row?.player, player.row?.team]);
      saved.players.set(id, player);
      saved.unread ||= player.unread || false;
    }
    for (const item of items) {
      const {pin, current} = item;
      if (!current.length) {
        add('inactive:' + pin.name, {reason: 'No current competition entry.'}, {pin});
        continue;
      }
      for (const row of current) {
        const key = sectionKey(row), data = sections.get(row.dataPath);
        if (!data) {
          add('unavailable:' + key, {row, reason: 'Could not load this section. Try again.'}, {pin, row});
          continue;
        }
        const groups = (data.results || []).filter(group => (group.fixtures || []).some(fixture =>
          !['Scheduled', 'Missing Result', 'Pending', 'Bye'].includes(fixture.status)));
        const latest = [...groups].sort((a,b) => order(b) - order(a))[0];
        const tracked = pin.resultTracking?.[key];
        const firstRound = tracked?.firstRound ?? order(latest || {});
        if (!tracked && Number.isFinite(firstRound)) tracking.push({pin, key, firstRound});
        let appearedLatest = false, lastPlayed;
        for (const group of groups) {
          const round = order(group);
          for (const fixture of group.fixtures) {
            const rubbers = (fixture.rubbers || []).filter(rubber =>
              ['home','away'].some(side => matchesPlayer(fixture, rubber, side, row)));
            if (!rubbers.length || ['Scheduled','Missing Result','Pending','Bye'].includes(fixture.status)) continue;
            if (group === latest) appearedLatest = true;
            const fixtureKey = fixture.fixtureId || JSON.stringify([fixture.home, fixture.away]);
            const signature = JSON.stringify([fixtureKey, ...rubbers.map(rubber =>
              [rubber.type, rubber.position, rubber.home, rubber.away, rubber.winner, rubber.score, rubber.status]).sort()]);
            const unread = round >= firstRound && !tracked?.seen?.[round]?.includes(signature);
            const cardKey = JSON.stringify([key, round, fixtureKey]);
            const card = {row, data, fixture: {...group, ...fixture, fixtures: undefined, round}, round};
            const player = {pin, row, unread, key, round, signature};
            if (!lastPlayed || round > lastPlayed.card.round) lastPlayed = {cardKey, card, player};
            if (group === latest || unread) add(cardKey, card, player);
          }
        }
        if (!appearedLatest) {
          if (lastPlayed) add(lastPlayed.cardKey, lastPlayed.card, lastPlayed.player);
          add('no-result:' + key, {row, data, round: latest?.round, group: latest, reason: latest ?
            'No individual result in the latest posted round.' : 'No rounds have been posted for this entry.'}, {pin, row});
        }
      }
    }
    const slides = [...cards.values()].map(card => ({...card, players: [...card.players.values()]}))
      .sort((a,b) => Number(b.unread) - Number(a.unread) || Number(!!b.fixture) - Number(!!a.fixture) ||
        Number(b.round || 0) - Number(a.round || 0) || (a.row?.competitionCode || '').localeCompare(b.row?.competitionCode || ''));
    const unread = [...new Set(slides.flatMap(card => card.players.filter(player => player.unread).map(player => player.pin.name)))];
    return {slides, unread, tracking};
  }

  function track(updates) {
    for (const {pin, key, firstRound} of updates) {
      pin.resultTracking ||= {};
      pin.resultTracking[key] ||= {firstRound, seen:{}};
    }
  }
  function acknowledge(slides) {
    for (const card of slides) for (const player of card.players) {
      if (!player.unread) continue;
      const {pin, key, round, signature} = player;
      track([{pin, key, firstRound:round}]);
      const seen = pin.resultTracking[key].seen[round] ||= [];
      if (!seen.includes(signature)) seen.push(signature);
    }
  }

  const api = {collect, track, acknowledge, matchesPlayer};
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof window === 'undefined') return;

  const scorecard = () => document.querySelector('#resultOverlay');
  const signed = value => (value > 0 ? '+' : '') + value;
  const label = slide => [slide.row?.competitionLabel, slide.row?.sectionLabel, slide.round == null ? '' :
    roundHeading(slide.fixture || slide.group || {round: slide.round})].filter(Boolean).join(' · ');
  const power = (data, row, round, view) => {
    const rounds = BRTAHistory.rounds(data, view).slice().sort((a,b) => Number(a.round)-Number(b.round));
    const current = rounds.find(item => Number(item.round) === round);
    const previous = rounds.filter(item => Number(item.round) < round).at(-1);
    if (!current) return null;
    const rank = item => BRTAHistory.ranked(BRTAHistory.rowsAt(data, view, Number(item.round)), view, data)
      .find(value => value.player === row.player);
    const after = rank(current), before = previous && rank(previous);
    if (!Number.isFinite(after?.rating)) return null;
    const change = Number.isFinite(before?.rating) ? ' (' + signed(after.rating - before.rating) + ')' : ' · first rated round';
    const rankChange = after.rank != null && before?.rank != null && after.rank !== before.rank ?
      ' · rank #' + before.rank + ' → #' + after.rank : after.rank == null ? ' · provisional' : '';
    return (view === 'singles' ? 'Singles' : 'Doubles') + ' Power ' + after.rating + change + rankChange;
  };
  const standing = (slide, row) => {
    const team = BRTAStandings.at(slide.data, slide.round).find(item => item.team === row.team);
    if (!team || team.position == null) return '';
    const movement = team.positionChange == null ? '' : team.positionChange === 0 ? ' · no ladder movement' :
      ' · ' + (team.positionChange > 0 ? 'up ' : 'down ') + Math.abs(team.positionChange);
    return row.team + ' #' + team.position + movement + (team.pointsChange == null ? '' : ' · ' + signed(team.pointsChange) + ' points');
  };
  function updates(slide) {
    if (!slide.fixture) return '';
    const opponents = new Set();
    for (const rubber of slide.fixture.rubbers || []) {
      const names = side => slide.players.filter(({row}) => matchesPlayer(slide.fixture, rubber, side, row)).map(({pin}) => pin.name);
      for (const home of names('home')) for (const away of names('away')) if (home !== away)
        opponents.add([home,away].sort().join(' vs '));
    }
    return '<section class="following-fixture-updates"><h3>What changed</h3>' +
      (opponents.size ? '<p class="following-head-to-head"><b>Followed players faced each other</b> · ' + esc([...opponents].join(' / ')) + '</p>' : '') +
      '<p class="small-note">Power changes use the published section snapshots.</p>' +
      slide.players.map(({pin,row}) => '<article><b>' + esc(pin.name) + '</b><p>' +
        esc(['singles','doublesPlayers'].map(view => power(slide.data, row, slide.round, view)).filter(Boolean).join(' · ') || 'Power change unavailable') +
        '</p><p>' + esc(standing(slide,row) || 'Ladder movement unavailable') + '</p></article>').join('') + '</section>';
  }

  function setup() {
    let cards = [], index = 0;
    const active = () => scorecard().hasAttribute('data-following-results') && !scorecard().classList.contains('hidden');
    function render() {
      const slide = cards[index], overlay = scorecard(), content = overlay.querySelector('#resultContent');
      delete overlay.dataset.simulated;
      overlay.dataset.followingResults = '';
      overlay.querySelector('#resultFixtureEdit').hidden = true;
      window.BRTAFixtureDetails?.closeMap('#resultOverlay');
      selectedMatch = null;
      overlay.querySelectorAll('.round841-controls,.round84-externalnav').forEach(element => element.remove());
      const names = slide.players.map(({pin}) => pin.name).join(', ');
      content.innerHTML = slide.fixture ? resultDetailHTML(slide.fixture, {followed: slide.players.map(player => player.row), sectionLabel: label(slide)}) + updates(slide) :
        '<div class="result-detail-head"><span>' + esc(label(slide)) + '</span><h2>' + esc(names) + '</h2><p>Nothing new · ' + esc(slide.reason) + '</p></div>';
      const step = (n, cls) => '<button type="button" class="' + cls + '" data-follow-result-step="' + n +
        '" aria-label="' + (n < 0 ? 'Previous' : 'Next') + ' followed scorecard">' + (n < 0 ? '‹' : '›') + '</button>';
      const multiple = cards.length > 1;
      overlay.insertAdjacentHTML('beforeend', '<div class="round841-controls"><div class="round841-tools">' +
        (slide.data && slide.round != null ? '<button type="button" class="button secondary" data-follow-result-standings>View standings</button>' : '') +
        '</div><nav class="round841-counter" aria-label="Followed scorecard position">' + (multiple ? step(-1,'round841-mobile-step') : '') +
        '<span>FOLLOWING · ' + (index + 1) + ' / ' + cards.length + '</span>' + (multiple ? step(1,'round841-mobile-step') : '') + '</nav></div>');
      if (multiple) overlay.insertAdjacentHTML('beforeend', '<nav class="round84-externalnav" aria-label="Followed scorecards">' +
        step(-1,'round84-arrow') + step(1,'round84-arrow') + '</nav>');
      overlay.classList.remove('hidden');
      resetResultScroll();
      BRTARoundSimulation.positionArrows();
      document.body.classList.add('modal-open');
    }
    function step(direction) {
      if (cards.length < 2) return;
      index = (index + direction + cards.length) % cards.length;
      render();
    }
    scorecard().addEventListener('click', event => {
      if (!active()) return;
      const arrow = event.target.closest('[data-follow-result-step]');
      if (arrow) {
        const kind = arrow.className;
        step(Number(arrow.dataset.followResultStep));
        scorecard().querySelector('[data-follow-result-step="' + arrow.dataset.followResultStep + '"].' + kind)?.focus();
      }
      if (!event.target.closest('[data-follow-result-standings]')) return;
      const slide = cards[index], rows = BRTAStandings.at(slide.data, slide.round);
      const table = BRTAOverlays.openSheet('Standings · ' + label(slide),
        '<div class="table-wrap"><table><thead>' + standingsHeadHTML() + '</thead><tbody>' +
        standingsRowsHTML(rows, new Set()) + '</tbody></table></div>');
      table.querySelectorAll('[data-club-team]').forEach(button => button.replaceWith(document.createTextNode(button.textContent)));
    });
    document.addEventListener('keydown', event => {
      if (!active() || !['ArrowLeft','ArrowRight'].includes(event.key) ||
          BRTAOverlays.top() !== scorecard() ||
          !scorecard().contains(document.activeElement)) return;
      event.preventDefault();
      step(event.key === 'ArrowLeft' ? -1 : 1);
      scorecard().querySelector('#resultClose').focus();
    });
    window.addEventListener('resize', () => { if (active()) BRTARoundSimulation.positionArrows(); });
    return {
      open(slides) {
        if (!slides.length) return false;
        cards = slides;
        index = 0;
        render();
        eightRaise(scorecard());
        scorecard().querySelector('#resultClose').focus();
        return true;
      }
    };
  }
  root.BRTAFollowingResults = {...api, setup};
})(typeof window === 'undefined' ? globalThis : window);
