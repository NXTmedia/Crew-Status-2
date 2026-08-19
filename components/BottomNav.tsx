
import React from 'react';
import { UserCircle, LayoutDashboard } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Root "/" is Crew Dashboard, "/station" is Station Dashboard
  const isCrew = location.pathname === '/';
  const isStation = location.pathname === '/station';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 pb-safe pt-2 px-6 z-50">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        <button 
          onClick={() => navigate('/')}
          className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${isCrew ? 'text-rnli-orange' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <UserCircle className={`w-6 h-6 ${isCrew ? 'scale-110' : ''} transition-transform`} />
          <span className="text-[10px] font-bold uppercase tracking-wide">My Status</span>
        </button>

        <button 
          onClick={() => navigate('/station')}
          className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${isStation ? 'text-rnli-orange' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <LayoutDashboard className={`w-6 h-6 ${isStation ? 'scale-110' : ''} transition-transform`} />
          <span className="text-[10px] font-bold uppercase tracking-wide">Station Board</span>
        </button>
      </div>
    </div>
  );
};
