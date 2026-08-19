
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { TimeControls } from '../components/TimeControls';
import { StationForecastGrid } from '../components/StationForecastGrid';
import { ActiveCrewList } from '../components/ActiveCrewList';
import { SummaryStats } from '../components/SummaryStats';
import { SettingsModal } from '../components/SettingsModal';
import { fetchRosterData } from '../services/sheetService';
import { AppState, LoadStatus } from '../types';
import { CONFIG } from '../config';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, addHours } from 'date-fns';

const CREW_NAME_KEY = 'RNLI_CREW_NAME';
const LA_VIEW_KEY = 'RNLI_LA_VIEW';

export const StationDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date()); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedHourIndex, setSelectedHourIndex] = useState(0); // Track selected forecast hour

  const [crewName, setCrewName] = useState(() => {
    return localStorage.getItem(CREW_NAME_KEY) || '';
  });

  const [state, setState] = useState<AppState>({
    status: LoadStatus.IDLE,
    data: null,
    error: null,
    targetDate: new Date(),
  });

  // Check for Redirect on Mount
  useEffect(() => {
    const isLaView = localStorage.getItem(LA_VIEW_KEY) === 'true';
    if (!isLaView) {
        navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleSaveSettings = (newName: string, isLaView: boolean) => {
    localStorage.setItem(CREW_NAME_KEY, newName);
    localStorage.setItem(LA_VIEW_KEY, String(isLaView));
    setCrewName(newName);

    if (!isLaView) {
        navigate('/');
    }
  };

  const handleToggleLaView = () => {
    localStorage.setItem(LA_VIEW_KEY, 'false');
    navigate('/');
  };

  const recalculateFromCache = useCallback(async (target: Date) => {
    try {
        const cachedResult = await fetchRosterData(target, '', true);
        if (cachedResult.isCachedData) {
            setState(prev => ({
                ...prev,
                data: cachedResult,
                targetDate: target,
            }));
        }
    } catch (e) {
        console.debug("Cache recalculation failed", e);
    }
  }, []);

  const loadData = useCallback(async (target: Date) => {
    setState(prev => ({ 
        ...prev, 
        status: LoadStatus.LOADING, 
        targetDate: target 
    }));

    try {
      const networkResult = await fetchRosterData(target, '', false); 
      setState({
        status: LoadStatus.SUCCESS,
        data: networkResult,
        error: null,
        targetDate: target,
      });
    } catch (err: any) {
      console.error("Network fetch failed", err);
      setState(prev => {
        if (prev.data) return prev;
        return {
            ...prev,
            status: LoadStatus.ERROR,
            error: err.message || "Failed to load roster data"
        };
      });
    }
  }, []);

  useEffect(() => {
    const isLaView = localStorage.getItem(LA_VIEW_KEY) === 'true';
    if (isLaView) {
        recalculateFromCache(now);
        loadData(now);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleManualRefresh = useCallback(() => {
    const currentMoment = new Date();
    setNow(currentMoment);
    // Reset selection on refresh to current time
    setSelectedHourIndex(0);
    recalculateFromCache(currentMoment);
    loadData(currentMoment);
  }, [loadData, recalculateFromCache]);

  // Handle PWA/Mobile Wake Up
  useEffect(() => {
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        const wakeUpTime = new Date();
        setNow(wakeUpTime);
        setSelectedHourIndex(0);
        recalculateFromCache(wakeUpTime);
        setTimeout(() => {
            loadData(wakeUpTime);
        }, 500);
      }
    };
    document.addEventListener("visibilitychange", handleWakeUp);
    window.addEventListener("focus", handleWakeUp);
    return () => {
      document.removeEventListener("visibilitychange", handleWakeUp);
      window.removeEventListener("focus", handleWakeUp);
    };
  }, [handleManualRefresh, recalculateFromCache, loadData]);

  // Auto-Refresh
  useEffect(() => {
    const calculateDelay = () => {
      const d = new Date();
      const mins = d.getMinutes();
      const secs = d.getSeconds();
      const ms = d.getMilliseconds();
      const interval = CONFIG.REFRESH_INTERVAL_MINUTES;
      const nextIntervalMark = Math.ceil((mins + 0.1) / interval) * interval;
      const diffMins = nextIntervalMark - mins;
      return (diffMins * 60 * 1000) - (secs * 1000) - ms + 2000;
    };
    const delay = calculateDelay();
    const timerId = setTimeout(() => {
      const newNow = new Date();
      setNow(newNow);
      // Don't reset selection on auto-refresh, just update data
      recalculateFromCache(newNow);
      loadData(newNow);
    }, delay);
    return () => clearTimeout(timerId);
  }, [now, loadData, recalculateFromCache]); 

  // Derived data for display
  const selectedRoster = state.data?.hourlyRosters?.[selectedHourIndex] || state.data?.roster;
  const selectedTime = state.data?.forecast?.[selectedHourIndex]?.time || now;
  // Format label for "Hour Ending XX:00"
  const timeLabel = format(addHours(selectedTime, 1), 'HH:00');

  return (
    <>
      <Header 
        lastUpdated={state.data?.fetchedAt} 
        onRefresh={handleManualRefresh}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTitleLongPress={handleToggleLaView}
        isLoading={state.status === LoadStatus.LOADING}
        sheetName={state.data?.sheetName}
        status={state.data?.summary.status}
        showSettings={true}
        showPersonalStatus={false}
        title="Station Board"
      />

      {state.status === LoadStatus.ERROR && (
        <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-xl mb-6 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 shrink-0 text-red-500" />
            <div>
              <h3 className="font-bold">System Error</h3>
              <p className="text-sm opacity-80">{state.error}</p>
            </div>
          </div>
          <button 
            onClick={handleManualRefresh}
            className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-colors w-full"
          >
            Retry Connection
          </button>
        </div>
      )}

      {state.data && (
        <>
          <SummaryStats 
            helms={state.data.summary.helms}
            navs={state.data.summary.navs}
            crew={state.data.summary.crew}
            // Passing undefined roster disables the popup on summary stats if desired, 
            // but we can keep it functional or let ActiveCrewList handle the view.
            roster={state.data.roster} 
          />
          
          <StationForecastGrid 
            forecast={state.data.forecast} 
            selectedIndex={selectedHourIndex}
            onSelectHour={setSelectedHourIndex}
          />

          <ActiveCrewList 
            roster={selectedRoster} 
            timeLabel={timeLabel}
          />
        </>
      )}

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentName={crewName}
        isLaViewEnabled={true}
        onSave={handleSaveSettings}
      />

      <TimeControls />
    </>
  );
};
