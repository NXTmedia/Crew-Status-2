import React, { useState } from 'react';
import { RosterData, CrewMember } from '../types';
import { SECTION_HEADERS } from '../constants';
import { X, Users } from 'lucide-react';

interface SummaryProps {
  helms: number;
  navs: number;
  crew: number;
  roster?: RosterData;
}

export const SummaryStats: React.FC<SummaryProps> = ({ helms, navs, crew, roster }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string>('');

  // Thresholds for warning colors
  const isHelmLow = helms < 2; 
  const isNavLow = navs < 1; 

  const handleOpen = (categoryKey: string, title: string) => {
    if (roster && roster[categoryKey]) {
      setSelectedCategory(categoryKey);
      setModalTitle(title);
    }
  };

  const handleClose = () => {
    setSelectedCategory(null);
  };

  const activeMembers = selectedCategory && roster ? roster[selectedCategory] : [];

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-6 select-none">
        <button 
          onClick={() => handleOpen(SECTION_HEADERS.COMMAND, 'Helms On Call')}
          className={`p-2 rounded-xl border ${isHelmLow ? 'bg-red-900/20 border-red-800' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'} flex flex-col items-center justify-center transition-colors active:scale-95`}
        >
          <span className="text-xl font-bold text-white">{helms}</span>
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Helms</span>
        </button>
        
        <button 
          onClick={() => handleOpen(SECTION_HEADERS.NAVIGATOR, 'Tier 2 On Call')}
          className={`p-2 rounded-xl border ${isNavLow ? 'bg-yellow-900/20 border-yellow-800' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'} flex flex-col items-center justify-center transition-colors active:scale-95`}
        >
          <span className="text-xl font-bold text-white">{navs}</span>
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Tier 2</span>
        </button>

        <button 
          onClick={() => handleOpen(SECTION_HEADERS.TIER1, 'Tier 1 / SOS On Call')}
          className="p-2 rounded-xl border bg-slate-900 border-slate-800 hover:bg-slate-800 flex flex-col items-center justify-center transition-colors active:scale-95"
        >
          <span className="text-xl font-bold text-white">{crew}</span>
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Tier 1 / SOS</span>
        </button>
      </div>

      {/* Popup Modal */}
      {selectedCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />
          
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-rnli-orange" />
                {modalTitle}
              </h3>
              <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {activeMembers.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {activeMembers.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
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
              ) : (
                <div className="text-center py-8 text-slate-500 italic">
                  No crew members currently on call in this category.
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