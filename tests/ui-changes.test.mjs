import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test, { after, before } from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

let viteServer;
let Header;
let SummaryStats;
let StationForecastGrid;
let getVisibleWeekDays;
let StatusTimeline;
let getAvailabilityBoxClass;
let OperationalStatus;
let SettingsModal;
let StationTrendAnalysis;
let describeReadinessGap;

before(async () => {
  viteServer = await createServer({
    root: process.cwd(),
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  ({ Header } = await viteServer.ssrLoadModule('/components/Header.tsx'));
  ({ SummaryStats } = await viteServer.ssrLoadModule('/components/SummaryStats.tsx'));
  ({ StationForecastGrid, getVisibleWeekDays } = await viteServer.ssrLoadModule('/components/StationForecastGrid.tsx'));
  ({ StatusTimeline } = await viteServer.ssrLoadModule('/components/StatusTimeline.tsx'));
  ({ getAvailabilityBoxClass } = await viteServer.ssrLoadModule('/components/PersonalAvailability.tsx'));
  ({ SettingsModal } = await viteServer.ssrLoadModule('/components/SettingsModal.tsx'));
  ({ StationTrendAnalysis } = await viteServer.ssrLoadModule('/components/StationTrendAnalysis.tsx'));
  ({ describeReadinessGap } = await viteServer.ssrLoadModule('/services/stationTrendUtils.ts'));
  ({ OperationalStatus } = await viteServer.ssrLoadModule('/types.ts'));
});

after(async () => {
  await viteServer?.close();
});

const flattenText = node => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return flattenText(node.children);
};

const renderHeader = props => {
  let component;
  act(() => {
    component = TestRenderer.create(React.createElement(Header, {
      onRefresh: () => {},
      isLoading: false,
      personalStatus: 2,
      ...props,
    }));
  });
  const text = flattenText(component.toJSON());
  act(() => component.unmount());
  return text;
};

const createWeekForecast = (weekStart = new Date(2026, 7, 19)) => Array.from({ length: 168 }, (_, hour) => {
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + Math.floor(hour / 24));
  const startHour = hour % 24;
  return {
    date,
    startHour,
    endHour: (startHour + 1) % 24,
    label: `${String(startHour).padStart(2, '0')}:00`,
    status: hour % 3 === 0 ? OperationalStatus.GREEN : OperationalStatus.ORANGE,
    totalCount: (hour % 8) + 1,
  };
});

test('the offline banner is visible only while the browser is offline', () => {
  const savedAt = new Date(2026, 7, 19, 14, 0);

  const onlineText = renderHeader({
    isOffline: false,
    isCachedData: false,
    status: OperationalStatus.GREEN,
    lastUpdated: savedAt,
  });
  const offlineLoadedText = renderHeader({
    isOffline: true,
    isCachedData: false,
    status: OperationalStatus.GREEN,
    lastUpdated: savedAt,
  });
  const offlineEmptyText = renderHeader({ isOffline: true });

  assert.doesNotMatch(onlineText, /Offline/);
  assert.match(offlineLoadedText, /Offline — showing saved roster/);
  assert.doesNotMatch(offlineLoadedText, /no saved roster available/);
  assert.match(offlineEmptyText, /Offline — no saved roster available/);
});

test('settings displays the package version', () => {
  const packageInfo = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
  let component;
  act(() => {
    component = TestRenderer.create(React.createElement(SettingsModal, {
      isOpen: true,
      onClose: () => {},
      currentName: 'Alex Example',
      isLaViewEnabled: false,
      onSave: () => {},
    }));
  });

  assert.ok(flattenText(component.toJSON()).replaceAll(/\s/g, '').includes(`v${packageInfo.version}`));
  act(() => component.unmount());
});

