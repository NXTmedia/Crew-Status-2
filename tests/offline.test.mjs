import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { createServer } from 'vite';

const CACHE_KEY = 'RNLI_ROSTER_CACHE_V2';
const SHEET_NAME = '19th Aug 2026';
const COLUMN_COUNT = 170;
const WEDNESDAY_14_COLUMN = 16;

let viteServer;
let fetchRosterData;

before(async () => {
  viteServer = await createServer({
    root: process.cwd(),
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  ({ fetchRosterData } = await viteServer.ssrLoadModule('/services/sheetService.ts'));
});

after(async () => {
  await viteServer?.close();
});

const emptyRow = () => Array(COLUMN_COUNT).fill('');

const crewRow = (name, onCallColumns) => {
  const row = emptyRow();
  row[0] = name;
  row[1] = 'C';
  onCallColumns.forEach(column => {
    row[column] = '2';
  });
  return row;
};

const sectionRow = name => {
  const row = emptyRow();
  row[0] = name;
  return row;
};

const rosterHeaderRow = startDate => {
  const row = emptyRow();
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    row[2 + (dayOffset * 24)] = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  }
  return row;
};

const createRosterCsv = () => {
  const alwaysOnCall = Array.from(
    { length: COLUMN_COUNT - 2 },
    (_, index) => index + 2,
  );

  return [
    rosterHeaderRow(new Date(2026, 7, 19)),
    emptyRow(),
    sectionRow('Command'),
    crewRow('Alex Example', [WEDNESDAY_14_COLUMN]),
    sectionRow('Tier 2 / Navigator'),
    crewRow('Blake Example', alwaysOnCall),
    sectionRow('Tier 1'),
    crewRow('Casey Example', alwaysOnCall),
    sectionRow('Shore Crew'),
  ].map(row => row.join(',')).join('\n');
};

const createStorage = (timestamp, includeRoster = true) => {
  const values = new Map();
  if (includeRoster) {
    values.set(CACHE_KEY, JSON.stringify({
      [SHEET_NAME.toLowerCase()]: {
        timestamp,
        sheetName: SHEET_NAME,
        csvText: createRosterCsv(),
      },
    }));
  }

  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
  };
};

const installOfflineEnvironment = storage => {
  const originalDescriptors = new Map(
    ['localStorage', 'navigator', 'fetch'].map(name => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  let networkCalls = 0;

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'fetch', {
    value: async () => {
      networkCalls += 1;
      throw new Error('Network access is disabled by this test');
    },
    configurable: true,
  });

  return {
    getNetworkCalls: () => networkCalls,
    restore: () => {
      for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) {
          Object.defineProperty(globalThis, name, descriptor);
        } else {
          delete globalThis[name];
        }
      }
    },
  };
};

const readDistFile = name =>
  readFileSync(resolve(process.cwd(), 'dist', name), 'utf8');

test('cache-only loading renders and recalculates personal status without networking', { concurrency: false }, async () => {
  const savedAt = new Date(2026, 7, 19, 13, 55).getTime();
  const environment = installOfflineEnvironment(createStorage(savedAt));

  try {
    const atFourteenHundred = await fetchRosterData(
      new Date(2026, 7, 19, 14, 0),
      'Alex Example',
      'cache-only',
    );
    const atFifteenHundred = await fetchRosterData(
      new Date(2026, 7, 19, 15, 0),
      'Alex Example',
      'cache-only',
    );

    assert.equal(environment.getNetworkCalls(), 0);
    assert.equal(atFourteenHundred.isCachedData, true);
    assert.equal(atFourteenHundred.fetchedAt.getTime(), savedAt);
    assert.equal(atFourteenHundred.forecast.length, 24);
    assert.equal(atFourteenHundred.weekForecast.length, 168);
    assert.equal(atFourteenHundred.weekForecast[0].time.getDay(), 3);
    assert.equal(atFourteenHundred.weekForecast[0].time.getHours(), 0);
    assert.equal(atFourteenHundred.weekForecast[167].time.getDay(), 2);
    assert.equal(atFourteenHundred.weekForecast[167].time.getHours(), 23);
    assert.equal(atFourteenHundred.personalForecast[0].status, 2);
    assert.equal(atFifteenHundred.personalForecast[0].status, 0);
  } finally {
    environment.restore();
  }
});

test('network-first loading immediately falls back to saved data while offline', { concurrency: false }, async () => {
  const environment = installOfflineEnvironment(createStorage(Date.now()));

  try {
    const result = await fetchRosterData(
      new Date(2026, 7, 19, 14, 0),
      'Alex Example',
      'network-first',
    );

    assert.equal(environment.getNetworkCalls(), 0);
    assert.equal(result.isCachedData, true);
    assert.equal(result.sheetName, SHEET_NAME);
    assert.equal(result.summary.total, 3);
  } finally {
    environment.restore();
  }
});

test('offline loading without a saved roster fails without attempting a request', { concurrency: false }, async () => {
  const environment = installOfflineEnvironment(createStorage(Date.now(), false));

  try {
    await assert.rejects(
      fetchRosterData(
        new Date(2026, 7, 19, 14, 0),
        'Alex Example',
        'network-first',
      ),
      /OFFLINE_WITHOUT_CACHE/,
    );
    assert.equal(environment.getNetworkCalls(), 0);
  } finally {
    environment.restore();
  }
});

test('the production service worker precaches the application shell', () => {
  const serviceWorker = readDistFile('sw.js');

  assert.match(serviceWorker, /precacheAndRoute/);
  assert.match(serviceWorker, /index\.html/);
  assert.match(serviceWorker, /assets\/index-[A-Za-z0-9_-]+\.js/);
  assert.match(serviceWorker, /assets\/index-[A-Za-z0-9_-]+\.css/);
  assert.match(serviceWorker, /manifest\.webmanifest/);
});

test('the service worker retains a network-first Google roster cache', () => {
  const serviceWorker = readDistFile('sw.js');

  assert.match(serviceWorker, /https:\/\/docs\.google\.com/);
  assert.match(serviceWorker, /crew-status-rosters/);
  assert.match(serviceWorker, /NetworkFirst/);
  assert.match(serviceWorker, /networkTimeoutSeconds:5/);
});

test('the production shell has no internet-hosted UI dependencies', () => {
  const indexHtml = readDistFile('index.html');
  const manifest = JSON.parse(readDistFile('manifest.webmanifest'));

  assert.doesNotMatch(indexHtml, /cdn\.tailwindcss|fonts\.googleapis|aistudiocdn|placehold\.co/);
  assert.match(indexHtml, /assets\/index-[A-Za-z0-9_-]+\.css/);
  assert.equal(manifest.name, 'Crew Status 2');
  assert.equal(manifest.icons.every(icon => icon.src.startsWith('/')), true);
});
