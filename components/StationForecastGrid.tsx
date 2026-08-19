
import React from 'react';
import { ForecastEntry, OperationalStatus } from '../types';
import { format, addHours } from 'date-fns';

interface StationForecastGridProps {
  forecast: ForecastEntry[];
  selectedIndex: number;
  onSelectHour: (index: number) => void;
}

export const StationForecastGrid: React.FC<StationForecastGridProps> = ({ forecast, selectedIndex, onSelectHour }) => {
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

  return (
    <div className="mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Station 24-Hour Forecast</span>
            <span className="text-[9px] text-slate-600 italic">Select an hour to view roster</span>
        </div>
        
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
                        {entry.status !== OperationalStatus.NO_DATA && isSelected && (
                            <span className="text-slate-200 font-bold text-sm drop-shadow-md">
                                {entry.totalCount}
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
    </div>
  );
};