test('every summary card opens the same complete on-call crew list', () => {
  const roster = {
    Command: [{ name: 'Alex Helm', role: 'Command', status: 2, sourceCell: 'A1' }],
    'Tier 2 / Navigator': [{ name: 'Blake Navigator', role: 'Tier 2 / Navigator', status: 2, sourceCell: 'A2' }],
    'Tier 1': [{ name: 'Casey Crew', role: 'Tier 1', status: 2, sourceCell: 'A3' }],
  };

  for (let cardIndex = 0; cardIndex < 3; cardIndex += 1) {
    let component;
    act(() => {
      component = TestRenderer.create(React.createElement(SummaryStats, {
        helms: 1,
        navs: 1,
        crew: 1,
        roster,
      }));
    });

    const summaryCards = component.root.findAllByType('button').slice(0, 3);
    act(() => summaryCards[cardIndex].props.onClick());
    const modalText = flattenText(component.toJSON());

    assert.match(modalText, /All Crew On Call \(\s*3\s*\)/);
    assert.match(modalText, /Helms \/ Command\s+1/);
    assert.match(modalText, /Tier 2 \/ Navigators\s+1/);
    assert.match(modalText, /Tier 1 \/ SOS\s+1/);
    assert.match(modalText, /Alex Helm/);
    assert.match(modalText, /Blake Navigator/);
    assert.match(modalText, /Casey Crew/);

    const helmGroupIndex = modalText.lastIndexOf('Helms / Command');
    const tier2GroupIndex = modalText.lastIndexOf('Tier 2 / Navigators');
    const tier1GroupIndex = modalText.lastIndexOf('Tier 1 / SOS');
    assert.ok(helmGroupIndex < modalText.indexOf('Alex Helm'));
    assert.ok(modalText.indexOf('Alex Helm') < tier2GroupIndex);
    assert.ok(tier2GroupIndex < modalText.indexOf('Blake Navigator'));
    assert.ok(modalText.indexOf('Blake Navigator') < tier1GroupIndex);
    assert.ok(tier1GroupIndex < modalText.indexOf('Casey Crew'));

    act(() => component.unmount());
  }
});

test('station forecast counts remain visible for selected and unselected hours', () => {
  const forecast = [
    {
    date: new Date(2026, 7, 19),
    startHour: 14,
    endHour: 15,
      label: '14:00',
      status: OperationalStatus.ORANGE,
      totalCount: 4,
    },
    {
    date: new Date(2026, 7, 19),
    startHour: 15,
    endHour: 16,
      label: '15:00',
      status: OperationalStatus.GREEN,
      totalCount: 9,
    },
  ];

  let component;
  act(() => {
    component = TestRenderer.create(React.createElement(StationForecastGrid, {
      forecast,
      weekForecast: createWeekForecast(),
      selectedIndex: 0,
      onSelectHour: () => {},
    }));
  });

  const text = flattenText(component.toJSON());
  assert.match(text, /\b4\b/);
  assert.match(text, /\b9\b/);

  const selectedTile = component.root.find(node =>
    typeof node.props.className === 'string' &&
    node.props.className.includes('aspect-[4/3]') &&
    node.props.className.includes('border-white'),
  );
  assert.match(selectedTile.props.className, /border-2/);
  assert.doesNotMatch(selectedTile.props.className, /ring-/);
  act(() => component.unmount());
});

test('seven-day filtering removes days before today and always ends on Tuesday', () => {
  const visibleDays = getVisibleWeekDays(
    createWeekForecast(),
    new Date(2026, 7, 21, 12), // Friday
  );

  assert.equal(visibleDays.length, 5);
  assert.equal(visibleDays[0][0].date.getDay(), 5);
  assert.equal(visibleDays.at(-1)[0].date.getDay(), 2);
});

