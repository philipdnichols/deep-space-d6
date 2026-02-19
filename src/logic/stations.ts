import type { ActiveThreat, CrewDie, CrewFace, GameState, StationId } from '../types/game';

// ── Station resolution helpers ────────────────────────────────────────────────

/** Collect all dice currently assigned to a station. */
export function getDiceAtStation(
  crew: ReadonlyArray<CrewDie>,
  stationId: StationId,
): ReadonlyArray<CrewDie> {
  return crew.filter((d) => d.location === stationId);
}

/** Count dice at a station. */
export function countAtStation(crew: ReadonlyArray<CrewDie>, stationId: StationId): number {
  return getDiceAtStation(crew, stationId).length;
}

// ── Engineering ───────────────────────────────────────────────────────────────

/** Repair hull by +1 per engineering die. Capped at maxHull. */
export function resolveEngineering(
  hull: number,
  maxHull: number,
  engineeringDiceCount: number,
): number {
  return Math.min(maxHull, hull + engineeringDiceCount);
}

// ── Medical ───────────────────────────────────────────────────────────────────

/** Return all crew from Infirmary to pool. */
export function resolveMedical(crew: ReadonlyArray<CrewDie>): ReadonlyArray<CrewDie> {
  return crew.map((d) => (d.location === 'infirmary' ? { ...d, location: 'pool' as const } : d));
}

/** Release one die from Scanners back to pool (Medical alternative action). */
export function releaseFromScanners(crew: ReadonlyArray<CrewDie>): ReadonlyArray<CrewDie> {
  let released = false;
  return crew.map((d) => {
    if (!released && d.location === 'scanners') {
      released = true;
      return { ...d, location: 'pool' as const };
    }
    return d;
  });
}

// ── Science ───────────────────────────────────────────────────────────────────

/** Recharge shields to maxShields. Only if Nebula is not active. */
export function resolveScience(maxShields: number): number {
  return maxShields;
}

/** Place a stasis token on a threat card. */
export function placeStasisToken(
  threats: ReadonlyArray<ActiveThreat>,
  threatId: string,
): ReadonlyArray<ActiveThreat> {
  return threats.map((t) => (t.id === threatId ? { ...t, stasisTokens: t.stasisTokens + 1 } : t));
}

// ── Commander ─────────────────────────────────────────────────────────────────

/** Change a specific die to a new face. */
export function commanderChangeDie(
  crew: ReadonlyArray<CrewDie>,
  dieId: number,
  newFace: CrewFace,
): ReadonlyArray<CrewDie> {
  return crew.map((d) => (d.id === dieId ? { ...d, face: newFace } : d));
}

/** Re-roll all dice currently in the pool (not assigned). Returns new faces array. */
export function commanderRerollCount(crew: ReadonlyArray<CrewDie>): number {
  return crew.filter((d) => d.location === 'pool').length;
}

// ── Internal threat resolution ────────────────────────────────────────────────

/** Check if enough matching dice are placed on the threat's away mission to resolve it. */
export function isThreatResolved(threat: ActiveThreat, crew: ReadonlyArray<CrewDie>): boolean {
  if (!threat.card.resolution) return false;
  const { face, count } = threat.card.resolution;
  const assigned = crew.filter((d) => d.location === `threat-${threat.id}` && d.face === face);
  return assigned.length >= count;
}

/** Remove a threat and return its assigned crew to pool. */
export function resolveThreat(
  threats: ReadonlyArray<ActiveThreat>,
  crew: ReadonlyArray<CrewDie>,
  threatId: string,
): { threats: ReadonlyArray<ActiveThreat>; crew: ReadonlyArray<CrewDie> } {
  const newCrew = crew.map((d) =>
    d.location === `threat-${threatId}` ? { ...d, location: 'pool' as const } : d,
  );
  const newThreats = threats.filter((t) => t.id !== threatId);
  return { threats: newThreats, crew: newCrew };
}

// ── Scanners processing ───────────────────────────────────────────────────────

