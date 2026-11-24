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

  // One carousel entry per followed identity. Additional scorecards remain reachable
  // from that entry, including unread rounds and appearances in other competitions.
  function presentation(slides) {
    const byPlayer = new Map(), primary = new Map();
    for (const card of slides) for (const player of card.players) {
      if (!byPlayer.has(player.pin)) byPlayer.set(player.pin, []);
      byPlayer.get(player.pin).push({card, player});
    }
    for (const entries of byPlayer.values()) {
      const choice = entries.find(entry => entry.player.unread) || entries.find(entry => entry.card.fixture) || entries[0];
      if (!primary.has(choice.card)) primary.set(choice.card, {card: choice.card, players: [], others: new Set(), empty: new Map()});
      const group = primary.get(choice.card);
      group.players.push(choice.player);
      for (const {card} of entries) {
        if (card === choice.card) continue;
        if (card.fixture) group.others.add(card);
        else if (choice.card.fixture && card.round != null && card.row?.dataPath === choice.card.row?.dataPath)
          group.empty.set(choice.player.pin, card);
      }
    }
    return [...primary.values()].map(group => ({...group, others:[...group.others]}));
  }

  function performanceLabel(winner, side, probability) {
    if (!winner) return 'No recorded winner';
    if (!Number.isFinite(probability)) return 'Too early to estimate';
    if (winner === side) return probability < .4 ? 'Upset win' : probability < .6 ? 'Good win' : 'Expected win';
    return probability > .6 ? 'Below expectation' : probability > .4 ? 'Close matchup' : 'Expected loss';
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

  const api = {collect, track, acknowledge, matchesPlayer, presentation, performanceLabel};
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof window === 'undefined') return;

  const scorecard = () => document.querySelector('#resultOverlay');
  const signed = value => (value > 0 ? '+' : '') + value;
  const label = slide => [slide.row?.competitionLabel, slide.row?.sectionLabel, slide.round == null ? '' :
    roundHeading(slide.fixture || slide.group || {round: slide.round})].filter(Boolean).join(' · ');
  const roundsBefore = (data, view, round) => BRTAHistory.rounds(data, view).filter(item => Number(item.round) < round)
    .map(item => Number(item.round)).sort((a,b)=>b-a);
  function power(data, row, round, view) {
    const current = BRTAHistory.rounds(data, view).find(item => Number(item.round) === round);
    if (!current) return null;
    const rank = number => BRTAHistory.ranked(BRTAHistory.rowsAt(data, view, number), view, data)
      .find(value => value.player === row.player);
    const after = rank(round), previous = roundsBefore(data, view, round)[0];
    const before = previous != null ? rank(previous) : null;
    if (!Number.isFinite(after?.rating)) return null;
    return {label:view==='singles'?'Singles Power':'Doubles Power', value:after.rating,
      change:Number.isFinite(before?.rating)?after.rating-before.rating:null,
      detail: after.rank == null ? 'Provisional' : before?.rank!=null && before.rank!==after.rank ?
        '#' + before.rank + ' → #' + after.rank : 'Rank #' + after.rank};
  }
  function standing(slide, row) {
    const team = BRTAStandings.at(slide.data, slide.round).find(item => item.team === row.team);
    if (!team || team.position == null) return null;
    const movement = team.positionChange == null ? '' : team.positionChange === 0 ? 'Held position' :
      (team.positionChange > 0 ? 'Up ' : 'Down ') + Math.abs(team.positionChange);
    return {label:'Team ladder', value:'#'+team.position, change:team.pointsChange, suffix:' pts',
      detail:[row.team,movement].filter(Boolean).join(' · ')};
  }
  const buttonFor = (type,name,text,css) => '<button type="button" class="' + css + '" data-follow-' + type + '="' +
    esc(name) + '">' + text + '</button>';
  const playerLink = (name,text=name) => !name || /^no player$/i.test(name) || BRTAPlayerDisplay?.isUnknown(name) ?
    esc(publicPlayerName(text)) : buttonFor('player',name,esc(publicPlayerName(text)),'person');
  const teamLink = name => name && !/^winner of semifinal \d+$/i.test(name) ?
    buttonFor('team',name,teamName(name),'club-link') : teamName(name);
  const metric = ({label,value,change,suffix='',detail}) => '<div class="follow-metric"><span>' + esc(label) + '</span><div><strong>' + esc(value) +
    '</strong>' + (change==null?'':' <span class="follow-delta '+(change>0?'win':change<0?'loss':'')+'">' + esc(signed(change)+suffix) + '</span>') +
    '</div>' + (detail?'<small>'+esc(detail)+'</small>':'') + '</div>';
  const opponentBand = (rows, rating) => {
    const rated = rows.filter(row => row.matches>=2 && Number.isFinite(row.rating));
    if (rated.length < 6) return '';
    const above = rated.filter(row => row.rating > rating).length / rated.length;
    return above < 1/3 ? 'Top third in this section' : above < 2/3 ? 'Middle third in this section' : 'Lower third in this section';
  };
  function performance(slide, rubber, side) {
    const doubles = rubber.type==='Doubles', other = side==='home'?'away':'home';
    const view = doubles?'doublesPlayers':'singles';
    const previous = roundsBefore(slide.data,view,slide.round)[0];
    const rows = previous==null ? [] : BRTAHistory.rowsAt(slide.data,view,previous);
    const lookup = name => rows.find(row => row.player===name && row.matches>=2 && Number.isFinite(row.rating));
    const average = list => list.length && list.every(Boolean) ? list.reduce((sum,row)=>sum+row.rating,0)/list.length : null;
    const own = participants(rubber,side).map(lookup), away = participants(rubber,other).map(lookup);
    const ownPower = average(own), awayPower = average(away), winner = rubberWinnerSide(rubber);
    const scored = !/forfeit|walkover|retir|unfinished/i.test((rubber.status || '')+' '+(rubber.score || '')) && rubber.valid_for_rating!==false;
    let chance = null;
    if (ownPower!=null && awayPower!=null && scored) {
      const game = BRTAPrediction.gameProbability(ownPower,awayPower,slide.data.meta?.ratingProbabilityScale || 450);
      chance = slide.data.format==='rubbers'&&!doubles ? BRTAPrediction.rubbersSinglesWin(game) :
        BRTAPrediction.shortSetWin(game,{greenBall:!!slide.data.greenBall,targetGames:slide.data.format==='rubbers'?8:6});
    }
    const outcome = scored ? performanceLabel(winner, side, chance) : 'No playing estimate';
    const tone = outcome==='Upset win'||outcome==='Good win'?'positive':outcome==='Below expectation'?'negative':'neutral';
    const opponents = participants(rubber,other).map((name,i) => {
      const opponent = away[i];
      const band = opponent && opponentBand(rows,opponent.rating);
      return '<li>'+playerLink(name)+(opponent?' <span>'+opponent.rating+' Power'+(band?' · '+esc(band):'')+'</span>':' <span>Limited prior results</span>')+'</li>';
    }).join('');
    return '<div class="follow-performance"><div><span>'+esc(rubber.type)+' · '+esc(rubber.position)+'</span><b class="follow-verdict '+tone+'">'+outcome+'</b></div>'+
      '<ul>'+opponents+'</ul><small>'+(chance==null?'A reliable pre-match estimate was unavailable.':
        Math.round(100*chance)+'% estimated chance to win before the round.')+'</small></div>';
  }
  function updates(slide, featured, noResults) {
    if (!slide.fixture) return '';
    const opponents = new Set();
    for (const rubber of slide.fixture.rubbers || []) {
      const names = side => slide.players.filter(({row}) => matchesPlayer(slide.fixture,rubber,side,row)).map(({pin}) => pin.name);
      for (const home of names('home')) for (const away of names('away')) if (home!==away)
        opponents.add([home,away].sort().join(' vs '));
    }
    return '<section class="following-fixture-updates"><h3>What changed</h3>' +
      (opponents.size?'<p class="following-head-to-head"><b>Followed players faced each other</b> · '+esc([...opponents].join(' / '))+'</p>':'') +
      featured.map(({pin,row}) => {
        const metrics = ['singles','doublesPlayers'].map(view=>power(slide.data,row,slide.round,view)).concat(standing(slide,row)).filter(Boolean);
        const performances = (slide.fixture.rubbers || []).flatMap(rubber => ['home','away']
          .filter(side=>matchesPlayer(slide.fixture,rubber,side,row)).map(side=>performance(slide,rubber,side))).join('');
        const missing = noResults.get(pin);
        return '<article class="following-player-update"><header><b>'+playerLink(row.player,pin.name)+'</b>'+
          (missing?'<small>Nothing new in '+esc(roundHeading(missing.group || {round:missing.round}))+' · last played scorecard shown</small>':'')+
          '</header><div class="follow-metrics">'+(metrics.map(metric).join('') || '<p>No rating or ladder change available.</p>')+
          '</div><div class="follow-performances">'+performances+'</div></article>';
      }).join('') + '</section>';
  }

  function setup() {
    let cards = [], index = 0, alternate = null;
    const current = () => alternate || cards[index]?.card;
    const active = () => scorecard().hasAttribute('data-following-results') && !scorecard().classList.contains('hidden');
    function render() {
      const group = cards[index], slide = current(), overlay = scorecard(), content = overlay.querySelector('#resultContent');
      delete overlay.dataset.simulated;
      overlay.dataset.followingResults = '';
      overlay.querySelector('#resultFixtureEdit').hidden = true;
      window.BRTAFixtureDetails?.closeMap('#resultOverlay');
      selectedMatch = null;
      overlay.querySelectorAll('.round841-controls,.round84-externalnav').forEach(element => element.remove());
      const featured = alternate ? slide.players.filter(player => group.players.some(item => item.pin===player.pin)) : group.players;
      const names = featured.map(({pin}) => pin.name).join(', ');
      content.innerHTML = slide.fixture ? resultDetailHTML(slide.fixture, {data:slide.data,followed:slide.players.map(player=>player.row),sectionLabel:label(slide),teamLabel:teamLink,playerLabel:playerLink}) +
        updates(slide,featured,alternate?new Map():group.empty) :
        '<div class="result-detail-head"><span>' + esc(label(slide)) + '</span><h2>' + esc(names) + '</h2><p>Nothing new · ' + esc(slide.reason) + '</p></div>';
      if (group.others.length) content.insertAdjacentHTML('beforeend','<details class="follow-other-scorecards"><summary>Other scorecards</summary>'+
        [group.card,...group.others].map((card,i)=>'<button class="button secondary" type="button" data-follow-other="'+i+'"'+
          (card===slide?' disabled':'')+'>'+esc(label(card)+' · '+card.fixture.home+' v '+card.fixture.away)+'</button>').join('')+'</details>');
      const step = (n, cls) => '<button type="button" class="' + cls + '" data-follow-result-step="' + n +
        '" aria-label="' + (n < 0 ? 'Previous' : 'Next') + ' followed scorecard">' + (n < 0 ? '‹' : '›') + '</button>';
      const multiple = cards.length > 1;
      overlay.insertAdjacentHTML('beforeend', '<div class="round841-controls following-controls"><div class="round841-tools">' +
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
      alternate=null; index = (index + direction + cards.length) % cards.length;
      render();
    }
    async function navigate(link, slide) {
      if (!slide?.row || link.disabled) return;
      if (link.dataset.followPlayer) {
        link.disabled = true;
        try { await openGlobalPlayer(slide.row.sectionCode,link.dataset.followPlayer); }
        finally { link.disabled = false; }
        return;
      }
      link.disabled = true;
      try {
        await BRTAActivity.run('Opening section',async task => {
          const code = slide.row.sectionCode;
          if (D.meta.section_code!==code || D.meta.is_archive) {
            activeHistorySeasonId=null;
            viewCatalog=currentCatalog();
            if (!await loadSection(code,null,task)) return false;
          }
          if (link.closest('.follow-standings-sheet')) BRTAOverlays.dismissSheet();
          close('#resultOverlay');
          if (link.dataset.followTeam) await openClubForTeam(link.dataset.followTeam);
          else if (link.dataset.followMatch) { switchPage('results'); openMatch(link.dataset.followMatch); }
        });
      } finally { link.disabled = false; }
    }
    function showStandings(slide) {
      const followed = new Set(slide.players.map(player=>player.row?.team).filter(Boolean));
      const view = standingsView(slide.data,{followed,teamLabel:teamLink,teamLink,
        matchLink: fixture=>buttonFor('match',fixture.fixtureId,'View result','export-link')});
      const title = [slide.row.competitionLabel,slide.row.sectionLabel].filter(Boolean).join(' · ');
      const sheet = BRTAOverlays.openSheet('Standings · '+title,'<p class="small-note">'+esc(view.note)+'</p>'+
        '<div class="knockout-summary">'+view.knockout+'</div><div class="table-wrap" tabindex="0" role="region" aria-label="Standings table">'+
        '<table><thead>'+view.head+'</thead><tbody>'+view.body+'</tbody></table></div><div class="notice">'+view.caveat+'</div>',
        {className:'follow-standings-sheet'});
      sheet.addEventListener('click',event=>{
        const link=event.target.closest('[data-follow-team],[data-follow-match]');
        if(link)void navigate(link,slide);
      });
    }
    scorecard().addEventListener('click', event => {
      if (!active()) return;
      const arrow = event.target.closest('[data-follow-result-step]');
      if (arrow) {
        const kind = arrow.className;
        step(Number(arrow.dataset.followResultStep));
        scorecard().querySelector('[data-follow-result-step="' + arrow.dataset.followResultStep + '"].' + kind)?.focus();
        return;
      }
      const other = event.target.closest('[data-follow-other]');
      if(other){
        const i=Number(other.dataset.followOther);
        alternate=i?cards[index].others[i-1]:null;
        render();
        scorecard().querySelector('#resultClose').focus();
        return;
      }
      const link=event.target.closest('[data-follow-team],[data-follow-player]');
      if(link)void navigate(link,current());
      if(event.target.closest('[data-follow-result-standings]'))showStandings(current());
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
        cards = presentation(slides);
        index = 0;
        alternate = null;
        render();
        eightRaise(scorecard());
        scorecard().querySelector('#resultClose').focus();
        return true;
      }
    };
  }
  root.BRTAFollowingResults = {...api, setup};
})(typeof window === 'undefined' ? globalThis : window);