test('LA View toggles to a labelled two-row-per-day forecast', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() - 3 + 7) % 7));
  const weekForecast = createWeekForecast(weekStart);
  const forecast = weekForecast.slice(0, 24);
  const viewChanges = [];

  let component;
  act(() => {
    component = TestRenderer.create(React.createElement(StationForecastGrid, {
      forecast,
      weekForecast,
      selectedIndex: 0,
      onSelectHour: () => {},
      onViewChange: view => viewChanges.push(view),
    }));
  });

  const sevenDayButton = component.root.findByProps({ 'aria-label': 'Show 7 day forecast' });
  assert.equal(sevenDayButton.props['aria-pressed'], false);
  act(() => sevenDayButton.props.onClick());

  const weeklyText = flattenText(component.toJSON());
  const visibleDayNames = getVisibleWeekDays(weekForecast).map(entries =>
    entries[0].date.toLocaleDateString('en-GB', { weekday: 'long' }),
  );
  for (const day of visibleDayNames) {
    assert.match(weeklyText, new RegExp(day));
  }
  assert.equal(
    component.root.findAll(node => node.props['data-week-hour'] === true).length,
    visibleDayNames.length * 24,
  );
  const dayGrids = component.root.findAll(node => node.props['data-week-day-grid'] === true);
  assert.equal(dayGrids.length, visibleDayNames.length);
  assert.equal(dayGrids.every(grid => grid.props.className.includes('grid-cols-12')), true);

  const hourLabels = component.root.findAll(node => node.props['data-week-hour-label'] === true);
  assert.equal(hourLabels.length, visibleDayNames.length * 24);
  assert.equal(flattenText(hourLabels[0]), '01');
  assert.equal(flattenText(hourLabels[11]), '12');
  assert.equal(flattenText(hourLabels[23]), '00');

  const crewCounts = component.root.findAll(node => node.props['data-week-crew-count'] === true);
  assert.equal(crewCounts.length, visibleDayNames.length * 24);
  assert.equal(flattenText(crewCounts[0]), '1');
  assert.equal(flattenText(crewCounts[7]), '8');
  assert.deepEqual(viewChanges, ['7-days']);

  const twentyFourHourButton = component.root.findByProps({ 'aria-label': 'Show 24 hour forecast' });
  act(() => twentyFourHourButton.props.onClick());
  assert.match(flattenText(component.toJSON()), /Select an hour to view roster/);
  assert.deepEqual(viewChanges, ['7-days', '24-hours']);

  act(() => component.unmount());
});

test('compact station forecast shows crew counts by default', () => {
  const forecast = [
    {
      date: new Date(2026, 7, 19),
      startHour: 14,
      endHour: 15,
      label: '14:00',
      status: OperationalStatus.ORANGE,
      totalCount: 4,
    },
    {
      date: new Date(2026, 7, 19),
      startHour: 15,
      endHour: 16,
      label: '15:00',
      status: OperationalStatus.GREEN,
      totalCount: 9,
    },
  ];

  let component;
  act(() => {
    component = TestRenderer.create(React.createElement(StatusTimeline, { forecast }));
  });

  const initialText = flattenText(component.toJSON());
  assert.match(initialText, /\b4\b/);
  assert.match(initialText, /\b9\b/);

  const grid = component.root.find(node =>
    typeof node.props.className === 'string' && node.props.className.includes('grid-cols-12'),
  );
  act(() => grid.props.onClick());
  const hiddenText = flattenText(component.toJSON());
  assert.doesNotMatch(hiddenText, /\b4\b/);
  assert.doesNotMatch(hiddenText, /\b9\b/);

  act(() => component.unmount());
});

