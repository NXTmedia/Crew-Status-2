import React, { useEffect, useMemo, useState } from 'react';
import { ForecastEntry, OperationalStatus, RosterData } from '../types';
import { formatRosterHour } from '../services/dateUtils';
import { countRosterCrew, describeReadinessGap } from '../services/stationTrendUtils';

interface StationTrendAnalysisProps {
  forecast: ForecastEntry[];
  hourlyRosters: RosterData[];
}

const STATUS_CONFIG = {
  [OperationalStatus.GREEN]: { boats: 2, label: 'GREEN', color: '#22c55e' },
  [OperationalStatus.ORANGE]: { boats: 1, label: 'AMBER', color: '#f97316' },
  [OperationalStatus.RED]: { boats: 0, label: 'RED', color: '#ef4444' },
  [OperationalStatus.NO_DATA]: { boats: 0, label: 'NO DATA', color: '#475569' },
};

const DOCK_BAR_CLASSES = {
  [OperationalStatus.GREEN]: 'bg-green-500',
  [OperationalStatus.ORANGE]: 'bg-orange-500',
  [OperationalStatus.RED]: 'bg-red-500',
  [OperationalStatus.NO_DATA]: 'bg-slate-600',
};

export const StationTrendAnalysis: React.FC<StationTrendAnalysisProps> = ({ forecast, hourlyRosters }) => {
  const data = useMemo(() => forecast.slice(0, 24).map((entry, index) => {
    const counts = countRosterCrew(hourlyRosters[index]);
    return {
      ...entry,
      index,
      counts,
      ...STATUS_CONFIG[entry.status],
      action: describeReadinessGap(entry.status, counts),
    };
  }), [forecast, hourlyRosters]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(0);
    setPreviewIndex(null);
  }, [forecast]);

  if (data.length === 0) return null;

  const activeIndex = Math.min(previewIndex ?? selectedIndex, data.length - 1);
  const selected = data[activeIndex];
  const firstDowngrade = data.find(entry => entry.status === OperationalStatus.ORANGE || entry.status === OperationalStatus.RED);
  const amberHours = data.filter(entry => entry.status === OperationalStatus.ORANGE).length;
  const redHours = data.filter(entry => entry.status === OperationalStatus.RED).length;
  const noDataHours = data.filter(entry => entry.status === OperationalStatus.NO_DATA).length;

  const width = 360;
  const height = 220;
  const plot = { left: 8, right: 352, top: 24, bottom: 168 };
  const x = (index: number) => plot.left + (index / Math.max(1, data.length - 1)) * (plot.right - plot.left);
  const y = (boats: number) => plot.bottom - (boats / 2) * (plot.bottom - plot.top);
  const tickIndexes = [0, 8, 16, 23].filter(index => index < data.length);
  const riskText = firstDowngrade
    ? `First downgrade ${firstDowngrade.index === 0 ? 'now' : `in ${firstDowngrade.index}h`}`
    : noDataHours > 0
      ? `${noDataHours} hour${noDataHours === 1 ? '' : 's'} awaiting data`
      : 'Full cover for the next 24 hours';

  const indexFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = Math.max(0, Math.min(bounds.width - 1, event.clientX - bounds.left));
    return Math.min(data.length - 1, Math.floor((position / bounds.width) * data.length));
  };

  const previewPointerHour = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || event.currentTarget.hasPointerCapture(event.pointerId)) {
      setPreviewIndex(indexFromPointer(event));
    }
  };

  const startScrubbing = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setPreviewIndex(indexFromPointer(event));
  };

  const finishScrubbing = (event: React.PointerEvent<HTMLDivElement>) => {
    const nextIndex = indexFromPointer(event);
    setSelectedIndex(nextIndex);
    setPreviewIndex(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-950 p-3.5" aria-labelledby="station-trend-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Next 24 hours · from now</p>
          <h2 id="station-trend-title" className="text-lg font-medium text-slate-50">Boats-ready trend</h2>
        </div>
        <p className="w-full text-xs font-medium text-orange-300" data-trend-risk>
          {riskText} · {amberHours} amber · {redHours} red
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400" aria-label="Readiness legend">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />2 boats</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />1 boat</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />No boats</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 block h-auto w-full touch-manipulation"
        role="img"
        aria-labelledby="station-trend-svg-title station-trend-svg-desc"
        data-testid="station-trend-chart"
      >
        <title id="station-trend-svg-title">Boats ready over the next 24 hours</title>
        <desc id="station-trend-svg-desc">Future-only readiness from the current hour. Drag across the magnifying hour dock below to inspect the crew gap for a specific hour.</desc>
        <rect x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} rx="4" fill="#0f172a" stroke="#334155" />

        {[0, 1, 2].map(boats => (
          <g key={boats}>
            <line x1={plot.left} x2={plot.right} y1={y(boats)} y2={y(boats)} stroke="#334155" strokeOpacity="0.65" />
          </g>
        ))}

        {data.slice(0, -1).map((entry, index) => {
          const next = data[index + 1];
          return (
            <path
              key={`segment-${entry.index}`}
              d={`M ${x(entry.index)} ${y(entry.boats)} H ${x(next.index)} V ${y(next.boats)}`}
              fill="none"
              stroke={entry.color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        <line
          x1={x(selected.index)}
          x2={x(selected.index)}
          y1={plot.top}
          y2={plot.bottom}
          stroke="#e2e8f0"
          strokeOpacity="0.55"
        />

        {data.map(entry => (
          <g key={`point-${entry.index}`} aria-hidden="true" data-trend-point>
            <circle cx={x(entry.index)} cy={y(entry.boats)} r="5" fill={entry.color} stroke="#020617" strokeWidth="2" />
          </g>
        ))}

        <circle cx={x(selected.index)} cy={y(selected.boats)} r="9" fill="none" stroke="#f8fafc" strokeWidth="2" pointerEvents="none" />

        {tickIndexes.map(index => (
          <g key={`tick-${index}`}>
            <line x1={x(index)} x2={x(index)} y1={plot.bottom} y2={plot.bottom + 5} stroke="#475569" />
            <text
              x={x(index)}
              y={plot.bottom + 18}
              textAnchor={index === tickIndexes[tickIndexes.length - 1] ? 'end' : 'middle'}
              fill="#94a3b8"
              fontSize="10"
            >
              {index === 0 ? 'Now' : `HE ${formatRosterHour(data[index].endHour)}`}
            </text>
          </g>
        ))}
        <text x={(plot.left + plot.right) / 2} y={height - 8} textAnchor="middle" fill="#64748b" fontSize="10">Hour ending</text>
      </svg>

      <div
        className="relative mb-3 mt-7 flex h-14 touch-none select-none items-end gap-0.5 px-0.5"
        aria-label="Drag across the hours to inspect"
        onPointerDown={startScrubbing}
        onPointerMove={previewPointerHour}
        onPointerUp={finishScrubbing}
        onPointerCancel={() => setPreviewIndex(null)}
        onPointerLeave={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) setPreviewIndex(null);
        }}
        data-trend-hour-strip
      >
        {data.map(entry => {
          const isSelected = entry.index === selected.index;
          const distance = Math.abs(entry.index - selected.index);
          const scale = distance === 0 ? 1.9 : distance === 1 ? 1.5 : distance === 2 ? 1.2 : 1;
          return (
            <button
              key={`hour-${entry.index}`}
              type="button"
              aria-label={`${entry.index === 0 ? 'Now' : `In ${entry.index} hour${entry.index === 1 ? '' : 's'}`}, hour ending ${formatRosterHour(entry.endHour)}:00, ${entry.label}`}
              aria-pressed={isSelected}
              onClick={() => setSelectedIndex(entry.index)}
              onFocus={() => setPreviewIndex(entry.index)}
              onBlur={() => setPreviewIndex(null)}
              className="relative flex h-10 min-w-0 flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white"
              data-trend-hour-button
            >
              <span
                aria-hidden="true"
                className={`block h-6 w-2 max-w-full origin-bottom rounded-full shadow-sm transition-transform duration-75 ${DOCK_BAR_CLASSES[entry.status]} ${isSelected ? 'ring-1 ring-white' : 'opacity-80'}`}
                style={{ transform: `scale(${scale})` }}
              />
              <span className="sr-only">
                {entry.index === 0 ? 'Now' : `In ${entry.index} hour${entry.index === 1 ? '' : 's'}`}, hour ending {formatRosterHour(entry.endHour)}
              </span>
            </button>
          );
        })}
        <span
          className={`pointer-events-none absolute -top-7 z-20 whitespace-nowrap rounded-md border border-slate-600 bg-slate-800 px-2 py-1 font-mono text-[10px] font-bold text-white shadow-lg ${selected.index === 0 ? 'left-0' : selected.index === data.length - 1 ? 'right-0' : '-translate-x-1/2'}`}
          style={selected.index === 0 || selected.index === data.length - 1
            ? undefined
            : { left: `${((selected.index + 0.5) / data.length) * 100}%` }}
          data-trend-dock-label
        >
          {selected.index === 0 ? 'NOW' : `+${selected.index}H`} · HE {formatRosterHour(selected.endHour)}
        </span>
      </div>

      <div className="mt-1 flex flex-col gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5" aria-live="polite" data-trend-selected>
        <span className="text-xs font-semibold text-slate-50">
          {selected.index === 0 ? 'NOW' : `+${selected.index}H`} · HE {formatRosterHour(selected.endHour)}:00 · {selected.label} · {selected.counts.total} crew
        </span>
        <span className="text-xs text-slate-300">{selected.action}</span>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500">Drag across the dock to scrub hours · tap to select</p>
    </section>
  );
};
