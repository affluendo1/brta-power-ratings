window.BRTASkillComparison = (() => {
  'use strict';
  const storageKey = 'brta-skill-presets-v1';
  const disciplines = {overall:'All matches', singles:'Singles', doubles:'Doubles'};
  const newGraph = () => ({title:'', discipline:'overall', from:'', to:'', players:[]});
  const codeLabel = code => competitionLabel(code).split(' - ')[0];
  const pointDate = point => new Date(point.date).toISOString().slice(0,10);
  const option = (value, title, selected) => '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(title) + '</option>';
  const control = (label, action, extra = '') => '<button class="button secondary" type="button" data-skill-action="' + action + '" ' + extra + '>' + label + '</button>';

  function setup(host, {careers, section, load}) {
    let competition = '', scope = 'section', revision = 0, graphs = [newGraph()], shared = true;
    let selectedPreset = '', presetName = '', presets;
    const histories = new Map(), candidatesByGraph = new WeakMap();
    try { presets = JSON.parse(localStorage.getItem(storageKey)) || {}; }
    catch { presets = {}; }
    if (!presets || typeof presets !== 'object' || Array.isArray(presets)) presets = {};
    presets = Object.fromEntries(Object.entries(presets).filter(([id,item]) => id.startsWith('preset-') &&
      item?.id===id && typeof item.name==='string' && Array.isArray(item.graphs) && item.graphs.length &&
      item.graphs.every(graph => Array.isArray(graph?.players))));
    function savePresets() {
      try { localStorage.setItem(storageKey, JSON.stringify(presets)); }
      catch { inform('Could not save this preset on this device.'); return false; }
      return true;
    }
    const inform = text => { host.querySelector('[data-skill-status]').textContent = text; };
    const competitions = () => [...new Set((DATA.catalog || []).map(row => row.competition_code))].filter(Boolean);
    function initialise() {
      if (competition) return;
      const selected = section()?.competition_code;
      competition = competitions().includes(selected) ? selected : competitions()[0] || '';
      if (competition !== selected) scope = 'competition';
    }
    const key = player => JSON.stringify([competition, player.id]);
    function graphCard(graph, i) {
      return '<article class="skill-comparison-graph" data-skill-graph="' + i + '"><header>' +
        '<label>Graph title<input data-skill-field="title" maxlength="80" value="' + esc(graph.title) + '" placeholder="Graph ' + (i+1) + '"></label>' +
        (graphs.length > 1 ? control('Remove graph','remove-graph') : '') + '</header><div class="career99-filters">' +
        '<label>Discipline<select data-skill-field="discipline">' + Object.entries(disciplines).map(([v, text]) => option(v,text,graph.discipline===v)).join('') + '</select></label>' +
        '<label>From<input type="date" data-skill-field="from" value="' + esc(graph.from) + '"></label>' +
        '<label>To<input type="date" data-skill-field="to" value="' + esc(graph.to) + '"></label></div>' +
        '<div class="skill-player-picker"><label>Add a player<input type="search" autocomplete="off" data-skill-search placeholder="Search by name"></label>' +
        '<div data-skill-candidates role="region" aria-label="Matching players"></div></div>' +
        '<ul class="skill-selected">' + graph.players.map((player,j) => '<li>' + esc(player.name) + control('×','remove-player',
          'data-skill-player="' + j + '" aria-label="Remove ' + esc(player.name) + '"') + '</li>').join('') + '</ul>' +
        '<div class="career99-chart" data-skill-plot></div><p class="skill-point-detail" data-skill-point-detail aria-live="polite"></p><div data-skill-values></div></article>';
    }
    function draw() {
      initialise();
      revision++;
      host.innerHTML = '<div class="skill-workspace-head"><h2>Compare career skill</h2><p>Compare players’ histories in one competition.</p></div>' +
        '<div class="career99-filters skill-workspace-filters"><label>Competition<select data-skill-competition>' +
        competitions().map(code => option(code, codeLabel(code), code === competition)).join('') + '</select></label>' +
        '<label>Player search<select data-skill-scope>' + (section()?.competition_code===competition ? option('section','Selected section',scope==='section') : '') +
        option('competition','Whole competition',scope==='competition') + '</select></label>' +
        '<label><input type="checkbox" data-skill-shared' + (shared ? ' checked' : '') + '> Same scale on every graph</label>' +
        control('Add graph','add-graph') + '</div><div class="career99-filters skill-presets">' +
        '<label>Preset title<input data-skill-preset-name maxlength="80" value="' + esc(presetName) + '" placeholder="Name a preset"></label>' +
        control('Save preset','save-preset') + '<label>Saved presets<select data-skill-presets>' + option('','Choose preset',!selectedPreset) +
        Object.values(presets).sort((a,b) => String(a.name).localeCompare(String(b.name))).map(item => option(item.id,item.name,item.id===selectedPreset)).join('') +
        '</select></label>' + control('Load preset','load-preset') + control('Delete preset','delete-preset') + '</div>' +
        '<p role="status" data-skill-status></p><div class="skill-graph-list">' + graphs.map(graphCard).join('') + '</div>';
      drawPlots();
    }
    function visiblePoints(graph) {
      return graph.players.flatMap(player => {
        const data = histories.get(key(player))?.data;
        if (!data) return [];
        return BRTACareerTimeline.skillHistory(data.matches, undefined, graph.discipline)
          .filter(point => Number.isFinite(point.date) && (!graph.from || pointDate(point) >= graph.from) && (!graph.to || pointDate(point) <= graph.to))
          .map(point => ({...point, name:player.name, id:player.id}));
      });
    }
    function drawPlots() {
      const points = graphs.map(visiblePoints);
      const axes = shared ? points.flat() : null;
      for (const node of host.querySelectorAll('[data-skill-graph]')) {
        const i = Number(node.dataset.skillGraph), graph = graphs[i], own = points[i];
        const plot = node.querySelector('[data-skill-plot]');
        const pending = graph.players.some(player => histories.get(key(player))?.pending);
        const unavailable = graph.players.some(player => histories.get(key(player))?.data?.unavailable);
        const missingPlayer = graph.players.some(player =>
          histories.get(key(player))?.data && !own.some(point => point.id === player.id));
        if (graph.from && graph.to && graph.from > graph.to) plot.innerHTML = '<p>Choose an end date on or after the start date.</p>';
        else if (own.length) plot.innerHTML = BRTACareerTimeline.chart(own, {axes,seriesKey:point=>point.id,seriesLabel:point=>point.name});
        else plot.innerHTML = '<p>' + (pending ? 'Loading match histories…' : graph.players.length ?
          'No dated skill ratings in this range.' : 'Add players to plot their season ratings.') + '</p>';
        if (pending && own.length) plot.insertAdjacentHTML('beforeend','<p role="status">Loading more histories…</p>');
        if (unavailable) plot.insertAdjacentHTML('beforeend', '<p role="status">Some section records could not be loaded. ' + control('Retry','retry') + '</p>');
        if (!pending && missingPlayer && own.length)
          plot.insertAdjacentHTML('beforeend','<p>Some selected players have no ratings for these filters.</p>');
        node.querySelector('[data-skill-values]').innerHTML = own.length ?
          '<details><summary>View plotted values</summary><div class="table-wrap"><table><thead><tr><th>Player</th><th>Season</th><th>Skill</th><th>Matches</th></tr></thead><tbody>' +
          own.map(point => '<tr><td>' + esc(point.name) + '</td><td>' + esc(point.row.seasonLabel) +
            '</td><td>' + point.rating + (point.count < 5 ? ' (provisional)' : '') + '</td><td>' + point.count + '</td></tr>').join('') +
          '</tbody></table></div></details>' : '';
      }
    }
    function ensure(player) {
      const comp = competition, cacheKey = key(player);
      if (histories.has(cacheKey)) return;
      const entry = {pending:true};
      histories.set(cacheKey,entry);
      load(player,comp).then(data => { entry.data = data; })
        .catch(() => { entry.data = {matches:[],unavailable:1}; })
        .finally(() => { entry.pending = false; if (comp === competition) drawPlots(); });
    }
    function sameSection(row, context) {
      if (!context || context.competition_code !== competition || row.sectionCode !== context.section_code) return false;
      return context.is_archive ? row.seasonLabel === context.season_label : row.isCurrent;
    }
    let searchGeneration = 0;
    const searchByGraph = new WeakMap();
    async function search(field) {
      const generation = searchGeneration;
      const query = field.value.trim(), graphNode = field.closest('[data-skill-graph]');
      const target = graphNode.querySelector('[data-skill-candidates]');
      const token = {};
      searchByGraph.set(graphNode,token);
      if (query.length < 2) { target.replaceChildren(); return; }
      const version = revision;
      const stillHere = () => version===revision && generation===searchGeneration && searchByGraph.get(graphNode)===token && field.value.trim()===query && field.isConnected;
      target.textContent = 'Searching…';
      try {
        const model = await careers();
        if (!stillHere()) return;
        const context = section();
        const strict = scope==='section' && context?.competition_code===competition;
        const allowed = row => row.competitionCode===competition && (!strict || sameSection(row,context));
        const select = people => people.filter(person => person.rows.some(allowed) &&
          !graphs[Number(graphNode.dataset.skillGraph)].players.some(player=>player.id===person.id));
        let candidates = select(model.find(query));
        if (!candidates.length) candidates = select(model.find(query,true));
        candidates = candidates.slice(0,12);
        candidatesByGraph.set(graphNode,candidates);
        target.innerHTML = candidates.length ? candidates.map((person,i) => {
          const row = person.rows.find(allowed);
          return control(esc(row.player) + '<small>' + esc([row.team,row.sectionLabel,row.seasonLabel].filter(Boolean).join(' · ')) + '</small>',
            'select-player','data-candidate="' + i + '"');
        }).join('') : '<p>No players found in this search scope.</p>';
      } catch { if (stillHere()) target.textContent = 'The player directory could not be loaded.'; }
    }
    function storePreset() {
      const name = presetName.trim();
      if (!name) { inform('Enter a title for this preset.'); return; }
      const existing = Object.values(presets).find(item => item.name === name);
      if (existing && selectedPreset !== existing.id && !confirm('Replace the preset “' + name + '”?')) return;
      const id = existing?.id || ('preset-' + (crypto.randomUUID?.() || Date.now()));
      presets[id] = {id,name,competition,scope,shared,graphs:structuredClone(graphs)};
      selectedPreset = id;
      draw();
      if (savePresets()) inform('Saved ' + name + '.');
    }
    host.addEventListener('input', event => {
      const field = event.target;
      if (field.matches('[data-skill-search]')) void search(field);
      if (field.matches('[data-skill-preset-name]')) presetName = field.value;
      if (field.dataset.skillField === 'title')
        graphs[Number(field.closest('[data-skill-graph]').dataset.skillGraph)].title = field.value;
    });
    host.addEventListener('change', event => {
      const field = event.target;
      if (field.matches('[data-skill-competition]')) {
        competition = field.value;
        scope = section()?.competition_code === competition ? 'section' : 'competition';
        graphs = graphs.map(graph => ({...graph, players:[]}));
        draw();
        host.querySelector('[data-skill-competition]').focus();
        return;
      }
      if (field.matches('[data-skill-scope]')) {
        scope = field.value;
        host.querySelectorAll('[data-skill-search]').forEach(input => { input.value=''; input.parentElement.nextElementSibling.replaceChildren(); });
        ++searchGeneration;
      }
      if (field.matches('[data-skill-shared]')) { shared = field.checked; drawPlots(); }
      if (field.matches('[data-skill-presets]')) selectedPreset = field.value;
      const node = field.closest('[data-skill-graph]');
      if (node && field.dataset.skillField) {
        graphs[Number(node.dataset.skillGraph)][field.dataset.skillField] = field.value;
        drawPlots();
      }
    });
    host.addEventListener('click', event => {
      const button = event.target.closest('[data-skill-action]');
      if (!button) return;
      const action = button.dataset.skillAction;
      const node = button.closest('[data-skill-graph]'), i = Number(node?.dataset.skillGraph), graph = graphs[i];
      if (action === 'add-graph') { graphs.push(newGraph()); draw(); host.querySelector('[data-skill-graph="' + (graphs.length-1) + '"] input').focus(); }
      if (action === 'remove-graph' && graphs.length > 1) { graphs.splice(i,1); draw(); host.querySelector('[data-skill-action="add-graph"]').focus(); }
      if (action === 'select-player') {
        const found = candidatesByGraph.get(node)?.[Number(button.dataset.candidate)];
        const row = found?.rows.find(row => row.competitionCode===competition &&
          (scope!=='section' || section()?.competition_code!==competition || sameSection(row,section())));
        if (!row || graph.players.some(player=>player.id===found.id)) return;
        const player = {id:found.id, name:row.player, anchor:row};
        graph.players.push(player);
        ensure(player);
        draw();
        host.querySelector('[data-skill-graph="' + i + '"] [data-skill-search]').focus();
      }
      if (action === 'remove-player') { graph.players.splice(Number(button.dataset.skillPlayer),1); draw();
        host.querySelector('[data-skill-graph="' + i + '"] [data-skill-search]').focus(); }
      if (action === 'retry') { graph.players.forEach(player => {
        if (histories.get(key(player))?.data?.unavailable) { histories.delete(key(player)); ensure(player); }
      }); drawPlots(); }
      if (action === 'save-preset') storePreset();
      if (action === 'load-preset') {
        const preset = presets[selectedPreset];
        if (!preset) { inform('Choose a saved preset.'); return; }
        if (!competitions().includes(preset.competition)) { inform('This competition is unavailable.'); return; }
        ({competition,scope,shared} = preset);
        if (scope==='section' && section()?.competition_code!==competition) scope='competition';
        presetName = preset.name;
        graphs = structuredClone(preset.graphs);
        graphs.flatMap(graph => graph.players).forEach(ensure);
        draw();
        inform('Loaded ' + preset.name + '.');
      }
      if (action === 'delete-preset') {
        const preset = presets[selectedPreset];
        if (!preset) { inform('Choose a saved preset.'); return; }
        if (!confirm('Delete the preset “' + preset.name + '”?')) return;
        delete presets[selectedPreset];
        selectedPreset = '';
        draw();
        if (savePresets()) inform('Preset deleted.');
      }
    });
    function showPoint(event) {
      const point = event.target.closest?.('[data-skill-point]');
      if (point) point.closest('[data-skill-graph]').querySelector('[data-skill-point-detail]').textContent = point.dataset.skillPoint;
    }
    host.addEventListener('focusin',showPoint);
    host.addEventListener('pointerover',showPoint);
    host.addEventListener('click',showPoint);
    return {
      draw() { if (!host.hasChildNodes()) draw(); },
      contextChanged() {
        if (!host.hasChildNodes()) return;
        if (scope==='section' && section()?.competition_code!==competition) { scope='competition'; draw(); return; }
        ++searchGeneration;
        host.querySelectorAll('[data-skill-candidates]').forEach(el => el.replaceChildren());
      }
    };
  }
  return {setup};
})();
