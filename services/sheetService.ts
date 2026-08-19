
import Papa from 'papaparse';
import { differenceInCalendarDays, format, addHours, startOfDay, addDays } from 'date-fns';
import { SECTION_HEADERS, VALID_COLUMN_B_FLAG, ON_CALL_STATUS_CODE, PARSER_STOP_TRIGGER, PROBATIONER_HEADER } from '../constants';
import { CONFIG } from '../config';
import { canViewRosterWeek, generatePossibleTabNames, getLastWednesday } from './dateUtils';
import { RosterData, SheetParseResult, DebugInfo, OperationalStatus, ForecastEntry, PersonalForecastEntry } from '../types';

interface FetchResult {
  data: any[];
  rawSnippet: string;
  sheetName: string;
}

const CACHE_KEY = 'RNLI_ROSTER_CACHE_V2';
const MAX_CACHED_SHEETS = 6;
const ROSTER_START_COL_INDEX = 2; // Column C
const HOURS_IN_WEEK = 168; // 7 days * 24 hours
// The index just after the last valid hour (Tuesday 23:00 is index 169, so 170 is the first invalid one)
const ROSTER_END_COL_INDEX = ROSTER_START_COL_INDEX + HOURS_IN_WEEK;

interface CacheEntry {
  timestamp: number;
  sheetName: string;
  csvText: string;
}

type CacheStore = Record<string, CacheEntry>;

export type RosterLoadMode = 'cache-only' | 'cache-first' | 'network-first';

interface CsvLoadResult {
  csvData: any[];
  usedSheetName: string;
  rawSnippet: string;
  isCached: boolean;
  sourceTimestamp: number;
}

const loadCacheStore = (): CacheStore => {
  try {
    const json = localStorage.getItem(CACHE_KEY);
    if (!json) return {};
    return JSON.parse(json) as CacheStore;
  } catch (e) {
    return {};
  }
};

const saveToCache = (sheetName: string, csvText: string) => {
  if (!csvText.trim()) return; // Never cache empty responses
  try {
    const store = loadCacheStore();
    store[sheetName.toLowerCase()] = { timestamp: Date.now(), sheetName, csvText };
    // Evict oldest entries if over limit
    const keys = Object.keys(store);
    if (keys.length > MAX_CACHED_SHEETS) {
      const sorted = keys.sort((a, b) => store[a].timestamp - store[b].timestamp);
      delete store[sorted[0]];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("Failed to save to cache", e);
  }
};

const removeFromCache = (sheetName: string) => {
  try {
    const store = loadCacheStore();
    const key = sheetName.toLowerCase();
    if (!(key in store)) return;
    delete store[key];
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('Failed to remove invalid roster data from cache', e);
  }
};

const findCacheEntry = (potentialSheetNames: string[]): CacheEntry | null => {
  const store = loadCacheStore();
  for (const name of potentialSheetNames) {
    const entry = store[name.toLowerCase()];
    if (entry && entry.csvText.trim()) return entry; // Skip empty cached entries
  }
  return null;
};

const parseCSV = (text: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      complete: (results) => resolve(results.data as any[]),
      error: (err: any) => reject(err),
      skipEmptyLines: false,
    });
  });
};

const getSheetDateKey = (value: unknown): string | null => {
  const match = String(value ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  return `${Number(year)}-${Number(month)}-${Number(day)}`;
};

const getDateKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

/**
 * Google gviz returns the first worksheet with HTTP 200 when a requested tab
 * does not exist. Verify all seven roster dates before data is cached or used.
 */
export const isRosterForDate = (csvData: any[], targetDate: Date): boolean => {
  const headerRow = csvData[0] as unknown[] | undefined;
  if (!headerRow) return false;

  const actualDates = new Set(
    headerRow
      .slice(ROSTER_START_COL_INDEX, ROSTER_END_COL_INDEX)
      .map(getSheetDateKey)
      .filter((value): value is string => value !== null),
  );
  const rotationStart = getLastWednesday(targetDate);

  return Array.from({ length: 7 }, (_, dayOffset) =>
    getDateKey(addDays(rotationStart, dayOffset)),
  ).every(dateKey => actualDates.has(dateKey));
};

const FETCH_TIMEOUT_MS = 8000;

const fetchCSV = async (sheetName: string): Promise<{ data: any[], rawSnippet: string, csvText: string }> => {
  // A stable URL lets the service worker keep a second, browser-managed copy.
  // `no-cache` still revalidates it whenever the network is available.
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error(`Fetch timed out for sheet: ${sheetName}`);
    }
    throw e;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${sheetName} (Status: ${response.status})`);
  }
  
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Sheet not found or empty: ${sheetName}`);
  }
  const rawSnippet = text.split('\n').slice(0, 10).join('\n');
  const data = await parseCSV(text);

  return { data, rawSnippet, csvText: text };
};

