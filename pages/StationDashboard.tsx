
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '../components/Header';
import { TimeControls } from '../components/TimeControls';
import { ForecastView, StationForecastGrid } from '../components/StationForecastGrid';
import { ActiveCrewList } from '../components/ActiveCrewList';
import { SummaryStats } from '../components/SummaryStats';
import { SettingsModal } from '../components/SettingsModal';
import { fetchRosterData } from '../services/sheetService';
import { AppState, LoadStatus } from '../types';
import { CONFIG } from '../config';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRosterHour } from '../services/dateUtils';
import { SingleFlightLatestQueue } from '../services/singleFlightQueue';

const CREW_NAME_KEY = 'RNLI_CREW_NAME';
const LA_VIEW_KEY = 'RNLI_LA_VIEW';

export const StationDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date()); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedHourIndex, setSelectedHourIndex] = useState(0); // Track selected forecast hour
  const [forecastView, setForecastView] = useState<ForecastView>('24-hours');
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

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

  const performRefresh = useCallback(async (target: Date, refreshSignal: AbortSignal) => {
    let loadedCachedRoster = false;

    try {
      const cachedResult = await fetchRosterData(target, '', 'cache-only', refreshSignal);
      if (refreshSignal.aborted) return;
      loadedCachedRoster = true;
      setState({
        status: LoadStatus.SUCCESS,
        data: cachedResult,
        error: null,
        targetDate: target,
      });
    } catch (error) {
      if (refreshSignal.aborted) return;
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
      const networkResult = await fetchRosterData(target, '', 'network-first', refreshSignal);
      if (refreshSignal.aborted) return;
      setState({
        status: LoadStatus.SUCCESS,
        data: networkResult,
        error: null,
        targetDate: target,
      });
    } catch (err: any) {
      if (refreshSignal.aborted) return;
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
  }, []);

  const performRefreshRef = useRef(performRefresh);
  performRefreshRef.current = performRefresh;
  const refreshQueueRef = useRef<SingleFlightLatestQueue<Date> | null>(null);
  if (!refreshQueueRef.current) {
    refreshQueueRef.current = new SingleFlightLatestQueue(
      (target, signal) => performRefreshRef.current(target, signal),
    );
  }

  const refreshData = useCallback((target: Date) => {
    void refreshQueueRef.current?.enqueue(target);
  }, []);

  useEffect(() => {
    refreshQueueRef.current?.resume();
    return () => refreshQueueRef.current?.stop();
  }, []);

  useEffect(() => {
    const isLaView = localStorage.getItem(LA_VIEW_KEY) === 'true';
    if (isLaView) {
        refreshData(now);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleManualRefresh = useCallback(() => {
    const currentMoment = new Date();
    setNow(currentMoment);
    // Reset selection on refresh to current time
    setSelectedHourIndex(0);
    refreshData(currentMoment);
  }, [refreshData]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const currentMoment = new Date();
      setNow(currentMoment);
      setSelectedHourIndex(0);
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
        setSelectedHourIndex(0);
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
      refreshData(newNow);
    }, delay);
    return () => clearTimeout(timerId);
  }, [now, refreshData]);

  // Derived data for display
  const selectedRoster = state.data?.hourlyRosters?.[selectedHourIndex] || state.data?.roster;
  const selectedEntry = state.data?.forecast?.[selectedHourIndex];
  // Format label for "Hour Ending XX:00"
  const timeLabel = `${formatRosterHour(selectedEntry?.endHour ?? ((now.getHours() + 1) % 24))}:00`;

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
        displayTime={now}
        isOffline={!isOnline}
        isCachedData={state.data?.isCachedData}
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
            weekForecast={state.data.weekForecast}
            selectedIndex={selectedHourIndex}
            onSelectHour={setSelectedHourIndex}
            onViewChange={setForecastView}
          />

          {forecastView === '24-hours' && (
            <ActiveCrewList
              roster={selectedRoster || state.data.roster}
              timeLabel={timeLabel}
            />
          )}
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
