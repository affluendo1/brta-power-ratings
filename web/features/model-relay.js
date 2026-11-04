/* 8.5.2.2: a private, entirely local model-to-model misunderstanding. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root || typeof root.addEventListener !== 'function' || !root.document) return;

  let started = false;
  const record = { packet: null, scrambled: null, transcript: [], done: false };
  // Console-only inspection; this does not alter predictions or render anything.
  root.BRTAHiddenRelay = Object.freeze({ inspect: () => ({
    packet: record.packet, scrambled: record.scrambled,
    transcript: record.transcript.map(line => ({ ...line })), done: record.done
  }) });

  async function topOverallRating() {
    const wanted = (typeof layoutDefaultCode === 'function' && layoutDefaultCode()) ||
      root.localStorage?.getItem('brta-section') || root.DATA?.defaultSectionCode;
    let section = typeof D === 'undefined' ? null : D;
    if (!section || section.meta?.section_code !== wanted) {
      const catalogue = typeof currentCatalog === 'function' ? currentCatalog() : (root.DATA?.catalog || []);
      const meta = catalogue.find(row => row.section_code === wanted);
      if (!meta) return 0;
      try {
        const original = meta.is_custom ? root.CustomSections?.payload(wanted) :
          await root.fetch(meta.data_path || ('data/site/sections/' + encodeURIComponent(wanted) + '.json')).then(r => {
            if (!r.ok) throw Error('Section unavailable');
            return r.json();
          });
        section = typeof layoutApplyModel === 'function' ? await layoutApplyModel(original) : original;
      } catch (_) { return 0; }
    }
    if (section.meta?.singlesOnly) return 0;
    let list;
    if (typeof D !== 'undefined' && section === D && typeof overallData === 'function') {
      list = overallData();
    } else {
      const singles = new Map((section.singles || []).map(row => [row.player, row]));
      const doubles = new Map((section.doublesIndividuals || []).map(row => [row.player, row]));
      list = [...new Set([...singles.keys(), ...doubles.keys()])].map(name => {
        const s = singles.get(name), d = doubles.get(name);
        return {rating: s && d ? Math.round((s.rating + d.rating) / 2) : (s?.rating ?? d?.rating),
          qualified: !!(s && s.matches >= 4 && d && d.qualified)};
      }).sort((a, b) => b.rating - a.rating);
    }
    const top = list.find(row => row.qualified && Number.isFinite(row.rating)) ||
      list.find(row => Number.isFinite(row.rating));
    return top ? Math.max(0, Math.round(top.rating)) : 0;
  }

  async function launch() {
    if (started) return;
    started = true;
    const release = root.BRTA_RELEASES?.[0];
    const version = /^\d+(?:\.\d+)+$/.test(String(release?.version || '')) ? release.version : '8.5.2.2';
    const hours = Number.isFinite(Date.parse(release?.committedAt)) ?
      Math.max(0, Math.round((Date.now() - Date.parse(release.committedAt)) / 3600000)) : 0;
    const rating = await topOverallRating();
    const trophies = Array.isArray(root.BRTA_DEEDS) ? root.BRTA_DEEDS.length : 0;
    const packet = api.packet(version, hours, rating, trophies);
    record.packet = packet;
    root.console?.info?.('[RM1000]', api.versionSum(version));
    const result = await api.perform(packet, {
      pause: ms => new Promise(resolve => root.setTimeout(resolve, ms)),
      onEvent: event => { record.transcript.push(event); if (event.scrambled) record.scrambled = event.scrambled; },
      melody: value => root.BRTAOrchestra?.Melody?.receive?.(value)
    });
    record.done = result.discarded;
  }
  root.addEventListener('brta-section-ready', launch, { once: true });
  // A section may be unavailable offline; don't let this novelty affect startup.
  root.setTimeout(launch, 8000);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const versionSum = version => String(version).split('.').reduce((sum, part) => sum + (Number(part) || 0), 0);
  const packet = (version, hours, overall, trophies) =>
    [versionSum(version), hours, overall, trophies].map(n => String(Math.max(0, Math.round(Number(n) || 0)))).join('.');
  const scramble = value => {
    const pieces = String(value).split('.');
    if (pieces.length !== 4 || pieces.some(p => !/^\d+$/.test(p))) throw Error('Invalid secret packet');
    return [pieces[3], pieces[1], pieces[0], pieces[2]].map(x => [...x].reverse().join('')).join('~');
  };
  const decipher = value => {
    const pieces = String(value).split('~');
    if (pieces.length !== 4 || pieces.some(p => !/^\d+$/.test(p))) throw Error('Invalid scrambled packet');
    return [pieces[2], pieces[1], pieces[3], pieces[0]].map(x => [...x].reverse().join('')).join('.');
  };
  async function perform(message, options = {}) {
    const pause = options.pause || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const emit = (from, text, extra = {}) => {
      const event = Object.freeze({ from, text, ...extra });
      options.onEvent?.(event);
      return event;
    };
    const steps = [];
    const speak = async (from, text, extra, ms = 750) => {
      const e = emit(from, text, extra);
      steps.push(e);
      await pause(ms);
    };
    await speak('RM1000', '', { to: 'RM1', packet: message }, 850); // No accompanying message.
    await speak('RM1', 'Is this a player rating? It has too many dots. [Archaically] W-what? What is this information. Error - Send To Rating Model 2.', { to: 'RM2' }, 1100);
    await speak('RM2', "This isn't information I can use. What even is this? Send to RM3.", { to: 'RM3' }, 900);
    const encoded = scramble(message);
    await speak('RM3b', 'Intercepted before RM3 could receive it. Now for a little rearranging...', { intercepted: 'RM3', to: 'RM4', scrambled: encoded }, 850);
    await speak('RM4', '[REDACTED]. Access denied. Automatically forwarding to the 4.2 series.', { seen: '[REDACTED]', to: '4.2 Orchestra' }, 800);
    await speak('4.2 Orchestra', 'All right, everyone. An unidentified message has arrived at the table.', {}, 650);
    await speak('4.2 Foundation', 'Four fields. Perhaps a historical strength estimate?', {}, 600);
    await speak('RM4.2', 'I can handle unfamiliar match formats, but this is not a match format.', {}, 650);
    await speak('Baton', 'No scoring contract. No valid route. Why is this on our table?', {}, 650);
    await speak('4.2 Melody', 'Hold on. RM3b reversed the digits and rearranged the fields. I can unscramble it.', {}, 750);
    const decoded = decipher(encoded);
    await speak('4.2 Melody', 'It is a version sum, hours since the last update, the top Overall rating and the Developer Deeds trophy count: ' + decoded, { decoded }, 850);
    let response; try { response = options.melody?.(decoded); } catch (_) { response = undefined; }
    await speak('4.2 Melody', response === undefined ? 'I cannot turn this into a rating. Huh? What is this?' : String(response) + ' I cannot use this as a rating.', { accepted: false }, 750);
    await speak('4.2 Orchestra', 'Decision: discard this message. No rating, forecast or ranking changes.', {}, 650);
    await speak('Baton', 'Discarded. End of transmission.', { discarded: true }, 700);
    await speak('RM1000', 'HAHAHAHA! You all fell for it. It was a prank.', { reveal: true }, 0);
    return { discarded: true, decoded, scrambled: encoded, transcript: steps };
  }
  return { versionSum, packet, scramble, decipher, perform };
});