test('station trend is future-only, tap-selectable, and explains readiness gaps', () => {
  const forecast = createWeekForecast().slice(0, 24).map((entry, index) => ({
    ...entry,
    status: index < 3 ? OperationalStatus.GREEN : index < 7 ? OperationalStatus.ORANGE : OperationalStatus.RED,
  }));
  const hourlyRosters = forecast.map((_, index) => ({
    Command: Array.from({ length: index < 3 ? 2 : index < 7 ? 1 : 0 }, (__, member) => ({ name: `Helm ${member}`, role: 'Command', status: 2, sourceCell: 'A1' })),
    'Tier 2 / Navigator': Array.from({ length: 2 }, (__, member) => ({ name: `Tier 2 ${member}`, role: 'Tier 2 / Navigator', status: 2, sourceCell: 'A2' })),
    'Tier 1': Array.from({ length: 2 }, (__, member) => ({ name: `Crew ${member}`, role: 'Tier 1', status: 2, sourceCell: 'A3' })),
  }));

  let component;
  act(() => {
    component = TestRenderer.create(React.createElement(StationTrendAnalysis, { forecast, hourlyRosters }));
  });

  const text = flattenText(component.toJSON());
  assert.match(text, /Next 24 hours · from now/);
  assert.match(text, /First downgrade in 3h/);
  assert.doesNotMatch(text, /Boats-ready trend|2 boats|1 boat|No boats/);
  assert.doesNotMatch(text, /\bHour ending\b/);
  assert.match(text, /Drag across the dock to scrub hours · tap to select/);
  assert.doesNotMatch(text, /hover/i);
  assert.doesNotMatch(text, /2\s+Green|1\s+Amber|0\s+Red/);
  assert.equal(component.root.findAll(node => node.props['data-trend-point'] === true).length, 24);
  assert.equal(component.root.findAll(node => node.props['data-trend-hour-button'] === true).length, 24);
  assert.equal(component.root.findAll(node => node.props['data-trend-dock-label'] === true).length, 1);

  const hourButtons = component.root.findAll(node => node.props['data-trend-hour-button'] === true);
  assert.equal(hourButtons[0].props['aria-pressed'], true);
  act(() => hourButtons[3].props.onClick());
  assert.equal(component.root.findAll(node => node.props['data-trend-hour-button'] === true)[3].props['aria-pressed'], true);
  assert.match(flattenText(component.root.findByProps({ 'data-trend-selected': true })), /\+3H/);
  assert.match(flattenText(component.root.findByProps({ 'data-trend-selected': true })), /To green: \+1 Helm/);

  const scrubber = component.root.findByProps({ 'data-trend-hour-strip': true });
  const scrubTarget = {
    getBoundingClientRect: () => ({ left: 0, width: 240 }),
    hasPointerCapture: () => true,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  };
  act(() => scrubber.props.onPointerDown({ currentTarget: scrubTarget, clientX: 125, pointerId: 1, pointerType: 'touch' }));
  assert.match(flattenText(component.root.findByProps({ 'data-trend-selected': true })), /\+12H/);
  act(() => scrubber.props.onPointerMove({ currentTarget: scrubTarget, clientX: 165, pointerId: 1, pointerType: 'touch' }));
  assert.match(flattenText(component.root.findByProps({ 'data-trend-selected': true })), /\+16H/);
  act(() => scrubber.props.onPointerUp({ currentTarget: scrubTarget, clientX: 165, pointerId: 1, pointerType: 'touch' }));
  assert.match(flattenText(component.root.findByProps({ 'data-trend-selected': true })), /\+16H/);

  assert.equal(
    describeReadinessGap(OperationalStatus.RED, { helms: 0, tier2: 1, tier1: 1, total: 2 }),
    'To amber: +1 Helm',
  );
  assert.equal(
    describeReadinessGap(OperationalStatus.ORANGE, { helms: 1, tier2: 1, tier1: 1, total: 3 }),
    'To green: +1 Helm · +1 Tier 2 · +1 crew',
  );

  act(() => component.unmount());
});

test('the current availability hour uses a pulsing white border every two seconds', () => {
  const currentHourClass = getAvailabilityBoxClass(true, true);
  const cssAsset = readdirSync(resolve(process.cwd(), 'dist', 'assets'))
    .find(name => /^index-[A-Za-z0-9_-]+\.css$/.test(name));
  const compiledCss = readFileSync(resolve(process.cwd(), 'dist', 'assets', cssAsset), 'utf8');

  assert.match(currentHourClass, /animate-current-hour/);
  assert.match(currentHourClass, /border-2/);
  assert.match(currentHourClass, /border-white/);
  assert.match(compiledCss, /\.animate-current-hour\{animation:current-hour-pulse 2s ease-in-out infinite\}/);
  assert.match(compiledCss, /@keyframes current-hour-pulse\{0%,to\{border-color:#fff;box-shadow:0 0 #ffffffb3\}50%\{border-color:#ffffff80;box-shadow:0 0 0 6px #fff0\}\}/);
});
