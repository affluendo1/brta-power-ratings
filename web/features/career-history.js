((root) => {
  'use strict';
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function matchTime(value) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
    const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value || '');
    if (numeric) return Date.UTC(+numeric[3] + (numeric[3].length === 2 ? (+numeric[3] < 70 ? 2000 : 1900) : 0), +numeric[2] - 1, +numeric[1]);
    const named = /^(\d{1,2}) ([a-z]{3,9}) (\d{2}|\d{4})$/i.exec(value || '');
    if (!named) return null;
    const month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase());
    if (month < 0) return null;
    const year = +named[3] + (named[3].length === 2 ? (+named[3] < 70 ? 2000 : 1900) : 0);
    return Date.UTC(year, month, +named[1]);
  }

  function seasonRecords(entries) {
    const groups = new Map();
    for (const entry of entries) {
      const row = entry.row;
      const key = JSON.stringify([row.competitionCode, row.seasonKey || row.seasonLabel]);
      if (!groups.has(key)) groups.set(key, {row, matches: new Map(), appearances: new Map()});
      const group = groups.get(key);
      group.appearances.set(JSON.stringify([row.sectionCode, row.player, row.team]), entry);
      for (const match of entry.matches) {
        const id = JSON.stringify([row.sectionCode, match.fixtureId || match.round, match.kind, match.position, match.opp, match.partner]);
        group.matches.set(id, match);
      }
    }
    const stats = matches => {
      const count = matches.length, wins = matches.filter(match => match.won).length;
      const games = matches.reduce((sum, match) => sum + match.gf + match.ga, 0);
      return {count, wins, winRate: count ? 100 * wins / count : null,
        gameShare: games ? 100 * matches.reduce((sum, match) => sum + match.gf, 0) / games : null};
    };
    return [...groups.values()].map(group => {
      const matches = [...group.matches.values()];
      const dates = matches.map(match => matchTime(match.date)).filter(Number.isFinite);
      return {row: group.row, date: dates.length ? Math.max(...dates) : null,
        overall: stats(matches), singles: stats(matches.filter(match => match.kind === 'singles')),
        doubles: stats(matches.filter(match => match.kind === 'doublesPlayers')),
        appearances: [...group.appearances.values()]};
    }).sort((a, b) => (b.date ?? -Infinity) - (a.date ?? -Infinity) ||
      a.row.competitionCode.localeCompare(b.row.competitionCode) || a.row.seasonLabel.localeCompare(b.row.seasonLabel));
  }

  function seasonAwards(seasons) {
    const highest = (stat, field, minimum) => seasons.filter(season =>
      season[stat].count >= minimum && Number.isFinite(season[stat][field])
    ).sort((a, b) => b[stat][field] - a[stat][field] || b[stat].count - a[stat].count);
    const categories = [
      ['Best singles win rate', 'singles', 'winRate', 5],
      ['Best doubles win rate', 'doubles', 'winRate', 5],
      ['Best share of games won', 'overall', 'gameShare', 5],
      ['Most match wins', 'overall', 'wins', 1],
      ['Most matches played', 'overall', 'count', 1]
    ];
    return categories.flatMap(([label, stat, field, minimum]) => {
      const ranked = highest(stat, field, minimum);
      if (!ranked.length) return [];
      const value = ranked[0][stat][field];
      return [{label, value, field, records: ranked.filter(season => season[stat][field] === value)}];
    });
  }

  // validation/calibrate_career_skill.py selects this bounded form adjustment
  // on past BRTA junior singles and measures it on Spring 2026.
  const skillMethod = 'Within a competition, each division step is worth 45 points. Junior Rubbers sit above Sets 1 and Green Ball starts below the yellow-ball draw. Form uses 20% match win rate and 80% game share, shrunk by two neutral matches and capped smoothly. Season estimates weight each section by matches played. Sets 1 anchors the display at 2,100 before the form adjustment. The calibration used junior singles, so other divisions and doubles use the same provisional scale.';
  const greenOffset = {AA:10, UA:22};
  const rubbersOffset = {AA:2, UA:3};
  function skillScale(row) {
    const label = String(row.sectionLabel || '').trim().toLowerCase();
    const number = Number(/(?:^|[^\d])(\d{1,2})(?!\d)/.exec(label)?.[1]);
    if (!Number.isInteger(number) || number < 1 || !/sets?|rub|section|secti?on|grade|div|s\/d|girls?|boys?|mixed|\bmx\b|^(?:a ?)?\d{1,2}$/.test(label)) return null;
    const code = row.competitionCode;
    const shift = /green/.test(label) ? -(greenOffset[code] ?? 10) : /^rub/.test(label) ? (rubbersOffset[code] ?? 0) : 0;
    return {pool: code, baseline: 2100 + 45 * (1 - number + shift)};
  }

  function skillHistory(matches, scale = skillScale, discipline = 'overall') {
    const seasons = new Map();
    const sections = new Map();
    const regularSeasons = new Set();
    for (const match of matches) {
      if (discipline !== 'overall' && match.kind !== (discipline === 'doubles' ? 'doublesPlayers' : 'singles')) continue;
      const row = match.entry, tier = scale(row);
      if (!tier || typeof match.won !== 'boolean') continue;
      const season = JSON.stringify([row.seasonKey || row.seasonLabel, tier.pool]);
      const id = JSON.stringify([season, row.sectionCode]);
      if (match.emergency !== true) regularSeasons.add(season);
      if (!sections.has(id)) sections.set(id, {season, row, tier, regular: [], emergency: []});
      const sample = sections.get(id);
      sample[match.emergency === true ? 'emergency' : 'regular'].push(match);
    }
    for (const {season, row, tier, regular, emergency} of sections.values()) {
      const emergencyOnly = !regularSeasons.has(season);
      if (!seasons.has(season)) seasons.set(season, {row, ...tier, date: null, count: 0, weighted: 0, sections: [], emergencyOnly, emergencySections: []});
      const point = seasons.get(season);
      if (emergency.length && !regular.length) point.emergencySections.push(row.sectionLabel);
      const evidence = emergencyOnly ? emergency : regular;
      const count = evidence.length;
      if (!count) continue;
      const wins = evidence.filter(match => match.won).length;
      const gamesFor = evidence.reduce((sum, match) => sum + (match.gf || 0), 0);
      const gamesAgainst = evidence.reduce((sum, match) => sum + (match.ga || 0), 0);
      const dates = evidence.map(match => matchTime(match.date)).filter(Number.isFinite);
      const date = dates.length ? Math.max(...dates) : null;
      if (!point.count) Object.assign(point, {row, ...tier});
      const winRate = wins / count, gameShare = gamesFor + gamesAgainst ? gamesFor / (gamesFor + gamesAgainst) : winRate;
      const form = 80 * (.2 * winRate + .8 * gameShare - .5) * count / (count + 2);
      const display = tier.baseline + 45 * 12 * Math.tanh(form / 12);
      // Maintain the original point gaps above the floor, and compress its lower tail smoothly.
      const score = display >= 100 ? display : Math.max(1,100 * Math.exp((display-100)/100));
      if (date != null) point.date = Math.max(point.date ?? date, date);
      point.count += count;
      point.weighted += score * count;
      point.sections.push({label: row.sectionLabel, code: row.sectionCode, baseline: tier.baseline, count,
        winRate: winRate * 100, gameShare: gameShare * 100, rating: Math.round(score)});
    }
    return [...seasons.values()].map(({weighted, ...point}) => ({...point, rating: Math.round(weighted / point.count)}))
      .sort((a, b) => (a.date ?? Infinity) - (b.date ?? Infinity) || a.pool.localeCompare(b.pool));
  }

  function seasonSlot(label, date) {
    const season = /\b(autumn|winter|spring|summer)\s+(\d{4}|\d{2})\b/i.exec(label || '');
    if (season) {
      const year = Number(season[2]) + (season[2].length===2?(Number(season[2])<70?2000:1900):0);
      return year * 4 + ['autumn','winter','spring','summer'].indexOf(season[1].toLowerCase());
    }
    if (!Number.isFinite(date)) return null;
    const d = new Date(date);
    return d.getUTCFullYear()*4 + [3,0,0,0,0,1,1,1,2,2,2,3][d.getUTCMonth()];
  }

  const career = {matchTime, seasonRecords, seasonAwards, skillScale, skillHistory, skillMethod, seasonSlot};
  if (typeof module !== 'undefined') module.exports = career;
  if (typeof window === 'undefined') return;

  const colours = ['#62aafa','#33ba91','#ea9664','#b398f3','#ed87ae','#50beca','#e3c15a','#90cf73'];
  const colour = index => colours[index] || 'hsl(' + Math.round(index * 137.5 % 360) + ' 66% 59%)';
  const percent = value => Number.isFinite(value) ? Math.round(value) + '%' : '—';
  const showCompetition = row => row.competitionLabel || competitionLabel(row.competitionCode);
  const label = row => row.seasonLabel + ' · ' + showCompetition(row);
  const ladderLabel = point => showCompetition(point.row);
  const disciplines = {singles:'Singles', doubles:'Doubles', overall:'Overall'};
  const disciplineButtons = (value, attribute) => '<div class="skill-disciplines" role="group" aria-label="Discipline">'+
    Object.entries(disciplines).map(([key,text])=>'<button type="button" '+attribute+'="'+key+'" aria-pressed="'+(key===value)+'">'+text+'</button>').join('') + '</div>';
  const slotLabel = slot => ['Aut','Win','Spr','Sum'][slot % 4] + ' ’' + String(Math.floor(slot/4)).slice(-2);
  function timeline(history, {seriesKey = point => point.pool, seriesLabel = ladderLabel, seriesIndex = null, legend = true, zoom = false, tight = false} = {}) {
    const points = history.map(point=>({...point, slot:seasonSlot(point.row.seasonLabel,point.date)}))
      .filter(point => Number.isFinite(point.slot)).sort((a,b) => a.slot - b.slot);
    if (!points.length) return '<p class="skill-chart-empty">No season ratings for this discipline.</p>';
    const series = new Map();
    for (const point of points) {
      const key = seriesKey(point);
      if (!series.has(key)) series.set(key, new Map());
      const previous = series.get(key).get(point.slot);
      if (!previous || point.count>previous.count) series.get(key).set(point.slot, point);
    }
    const left=50,right=548,top=13,bottom=zoom?195:148;
    const first=points[0].slot,last=points.at(-1).slot;
    const pad = first===last ? 1 : .22;
    const x = slot => left + (slot-first+pad)/(last-first+2*pad)*(right-left);
    const ratings = points.map(point=>point.rating);
    const min=Math.min(...ratings),max=Math.max(...ratings),spread=max-min;
    const margin=tight?Math.max(1,spread*.025):zoom?Math.max(5,spread*.07):Math.max(20,spread*.10);
    const tickTarget=Math.max(tight?1:5,(spread+2*margin)/4),magnitude=10**Math.floor(Math.log10(tickTarget));
    const interval=([1,2,2.5,5,10].find(value=>value*magnitude>=tickTarget)||10)*magnitude;
    const low=Math.max(0,tight?Math.floor(min-margin):Math.floor((min-margin)/interval)*interval);
    const high=tight?Math.max(low+2,Math.ceil(max+margin)):Math.max(low+interval*2,Math.ceil((max+margin)/interval)*interval);
    const firstTick=Math.ceil(low/interval)*interval;
    const y = rating => bottom - (rating-low)/(high-low)*(bottom-top);
    const slots=[...new Set(points.map(point=>point.slot))];
    const ticks=slots.length<=5?slots:[first,Math.round((2*first+last)/3),Math.round((first+2*last)/3),last];
    const grid = Array.from({length:Math.floor((high-firstTick)/interval)+1},(_,i)=>{
      const value=firstTick+i*interval,at=y(value);
      return '<path d="M'+left+' '+at+'H'+right+'"/><text x="'+(left-8)+'" y="'+(at+4)+'" text-anchor="end">'+value+'</text>';
    }).join('')+ticks.map((slot,i)=>'<text x="'+x(slot)+'" y="'+(bottom+18)+'" text-anchor="'+
      (ticks.length===1?'middle':i===0?'start':i===ticks.length-1?'end':'middle')+'">'+slotLabel(slot)+'</text>').join('');
    let lines='', keyHTML='';
    for (const [index,[key,seasons]] of [...series].entries()) {
      const entries=[...seasons.values()], id=seriesIndex?seriesIndex(key):index, color=colour(id);
      const coords=point=>x(point.slot).toFixed(1)+','+y(point.rating).toFixed(1);
      const regular=entries.filter(point=>!point.emergencyOnly);
      lines+='<g class="skill-series" data-skill-series="'+id+'">'+
        (regular.length>1?'<polyline points="'+regular.map(coords).join(' ')+'" stroke="'+color+'" fill="none" stroke-width="2.6"/>':'')+
        entries.map(point=>{
          const cx=x(point.slot).toFixed(1), cy=y(point.rating).toFixed(1);
          return point.emergencyOnly
            ? '<path class="skill-emergency-point" d="M'+cx+' '+(Number(cy)-5)+' l 5 5 -5 5 -5 -5 z" fill="var(--surface)" stroke="'+color+'" stroke-width="2"><title>Emergency appearances only · '+esc(point.row.seasonLabel)+'</title></path>'
            : '<circle cx="'+cx+'" cy="'+cy+'" r="'+(regular.length===1?5:3.3)+'" fill="'+color+'"/>';
        }).join('')+'</g>';
      keyHTML+='<li><i style="background:'+color+'" aria-hidden="true"></i>'+esc(seriesLabel(entries[0]))+'</li>';
    }
    return '<svg viewBox="0 0 560 '+(bottom+28)+'" role="img" aria-label="Estimated playing skill by season and competition">'+
      '<g class="career99-axes">'+grid+'</g>'+lines+'</svg>'+(legend?'<ul class="career99-legend">'+keyHTML+'</ul>':'')+emergencyNotes(points,seriesLabel);
  }

  function emergencyNotes(points, seriesLabel) {
    const marked = points.filter(point => point.emergencySections?.length);
    if (!marked.length) return '';
    return '<details class="skill-emergency-notes"><summary>Emergency appearances'+
      (marked.some(point=>point.emergencyOnly)?' · ◇ Emergency only':'')+'</summary><ul>'+marked.map(point=>
        '<li>'+esc([seriesLabel(point), point.row.seasonLabel, [...new Set(point.emergencySections)].join(', ')].filter(Boolean).join(' · '))+
        (point.emergencyOnly ? ' · provisional estimate' : ' · excluded from the season rating')+'</li>').join('')+'</ul></details>';
  }

  function skillTable(history) {
    if (!history.length) return '';
    return '<details class="career-skill-record"><summary>Skill ratings by season</summary><div class="table-wrap"><table><thead><tr><th scope="col">Season</th><th scope="col">Competition</th><th scope="col">Sections</th><th scope="col">Matches</th><th scope="col">Skill</th></tr></thead><tbody>' +
      [...history].reverse().map(point => '<tr><td>' + esc(point.row.seasonLabel) + '</td><td>' + esc(ladderLabel(point)) +
        '</td><td>' + esc(point.sections.map(section => section.label).join(', ')) + '</td><td>' + point.count +
        '</td><td><b>' + point.rating + '</b>' + (point.emergencyOnly ? ' <small>Emergency only · provisional</small>' : point.count < 5 ? ' <small>Provisional</small>' : '') + '</td></tr>').join('') + '</tbody></table></div></details>';
  }

  function draw(panel, matches, scale) {
    const seasons = seasonRecords(matches.map(match => ({row: match.entry, matches: [match]})));
    panel.innerHTML = '<p>Each dot estimates playing skill for a season in one competition, including Green Ball and Rubbers. Compare points within the same competition.</p>' +
      '<div class="skill-expanded-controls">'+disciplineButtons('overall','data-career-discipline')+
      '<button type="button" class="button secondary" data-career-expand>Expand skill graph</button></div>' +
      '<div data-career-chart class="career99-chart"></div><div data-career-skill-table></div>' +
      '<details><summary>How skill is estimated</summary><p>' + skillMethod + ' A rating based on fewer than five matches is provisional. ' +
        'Emergency matches are excluded when regular results are available. An emergency-only season appears as a separate provisional point.</p></details>' +
      '<h4>Best seasons</h4><p>Rate awards require at least five matches. Each competition season is assessed separately.</p><div class="career99-awards">' +
      (seasonAwards(seasons).map(award => '<article><span>' + award.label + '</span><strong>' +
        (['winRate','gameShare'].includes(award.field) ? percent(award.value) : award.value) +
        '</strong><small>' + award.records.map(season => esc(label(season.row))).join(' / ') + '</small></article>').join('') ||
        '<p>Season awards will appear when there are recorded matches.</p>') +
      '</div>';
    const chart = panel.querySelector('[data-career-chart]');
    const refresh = discipline => {
      const points = skillHistory(matches,scale,discipline);
      chart.innerHTML = timeline(points);
      panel.querySelector('[data-career-skill-table]').innerHTML = skillTable(points);
      panel.querySelectorAll('[data-career-discipline]').forEach(button=>
        button.setAttribute('aria-pressed',String(button.dataset.careerDiscipline===discipline)));
    };
    panel.querySelectorAll('[data-career-discipline]').forEach(button=>
      button.addEventListener('click',()=>refresh(button.dataset.careerDiscipline)));
    panel.querySelector('[data-career-expand]').addEventListener('click',()=>{
      let discipline=panel.querySelector('[data-career-discipline][aria-pressed="true"]').dataset.careerDiscipline;
      let tight=false;
      const sheet=BRTAOverlays.openSheet('Career skill','<div class="skill-expanded-controls">'+
        disciplineButtons(discipline,'data-career-expanded-discipline')+
        '<button type="button" class="button secondary" data-skill-tight aria-pressed="false">Tighter Y-axis</button></div>'+
        '<div class="career99-chart" data-career-expanded-chart></div>',{className:'skill-expanded-dialog'});
      const render=()=>{
        sheet.querySelector('[data-career-expanded-chart]').innerHTML=timeline(skillHistory(matches,scale,discipline),{zoom:true,tight});
        sheet.querySelectorAll('[data-career-expanded-discipline]').forEach(button=>
          button.setAttribute('aria-pressed',String(button.dataset.careerExpandedDiscipline===discipline)));
      };
      sheet.addEventListener('click',event=>{
        const scaleButton=event.target.closest('[data-skill-tight]');
        const disciplineButton=event.target.closest('[data-career-expanded-discipline]');
        if(!scaleButton&&!disciplineButton)return;
        if(scaleButton){
          tight=!tight;
          scaleButton.setAttribute('aria-pressed',String(tight));
        }else discipline=disciplineButton.dataset.careerExpandedDiscipline;
        render();
      });
      render();
    });
    refresh('overall');
  }

  root.BRTACareerTimeline = {...career, chart:timeline, render:draw, colour, disciplineButtons};
})(typeof window === 'undefined' ? globalThis : window);
/* BRTA Power Ratings 9.9g */
