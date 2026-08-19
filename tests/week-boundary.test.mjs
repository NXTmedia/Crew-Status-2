import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createServer } from 'vite';

const CACHE_KEY = 'RNLI_ROSTER_CACHE_V2';
const COLUMN_COUNT = 176;

let viteServer;
let fetchRosterData;
let fetchPersonalSchedule;
let getAvailabilityDateRange;
let canViewRosterWeek;
let isRosterForDate;
let getRosterSlot;
let SingleFlightLatestQueue;

before(async () => {
  viteServer = await createServer({
    root: process.cwd(),
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  ({ fetchRosterData, fetchPersonalSchedule, isRosterForDate } = await viteServer.ssrLoadModule('/services/sheetService.ts'));
  ({ getAvailabilityDateRange, canViewRosterWeek, getRosterSlot } = await viteServer.ssrLoadModule('/services/dateUtils.ts'));
  ({ SingleFlightLatestQueue } = await viteServer.ssrLoadModule('/services/singleFlightQueue.ts'));
});

after(async () => {
  await viteServer?.close();
});

const emptyRow = () => Array(COLUMN_COUNT).fill('');

const addDays = (date, amount) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

const createRosterCsv = startDate => {
  const header = emptyRow();
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = addDays(startDate, dayOffset);
    header[2 + (dayOffset * 24)] = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  }

  const command = emptyRow();
  command[0] = 'Command';

  const crew = emptyRow();
  crew[0] = 'Alex Example';
  crew[1] = 'C';
  crew[2] = '2';

  const stop = emptyRow();
  stop[0] = 'Shore Crew';

  return [header, emptyRow(), command, crew, stop]
    .map(row => row.join(','))
    .join('\n');
};

const createStorage = initialStore => {
  const values = new Map();
  if (initialStore) values.set(CACHE_KEY, JSON.stringify(initialStore));

  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    readStore: () => JSON.parse(values.get(CACHE_KEY) ?? '{}'),
  };
};

const installEnvironment = ({ storage, online, csvText, fetchImpl }) => {
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
    value: { onLine: online },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchImpl ?? (async () => {
      networkCalls += 1;
      return new Response(csvText, {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      });
    }),
    configurable: true,
  });

  return {
    getNetworkCalls: () => networkCalls,
    restore: () => {
      for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
};

test('next week stays hidden until Tuesday and rotates on Wednesday', () => {
  const monday = new Date(2026, 7, 24, 12);
  const tuesday = new Date(2026, 7, 25, 12);
  const wednesday = new Date(2026, 7, 26, 12);
  const nextWednesday = new Date(2026, 7, 26, 12);

  const mondayRange = getAvailabilityDateRange(monday);
  assert.equal(mondayRange.minDate.getDate(), 19);
  assert.equal(mondayRange.maxDate.getDate(), 25);
  assert.equal(canViewRosterWeek(nextWednesday, monday), false);

  const tuesdayRange = getAvailabilityDateRange(tuesday);
  assert.equal(tuesdayRange.minDate.getDate(), 19);
  assert.equal(tuesdayRange.maxDate.getDate(), 1);
  assert.equal(tuesdayRange.maxDate.getMonth(), 8);
  assert.equal(canViewRosterWeek(nextWednesday, tuesday), true);

  const wednesdayRange = getAvailabilityDateRange(wednesday);
  assert.equal(wednesdayRange.minDate.getDate(), 26);
  assert.equal(wednesdayRange.maxDate.getDate(), 1);
  assert.equal(wednesdayRange.maxDate.getMonth(), 8);
});

test('fixed roster slots remain 00-23 across both UK clock changes', () => {
  const springWeek = new Date(2026, 2, 25, 0); // Clocks advance on Sunday 29 March
  const autumnWeek = new Date(2026, 9, 21, 0); // Clocks return on Sunday 25 October

  for (const weekStart of [springWeek, autumnWeek]) {
    const sundaySlots = Array.from({ length: 24 }, (_, hour) =>
      getRosterSlot(weekStart, (4 * 24) + hour),
    );

    assert.deepEqual(sundaySlots.map(slot => slot.startHour), Array.from({ length: 24 }, (_, hour) => hour));
    assert.equal(new Set(sundaySlots.map(slot => slot.date.getDate())).size, 1);

    const finalSlot = getRosterSlot(weekStart, 167);
    assert.equal(finalSlot.date.getDay(), 2);
    assert.equal(finalSlot.startHour, 23);
    assert.equal(finalSlot.endHour, 0);
  }
});

test('a roster request honours cancellation before it can complete', { concurrency: false }, async () => {
  const storage = createStorage();
  let markFetchStarted;
  const fetchStarted = new Promise(resolve => {
    markFetchStarted = resolve;
  });
  const environment = installEnvironment({
    storage,
    online: true,
    csvText: '',
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      markFetchStarted();
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    }),
  });
  const controller = new AbortController();

  try {
    const request = fetchRosterData(
      new Date(2026, 7, 19, 12),
      'Alex Example',
      'network-first',
      controller.signal,
    );
    await fetchStarted;
    controller.abort();

    await assert.rejects(request, error => error?.name === 'AbortError');
    assert.deepEqual(storage.readStore(), {});
  } finally {
    environment.restore();
  }
});