export const getColumnLetter = (index: number): string => {
  let label = "";
  let num = index + 1; // Convert to 1-based
  while (num > 0) {
    let rem = (num - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    num = Math.floor((num - 1) / 26);
  }
  return label;
};

/**
 * Calculates status based on crewing numbers.
 * Green (2 Boats): >= 2 Helms, >= 4 Senior (Helms+Navs), >= 6 Total
 * Orange (1 Boat): >= 1 Helms, >= 2 Senior (Helms+Navs), >= 3 Total
 * Red: Else
 */
const calculateOperationalStatus = (helms: number, navs: number, total: number): OperationalStatus => {
  const seniorCrew = helms + navs;

  if (helms >= 2 && seniorCrew >= 4 && total >= 6) {
    return OperationalStatus.GREEN;
  } else if (helms >= 1 && seniorCrew >= 2 && total >= 3) {
    return OperationalStatus.ORANGE;
  } else {
    return OperationalStatus.RED;
  }
};

/**
 * Loads CSV data.
 * @param targetDate The date we need data for
 * Loads the roster using an explicit cache/network strategy.
 */
const loadCsvForDate = async (
  targetDate: Date,
  mode: RosterLoadMode = 'network-first'
): Promise<CsvLoadResult> => {
  const potentialSheetNames = generatePossibleTabNames(targetDate);
  let csvData: any[] | null = null;
  let rawSnippet = '';
  let usedSheetName = '';
  let isCached = false;
  let sourceTimestamp = Date.now();

  const loadMatchingCache = async (): Promise<boolean> => {
    for (const potentialName of potentialSheetNames) {
      const cached = findCacheEntry([potentialName]);
      if (!cached) continue;

      try {
        const parsedData = await parseCSV(cached.csvText);
        if (!isRosterForDate(parsedData, targetDate)) {
          console.warn(`Discarding cached roster with mismatched dates: ${cached.sheetName}`);
          removeFromCache(cached.sheetName);
          continue;
        }

        csvData = parsedData;
        rawSnippet = cached.csvText.split('\n').slice(0, 10).join('\n');
        usedSheetName = cached.sheetName;
        sourceTimestamp = cached.timestamp;
        isCached = true;
        return true;
      } catch (error) {
        console.error('Failed to parse cached roster data', error);
        removeFromCache(cached.sheetName);
      }
    }

    return false;
  };

  if (mode === 'cache-only' || mode === 'cache-first') {
    if (await loadMatchingCache()) {
      return { csvData: csvData!, usedSheetName, rawSnippet, isCached, sourceTimestamp };
    }

    if (mode === 'cache-only') {
      throw new Error('NO_CACHED_ROSTER');
    }
  }

  const browserIsOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (!browserIsOffline) {
    for (const name of potentialSheetNames) {
      try {
        const result = await fetchCSV(name);
        if (!isRosterForDate(result.data, targetDate)) {
          throw new Error(`Worksheet dates do not match requested roster: ${name}`);
        }
        csvData = result.data;
        rawSnippet = result.rawSnippet;
        usedSheetName = name;
        sourceTimestamp = Date.now();
        saveToCache(name, result.csvText);
        break;
      } catch (error) {
        console.warn(`Failed to fetch tab "${name}":`, error);
      }
    }
  }

  if (!csvData && mode === 'network-first') {
    await loadMatchingCache();
  }

  if (!csvData) {
    if (browserIsOffline) {
      throw new Error('OFFLINE_WITHOUT_CACHE');
    }
    throw new Error('Could not load roster data.');
  }

  return { csvData, usedSheetName, rawSnippet, isCached, sourceTimestamp };
};

export const fetchPersonalSchedule = async (
  targetDate: Date,
  crewName: string,
  referenceDate: Date = new Date(),
): Promise<{ data: PersonalForecastEntry[], found: boolean }> => {
  if (!canViewRosterWeek(targetDate, referenceDate)) {
    throw new Error('NEXT_WEEK_NOT_AVAILABLE');
  }

  // Use Cache First for personal schedule navigation (performance optimization)
  // If the user swipes to a day covered by the current cached sheet, it will load instantly.
  let csvData: any[];
  try {
    const result = await loadCsvForDate(targetDate, 'cache-first');
    csvData = result.csvData;
  } catch (e) {
    // If targetDate is in a future week, this likely means the sheet doesn't exist yet
    const targetWed = getLastWednesday(targetDate);
    const currentWed = getLastWednesday(referenceDate);
    if (targetWed > currentWed) {
      throw new Error('NEXT_WEEK_NOT_AVAILABLE');
    }
    throw e;
  }

  // Align to start of the requested day (00:00)
  const startOfDayDate = startOfDay(targetDate);
  const rotationStart = getLastWednesday(startOfDayDate);
  const diffDays = differenceInCalendarDays(startOfDayDate, rotationStart);

  // Column Index for 00:00 of the target day
  // Base (Column C = 2) + (DaysPast * 24) + 0 Hours
  const baseColumnIndex = ROSTER_START_COL_INDEX + (diffDays * 24);

  const personalForecast: PersonalForecastEntry[] = [];
  let found = false;

  // Scan rows
  const DATA_START_ROW_INDEX = 0;
  for (let i = DATA_START_ROW_INDEX; i < csvData.length; i++) {
    const row = csvData[i] as string[];
    if (!row) continue;
    const colA = row[0]?.trim();

    // Stop trigger - Stop at Shore Crew OR Probationer
    if (colA?.includes(PARSER_STOP_TRIGGER) || colA?.includes(PROBATIONER_HEADER)) break;

    // Check Name Match
    if (colA && colA.toLowerCase() === crewName.toLowerCase()) {
      found = true;
      // Extract 24 hours
      for (let h = 0; h < 24; h++) {
        const targetColIndex = baseColumnIndex + h;
        const val = row[targetColIndex]?.toString().trim();
        const hourTime = addHours(startOfDayDate, h);

        personalForecast.push({
            time: hourTime,
            hourLabel: format(hourTime, 'HH'),
            status: val === ON_CALL_STATUS_CODE ? 2 : 0
        });
      }
      break; // Stop scanning once found
    }
  }

  return { data: personalForecast, found };
};

/**
 * Shared row-parsing logic for scanning crew data from a sheet's CSV.
 * Used by fetchRosterData for both the current week and next week stitching.
 */
interface RowParseContext {
  csvData: any[];
  forecastAccumulators: { helms: number; navs: number; crew: number; total: number }[];
  hourlyRosters?: RosterData[];
  personalForecast: PersonalForecastEntry[];
  crewName?: string;
  targetDate: Date;
  forecastStartHour: number; // Inclusive
  forecastEndHour: number;   // Exclusive
  columnForHour: (h: number) => number; // Maps forecast hour index to sheet column index
  sourceLabel?: string; // For sourceCell debug label, e.g., '' or ' (next)'
  debugInfo?: DebugInfo;
  debugColumnIndex?: number; // Column index for debug dump val
}

const parseSheetRows = (ctx: RowParseContext): boolean => {
  let crewNameFound = false;
  let currentCategory: string | null = null;
  let hasEncounteredFirstHeader = false;

  for (let i = 0; i < ctx.csvData.length; i++) {
    const row = ctx.csvData[i] as string[];
    if (!row) continue;

    const colA = row[0]?.trim();
    const colB = row[1]?.trim();

    if (!colA) continue;

    // Debug dump (only for primary sheet)
    if (ctx.debugInfo && ctx.debugColumnIndex !== undefined) {
      const valAtTarget = row[ctx.debugColumnIndex]?.toString().trim() || "";
      const debugColA = colA.length > 25 ? colA.substring(0, 25) + '...' : colA.padEnd(25);
      ctx.debugInfo.columnDump.push(
        `R${i + 1} | ${debugColA} | Flag:${colB || '_'} | Val:${valAtTarget}`
      );
    }

    if (colA.includes(PARSER_STOP_TRIGGER)) {
      if (ctx.debugInfo) {
        ctx.debugInfo.columnDump.push(`--- STOPPED AT "${PARSER_STOP_TRIGGER}" ---`);
      }
      break;
    }

    const matchedHeader = Object.values(SECTION_HEADERS).find(h => colA.includes(h));
    if (matchedHeader) {
      currentCategory = matchedHeader;
      hasEncounteredFirstHeader = true;
      continue;
    }

    if (colA.includes(PROBATIONER_HEADER)) {
      currentCategory = PROBATIONER_HEADER;
      continue;
    }

    if (!hasEncounteredFirstHeader && colB === VALID_COLUMN_B_FLAG) {
      currentCategory = SECTION_HEADERS.COMMAND;
      hasEncounteredFirstHeader = true;
    }

    if (colB === VALID_COLUMN_B_FLAG && currentCategory) {
      if (currentCategory === PROBATIONER_HEADER) continue;

      let effectiveCategory = currentCategory;
      if (currentCategory === SECTION_HEADERS.SAFE_ON_SERVICE) {
        effectiveCategory = SECTION_HEADERS.TIER1;
      }

      // Check each hour in the specified forecast range
      for (let h = ctx.forecastStartHour; h < ctx.forecastEndHour; h++) {
        const sheetCol = ctx.columnForHour(h);
        if (sheetCol < ROSTER_START_COL_INDEX || sheetCol >= ROSTER_END_COL_INDEX) continue;

        const val = row[sheetCol]?.toString().trim();
        if (val === ON_CALL_STATUS_CODE) {
          const acc = ctx.forecastAccumulators[h];
          acc.total++;
          if (currentCategory === SECTION_HEADERS.COMMAND) {
            acc.helms++;
          } else if (currentCategory === SECTION_HEADERS.NAVIGATOR) {
            acc.navs++;
          } else {
            acc.crew++;
          }

          if (ctx.hourlyRosters) {
            ctx.hourlyRosters[h][effectiveCategory].push({
              name: colA,
              role: currentCategory,
              status: 2,
              sourceCell: `A${i + 1}${ctx.sourceLabel || ''}`
            });
          }
        }
      }

      // Personal forecast
      if (ctx.crewName && colA.toLowerCase() === ctx.crewName.toLowerCase()) {
        crewNameFound = true;
        for (let h = ctx.forecastStartHour; h < ctx.forecastEndHour; h++) {
          const sheetCol = ctx.columnForHour(h);
          if (sheetCol < ROSTER_START_COL_INDEX || sheetCol >= ROSTER_END_COL_INDEX) continue;

          const val = row[sheetCol]?.toString().trim();
          const hourTime = addHours(ctx.targetDate, h);
          ctx.personalForecast.push({
            time: hourTime,
            hourLabel: format(hourTime, 'HH'),
            status: val === ON_CALL_STATUS_CODE ? 2 : 0
          });
        }
      }
    }
  }

  return crewNameFound;
};

export const fetchRosterData = async (
  targetDate: Date,
  crewName?: string,
  mode: RosterLoadMode = 'network-first'
): Promise<SheetParseResult> => {
  const { csvData, usedSheetName, rawSnippet, isCached, sourceTimestamp } = await loadCsvForDate(targetDate, mode);

  // Calculate Column Logic
  const rotationStart = getLastWednesday(targetDate);
  const diffDays = differenceInCalendarDays(targetDate, rotationStart);
  const currentHour = targetDate.getHours();

  const columnIndex = ROSTER_START_COL_INDEX + (diffDays * 24) + currentHour;
  const columnLetter = getColumnLetter(columnIndex);

  // Bounds checking
  const headerDateValue = csvData[0] ? csvData[0][columnIndex] : 'N/A';
  const headerHourValue = csvData[1] ? csvData[1][columnIndex] : 'N/A';

  const debugInfo: DebugInfo = {
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    gid: 'Hidden by Google API (Name lookup used)',
    sheetName: usedSheetName,
    targetDate: format(targetDate, 'yyyy-MM-dd HH:mm'),
    rotationStart: format(rotationStart, 'yyyy-MM-dd'),
    daysOffset: diffDays,
    hour: currentHour,
    columnIndex,
    columnLetter,
    csvPreview: rawSnippet,
    headerDateValue: String(headerDateValue),
    headerHourValue: String(headerHourValue),
    columnDump: [],
  };

  // Prepare Forecast Data Structure (24 hours)
  const STATION_FORECAST_HOURS = 24;

  const hourlyRosters: RosterData[] = Array.from({ length: STATION_FORECAST_HOURS }, () => {
    const r: RosterData = {};
    Object.values(SECTION_HEADERS).forEach(header => {
      r[header] = [];
    });
    return r;
  });

  const forecastAccumulators = Array.from({ length: STATION_FORECAST_HOURS }, () => ({
    helms: 0,
    navs: 0,
    crew: 0,
    total: 0
  }));

  const personalForecast: PersonalForecastEntry[] = [];

  // --- Parse current week's sheet ---
  const crewNameFound = parseSheetRows({
    csvData,
    forecastAccumulators,
    hourlyRosters,
    personalForecast,
    crewName,
    targetDate,
    forecastStartHour: 0,
    forecastEndHour: STATION_FORECAST_HOURS,
    columnForHour: (h) => columnIndex + h,
    debugInfo,
    debugColumnIndex: columnIndex,
  });

  // Work out whether the 24-hour view crosses into the next roster week.
  const overflowStartIndex = Math.max(0, ROSTER_END_COL_INDEX - columnIndex);
  const overflowHours = STATION_FORECAST_HOURS - overflowStartIndex;
  const needsNextWeekNow = overflowHours > 0 && overflowStartIndex < STATION_FORECAST_HOURS;

  // Load next week only when Tuesday's visible 24-hour forecast crosses the
  // roster boundary. Earlier prefetching can cache Google's fallback worksheet
  // under the wrong future-week name.
  const nextWed = addDays(rotationStart, 7);
  let nextCsvData: any[] | null = null;
  if (needsNextWeekNow) {
    try {
      const nextMode: RosterLoadMode = isCached ? 'cache-only' : mode;
      const nextResult = await loadCsvForDate(nextWed, nextMode);
      nextCsvData = nextResult.csvData;
    } catch (e) {
      // Next week's sheet doesn't exist yet — that's fine
      console.debug("Next week sheet not available:", e);
    }
  }

  // --- Cross-week stitching: use next week data if forecast overflows ---
  if (nextCsvData && needsNextWeekNow) {
    parseSheetRows({
      csvData: nextCsvData,
      forecastAccumulators,
      hourlyRosters,
      personalForecast,
      crewName,
      targetDate,
      forecastStartHour: overflowStartIndex,
      forecastEndHour: STATION_FORECAST_HOURS,
      columnForHour: (h) => ROSTER_START_COL_INDEX + (h - overflowStartIndex),
      sourceLabel: ' (next)',
    });
  }

  // Summary logic uses index 0 (current hour)
  const currentAcc = forecastAccumulators[0];
  const summary = {
    helms: currentAcc.helms,
    navs: currentAcc.navs,
    crew: currentAcc.crew,
    total: currentAcc.total,
    status: calculateOperationalStatus(currentAcc.helms, currentAcc.navs, currentAcc.total)
  };

  const forecast: ForecastEntry[] = forecastAccumulators.map((acc, idx) => {
    const targetColIndex = columnIndex + idx;
    const time = addHours(targetDate, idx);
    const label = format(time, 'HH:mm');

    // End of week: show NO_DATA only if stitching didn't populate this hour
    if (targetColIndex >= ROSTER_END_COL_INDEX) {
        if (acc.total === 0 && acc.helms === 0 && acc.navs === 0) {
            return {
                time,
                label,
                status: OperationalStatus.NO_DATA,
                totalCount: 0
            };
        }
    }

    return {
      time,
      label,
      status: calculateOperationalStatus(acc.helms, acc.navs, acc.total),
      totalCount: acc.total
    };
  });

  // Build a compact operational overview for the complete current roster week.
  // This deliberately uses only the validated Wednesday-Tuesday worksheet and
  // is independent of the rolling 24-hour forecast above.
  const weekForecastAccumulators = Array.from({ length: HOURS_IN_WEEK }, () => ({
    helms: 0,
    navs: 0,
    crew: 0,
    total: 0,
  }));

  parseSheetRows({
    csvData,
    forecastAccumulators: weekForecastAccumulators,
    personalForecast: [],
    targetDate: rotationStart,
    forecastStartHour: 0,
    forecastEndHour: HOURS_IN_WEEK,
    columnForHour: hour => ROSTER_START_COL_INDEX + hour,
  });

  const weekForecast: ForecastEntry[] = weekForecastAccumulators.map((acc, hour) => {
    const time = addHours(rotationStart, hour);
    return {
      time,
      label: format(time, 'HH:mm'),
      status: calculateOperationalStatus(acc.helms, acc.navs, acc.total),
      totalCount: acc.total,
    };
  });

  return {
    roster: hourlyRosters[0],
    hourlyRosters: hourlyRosters,
    summary,
    forecast,
    weekForecast,
    personalForecast,
    crewNameFound,
    fetchedAt: new Date(sourceTimestamp),
    sheetName: usedSheetName,
    isCachedData: isCached,
    debug: debugInfo
  };
};
