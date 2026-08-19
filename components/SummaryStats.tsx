import React, { useState } from 'react';
import { RosterData, CrewMember } from '../types';
import { X, Users } from 'lucide-react';
import { SECTION_HEADERS } from '../constants';

interface SummaryProps {
  helms: number;
  navs: number;
  crew: number;
  roster?: RosterData;
}

const GROUP_LABELS: Record<string, string> = {
  [SECTION_HEADERS.COMMAND]: 'Helms / Command',
  [SECTION_HEADERS.NAVIGATOR]: 'Tier 2 / Navigators',
  [SECTION_HEADERS.TIER1]: 'Tier 1 / SOS',
  [SECTION_HEADERS.SAFE_ON_SERVICE]: 'Safe on Service',
};

const GROUP_ORDER = [
  SECTION_HEADERS.COMMAND,
  SECTION_HEADERS.NAVIGATOR,
  SECTION_HEADERS.TIER1,
  SECTION_HEADERS.SAFE_ON_SERVICE,
];

export const SummaryStats: React.FC<SummaryProps> = ({ helms, navs, crew, roster }) => {
  const [isRosterOpen, setIsRosterOpen] = useState(false);

  // Thresholds for warning colors
  const isHelmLow = helms < 2; 
  const isNavLow = navs < 1; 

  const handleOpen = () => {
    if (roster) setIsRosterOpen(true);
  };

  const handleClose = () => {
    setIsRosterOpen(false);
  };

  const activeMembers: CrewMember[] = roster
    ? Array.from(
        new Map(
          Object.values(roster)
            .flat()
            .map(member => [member.name.toLocaleLowerCase(), member]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const rosterGroups = roster
    ? [
        ...GROUP_ORDER.filter(role => roster[role]?.length).map(role => [role, roster[role]] as const),
        ...Object.entries(roster).filter(
          ([role, members]) => !GROUP_ORDER.includes(role) && members.length > 0,
        ),
      ].map(([role, members]) => ({
        role,
        label: GROUP_LABELS[role] || role,
        members: Array.from(
          new Map(members.map(member => [member.name.toLocaleLowerCase(), member])).values(),
        ).sort((a, b) => a.name.localeCompare(b.name)),
      }))
    : [];

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-6 select-none">
        <button 
          onClick={handleOpen}
          className={`p-2 rounded-xl border ${isHelmLow ? 'bg-red-900/20 border-red-800' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'} flex flex-col items-center justify-center transition-colors active:scale-95`}
        >
          <span className="text-xl font-bold text-white">{helms}</span>
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Helms</span>
        </button>
        
        <button 
          onClick={handleOpen}
          className={`p-2 rounded-xl border ${isNavLow ? 'bg-yellow-900/20 border-yellow-800' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'} flex flex-col items-center justify-center transition-colors active:scale-95`}
        >
          <span className="text-xl font-bold text-white">{navs}</span>
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Tier 2</span>
        </button>

        <button 
          onClick={handleOpen}
          className="p-2 rounded-xl border bg-slate-900 border-slate-800 hover:bg-slate-800 flex flex-col items-center justify-center transition-colors active:scale-95"
        >
          <span className="text-xl font-bold text-white">{crew}</span>
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Tier 1 / SOS</span>
        </button>
      </div>

      {/* Popup Modal */}
      {isRosterOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />
          
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-rnli-orange" />
                All Crew On Call ({activeMembers.length})
              </h3>
              <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {activeMembers.length > 0 ? (
                <div className="flex flex-col gap-5">
                  {rosterGroups.map(group => (
                    <section key={group.role}>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {group.label}
                        </h4>
                        <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                          {group.members.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {group.members.map(member => (
                          <div key={`${group.role}-${member.name}`} className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                            <span className="font-medium text-slate-200">{member.name}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                              <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">On Call</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 italic">
                  No crew members are currently on call.
                </div>
              )}
            </div>

            <button 
              onClick={handleClose}
              className="mt-4 w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
