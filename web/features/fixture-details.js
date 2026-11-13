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
      (window.BRTAFinalsRace?.hint(fixture) || '') + '</section>';
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
      if (!target.isConnected || target.closest('.overlay')?.classList.contains('hidden')) return;
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
        target.insertAdjacentHTML('beforeend', '<section><h4>Venue map</h4><div class="fixture-logistics-map" aria-label="Fixture venue map"></div><small role="status"></small></section>');
        const mapSection = target.lastElementChild;
        const mount = async () => {
          const controller = new AbortController();
          maps.set(target, controller);
          const status = mapSection.querySelector('[role=status]');
          try {
            await BRTAActivity.run('Loading venue map', async task => {
              task.stage(35, 'Opening the map…');
              const map = await BRTAClubMap.mountNetwork(mapSection.querySelector('.fixture-logistics-map'), markers, () => {}, {
              signal: controller.signal, selectedId: 'fixture',
              onTileError: () => { status.textContent = 'Map tiles are unavailable. The venue pins may still be visible.'; }
              });
              await map.ready;
            }, { key: 'fixture-map' });
          } catch (error) {
            if (error.name !== 'AbortError') status.textContent = 'The map could not load. Use the club or venue map links above.';
          }
        };
        void mount();
      }
      target.querySelector('[data-venue-side="fixture"]').innerHTML =
        (address(location) ? '<span>' + esc(address(location)) + '</span>' : '') + directions('Directions', location);
    } catch {
      for (const node of target.querySelectorAll('[data-venue-side]')) node.textContent = 'Location unavailable';
    }
  }

  window.BRTAFixtureDetails = { html, hydrate, closeMap(id) {
    for (const target of $(id)?.querySelectorAll('[data-fixture-logistics]') || []) maps.get(target)?.abort();
  } };
})();
