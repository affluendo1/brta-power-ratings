(() => {
  'use strict';
  const presets = window.BRTAThemeCalendarPresets;
  const lookup = new Map(presets.map(preset => ['calendar-' + preset.id, preset]));
  const storageKey = 'brta-theme-calendar-enabled';
  const firstDay = Date.UTC(2000, 0, 1);
  const dayLength = 86400000;
  const root = document.documentElement;
  const model = BRTAThemeStudio;
  const style = document.createElement('style');
  style.id = 'themeCalendarStyles';
  document.head.append(style);
  let enabled = localStorage.getItem(storageKey) === '1';

  function todayPreset(now = new Date()) {
    const day = Date.UTC(2000, now.getMonth(), now.getDate());
    return presets[(day - firstDay) / dayLength];
  }
  function currentPreset() {
    return enabled ? todayPreset() : lookup.get(theme);
  }
  function opaque(value) {
    const raw = value.slice(1);
    return '#' + (raw.length <= 4 ? [...raw.slice(0, 3)].map(c => c + c).join('') : raw.slice(0, 6));
  }
  const previousDark = resolvedDark;
  resolvedDark = function () {
    const preset = currentPreset();
    return preset ? model.ink(opaque(preset.colors[0])) === '#ffffff' : previousDark();
  };
  const previousApply = applyTheme;
  applyTheme = function () {
    previousApply();
    const preset = currentPreset();
    if (!preset) {
      style.textContent = '';
      return;
    }
    root.dataset.theme = 'calendar';
    const [bg, primary, muted, panel, text, error, success] = preset.colors.map(opaque);
    const dark = resolvedDark();
    const variables = model.variables({
      kind: 'theme', name: preset.name, radius: 7,
      values: {
        ...model.defaults(dark),
        'page-bg': bg, surface: panel, 'surface-raised': panel, 'surface-muted': panel,
        'text-color': text, 'muted-color': muted, 'border-color': muted,
        'header-bg': bg, 'header-ink': text, 'bad-color': error, 'good-color': success,
      },
    });
    Object.assign(variables, {
      brand: primary, primary, 'primary-ink': model.ink(primary),
      'nav-active': primary, 'nav-active-border': primary, 'nav-active-ink': model.ink(primary),
      'link-color': primary, 'chrome-color': bg,
      'provisional-bg': panel, 'provisional-ink': muted,
      'classic-link': primary, 'classic-edge': muted,
    });
    style.textContent = 'html[data-theme="calendar"]:not([data-ms-void]){' +
      Object.entries(variables).map(([key, value]) => '--' + key + ':' + value + '!important').join(';') + '}';
    if (!root.hasAttribute('data-ms-void')) $('#themeColor').content = bg;
  };

  function refreshStatus() {
    const status = $('#themeCalendarStatus');
    if (!status) return;
    const selected = currentPreset();
    status.textContent = enabled ? 'Today · ' + selected.name
      : selected ? 'Default · ' + selected.name : 'Today · ' + todayPreset().name;
  }
  function addDefaultOption(select) {
    const preset = lookup.get(theme);
    if (!preset) return;
    if (!Array.from(select.options).some(option => option.value === theme)) {
      select.add(new Option(preset.name, theme));
    }
    select.value = theme;
  }
  function renderStudio() {
    const host = $('#themeCalendarControls');
    if (!host) return;
    host.innerHTML = `<label class="setting-row"><b>Theme Calendar</b><input type="checkbox" id="themeCalendarEnabled"></label>
      <p id="themeCalendarStatus" role="status"></p>
      <div class="settings-action-row">
        <label>Calendar preset <select id="themeCalendarPreset" aria-label="Calendar preset"></select></label>
        <button type="button" class="button secondary" id="themeCalendarDefault">Set as default</button>
      </div>`;
    const toggle = $('#themeCalendarEnabled'), select = $('#themeCalendarPreset');
    toggle.checked = enabled;
    const groups = [document.createElement('optgroup'), document.createElement('optgroup')];
    groups[0].label = 'Monkeytype counterparts';
    groups[1].label = 'BRTA editions';
    for (const preset of [...presets].sort((a, b) => a.name.localeCompare(b.name))) {
      groups[preset.source ? 0 : 1].append(new Option(preset.name, 'calendar-' + preset.id));
    }
    select.append(...groups);
    select.value = 'calendar-' + (currentPreset() ?? todayPreset()).id;
    toggle.addEventListener('change', () => {
      enabled = toggle.checked;
      localStorage.setItem(storageKey, enabled ? '1' : '0');
      applyTheme();
      refreshStatus();
    });
    $('#themeCalendarDefault').addEventListener('click', () => {
      if (!lookup.has(select.value)) return;
      enabled = toggle.checked = false;
      localStorage.setItem(storageKey, '0');
      BRTASitePreferences.setTheme(select.value);
      addDefaultOption($('#themeSelect'));
      refreshStatus();
    });
    refreshStatus();
  }
  const previousSettings = openSettings;
  openSettings = function () {
    previousSettings();
    addDefaultOption($('#themeSelect'));
    renderStudio();
  };
  $('#settingsBtn').onclick = openSettings;

  let timer;
  let lastDay = todayPreset().id;
  function watchDate() {
    clearTimeout(timer);
    const now = new Date();
    const day = todayPreset(now).id;
    if (day !== lastDay) {
      lastDay = day;
      if (enabled) applyTheme();
      refreshStatus();
    }
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = setTimeout(watchDate, midnight - now + 100);
  }
  window.addEventListener('focus', watchDate);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) watchDate(); });
  applyTheme();
  watchDate();
})();
