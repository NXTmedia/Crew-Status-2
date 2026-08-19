export const SECTION_HEADERS = {
  COMMAND: 'Command',
  NAVIGATOR: 'Tier 2 / Navigator',
  TIER1: 'Tier 1',
  SAFE_ON_SERVICE: 'Safe on Service',
};

export const PARSER_STOP_TRIGGER = 'Shore Crew';
export const PROBATIONER_HEADER = 'Probationer';

// The keys here must match the values above for the UI to find them in the data map
export const UI_SECTION_ORDER = [
  SECTION_HEADERS.COMMAND,
  SECTION_HEADERS.NAVIGATOR,
  SECTION_HEADERS.TIER1,
];

export const VALID_COLUMN_B_FLAG = 'C';
export const ON_CALL_STATUS_CODE = '2';