
export interface CrewMember {
  name: string;
  role: string;
  status: number; // 2 = On Call
  sourceCell: string; // E.g., "A45"
}

export interface RosterData {
  [role: string]: CrewMember[];
}

export interface DebugInfo {
  spreadsheetId: string;
  gid?: string;
  sheetName: string;
  targetDate: string;
  rotationStart: string;
  daysOffset: number;
  hour: number;
  columnIndex: number;
  columnLetter: string;
  rawCellValue?: string; // The value found at the calculated cell
  csvPreview: string; // First few lines of the raw CSV
  headerDateValue?: string; // Value at Row 0, Target Col
  headerHourValue?: string; // Value at Row 1, Target Col
  columnDump: string[]; // List of values in the target column for debugging
}

export enum OperationalStatus {
  GREEN = 'GREEN',   // 2 Boats (2+ Helms, 4+ Senior, 6+ Total)
  ORANGE = 'ORANGE', // 1 Boat (1+ Helms, 2+ Senior, 3+ Total)
  RED = 'RED',       // 0 Boats
  NO_DATA = 'NO_DATA' // End of sheet / No data available
}

export interface ForecastEntry {
  time: Date;
  status: OperationalStatus;
  label: string; // e.g., "14:00"
  totalCount?: number; // Total crew count for this hour
}

export interface PersonalForecastEntry {
  time: Date;
  hourLabel: string;
  status: number; // 2 = Available, 0/Other = Unavailable
}

export interface SheetParseResult {
  roster: RosterData; // Roster for the CURRENT hour (Legacy/Default)
  hourlyRosters: RosterData[]; // Rosters for each hour in the forecast window
  summary: {
    helms: number;
    navs: number; // Tier 2 / Navigator
    crew: number; // Tier 1 / Generic
    total: number;
    status: OperationalStatus;
  };
  forecast: ForecastEntry[];
  personalForecast: PersonalForecastEntry[];
  crewNameFound: boolean;
  fetchedAt: Date;
  sheetName: string;
  isCachedData: boolean; // Indicates if source is local storage
  debug: DebugInfo;
}

export enum LoadStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface AppState {
  status: LoadStatus;
  data: SheetParseResult | null;
  error: string | null;
  targetDate: Date;
}