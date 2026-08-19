import { format, subDays, getDay, addDays, startOfDay, isBefore } from 'date-fns';

/**
 * Get the Wednesday immediately preceding the given date.
 * If today is Wednesday, returns today.
 */
export const getLastWednesday = (date: Date): Date => {
  const day = getDay(date); // 0 = Sunday, 1 = Monday, ..., 3 = Wednesday
  const diff = (day < 3 ? 7 : 0) + day - 3;
  return startOfDay(subDays(date, diff));
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