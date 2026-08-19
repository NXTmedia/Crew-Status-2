
import React, { useState } from 'react';
import { ForecastEntry, OperationalStatus } from '../types';
import { format, addHours } from 'date-fns';

interface StatusTimelineProps {
  forecast: ForecastEntry[];
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ forecast }) => {
  const [showCount, setShowCount] = useState(true);
  if (!forecast || forecast.length === 0) return null;

  const getColorClass = (status: OperationalStatus) => {
    switch (status) {
      case OperationalStatus.GREEN:
        return 'bg-safe border-safe';
      case OperationalStatus.ORANGE:
        return 'bg-orange-500 border-orange-500';
      case OperationalStatus.RED:
        return 'bg-alert border-alert';
      case OperationalStatus.NO_DATA:
      default:
        // Dark grey square for end of data / unknown
        return 'bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="mb-6">
        <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Station 24-Hour Forecast</span>
        </div>
        <div className="grid grid-cols-12 gap-1 cursor-pointer select-none" onClick={() => setShowCount(c => !c)}>
        {forecast.map((entry, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1">
            <div
                className={`w-full aspect-square rounded-sm border ${getColorClass(entry.status)} opacity-90 shadow-sm flex items-center justify-center`}
                title={`${entry.label} - ${entry.status}`}
            >
                {showCount && entry.status !== OperationalStatus.NO_DATA && (
                    <span className="text-[9px] font-bold text-white/90 leading-none drop-shadow">
                        {entry.totalCount}
                    </span>
                )}
            </div>
            {/* Increment hour by 1 for display as requested, handling 23->00 rollover */}
            <span className="text-[9px] text-slate-500 font-mono">
                {format(addHours(entry.time, 1), 'HH')}
            </span>
            </div>
        ))}
        </div>
    </div>
  );
};
