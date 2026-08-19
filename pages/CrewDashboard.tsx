
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { TimeControls } from '../components/TimeControls';
import { StatusTimeline } from '../components/StatusTimeline';
import { SummaryStats } from '../components/SummaryStats';
import { PersonalAvailability } from '../components/PersonalAvailability';
import { SettingsModal } from '../components/SettingsModal';
import { fetchRosterData } from '../services/sheetService';
import { AppState, LoadStatus } from '../types';
import { CONFIG } from '../config';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CREW_NAME_KEY = 'RNLI_CREW_NAME';
const LA_VIEW_KEY = 'RNLI_LA_VIEW';

export const CrewDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date()); 
  
  // Settings State
  const [crewName, setCrewName] = useState(() => {
    return localStorage.getItem(CREW_NAME_KEY) || '';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [state, setState] = useState<AppState>({
    status: LoadStatus.IDLE,
    data: null,
    error: null,
    targetDate: new Date(),
  });

  // Check for Redirect on Mount
  useEffect(() => {
    const isLaView = localStorage.getItem(LA_VIEW_KEY) === 'true';
    if (isLaView) {
        navigate('/station', { replace: true });
    }
  }, [navigate]);

  // Check if name is missing on mount to prompt settings
  useEffect(() => {
    const isLaView = localStorage.getItem(LA_VIEW_KEY) === 'true';
    if (!crewName && !isLaView) {
      setIsSettingsOpen(true); 
    }
  }, [crewName]);

  const handleSaveSettings = (newName: string, isLaView: boolean) => {
    localStorage.setItem(CREW_NAME_KEY, newName);
    localStorage.setItem(LA_VIEW_KEY, String(isLaView));

    setCrewName(newName);

    if (isLaView) {
        navigate('/station');
    } else {
        // Reload main data with new name (mostly for validation/updates)
        loadData(now, newName);
    }
  };

  const handleToggleLaView = () => {
    localStorage.setItem(LA_VIEW_KEY, 'true');
    navigate('/station');
  };

  /**
   * Instantly re-processes the local cache for a new time.
   * This updates the UI (Status, On/Off Call) without touching the network.
   */
  const recalculateFromCache = useCallback(async (target: Date, nameOverride?: string) => {
    const nameToFetch = nameOverride !== undefined ? nameOverride : crewName;
    try {
        // Force cache usage (true) to recalculate column/status for the *new* target time
        const cachedResult = await fetchRosterData(target, nameToFetch, true);
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
  }, [crewName]);

  const loadData = useCallback(async (target: Date, nameOverride?: string) => {
    const nameToFetch = nameOverride !== undefined ? nameOverride : crewName;
    
    // 1. Trigger Network Fetch (Background update)
    setState(prev => ({ 
        ...prev, 
        status: LoadStatus.LOADING, 
        targetDate: target 
    }));

    try {
      const networkResult = await fetchRosterData(target, nameToFetch, false); // false = force network
      setState({
        status: LoadStatus.SUCCESS,
        data: networkResult,
        error: null,
        targetDate: target,
      });
    } catch (err: any) {
      console.error("Network fetch failed", err);
      // Only show error if we don't have cached data displayed
      setState(prev => {
        if (prev.data) {
             return prev;
        }
        return {
            ...prev,
            status: LoadStatus.ERROR,
            error: err.message || "Failed to load roster data"
        };
      });
    }
  }, [crewName]);

  // Initial load
  useEffect(() => {
    const isLaView = localStorage.getItem(LA_VIEW_KEY) === 'true';
    if (!isLaView) {
        recalculateFromCache(now);
        loadData(now);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleManualRefresh = useCallback(() => {
    const currentMoment = new Date();
    setNow(currentMoment);
    recalculateFromCache(currentMoment);
    loadData(currentMoment);
  }, [loadData, recalculateFromCache]);

  // Handle PWA/Mobile Wake Up
  useEffect(() => {
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        const wakeUpTime = new Date();
        setNow(wakeUpTime);
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

  // Smart Auto-Refresh
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
      recalculateFromCache(newNow);
      loadData(newNow);
    }, delay);
    return () => clearTimeout(timerId);
  }, [now, loadData, recalculateFromCache]); 

  // Get current status from the main forecast (index 0 is current hour)
  const currentStatus = state.data?.personalForecast?.[0]?.status;

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
        personalStatus={currentStatus}
        showSettings={true}
        showPersonalStatus={true}
        title="Cruise Status 2"
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
            roster={state.data.roster}
          />
          
          <StatusTimeline forecast={state.data.forecast} />

          <PersonalAvailability 
            crewName={crewName}
            currentStatus={currentStatus}
            onOpenSettings={() => setIsSettingsOpen(true)}
            lastRefreshTime={state.data.fetchedAt}
          />
        </>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentName={crewName}
        isLaViewEnabled={false}
        onSave={handleSaveSettings}
      />

      <TimeControls />
    </>
  );
};