export interface ScannersResult {
  readonly crew: ReadonlyArray<CrewDie>;
  readonly extraDraws: number;
}

/**
 * Process scanners: every 3 dice in scanners = draw 1 threat + release those 3 dice.
 * Returns updated crew and how many extra threat cards to draw.
 */
export function processScanners(crew: ReadonlyArray<CrewDie>): ScannersResult {
  const scannerDice = crew.filter((d) => d.location === 'scanners');
  const groups = Math.floor(scannerDice.length / 3);
  if (groups === 0) return { crew, extraDraws: 0 };

  const toRelease = scannerDice.slice(0, groups * 3).map((d) => d.id);
  const newCrew = crew.map((d) =>
    toRelease.includes(d.id) ? { ...d, location: 'pool' as const } : d,
  );
  return { crew: newCrew, extraDraws: groups };
}

// ── Gather phase ──────────────────────────────────────────────────────────────

/**
 * Return all assigned dice to pool, EXCEPT:
 * - Dice in 'infirmary'
 * - Dice in 'scanners'
 * - Dice locked on a threat card (away mission)
 */
export function gatherCrew(
  crew: ReadonlyArray<CrewDie>,
  activeThreats: ReadonlyArray<ActiveThreat>,
): ReadonlyArray<CrewDie> {
  const activeThreatIds = new Set(activeThreats.map((t) => t.id));
  return crew.map((d) => {
    if (d.location === 'infirmary' || d.location === 'scanners') return d;
    if (typeof d.location === 'string' && d.location.startsWith('threat-')) {
      const threatId = d.location.slice('threat-'.length);
      if (activeThreatIds.has(threatId)) return d; // still locked on active threat
    }
    return { ...d, location: 'pool' as const };
  });
}

// ── Passive threat effects ────────────────────────────────────────────────────

/** Check if Nebula is among active internal threats. */
export function isNebulaActive(threats: ReadonlyArray<ActiveThreat>): boolean {
  return threats.some((t) => t.card.id === 'nebula' && !t.isDestroyed);
}

/** Check if Comms Offline is among active internal threats. */
export function isCommsOfflineActive(threats: ReadonlyArray<ActiveThreat>): boolean {
  return threats.some((t) => t.card.id === 'comms-offline' && !t.isDestroyed);
}

/** Check if Time Warp is among active internal threats. */
export function isTimeWarpActive(threats: ReadonlyArray<ActiveThreat>): boolean {
  return threats.some((t) => t.card.id === 'time-warp' && !t.isDestroyed);
}

/** The stations that accept a die of a given face. */
export function stationForFace(face: CrewFace): StationId | null {
  const map: Record<CrewFace, StationId | null> = {
    commander: 'commander',
    tactical: 'tactical',
    medical: 'medical',
    science: 'science',
    engineering: 'engineering',
    threat: 'scanners',
  };
  return map[face];
}

/** Is a given die valid to assign to a given station? */
export function canAssignToStation(
  die: CrewDie,
  stationId: StationId,
  commsOfflineActive: boolean,
): boolean {
  if (die.location !== 'pool') return false;
  if (stationId === 'infirmary' || stationId === 'scanners') return false;
  if (commsOfflineActive && stationId === 'commander') return false;
  const expectedFace = Object.entries({
    commander: 'commander',
    tactical: 'tactical',
    medical: 'medical',
    science: 'science',
    engineering: 'engineering',
  } as Record<StationId, CrewFace>).find(([sid]) => sid === stationId)?.[1];
  if (!expectedFace) return false;
  return die.face === expectedFace;
}

/** Can a die be assigned to a threat's away mission? */
export function canAssignToThreat(
  die: CrewDie,
  threat: ActiveThreat,
  state: Pick<GameState, 'phase'>,
): boolean {
  if (state.phase !== 'assigning') return false;
  if (die.location !== 'pool') return false;
  if (threat.card.kind !== 'internal') return false;
  if (!threat.card.resolution) return false;
  return die.face === threat.card.resolution.face;
}
