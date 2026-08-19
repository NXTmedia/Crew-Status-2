
import React, { useState, useEffect, useRef } from 'react';
import { PersonalForecastEntry } from '../types';
import { UserCheck, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, addDays, addHours, isSameDay, startOfDay, isBefore, isAfter, isSameHour } from 'date-fns';
import { fetchPersonalSchedule } from '../services/sheetService';
import { getLastWednesday } from '../services/dateUtils';

interface PersonalAvailabilityProps {
  crewName: string;
  currentStatus?: number; // 2 = On Call, 0 = Off
  onOpenSettings: () => void;
  lastRefreshTime?: Date; // Signal from parent to re-fetch
}

export const getAvailabilityBoxClass = (isCurrentHour: boolean, isAvailable: boolean) =>
  `w-full aspect-[4/3] rounded-md transition-all duration-300 relative ${
    isCurrentHour
      ? 'animate-current-hour z-10'
      : !isAvailable ? 'border border-slate-700/50' : ''
  } ${
    isAvailable
      ? 'bg-safe shadow-[0_0_8px_rgba(40,167,69,0.4)]'
      : 'bg-slate-800'
  }`;

export const PersonalAvailability: React.FC<PersonalAvailabilityProps> = ({ crewName, currentStatus, onOpenSettings, lastRefreshTime }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [now, setNow] = useState(new Date()); // Track real time for the highlight
  const [data, setData] = useState<PersonalForecastEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(true);
  const [nextWeekUnavailable, setNextWeekUnavailable] = useState(false);

  // Calculate Roster Boundaries (Wed - Next Tue)
  const today = startOfDay(new Date());
  const minDate = getLastWednesday(today); // Current Roster Start (Wed)
  const maxDate = addDays(minDate, 13);    // Next Roster End (next Tue)

  const isAtStart = isSameDay(viewDate, minDate);
  const isAtEnd = isSameDay(viewDate, maxDate);

  // Swipe State
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Timer to move the pulsing current-hour marker as time advances.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // Check every minute
    return () => clearInterval(timer);
  }, []);

  // Navigation / crew change: clear data immediately so the spinner shows right away
  useEffect(() => {
    if (crewName) {
      setData([]);
      setFound(true);
      setNextWeekUnavailable(false);
      loadDataForDate(viewDate);
    }
  }, [viewDate, crewName]);

  // Background refresh from parent: silent reload, no spinner
  useEffect(() => {
    if (crewName && lastRefreshTime) {
      loadDataForDate(viewDate);
    }
  }, [lastRefreshTime]);

  const loadDataForDate = async (date: Date) => {
    if (data.length === 0) setLoading(true);
    setNextWeekUnavailable(false);

    try {
      // Always try cache first for speed. If parent just refreshed, cache will be new.
      const result = await fetchPersonalSchedule(date, crewName);
      setData(result.data);
      setFound(result.found);
    } catch (e: any) {
      console.error(e);
      if (e?.message === 'NEXT_WEEK_NOT_AVAILABLE') {
        setData([]);
        setFound(true); // Don't show "Name Not Found"
        setNextWeekUnavailable(true);
      } else {
        setFound(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrevDay = () => {
    if (!isAtStart) {
      setViewDate(prev => addDays(prev, -1));
    }
  };

  const handleNextDay = () => {
    if (!isAtEnd) {
      setViewDate(prev => addDays(prev, 1));
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && !isAtEnd) handleNextDay();
    if (isRightSwipe && !isAtStart) handlePrevDay();

    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (!crewName) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center mb-6">
        <h3 className="text-lg font-bold text-white mb-2">Set Your Name</h3>
        <p className="text-slate-400 text-sm mb-4">Enter your roster name to see your availability.</p>
        <button 
          onClick={onOpenSettings}
          className="bg-rnli-orange hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
        >
          Configure Settings
        </button>
      </div>
    );
  }

  const isToday = isSameDay(viewDate, today);
  const isNextWeek = !isSameDay(getLastWednesday(viewDate), minDate);

  // Determine which content to show in the hourly grid area
  const renderGridContent = () => {
    if (loading && data.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center py-8 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2 text-rnli-orange" />
          <span className="text-xs">Loading Schedule...</span>
        </div>
      );
    }

    if (!found) {
      return (
        <div className="flex items-start gap-3 py-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-200 text-sm">Name Not Found</h3>
            <p className="text-red-300/80 text-xs mb-2">
              Could not find "<strong>{crewName}</strong>" in the roster.
            </p>
            <button onClick={onOpenSettings} className="text-xs underline text-red-300">Change Name</button>
          </div>
        </div>
      );
    }

    if (nextWeekUnavailable) {
      return (
        <div className="h-full flex flex-col items-center justify-center py-8 text-slate-500">
          <span className="text-sm text-slate-400">Next week's roster is not yet published.</span>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-6 gap-2">
        {data.map((entry, idx) => {
          const isAvailable = entry.status === 2;
          const startHour = format(entry.time, 'HH');
          const endHour = format(addHours(entry.time, 1), 'HH');
          const isCurrentHour = isSameHour(entry.time, now);

          return (
            <div key={idx} className="flex flex-col gap-1 relative">
              <div
                className={getAvailabilityBoxClass(isCurrentHour, isAvailable)}
              ></div>
              <span className={`text-[11px] text-center font-medium tracking-tight ${isCurrentHour ? 'text-white font-bold' : 'text-slate-300'}`}>
                {startHour}-{endHour}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="mb-6 animate-fade-in-up select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
           <UserCheck className="w-6 h-6 text-rnli-orange" />
           <span className="text-lg font-semibold text-white">My Availability - {crewName}</span>
        </div>
      </div>

      {/* Date Navigation Header */}
      <div className="flex items-center justify-between bg-slate-800 rounded-t-xl p-3 border-b border-slate-700">
        <button
          onClick={handlePrevDay}
          disabled={isAtStart}
          className={`p-1 rounded-full transition-colors ${isAtStart ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700'}`}
        >
            <ChevronLeft className="w-5 h-5 text-slate-400" />
        </button>

        <button
            onClick={() => setViewDate(new Date())}
            className="text-center focus:outline-none group"
        >
            <div className={`font-bold transition-colors ${isToday ? 'text-rnli-orange' : 'text-white group-hover:text-rnli-orange/80'}`}>
                {format(viewDate, 'EEEE, d MMM')}
            </div>
            {isToday && <div className="text-[10px] font-bold text-rnli-orange tracking-widest uppercase">Today</div>}
            {!isToday && isNextWeek && <div className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">Next Week</div>}
        </button>

        <button
          onClick={handleNextDay}
          disabled={isAtEnd}
          className={`p-1 rounded-full transition-colors ${isAtEnd ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700'}`}
        >
            <ChevronRight className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Hourly Grid / Status Area */}
      <div className="bg-slate-900 border border-slate-800 rounded-b-xl p-4 min-h-[160px]">
        {renderGridContent()}
      </div>
      <div className="text-center mt-2 text-[10px] text-slate-600">
        Swipe left/right to change days
      </div>
    </div>
  );
};
