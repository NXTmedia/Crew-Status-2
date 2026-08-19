
import React from 'react';
import { RosterData } from '../types';
import { SECTION_HEADERS, UI_SECTION_ORDER } from '../constants';
import { RosterGroup } from './RosterGroup';

interface ActiveCrewListProps {
  roster: RosterData;
  timeLabel: string;
}

export const ActiveCrewList: React.FC<ActiveCrewListProps> = ({ roster, timeLabel }) => {
  if (!roster) return null;

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-2">
        <h2 className="text-lg font-bold text-white">Active Crew</h2>
        <span className="text-xs font-mono bg-slate-800 text-rnli-orange px-2 py-1 rounded-md">
           Hour Ending {timeLabel}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <RosterGroup 
            title="Helms" 
            members={roster[SECTION_HEADERS.COMMAND]} 
            borderClass="border-safe"
        />
        <RosterGroup 
            title="Tier 2" 
            members={roster[SECTION_HEADERS.NAVIGATOR]} 
            borderClass="border-blue-500"
        />
        <RosterGroup 
            title="Tier 1 / SOS" 
            members={roster[SECTION_HEADERS.TIER1]} 
            borderClass="border-purple-500"
        />
      </div>
    </div>
  );
};
