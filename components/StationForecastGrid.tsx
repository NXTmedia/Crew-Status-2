
import React, { useState } from 'react';
import { ForecastEntry, OperationalStatus } from '../types';
import { format, addHours, isBefore, isSameHour, startOfDay } from 'date-fns';

interface StationForecastGridProps {
  forecast: ForecastEntry[];
  weekForecast: ForecastEntry[];
  selectedIndex: number;
  onSelectHour: (index: number) => void;
  onViewChange?: (view: ForecastView) => void;
}

export type ForecastView = '24-hours' | '7-days';

export const getVisibleWeekDays = (weekForecast: ForecastEntry[], referenceDate: Date = new Date()) => {
  const today = startOfDay(referenceDate);
  return Array.from({ length: 7 }, (_, day) =>
    weekForecast.slice(day * 24, (day + 1) * 24),
  ).filter(entries =>
    entries.length === 24 && !isBefore(startOfDay(entries[0].time), today),
  );
};

export const StationForecastGrid: React.FC<StationForecastGridProps> = ({
  forecast,
  weekForecast,
  selectedIndex,
  onSelectHour,
  onViewChange,
}) => {
  const [view, setView] = useState<ForecastView>('24-hours');
  if (!forecast || forecast.length === 0) return null;

  const getColorClass = (status: OperationalStatus, isSelected: boolean) => {
    if (status === OperationalStatus.NO_DATA) {
        return 'bg-slate-800 border-slate-700 opacity-50';
    }
    
    // Base colors
    let base = '';
    switch (status) {
      case OperationalStatus.GREEN:
        base = 'bg-safe border-safe';
        break;
      case OperationalStatus.ORANGE:
        base = 'bg-orange-500 border-orange-500';
        break;
      case OperationalStatus.RED:
        base = 'bg-alert border-alert';
        break;
    }

    if (isSelected) {
        return `${base} ring-2 ring-white ring-offset-2 ring-offset-slate-950 z-10`;
    }
    
    return `${base} opacity-90`;
  };

  const weekDays = getVisibleWeekDays(weekForecast);

  const changeView = (nextView: ForecastView) => {
    setView(nextView);
    onViewChange?.(nextView);
  };

  return (
    <div className="mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
              {view === '24-hours' ? 'Station 24-Hour Forecast' : 'Station 7-Day Forecast'}
            </span>
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
              <button
                type="button"
                aria-label="Show 24 hour forecast"
                aria-pressed={view === '24-hours'}
                onClick={() => changeView('24-hours')}
                className={`rounded-md px-2 py-1 text-[9px] font-bold transition-colors ${
                  view === '24-hours' ? 'bg-rnli-orange text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                24 Hours
              </button>
              <button
                type="button"
                aria-label="Show 7 day forecast"
                aria-pressed={view === '7-days'}
                onClick={() => changeView('7-days')}
                disabled={weekForecast.length !== 168}
                className={`rounded-md px-2 py-1 text-[9px] font-bold transition-colors ${
                  view === '7-days' ? 'bg-rnli-orange text-white' : 'text-slate-500 hover:text-slate-300'
                } disabled:cursor-not-allowed disabled:opacity-30`}
              >
                7 Days
              </button>
            </div>
        </div>

        {view === '24-hours' ? (
          <>
            <div className="text-right text-[9px] text-slate-600 italic mb-2 px-1">Select an hour to view roster</div>
            {/* 4 Rows of 6 Hours */}
            <div className="grid grid-cols-6 gap-2">
              {forecast.slice(0, 24).map((entry, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                      <button
                          key={idx}
                          onClick={() => onSelectHour(idx)}
                          className="flex flex-col items-center gap-1 group focus:outline-none"
                      >
                          <div
                              className={`w-full aspect-[4/3] rounded-md border transition-all duration-200 flex items-center justify-center ${getColorClass(entry.status, isSelected)}`}
                          >
                              {entry.status !== OperationalStatus.NO_DATA && (
                                  <span className="text-slate-200 font-bold text-sm drop-shadow-md">
                                      {entry.totalCount ?? 0}
                                  </span>
                              )}
                          </div>
                          {/* Increment hour by 1 for display as requested, handling 23->00 rollover */}
                          <span className={`text-[9px] font-mono transition-colors ${isSelected ? 'text-white font-bold' : 'text-slate-500 group-hover:text-slate-300'}`}>
                              {format(addHours(entry.time, 1), 'HH')}
                          </span>
                      </button>
                  );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-3" data-testid="week-forecast-grid">
            {weekDays.map((entries, dayIndex) => {
              if (entries.length !== 24) return null;
              const dayDate = entries[0].time;
              return (
                <section key={dayIndex}>
                  <div className="flex items-baseline justify-between mb-1 px-1">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                      {format(dayDate, 'EEEE')}
                    </span>
                    <span className="text-[9px] text-slate-600">{format(dayDate, 'd MMM')}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-x-1 gap-y-2" data-week-day-grid>
                    {entries.map((entry, hourIndex) => {
                      const isCurrentHour = isSameHour(entry.time, new Date());
                      const hourEnding = format(addHours(entry.time, 1), 'HH');
                      return (
                        <div
                          key={hourIndex}
                          data-week-hour
                          aria-label={`${format(entry.time, 'EEEE')}, hour ending ${hourEnding}:00 — ${entry.status}, ${entry.totalCount ?? 0} crew`}
                          title={`Hour ending ${hourEnding}:00 — ${entry.totalCount ?? 0} crew`}
                          className="flex min-w-0 flex-col items-center gap-1"
                        >
                          <div className={`w-full aspect-square rounded-sm border flex items-center justify-center ${getColorClass(entry.status, isCurrentHour)}`}>
                            {entry.status !== OperationalStatus.NO_DATA && (
                              <span data-week-crew-count className="text-[10px] font-bold leading-none text-white drop-shadow-md">
                                {entry.totalCount ?? 0}
                              </span>
                            )}
                          </div>
                          <span data-week-hour-label className="text-[8px] font-mono leading-none text-slate-500">
                            {hourEnding}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
    </div>
  );
};
