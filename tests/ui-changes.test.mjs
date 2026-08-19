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
let getAvailabilityBoxClass;
let OperationalStatus;

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
  ({ StationForecastGrid } = await viteServer.ssrLoadModule('/components/StationForecastGrid.tsx'));
  ({ getAvailabilityBoxClass } = await viteServer.ssrLoadModule('/components/PersonalAvailability.tsx'));
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

test('the offline banner is visible only while the browser is offline', () => {
  const savedAt = new Date(2026, 7, 19, 14, 0);

  const onlineText = renderHeader({
    isOffline: false,
    isCachedData: true,
    lastUpdated: savedAt,
  });
  const offlineText = renderHeader({
    isOffline: true,
    isCachedData: true,
    lastUpdated: savedAt,
  });

  assert.doesNotMatch(onlineText, /Offline/);
  assert.match(offlineText, /Offline — showing saved roster/);
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
    assert.match(modalText, /Alex Helm/);
    assert.match(modalText, /Blake Navigator/);
    assert.match(modalText, /Casey Crew/);

    act(() => component.unmount());
  }
});

test('station forecast counts remain visible for selected and unselected hours', () => {
  const forecast = [
    {
      time: new Date(2026, 7, 19, 14, 0),
      label: '14:00',
      status: OperationalStatus.ORANGE,
      totalCount: 4,
    },
    {
      time: new Date(2026, 7, 19, 15, 0),
      label: '15:00',
      status: OperationalStatus.GREEN,
      totalCount: 9,
    },
  ];

  let component;
  act(() => {
    component = TestRenderer.create(React.createElement(StationForecastGrid, {
      forecast,
      selectedIndex: 0,
      onSelectHour: () => {},
    }));
  });

  const text = flattenText(component.toJSON());
  assert.match(text, /\b4\b/);
  assert.match(text, /\b9\b/);
  act(() => component.unmount());
});

test('the current availability hour uses a pulsing white border once per second', () => {
  const currentHourClass = getAvailabilityBoxClass(true, true);
  const cssAsset = readdirSync(resolve(process.cwd(), 'dist', 'assets'))
    .find(name => /^index-[A-Za-z0-9_-]+\.css$/.test(name));
  const compiledCss = readFileSync(resolve(process.cwd(), 'dist', 'assets', cssAsset), 'utf8');

  assert.match(currentHourClass, /animate-current-hour/);
  assert.match(currentHourClass, /border-2/);
  assert.match(currentHourClass, /border-white/);
  assert.match(compiledCss, /\.animate-current-hour\{animation:current-hour-pulse 1s ease-in-out infinite\}/);
  assert.match(compiledCss, /@keyframes current-hour-pulse\{0%,to\{border-color:#fff;box-shadow:0 0 #ffffffb3\}50%\{border-color:#ffffff80;box-shadow:0 0 0 6px #fff0\}\}/);
});
