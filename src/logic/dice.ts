import type { CrewFace, ThreatSymbol } from '../types/game';

// Distribution of faces across a crew die (6 sides).
// Weighted toward threat to create pressure.
const CREW_FACE_DISTRIBUTION: ReadonlyArray<CrewFace> = [
  'commander',
  'tactical',
  'medical',
  'science',
  'engineering',
  'threat',
];

// All possible crew faces for Commander's "change" action
export const ALL_CREW_FACES: ReadonlyArray<CrewFace> = [
  'commander',
  'tactical',
  'medical',
  'science',
  'engineering',
  'threat',
];

// Threat die faces (6 sides)
export const THREAT_FACES: ReadonlyArray<ThreatSymbol> = [
  'skull',
  'lightning',
  'alien',
  'warning',
  'hazard',
  'nova',
];

export function rollCrewFace(): CrewFace {
  const index = Math.floor(Math.random() * CREW_FACE_DISTRIBUTION.length);
  return CREW_FACE_DISTRIBUTION[index]!;
}

export function rollAllCrewDice(count: number): ReadonlyArray<CrewFace> {
  return Array.from({ length: count }, () => rollCrewFace());
}

export function rollThreatDie(): ThreatSymbol {
  const index = Math.floor(Math.random() * THREAT_FACES.length);
  return THREAT_FACES[index]!;
}

/** Tactical damage formula: 1 die = 1dmg, each additional die adds 2 */
export function calculateTacticalDamage(diceCount: number): number {
  if (diceCount <= 0) return 0;
  return 1 + (diceCount - 1) * 2;
}
