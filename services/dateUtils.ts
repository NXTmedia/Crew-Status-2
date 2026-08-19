import { format, subDays, getDay, addDays, startOfDay, isSameDay } from 'date-fns';

/**
 * A roster day always contains 24 spreadsheet slots, even when the UK clocks
 * change. Keep the calendar date and wall-clock hour separate so JavaScript's
 * elapsed-time arithmetic cannot skip or repeat a spreadsheet column at DST.
 */
export const getRosterSlot = (baseDate: Date, offsetHours: number) => {
  const totalHours = baseDate.getHours() + offsetHours;
  const dayOffset = Math.floor(totalHours / 24);
  const startHour = ((totalHours % 24) + 24) % 24;

  return {
    date: addDays(startOfDay(baseDate), dayOffset),
    startHour,
    endHour: (startHour + 1) % 24,
  };
};

export const formatRosterHour = (hour: number): string =>
  String(hour).padStart(2, '0');

export const isCurrentRosterSlot = (
  slotDate: Date,
  startHour: number,
  referenceDate: Date = new Date(),
): boolean => isSameDay(slotDate, referenceDate) && startHour === referenceDate.getHours();

/**
 * Get the Wednesday immediately preceding the given date.
 * If today is Wednesday, returns today.
 */
export const getLastWednesday = (date: Date): Date => {
  const day = getDay(date); // 0 = Sunday, 1 = Monday, ..., 3 = Wednesday
  const diff = (day < 3 ? 7 : 0) + day - 3;
  return startOfDay(subDays(date, diff));
};

/**
 * Personal availability normally stays inside the current Wednesday-Tuesday
 * roster. On Tuesday, the following roster becomes visible so tomorrow's
 * availability can be checked before the handover.
 */
export const getAvailabilityDateRange = (referenceDate: Date): { minDate: Date; maxDate: Date } => {
  const minDate = getLastWednesday(referenceDate);
  const canPreviewNextWeek = getDay(referenceDate) === 2; // Tuesday

  return {
    minDate,
    maxDate: addDays(minDate, canPreviewNextWeek ? 13 : 6),
  };
};

/**
 * Guards service-level requests as well as the UI. A future roster may only be
 * requested on Tuesday, and only for the immediately following week.
 */
export const canViewRosterWeek = (targetDate: Date, referenceDate: Date = new Date()): boolean => {
  const targetWeek = getLastWednesday(targetDate);
  const currentWeek = getLastWednesday(referenceDate);

  if (targetWeek.getTime() <= currentWeek.getTime()) return true;

  const nextWeek = addDays(currentWeek, 7);
  return getDay(referenceDate) === 2 && targetWeek.getTime() === nextWeek.getTime();
};

export const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
};

/**
 * Generates possible tab names based on the Rotation Start (Wednesday).
 * Format: {Day}{Suffix} {Month} {Year}
 * E.g., "19th Nov 2025" (Priority) or "19th November 2025"
 */
export const generatePossibleTabNames = (date: Date): string[] => {
  const rotationStart = getLastWednesday(date);
  
  const day = rotationStart.getDate();
  const suffix = getOrdinalSuffix(day);
  const year = format(rotationStart, 'yyyy');
  
  const fullMonth = format(rotationStart, 'MMMM'); // November
  const shortMonth = format(rotationStart, 'MMM'); // Nov
  
  // Specific catch for September which can be 'Sep' or 'Sept'
  const isSept = fullMonth === 'September';

  // Priority 1: Short Month (e.g., "19th Nov 2025") - As requested by user
  // Priority 2: Full Month (e.g., "19th November 2025")
  const names = [
    `${day}${suffix} ${shortMonth} ${year}`, 
    `${day}${suffix} ${fullMonth} ${year}`,
  ];

  if (isSept) {
    names.push(`${day}${suffix} Sept ${year}`);
  }

  return names;
};

export const formatTime = (date: Date): string => {
  return format(date, 'HH:mm');
};

export const formatDateDisplay = (date: Date): string => {
  return format(date, 'EEE, dd MMM');
};
