window.BRTARatingControls = {
  searchIcon: '<svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  setup(page) {
    const tabs = page.querySelector('#ratingTabs');
    const filters = page.querySelector('#ratingFilters');
    const search = page.querySelector('#search');
    const team = page.querySelector('#teamFilter');
    const pairs = tabs.querySelector('[data-rating="pairs"]');
    const individual = tabs.querySelector('[data-rating="doublesPlayers"]');
    const overall = tabs.querySelector('[data-rating="overall"]');
    const round = document.createElement('select');
    round.id = 'playersRatingRound';
    const teamLabel = document.createElement('label');
    teamLabel.textContent = 'Team';
    teamLabel.append(team);
    const roundLabel = document.createElement('label');
    roundLabel.textContent = 'Rating snapshot';
    roundLabel.append(round);
    filters.replaceChildren(roundLabel);
    const searchRow = document.createElement('div');
    searchRow.className = 'players-rating-search';
    const searchLabel = document.createElement('label');
    searchLabel.className = 'players-search-input';
    searchLabel.innerHTML = '<span>Search section ratings</span><span class="players-search-control">' + BRTARatingControls.searchIcon + '</span>';
    search.placeholder = 'Search player or pair';
    search.setAttribute('aria-label', 'Search section ratings');
    searchLabel.lastElementChild.append(search);
    searchRow.append(searchLabel, teamLabel);
    page.querySelector('#bandInfo').after(searchRow);

    const doubles = document.createElement('div');
    doubles.className = 'players-doubles';
    doubles.innerHTML = '<button type="button" class="subtab" aria-expanded="false" aria-controls="playersDoublesChoices">Doubles <span aria-hidden="true">▾</span></button><div id="playersDoublesChoices" hidden></div>';
    const toggle = doubles.firstElementChild;
    const choices = doubles.lastElementChild;
    pairs.textContent = 'Pairs';
    individual.textContent = 'Individual';
    overall.before(doubles);
    choices.append(pairs, individual);
    const info = document.createElement('button');
    info.type = 'button';
    info.className = 'subtab players-description-button';
    info.textContent = 'Description';
    info.setAttribute('aria-expanded', 'false');
    info.setAttribute('aria-controls', 'playersRatingDescription');
    tabs.append(info);
    const description = document.createElement('section');
    description.id = 'playersRatingDescription';
    description.hidden = true;
    description.innerHTML = '<h2>How the ratings work</h2><div class="players-explain-grid">' +
      '<article><h3>Power</h3><p>A rating summarises performance against opponents in this section. It responds to the score and who was on the other side of the court.</p></article>' +
      '<article><h3>Pick a discipline</h3><p>Singles rates individual players. Doubles pairs rates a particular partnership. Individual doubles estimates each player’s contribution. Overall combines individual singles and doubles evidence where available.</p></article>' +
      '<article><h3>Read the ladder</h3><p>Performance bands group ratings within the section. Provisional players are still building a record. If shown, ± indicates model uncertainty.</p></article>' +
      '<article><h3>Rewind a round</h3><p>Use Rating snapshot to view the ladder after a published round. Tap a name to explore the matches and graphs behind the rating in Player Lab.</p></article></div>' +
      '<p class="career-footnote">Power is calculated separately for each section. To follow a player across sections, use Players.</p>';
    page.querySelector('.ratings-toolbar').after(description);

    toggle.onclick = () => {
      choices.hidden = !choices.hidden;
      toggle.setAttribute('aria-expanded', String(!choices.hidden));
    };
    const normal = () => {
      description.hidden = true;
      page.classList.remove('show-rating-description');
      info.setAttribute('aria-expanded', 'false');
    };
    tabs.addEventListener('click', event => {
      if (event.target.closest('[data-rating]')) {
        normal();
        choices.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    doubles.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !choices.hidden) {
        choices.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
    info.onclick = () => {
      if (!description.hidden) return normal();
      renderRatingOptions();
      const help = document.querySelector('#searchCommandHelp');
      if (help) description.append(help);
      description.hidden = false;
      page.classList.add('show-rating-description');
      info.setAttribute('aria-expanded', 'true');
    };
    round.onchange = () => selectRatingRound(round.value);
    let lastKey;
    return {
      sync() {
        toggle.disabled = pairs.disabled && individual.disabled;
        toggle.classList.toggle('active', ratingView === 'pairs' || ratingView === 'doublesPlayers');
        if (toggle.disabled && !choices.hidden) {
          choices.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
        }
        const options = BRTAHistory.rounds(D, ratingView).slice().sort((a, b) => b.round - a.round);
        const key = JSON.stringify(options.map(x => [x.round, ratingRoundLabel(x.round)]));
        if (key !== lastKey) {
          lastKey = key;
          round.innerHTML = '<option value="latest">Latest ratings</option>' +
            options.map(x => '<option value="' + Number(x.round) + '">' + esc(ratingRoundLabel(x.round)) + '</option>').join('');
        }
        round.value = ratingRound == null ? 'latest' : String(ratingRound);
        if (!round.value) round.value = 'latest';
      }
    };
  }
};
