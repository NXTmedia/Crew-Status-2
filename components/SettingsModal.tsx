import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  isLaViewEnabled: boolean;
  onSave: (name: string, isLaView: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentName, isLaViewEnabled, onSave }) => {
  const [name, setName] = useState(currentName);
  const [isLaView, setIsLaView] = useState(isLaViewEnabled);

  useEffect(() => {
    setName(currentName);
    setIsLaView(isLaViewEnabled);
  }, [currentName, isLaViewEnabled, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(name.trim(), isLaView);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="crewName" className="block text-sm font-medium text-slate-400 mb-2">
              Your Roster Name
            </label>
            <input
              type="text"
              id="crewName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Damian"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rnli-orange"
              autoFocus
            />
            <p className="mt-2 text-xs text-slate-500">
              Enter your name exactly as it appears on the Google Sheet row.
            </p>
          </div>

          <div className="mb-8 bg-slate-950 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
                <label className="block text-sm font-medium text-white mb-1">LA View</label>
                <p className="text-xs text-slate-500">Enable Station Board mode</p>
            </div>

            <button
                type="button"
                onClick={() => setIsLaView(!isLaView)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rnli-orange/50 ${isLaView ? 'bg-rnli-orange' : 'bg-slate-700'}`}
            >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${isLaView ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <p className="text-center text-xs text-slate-600 mb-3">v2.1</p>

          <div className="flex gap-3">
             <button
               type="button"
               onClick={onClose}
               className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-3 rounded-xl transition-colors"
             >
               Cancel
             </button>
             <button
               type="submit"
               className="flex-1 bg-rnli-orange hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
             >
               <Save className="w-4 h-4" />
               Save
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};
