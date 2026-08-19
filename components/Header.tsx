import React, { useRef } from 'react';
import { Anchor, RotateCw, CheckCircle2, AlertTriangle, XCircle, Settings, WifiOff, Database } from 'lucide-react';
import { formatTime, formatDateDisplay } from '../services/dateUtils';
import { OperationalStatus } from '../types';

interface HeaderProps {
  lastUpdated?: Date;
  displayTime?: Date;
  onRefresh: () => void;
  onOpenSettings?: () => void;
  onTitleLongPress?: () => void;
  isLoading: boolean;
  sheetName?: string;
  status?: OperationalStatus;
  personalStatus?: number; // 2 = On Call
  isOffline?: boolean;
  isCachedData?: boolean;
  showPersonalStatus?: boolean;
  showSettings?: boolean;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ 
  lastUpdated, 
  displayTime,
  onRefresh, 
  onOpenSettings, 
  onTitleLongPress,
  isLoading, 
  status, 
  personalStatus,
  isOffline = false,
  isCachedData = false,
  showPersonalStatus = true,
  showSettings = true,
  title = "Crew Status 2"
}) => {
  
  const displayDate = displayTime || new Date();
  const hasPersonalStatus = personalStatus !== undefined;
  const isOnCall = personalStatus === 2;
  // Use ReturnType<typeof setTimeout> for cross-environment compatibility (Node vs Browser types)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressStart = () => {
    if (!onTitleLongPress) return;
    timerRef.current = setTimeout(() => {
      // Vibrate on mobile to indicate success if supported
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(50);
      }
      onTitleLongPress();
    }, 800); // 800ms threshold
  };

  const handlePressEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const getStatusConfig = (s?: OperationalStatus) => {
    switch (s) {
      case OperationalStatus.GREEN:
        return {
          color: 'text-safe',
          bg: 'bg-safe/10',
          border: 'border-safe/20',
          icon: <CheckCircle2 className="w-8 h-8 text-safe mb-1" />,
          label: '2 BOATS READY',
          sub: 'This lifeboat station is fully operational'
        };
      case OperationalStatus.ORANGE:
        return {
          color: 'text-orange-500',
          bg: 'bg-orange-500/10',
          border: 'border-orange-500/20',
          icon: <AlertTriangle className="w-8 h-8 text-orange-500 mb-1" />,
          label: '1 BOAT READY',
          sub: 'Never tell me the odds'
        };
      case OperationalStatus.RED:
      default:
        return {
          color: 'text-alert',
          bg: 'bg-alert/10',
          border: 'border-alert/20',
          icon: <XCircle className="w-8 h-8 text-alert mb-1" />,
          label: 'NO ASSETS',
          sub: 'Ive got a bad feeling about this'
        };
    }
  };

  const statusConfig = getStatusConfig(status);

  // Time Card Styles
  // Fixed background color to prevent layout shift/styling issues when status changes
  const timeCardClass = "w-full border rounded-xl py-2 px-2 sm:px-4 flex items-center justify-center shadow-md transition-colors duration-300 bg-slate-900 border-slate-800";

  // Unified Base Styles (Size/Weight)
  const baseText = "text-base font-semibold uppercase tracking-wide";
  const baseValue = "text-base font-bold";
  const separatorBase = "mx-1.5 sm:mx-2";

  // Static Colors
  const labelColor = "text-slate-500";
  const valueColor = "text-white"; 
  const separatorColor = "text-slate-700";
  
  // Status Text Color
  const statusTextColor = !hasPersonalStatus
    ? 'text-amber-400'
    : isOnCall
      ? 'text-safe'
      : 'text-slate-500';

  return (
    <header className="mb-6 select-none">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 
            className="text-2xl font-bold flex items-center gap-2 text-white cursor-pointer active:opacity-70 transition-opacity"
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
          >
            <Anchor className="text-rnli-orange w-6 h-6" />
            <span>{title}</span>
          </h1>
        </div>
        <div className="flex gap-2">
            {showSettings && onOpenSettings && (
              <button 
                onClick={onOpenSettings}
                className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-all text-slate-400 hover:text-white"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={onRefresh}
              disabled={isLoading}
              className={`p-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-all ${isLoading ? 'opacity-50' : ''}`}
            >
              <RotateCw className={`w-5 h-5 text-rnli-orange ${isLoading ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        {/* Time / Status Card */}
        <div className="w-full">
            <div className={timeCardClass}>
              <div className="flex items-center whitespace-nowrap overflow-hidden">
                 <span className={`${baseText} ${labelColor}`}>At</span>
                 <span className={`${baseValue} ${valueColor} ml-2`}>{formatTime(displayDate)}</span>
                 
                 <span className={`${separatorColor} ${separatorBase}`}>|</span>
                 <span className={`${baseText} ${labelColor}`}>{formatDateDisplay(displayDate)}</span>
                 
                 {showPersonalStatus && (
                   <>
                     <span className={`${separatorColor} ${separatorBase}`}>|</span>
                     
                     {/* Status Light Indicator */}
                     <span className="relative flex h-2.5 w-2.5 mr-2">
                        {!hasPersonalStatus ? (
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                        ) : isOnCall ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-safe"></span>
                            </>
                        ) : (
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-900"></span>
                        )}
                     </span>

                     {/* Status Text */}
                     <span className={`${baseValue} ${statusTextColor} uppercase tracking-wider`}>
                        {!hasPersonalStatus ? 'STATUS UNKNOWN' : isOnCall ? 'ON CALL' : 'OFF CALL'}
                     </span>
                   </>
                 )}
              </div>
            </div>

            {(isOffline || isCachedData) && (
              <div className={`mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-2 border ${
                isOffline
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
              }`}>
                {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}
                <span>
                  {isOffline ? 'Offline — showing saved roster' : 'Showing saved roster while refreshing'}
                  {lastUpdated && ` · saved ${formatDateDisplay(lastUpdated)} at ${formatTime(lastUpdated)}`}
                </span>
              </div>
            )}
        </div>

        {/* Status Card */}
        {status && (
          <div className={`relative overflow-hidden ${statusConfig.bg} ${statusConfig.border} border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg transition-all duration-500`}>
            
            {/* Refreshing Overlay - Non-blocking */}
            {isLoading && (
               <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 animate-in fade-in duration-200 bg-slate-900/50 rounded-full px-2 py-0.5">
                  <RotateCw className="w-3 h-3 text-white animate-spin" />
                  <span className="text-[9px] font-bold text-white tracking-widest uppercase">Refreshing...</span>
               </div>
            )}

            {/* Content (Dimmed slightly when loading) */}
            <div className={`flex flex-col items-center transition-all duration-300 ${isLoading ? 'opacity-70' : 'opacity-100'}`}>
              {statusConfig.icon}
              <div className={`text-xl font-black ${statusConfig.color} tracking-tight`}>
                {statusConfig.label}
              </div>
              <div className={`text-xs font-medium opacity-80 ${statusConfig.color}`}>
                {statusConfig.sub}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
