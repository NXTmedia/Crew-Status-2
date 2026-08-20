import { SECTION_HEADERS } from '../constants';
import { OperationalStatus, RosterData } from '../types';

export interface CrewCounts {
  helms: number;
  tier2: number;
  tier1: number;
  total: number;
}

type ReadinessTarget = 'amber' | 'green';

const TARGETS: Record<ReadinessTarget, { helms: number; senior: number; total: number }> = {
  amber: { helms: 1, senior: 2, total: 3 },
  green: { helms: 2, senior: 4, total: 6 },
};

export const countRosterCrew = (roster?: RosterData): CrewCounts => {
  const helms = roster?.[SECTION_HEADERS.COMMAND]?.length ?? 0;
  const tier2 = roster?.[SECTION_HEADERS.NAVIGATOR]?.length ?? 0;
  const tier1 = roster?.[SECTION_HEADERS.TIER1]?.length ?? 0;
  return { helms, tier2, tier1, total: helms + tier2 + tier1 };
};

export const describeReadinessGap = (status: OperationalStatus, counts: CrewCounts): string => {
  if (status === OperationalStatus.NO_DATA) return 'No roster data is available for this hour';
  if (status === OperationalStatus.GREEN) return 'Full two-boat cover';

  const target: ReadinessTarget = status === OperationalStatus.ORANGE ? 'green' : 'amber';
  const thresholds = TARGETS[target];
  const missingHelms = Math.max(0, thresholds.helms - counts.helms);
  const seniorAfterHelms = counts.helms + counts.tier2 + missingHelms;
  const missingTier2 = Math.max(0, thresholds.senior - seniorAfterHelms);
  const totalAfterQualifiedCrew = counts.total + missingHelms + missingTier2;
  const missingCrew = Math.max(0, thresholds.total - totalAfterQualifiedCrew);
  const additions = [
    missingHelms > 0 ? `+${missingHelms} Helm${missingHelms > 1 ? 's' : ''}` : '',
    missingTier2 > 0 ? `+${missingTier2} Tier 2` : '',
    missingCrew > 0 ? `+${missingCrew} crew` : '',
  ].filter(Boolean);

  return `To ${target}: ${additions.join(' · ')}`;
};
