(function () {
  'use strict';
  const routes = BRTASiteRoutes;
  const base = new URL('.', document.baseURI);
  if (!document.querySelector('base')) {
    const element = document.createElement('base');
    element.href = base.href;
    document.head.prepend(element);
  }
  const redirected = new URLSearchParams(location.search).get('brta-route');
  if (redirected && routes.parse(redirected)) history.replaceState(null, '', new URL(redirected.replace(/^\/+/, ''), base));
  let opening = false, started = false, fixture = null, fixturePage = null, club = null, panel = null, revision = 0;

  function read() {
    const path = location.pathname.slice(base.pathname.length);
    return routes.parse(path);
  }

  function notice(message) {
    $('#statusStrip').querySelector('.route-notice')?.remove();
    const element = document.createElement('p');
    element.className = 'notice route-notice';
    element.setAttribute('role', 'status');
    element.textContent = message;
    $('#statusStrip').append(element);
  }

  const flatten = groups => (groups || []).flatMap(group =>
    (group.fixtures || []).map(row => ({ ...group, fixtures: undefined, ...row })));
  const publishedFixtures = page => {
    const results = flatten(D.results);
    if (page === 'results') return results;
    return [...results, ...flatten(D.upcomingFixtures).filter(row => row.status === 'Scheduled' && !findFixtureResult(row, row.round))];
  };

  function publish(replace = false) {
    if (!started || opening || !D) return;
    const page = fixturePage || activePage;
    const options = { view: ratingView, fixture, club, panel };
    let path = routes.path(D.meta, page, options);
    if (fixture && path && !routes.findFixture(publishedFixtures(page), routes.parse(path).detail)) {
      path = routes.path(D.meta, page, { ...options, fixtureId: true });
    }
    const next = new URL(path, base);
    if (next.pathname === location.pathname && !location.search) return;
    history[replace ? 'replaceState' : 'pushState'](null, '', next);
  }

  async function restore(route) {
    const request = ++revision;
    opening = true;
    fixture = fixturePage = club = panel = null;
    try {
      const catalog = currentCatalog().filter(row => !row.is_custom);
      const matchSection = row => (!route.competition || row.competition_code === route.competition) &&
        routes.sectionMatches(row, route.section);
      let matches = catalog.filter(row => matchSection(row) && (!route.season || routes.sameSeason(row.season_label, route.season)))
        .map(row => ({ row }));
      if (route.season && !matches.length) {
        const historyCatalog = await ensureHistoryCatalog();
        if (request !== revision) return false;
        matches = (historyCatalog?.seasons || []).filter(season => !season.is_current && routes.sameSeason(season.season_label, route.season))
          .flatMap(season => historySeasonSections(season).filter(matchSection).map(row => ({ row, season })));
      }
      if (!route.competition && matches.length > 1) {
        const preferred = matches.filter(match => match.row.competition_code === 'UA');
        if (preferred.length === 1) matches = preferred;
      }
      if (matches.length !== 1) return false;
      const { row, season } = matches[0];
      for (const overlay of $$('.overlay:not(.hidden)')) if (overlay.id) close('#' + overlay.id);
      if (D?.meta?.section_code !== row.section_code || activeHistorySeasonId !== (season?.id ?? null)) {
        viewCatalog = season ? historySeasonSections(season) : currentCatalog();
        activeHistorySeasonId = season?.id ?? null;
        if (!await loadSection(row.section_code, null, null, () => request === revision)) return false;
      }
      if (request !== revision) return false;
      if (route.page === 'ratings') {
        const view = Object.keys(routes.views).find(key => routes.views[key] === route.detail[0]) || 'singles';
        ratingScope = 'section';
        ratingRound = null;
        ratingView = view;
        $$('.subtab[data-rating]').forEach(button => button.classList.toggle('active', button.dataset.rating === view));
        if ($('#search')) $('#search').value = '';
        renderRatings();
      }
      switchPage(route.page);
      if (route.page === 'teams' && route.detail[0]) {
        await window.BRTAClubs?.ready();
        if (request !== revision) return false;
        const target = (D.standings || []).find(row => routes.slug(row.team) === route.detail[0]);
        if (target) {
          club = target.team;
          panel = route.detail[1] || 'overview';
          await window.BRTAClubs?.openTeam(club, panel);
        } else notice('This club link could not be matched in the section.');
      }
      if (route.detail.length && ['fixtures', 'results'].includes(route.page)) {
        const target = routes.findFixture(publishedFixtures(route.page), route.detail);
        if (!target) notice('This link does not identify a unique published fixture.');
        else {
          if (target.status === 'Scheduled') openPrediction(target.fixtureId);
          else openMatch(target.fixtureId);
          fixture = target;
          fixturePage = route.page;
        }
      }
      return true;
    } finally {
      if (request === revision) opening = false;
    }
  }

  window.BRTARouteUI = {
    async start() {
      started = true;
      const route = read();
      if (!route) return false;
      const restored = await restore(route).catch(() => false);
      if (!restored) window.addEventListener('brta-section-ready', () => notice('This section link could not be opened.'), { once: true });
      return restored;
    },
    section() { fixture = fixturePage = club = panel = null; publish(location.pathname === base.pathname); },
    page() {
      if (!fixture && activePage === 'teams' && club) return publish();
      fixture = fixturePage = club = panel = null;
      publish();
    },
    club(name, view) {
      if (activePage !== 'teams') return;
      club = name;
      panel = view;
      publish();
    },
    rating() {
      if (activePage !== 'ratings') return;
      if (!routes.views[ratingView]) this.secret();
      else publish();
    },
    fixture(row, page) {
      if (!row || row.simulated || String(row.fixtureId).startsWith('custom:')) return;
      fixture = row;
      fixturePage = page;
      publish();
    },
    close(id) {
      if (fixture && id === (fixture.status === 'Scheduled' ? '#predictionOverlay' : '#resultOverlay')) {
        fixture = fixturePage = null;
        publish(true);
      }
    },
    secret() {
      if (!opening && location.pathname !== base.pathname) {
        fixture = fixturePage = club = panel = null;
        history.pushState(null, '', base);
      }
    }
  };
  window.addEventListener('popstate', async () => {
    const route = read();
    if (route) {
      if (!await restore(route).catch(() => false) && D) notice('This section link could not be opened.');
    } else {
      revision++;
      opening = true;
      fixture = fixturePage = club = panel = null;
      for (const overlay of $$('.overlay:not(.hidden)')) if (overlay.id) close('#' + overlay.id);
      switchPage('results');
      opening = false;
    }
  });
})();
