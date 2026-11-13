(function () {
  'use strict';
  let foundation;
  const maps = new WeakMap();
  const points = venue => venue?.coordinates;
  const address = venue => venue?.address_lines?.join(', ') || '';
  const published = fixture => !String(fixture.fixtureId).startsWith('custom:') && !fixture.simulated;
  function load() {
    return foundation ||= fetch('data/current/club-foundation.json').then(response => {
      if (!response.ok) throw Error('Club locations are unavailable.');
      return response.json();
    }).then(network => ({ network, directory: BRTAClubData.directory(network) })).catch(error => {
      foundation = null;
      throw error;
    });
  }
  function directions(label, venue) {
    const location = points(venue);
    const query = address(venue) || (location ? location.latitude + ',' + location.longitude : '');
    if (!query) return '<small>Location unavailable</small>';
    return '<a href="https://www.google.com/maps/search/?api=1&amp;query=' + encodeURIComponent(query) +
      '" target="_blank" rel="noopener noreferrer">' + esc(label) + ' ↗</a>';
  }

  function html(fixture) {
    if (!published(fixture)) return '';
    const date = roundDate(fixture.date), venue = fixture.venue || 'Venue not published';
    const time = fixture.startTime ? String(fixture.startTime).replace(/^(\d{1,2}):(\d\d)$/, (_, hour, minute) =>
      (Number(hour) % 12 || 12) + ':' + minute + (Number(hour) >= 12 ? ' pm' : ' am')) : '';
    return '<section class="fixture-logistics" data-fixture-logistics="' + esc(fixture.fixtureId) + '"><h3>Fixture details</h3>' +
      '<div class="fixture-logistics-grid"><div><span>Home</span><b>' + teamName(fixture.home) + '</b></div>' +
      '<div><span>Away</span><b>' + teamName(fixture.away) + '</b></div>' +
      '<div><span>Date and time</span><b>' + esc([date, time].filter(Boolean).join(' · ') || 'Not published') +
      '</b></div><div><span>Playing venue</span><b>' + esc(venue) + '</b><small data-venue-side="fixture"></small></div></div>' +
      (fixture.status === 'Scheduled' ? '<div class="fixture-logistics-actions"><button class="button secondary" type="button" data-blank-scorecard="' +
        esc(fixture.fixtureId) + '">Print blank scorecard</button></div>' : '') + (window.BRTAFinalsRace?.hint(fixture) || '') + '</section>';
  }

  async function hydrate(fixture, host) {
    const target = host.querySelector('[data-fixture-logistics]');
    if (!target || D.meta.is_custom) return;
    const meta = D.meta;
    try {
      const { network, directory } = await BRTAActivity.run('Loading fixture venue', async task => {
        task.stage(30, 'Reading the club directory…');
        return load();
      }, { key: 'fixture-venue' });
      if (!target.isConnected) return;
      function homeVenue(team) {
        const club = directory.clubs.get(directory.resolve(team, meta, clubBaseName(team)));
        return directory.venues.get(club?.main_venue_id);
      }
      const home = homeVenue(fixture.home);
      const assignment = network.venue_assignments.find(row => row.fixture_id === fixture.fixtureId &&
        row.source?.season_id === meta.season_id) || network.venue_assignments.find(row => row.scope === 'fixture' &&
        row.source?.season_id === meta.season_id && row.source?.section_code === meta.section_code &&
        String(row.round) === String(fixture.round) && row.home_team === fixture.home);
      const venueKey = BRTAClubData.key(fixture.venue);
      const isHome = venueKey && [fixture.home, clubBaseName(fixture.home)].some(name => BRTAClubData.key(name) === venueKey);
      const location = directory.venues.get(assignment?.resolved_venue_id) ||
        (isHome ? home : fixture.venue ? homeVenue(fixture.venue) : null);
      const locations = location ? [{ id: 'fixture', name: fixture.venue, venue: location }] : [];
      const markers = locations.filter(item => BRTAClubMap.inside(points(item.venue))).map(item => ({
        id: item.id, name: item.name, coordinates: points(item.venue), group: 'section'
      }));
      if (markers.length) {
        target.insertAdjacentHTML('beforeend', '<details><summary>Venue map</summary><div class="fixture-logistics-map" aria-label="Fixture and club map"></div><small role="status"></small></details>');
        const details = target.lastElementChild;
        details.addEventListener('toggle', async () => {
          maps.get(target)?.abort();
          if (!details.open) return;
          const controller = new AbortController();
          maps.set(target, controller);
          const status = details.querySelector('[role=status]');
          try {
            await BRTAActivity.run('Loading venue map', async task => {
              task.stage(35, 'Opening the map…');
              const map = await BRTAClubMap.mountNetwork(details.querySelector('.fixture-logistics-map'), markers, () => {}, {
              signal: controller.signal, selectedId: 'fixture',
              onTileError: () => { status.textContent = 'Map tiles are unavailable. The venue pins may still be visible.'; }
              });
              await map.ready;
            }, { key: 'fixture-map' });
          } catch (error) {
            if (error.name !== 'AbortError') status.textContent = 'The map could not load. Use the club or venue map links above.';
          }
        });
      }
      target.querySelector('[data-venue-side="fixture"]').innerHTML =
        (address(location) ? '<span>' + esc(address(location)) + '</span>' : '') + directions('Directions', location);
    } catch {
      for (const node of target.querySelectorAll('[data-venue-side]')) node.textContent = 'Location unavailable';
    }
  }

  function scorecard(fixture) {
    const rules = BRTALineups.rules(D);
    const rows = Object.entries({ Singles: rules.singles, Doubles: rules.doubles }).flatMap(([label, count]) =>
      Array.from({ length: count }, (_, index) => '<tr><th>' + label + ' ' + (index + 1) + '</th><td></td><td></td><td></td></tr>')).join('');
    const content = '<div class="blank-scorecard"><h2>' + esc(fixture.home + ' v ' + fixture.away) + '</h2><p>' +
      esc([D.meta.section_label, roundHeading(fixture), roundDate(fixture.date), fixture.startTime, fixture.venue].filter(Boolean).join(' · ')) +
      '</p><table><thead><tr><th>Match</th><th>' + esc(fixture.home) + '</th><th>' + esc(fixture.away) +
      '</th><th>Set scores</th></tr></thead><tbody>' + rows + '</tbody></table><p>Team totals ________________________</p>' +
      '<button class="button primary" type="button" data-print-scorecard>Print</button></div>';
    BRTA82.modal('Blank scorecard', content, true);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-blank-scorecard]');
    if (button) {
      const fixture = fixtureById(button.dataset.blankScorecard);
      if (fixture) scorecard(fixture);
    }
    if (event.target.closest('[data-print-scorecard]')) window.print();
  });
  window.BRTAFixtureDetails = { html, hydrate, closeMap(id) {
    for (const target of $(id)?.querySelectorAll('[data-fixture-logistics]') || []) maps.get(target)?.abort();
  } };
})();
