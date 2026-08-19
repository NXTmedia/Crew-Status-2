import React from 'react';
import { CrewMember } from '../types';

interface RosterGroupProps {
  title: string;
  members: CrewMember[];
  icon?: React.ReactNode;
  borderClass?: string;
}

export const RosterGroup: React.FC<RosterGroupProps> = ({ title, members, icon, borderClass = 'border-rnli-orange' }) => {
  if (!members || members.length === 0) return null;

  return (
    <div className="mb-6 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-3 px-1">
        {icon}
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
        <span className="ml-auto text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
          {members.length}
        </span>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {members.map((member, idx) => (
          <div 
            key={`${member.name}-${idx}`}
            className={`bg-slate-800 hover:bg-slate-750 border-l-4 ${borderClass} rounded-r-lg p-3 flex items-center justify-between shadow-sm transition-colors`}
          >
            <div className="flex flex-col">
              <span className="font-medium text-white">{member.name}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-xs text-green-400 font-medium">On Call</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};