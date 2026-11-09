/* A bounded Leaflet map with OpenFreeMap vector tiles rendered on canvas. */
(function (root) {
  'use strict';
  const bounds = [[-38.7, 144.3], [-37.1, 146.3]];
  const attribution = '<a href="https://openfreemap.org/">OpenFreeMap</a> · ' +
    '<a href="https://openmaptiles.org/">OpenMapTiles</a> · ' +
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  function inside(coordinates) {
    return coordinates && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude) &&
      coordinates.latitude >= bounds[0][0] && coordinates.latitude <= bounds[1][0] &&
      coordinates.longitude >= bounds[0][1] && coordinates.longitude <= bounds[1][1];
  }

  function markers(clubs) {
    return clubs.filter(club => inside(club.coordinates)).map(club => ({
      id: club.id, name: club.name, lat: club.coordinates.latitude, lng: club.coordinates.longitude
    }));
  }

  function script(src) {
    return new Promise((resolve, reject) => {
      const element = document.createElement('script');
      const timeout = setTimeout(() => failed(), 7000);
      element.src = src;
      function failed() {
        clearTimeout(timeout);
        element.remove();
        reject(Error('The map library could not load.'));
      }
      element.onload = () => { clearTimeout(timeout); resolve(); };
      element.onerror = failed;
      document.head.append(element);
    });
  }

  let loading, tileSource;
  function load() {
    if (!loading) loading = (async () => {
      if (!root.L) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'web/vendor/leaflet/leaflet.css';
        document.head.append(css);
        await script('web/vendor/leaflet/leaflet.js');
      }
      if (!root.L.vectorGrid) await script('web/vendor/leaflet/Leaflet.VectorGrid.bundled.js');
      return root.L;
    })().catch(error => { loading = null; throw error; });
    return loading;
  }

  function tiles() {
    if (!tileSource) tileSource = (async () => {
      const response = await fetch('https://tiles.openfreemap.org/planet', { signal: AbortSignal.timeout(4500) });
      if (!response.ok) throw Error('Street tiles unavailable.');
      const source = await response.json();
      if (!source.tiles?.length) throw Error('Street tiles unavailable.');
      return source;
    })().catch(error => { tileSource = null; throw error; });
    return tileSource;
  }

  const area = fillColor => ({ fill: true, fillColor, fillOpacity: 1, stroke: false });
  const line = (color, weight) => ({ color, weight, opacity: .95, fill: false });
  const styles = {
    water: area('#a4cde4'),
    waterway: line('#a4cde4', 1.8),
    landcover: properties => area(properties.class === 'wood' ? '#c5dbc4' : '#dce8ca'),
    landuse: properties => area(properties.class === 'residential' ? '#efece2' : '#e7e7d4'),
    park: area('#cce3c4'),
    building: (properties, zoom) => zoom >= 15 ? area('#ded4c7') : [],
    transportation: (properties, zoom) => {
      const major = ['motorway', 'trunk', 'primary', 'secondary'].includes(properties.class);
      if (zoom < 12 && !major) return [];
      return [line(major ? '#e1bc7d' : '#dad4c8', major ? 4 : 2.7),
        line(major ? '#fff1c0' : '#fffdfa', major ? 2.7 : 1.8)];
    },
    boundary: line('#aaa8a1', .8),
    place: [], housenumber: [], transportation_name: [], water_name: [],
    poi: [], aeroway: [], mountain_peak: [], aerodrome_label: []
  };

  async function mountNetwork(container, clubs, onClubSelect, { signal, onTileError = () => {}, selectedId } = {}) {
    const L = await load();
    if (signal?.aborted || !container.isConnected) throw new DOMException('Map closed before loading.', 'AbortError');
    const map = L.map(container, {
      maxBounds: bounds, maxBoundsViscosity: 1, minZoom: 9, maxZoom: 19,
      worldCopyJump: false, scrollWheelZoom: false
    });
    const points = markers(clubs);
    if (points.length) {
      map.fitBounds(L.latLngBounds(points.map(point => [point.lat, point.lng])).pad(.15), { maxZoom: 15 });
    } else map.fitBounds(bounds);
    L.control.scale({ imperial: false }).addTo(map);
    map.attributionControl.addAttribution(attribution);

    const groups = new Map(clubs.map(club => [club.id, club.group]));
    const colors = { selected: '#b8f4d9', section: '#238271', competition: '#527eaa', history: '#9a8fa9' };
    points.sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
    for (const point of points) {
      const active = point.id === selectedId;
      const group = active ? 'selected' : groups.get(point.id) || 'section';
      const label = document.createElement('span');
      label.textContent = point.name;
      L.circleMarker([point.lat, point.lng], {
        radius: active ? 11 : group === 'section' ? 7 : group === 'competition' ? 5 : 4,
        color: active ? '#286b5e' : '#f8fbf9', fillColor: colors[group],
        fillOpacity: group === 'history' ? .72 : 1, weight: active ? 4 : 1.5
      }).addTo(map).bindTooltip(label, { permanent: active, direction: 'top', offset: [0, -9] })
        .on('click', () => onClubSelect({ id: point.id, name: point.name }));
    }

    let destroyed = false;
    const ready = tiles().then(source => {
      if (destroyed) return;
      const grid = L.vectorGrid.protobuf(source.tiles[0], {
        vectorTileLayerStyles: styles, rendererFactory: L.canvas.tile,
        interactive: false, bounds, noWrap: true, maxNativeZoom: source.maxzoom || 14
      });
      return new Promise(resolve => {
        const timeout = setTimeout(settle, 2200);
        function settle() {
          clearTimeout(timeout);
          grid.off('load', settle);
          signal?.removeEventListener('abort', settle);
          resolve();
        }
        grid.once('load', settle);
        signal?.addEventListener('abort', settle, { once: true });
        grid.on('tileerror', onTileError).addTo(map);
      });
    }).catch(() => { if (!destroyed) onTileError(); });

    const observer = new ResizeObserver(() => {
      if (destroyed) return;
      map.invalidateSize({ pan: false });
      map.setMinZoom(Math.max(9, map.getBoundsZoom(L.latLngBounds(bounds), true)));
    });
    observer.observe(container);
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      signal?.removeEventListener('abort', destroy);
      map.remove();
    }
    signal?.addEventListener('abort', destroy, { once: true });
    return { map, destroy, ready, focusSelected() {
      const point = points.find(item => item.id === selectedId);
      if (point) map.setView([point.lat, point.lng], 17);
    }};
  }

  const api = { bounds, inside, markers, mountNetwork };
  root.BRTAClubMap = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
