
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
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

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
        refreshData(now, newName);
    }
  };

  const handleToggleLaView = () => {
    localStorage.setItem(LA_VIEW_KEY, 'true');
    navigate('/station');
  };

  const refreshData = useCallback(async (target: Date, nameOverride?: string) => {
    const nameToFetch = nameOverride !== undefined ? nameOverride : crewName;

    let loadedCachedRoster = false;

    // Render the last saved roster first. This is intentionally cache-only so
    // startup never waits for a network timeout before showing on-call status.
    try {
      const cachedResult = await fetchRosterData(target, nameToFetch, 'cache-only');
      loadedCachedRoster = true;
      setState({
        status: LoadStatus.SUCCESS,
        data: cachedResult,
        error: null,
        targetDate: target,
      });
    } catch (error) {
      console.debug('No matching saved roster is available', error);
    }

    if (!navigator.onLine) {
      setIsOnline(false);
      if (!loadedCachedRoster) {
        setState({
          status: LoadStatus.ERROR,
          data: null,
          error: "You're offline and no saved roster is available yet. Connect once to save the current roster for offline use.",
          targetDate: target,
        });
      }
      return;
    }

    setIsOnline(true);
    setState(prev => ({
      ...prev,
      status: LoadStatus.LOADING,
      error: null,
      targetDate: target,
    }));

    try {
      const networkResult = await fetchRosterData(target, nameToFetch, 'network-first');
      setState({
        status: LoadStatus.SUCCESS,
        data: networkResult,
        error: null,
        targetDate: target,
      });
    } catch (err: any) {
      console.error("Network fetch failed", err);
      setState(prev => {
        if (prev.data) {
          return {
            ...prev,
            status: LoadStatus.SUCCESS,
            error: err.message || 'The saved roster could not be refreshed.',
          };
        }
        return {
          ...prev,
          status: LoadStatus.ERROR,
          error: err.message || 'Failed to load roster data',
        };
      });
    }
  }, [crewName]);

  // Initial load
  useEffect(() => {
    const isLaView = localStorage.getItem(LA_VIEW_KEY) === 'true';
    if (!isLaView) {
        refreshData(now);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleManualRefresh = useCallback(() => {
    const currentMoment = new Date();
    setNow(currentMoment);
    refreshData(currentMoment);
  }, [refreshData]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const currentMoment = new Date();
      setNow(currentMoment);
      refreshData(currentMoment);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshData]);

  // Handle PWA/Mobile Wake Up
  useEffect(() => {
    let lastWakeRefresh = 0;
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        const wakeTimestamp = Date.now();
        if (wakeTimestamp - lastWakeRefresh < 1000) return;
        lastWakeRefresh = wakeTimestamp;
        const wakeUpTime = new Date();
        setNow(wakeUpTime);
        refreshData(wakeUpTime);
      }
    };
    document.addEventListener("visibilitychange", handleWakeUp);
    window.addEventListener("focus", handleWakeUp);
    return () => {
      document.removeEventListener("visibilitychange", handleWakeUp);
      window.removeEventListener("focus", handleWakeUp);
    };
  }, [refreshData]);

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
      refreshData(newNow);
    }, delay);
    return () => clearTimeout(timerId);
  }, [now, refreshData]);

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
        displayTime={now}
        isOffline={!isOnline}
        isCachedData={state.data?.isCachedData}
        showSettings={true}
        showPersonalStatus={true}
        title="Crew Status 2"
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
