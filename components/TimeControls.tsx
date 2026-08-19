import React from 'react';
import { ExternalLink } from 'lucide-react';
import { CONFIG } from '../config';

interface TimeControlsProps {}

export const TimeControls: React.FC<TimeControlsProps> = () => {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/edit`;

  return (
    <div className="w-full px-4 pb-8">
      <div className="max-w-lg mx-auto w-full">
        {/* Sheet Link */}
        <a 
          href={sheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-12 rounded-xl bg-rnli-orange hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-900/20 no-underline flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Open Google Sheet</span>
        </a>
      </div>
    </div>
  );
};