test('refresh requests run singly and collapse repeats into the latest pending request', async () => {
  const started = [];
  const completed = [];
  let releaseFirst;
  const firstCanFinish = new Promise(resolve => {
    releaseFirst = resolve;
  });
  const queue = new SingleFlightLatestQueue(async request => {
    started.push(request);
    if (request === 'first') await firstCanFinish;
    completed.push(request);
  });

  const idle = queue.enqueue('first');
  queue.enqueue('duplicate');
  queue.enqueue('latest');

  assert.deepEqual(started, ['first']);
  releaseFirst();
  await idle;

  assert.deepEqual(started, ['first', 'latest']);
  assert.deepEqual(completed, ['first', 'latest']);
});

test('worksheet validation requires the requested Wednesday-Tuesday dates', async () => {
  const currentWeekCsv = createRosterCsv(new Date(2026, 7, 19));
  const nextWeekCsv = createRosterCsv(new Date(2026, 7, 26));

  const Papa = (await import('papaparse')).default;
  const currentRows = Papa.parse(currentWeekCsv).data;
  const nextRows = Papa.parse(nextWeekCsv).data;

  assert.equal(isRosterForDate(currentRows, new Date(2026, 7, 19)), true);
  assert.equal(isRosterForDate(currentRows, new Date(2026, 7, 26)), false);
  assert.equal(isRosterForDate(nextRows, new Date(2026, 7, 26)), true);
});

test('the data service blocks next-week personal availability before Tuesday', { concurrency: false }, async () => {
  const storage = createStorage();
  const environment = installEnvironment({
    storage,
    online: true,
    csvText: createRosterCsv(new Date(2026, 7, 26)),
  });

  try {
    await assert.rejects(
      fetchPersonalSchedule(
        new Date(2026, 7, 26, 12),
        'Alex Example',
        new Date(2026, 7, 24, 12),
      ),
      /NEXT_WEEK_NOT_AVAILABLE/,
    );
    assert.equal(environment.getNetworkCalls(), 0);
  } finally {
    environment.restore();
  }
});

test('Google-style fallback data is rejected and never cached as next week', { concurrency: false }, async () => {
  const storage = createStorage();
  const environment = installEnvironment({
    storage,
    online: true,
    csvText: createRosterCsv(new Date(2026, 7, 19)),
  });

  try {
    await assert.rejects(
      fetchRosterData(new Date(2026, 7, 26, 12), undefined, 'network-first'),
      /Could not load roster data/,
    );
    assert.equal(environment.getNetworkCalls(), 2);
    assert.deepEqual(storage.readStore(), {});
  } finally {
    environment.restore();
  }
});

test('a mismatched future-week cache entry is removed while offline', { concurrency: false }, async () => {
  const sheetName = '26th Aug 2026';
  const storage = createStorage({
    [sheetName.toLowerCase()]: {
      timestamp: Date.now(),
      sheetName,
      csvText: createRosterCsv(new Date(2026, 7, 19)),
    },
  });
  const environment = installEnvironment({
    storage,
    online: false,
    csvText: '',
  });

  try {
    await assert.rejects(
      fetchRosterData(new Date(2026, 7, 26, 12), undefined, 'cache-only'),
      /NO_CACHED_ROSTER/,
    );
    assert.equal(environment.getNetworkCalls(), 0);
    assert.deepEqual(storage.readStore(), {});
  } finally {
    environment.restore();
  }
});

test('loading the current week no longer prefetches an unpublished future tab', { concurrency: false }, async () => {
  const storage = createStorage();
  const environment = installEnvironment({
    storage,
    online: true,
    csvText: createRosterCsv(new Date(2026, 7, 19)),
  });

  try {
    const result = await fetchRosterData(
      new Date(2026, 7, 19, 12),
      'Alex Example',
      'network-first',
    );

    assert.equal(result.sheetName, '19th Aug 2026');
    assert.equal(environment.getNetworkCalls(), 1);
    assert.deepEqual(Object.keys(storage.readStore()), ['19th aug 2026']);
  } finally {
    environment.restore();
  }
});
