import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDiceAtStation,
  countAtStation,
  resolveEngineering,
  resolveMedical,
  releaseFromScanners,
  resolveScience,
  placeStasisToken,
  commanderChangeDie,
  commanderRerollCount,
  isThreatResolved,
  resolveThreat,
  processScanners,
  gatherCrew,
  isNebulaActive,
  isCommsOfflineActive,
  isTimeWarpActive,
  stationForFace,
  canAssignToStation,
  canAssignToThreat,
} from './stations';
import { createActiveThreat, resetInstanceCounter } from './threats';
import type { CrewDie, ThreatCard } from '../types/game';

beforeEach(() => {
  resetInstanceCounter();
});

function makeDie(
  id: number,
  location: CrewDie['location'] = 'pool',
  face: CrewDie['face'] = 'tactical',
): CrewDie {
  return { id, face, location };
}

function makeCard(overrides: Partial<ThreatCard> = {}): ThreatCard {
  return {
    id: 'test',
    name: 'Test',
    kind: 'internal',
    activation: 'skull',
    maxHealth: 0,
    description: '',
    resolution: { face: 'engineering', count: 1 },
    isOuroboros: false,
    isBarrier: false,
    immediateOnReveal: false,
    ...overrides,
  };
}

describe('getDiceAtStation', () => {
  it('returns only dice at the specified station', () => {
    const crew = [makeDie(0, 'tactical'), makeDie(1, 'medical'), makeDie(2, 'tactical')];
    expect(getDiceAtStation(crew, 'tactical')).toHaveLength(2);
    expect(getDiceAtStation(crew, 'medical')).toHaveLength(1);
  });
});

describe('countAtStation', () => {
  it('counts dice at station', () => {
    const crew = [makeDie(0, 'science'), makeDie(1, 'science'), makeDie(2, 'pool')];
    expect(countAtStation(crew, 'science')).toBe(2);
  });
});

describe('resolveEngineering', () => {
  it('adds 1 HP per die, capped at maxHull', () => {
    expect(resolveEngineering(6, 8, 3)).toBe(8);
    expect(resolveEngineering(6, 8, 1)).toBe(7);
  });

  it('never exceeds maxHull', () => {
    expect(resolveEngineering(8, 8, 5)).toBe(8);
  });
});

describe('resolveMedical', () => {
  it('moves all infirmary crew to pool', () => {
    const crew = [makeDie(0, 'infirmary'), makeDie(1, 'pool'), makeDie(2, 'infirmary')];
    const result = resolveMedical(crew);
    expect(result.every((d) => d.location === 'pool')).toBe(true);
  });

  it('does not affect non-infirmary dice', () => {
    const crew = [makeDie(0, 'scanners'), makeDie(1, 'pool')];
    const result = resolveMedical(crew);
    expect(result.find((d) => d.id === 0)!.location).toBe('scanners');
  });
});

describe('releaseFromScanners', () => {
  it('releases one die from scanners', () => {
    const crew = [makeDie(0, 'scanners'), makeDie(1, 'scanners')];
    const result = releaseFromScanners(crew);
    const inPool = result.filter((d) => d.location === 'pool');
    expect(inPool).toHaveLength(1);
    const inScanners = result.filter((d) => d.location === 'scanners');
    expect(inScanners).toHaveLength(1);
  });
});

describe('resolveScience', () => {
  it('returns maxShields', () => {
    expect(resolveScience(4)).toBe(4);
  });
});

describe('placeStasisToken', () => {
  it('adds a stasis token to the target threat', () => {
    const card = makeCard({ kind: 'external', maxHealth: 3 });
    const threat = createActiveThreat(card);
    const result = placeStasisToken([threat], threat.id);
    expect(result[0]!.stasisTokens).toBe(1);
  });

  it('does not affect other threats (covers ternary else branch)', () => {
    const card1 = makeCard({ kind: 'external', maxHealth: 3 });
    const card2 = makeCard({ kind: 'external', maxHealth: 2 });
    const t1 = createActiveThreat(card1);
    const t2 = createActiveThreat(card2);
    const result = placeStasisToken([t1, t2], t1.id);
    expect(result[0]!.stasisTokens).toBe(1);
    expect(result[1]!.stasisTokens).toBe(0);
  });
});

describe('commanderChangeDie', () => {
  it('changes the face of the target die', () => {
    const crew = [makeDie(0, 'pool', 'tactical')];
    const result = commanderChangeDie(crew, 0, 'science');
    expect(result[0]!.face).toBe('science');
  });

  it('does not affect other dice', () => {
    const crew = [makeDie(0, 'pool', 'tactical'), makeDie(1, 'pool', 'medical')];
    const result = commanderChangeDie(crew, 0, 'engineering');
    expect(result[1]!.face).toBe('medical');
  });
});

describe('commanderRerollCount', () => {
  it('counts only pool dice', () => {
    const crew = [makeDie(0, 'pool'), makeDie(1, 'infirmary'), makeDie(2, 'pool')];
    expect(commanderRerollCount(crew)).toBe(2);
  });
});

describe('isThreatResolved', () => {
  it('returns true when required dice are assigned', () => {
    const card = makeCard({ id: 'test', resolution: { face: 'engineering', count: 2 } });
    const threat = createActiveThreat(card);
    const crew = [
      makeDie(0, `threat-${threat.id}`, 'engineering'),
      makeDie(1, `threat-${threat.id}`, 'engineering'),
    ];
    expect(isThreatResolved(threat, crew)).toBe(true);
  });

  it('returns false when not enough dice', () => {
    const card = makeCard({ id: 'test2', resolution: { face: 'engineering', count: 2 } });
    const threat = createActiveThreat(card);
    const crew = [makeDie(0, `threat-${threat.id}`, 'engineering')];
    expect(isThreatResolved(threat, crew)).toBe(false);
  });

  it('returns false when wrong face', () => {
    const card = makeCard({ id: 'test3', resolution: { face: 'science', count: 1 } });
    const threat = createActiveThreat(card);
    const crew = [makeDie(0, `threat-${threat.id}`, 'engineering')];
    expect(isThreatResolved(threat, crew)).toBe(false);
  });

  it('returns false for no resolution requirement', () => {
    const card = makeCard({ resolution: null });
    const threat = createActiveThreat(card);
    expect(isThreatResolved(threat, [])).toBe(false);
  });
});

describe('resolveThreat', () => {
  it('removes the threat and frees assigned crew', () => {
    const card = makeCard({ id: 'resolved' });
    const threat = createActiveThreat(card);
    const crew = [makeDie(0, `threat-${threat.id}`, 'engineering'), makeDie(1, 'pool')];
    const { threats, crew: newCrew } = resolveThreat([threat], crew, threat.id);
    expect(threats).toHaveLength(0);
    expect(newCrew.find((d) => d.id === 0)!.location).toBe('pool');
  });
});

describe('processScanners', () => {
  it('every 3 scanner dice = 1 extra draw', () => {
    const crew = Array.from({ length: 6 }, (_, i) => makeDie(i, 'scanners'));
    const result = processScanners(crew);
    expect(result.extraDraws).toBe(2);
    expect(result.crew.every((d) => d.location === 'pool')).toBe(true);
  });

  it('2 scanner dice produce no extra draws', () => {
    const crew = [makeDie(0, 'scanners'), makeDie(1, 'scanners')];
    const result = processScanners(crew);
    expect(result.extraDraws).toBe(0);
    expect(result.crew.every((d) => d.location === 'scanners')).toBe(true);
  });

  it('4 scanner dice produce 1 draw, 1 remaining', () => {
    const crew = Array.from({ length: 4 }, (_, i) => makeDie(i, 'scanners'));
    const result = processScanners(crew);
    expect(result.extraDraws).toBe(1);
    const inScanners = result.crew.filter((d) => d.location === 'scanners');
    expect(inScanners).toHaveLength(1);
  });
});

describe('gatherCrew', () => {
  it('returns assigned dice to pool', () => {
    const crew = [makeDie(0, 'tactical'), makeDie(1, 'medical')];
    const result = gatherCrew(crew, []);
    expect(result.every((d) => d.location === 'pool')).toBe(true);
  });

  it('keeps infirmary dice in infirmary', () => {
    const crew = [makeDie(0, 'infirmary')];
    const result = gatherCrew(crew, []);
    expect(result[0]!.location).toBe('infirmary');
  });

  it('keeps scanner dice in scanners', () => {
    const crew = [makeDie(0, 'scanners')];
    const result = gatherCrew(crew, []);
    expect(result[0]!.location).toBe('scanners');
  });

  it('keeps dice on active threats locked', () => {
    const card = makeCard();
    const threat = createActiveThreat(card);
    const crew = [makeDie(0, `threat-${threat.id}`)];
    const result = gatherCrew(crew, [threat]);
    expect(result[0]!.location).toBe(`threat-${threat.id}`);
  });

  it('frees dice from resolved threats', () => {
    const card = makeCard();
    const threat = createActiveThreat(card);
    const crew = [makeDie(0, `threat-${threat.id}`)];
    // threat is not in active threats list (already resolved)
    const result = gatherCrew(crew, []);
    expect(result[0]!.location).toBe('pool');
  });
});

describe('passive threat checks', () => {
  it('isNebulaActive detects nebula', () => {
    const card = makeCard({ id: 'nebula' });
    const threat = createActiveThreat(card);
    expect(isNebulaActive([threat])).toBe(true);
    expect(isNebulaActive([{ ...threat, isDestroyed: true }])).toBe(false);
  });

  it('isCommsOfflineActive detects comms-offline', () => {
    const card = makeCard({ id: 'comms-offline' });
    const threat = createActiveThreat(card);
    expect(isCommsOfflineActive([threat])).toBe(true);
  });

  it('isTimeWarpActive detects time-warp', () => {
    const card = makeCard({ id: 'time-warp' });
    const threat = createActiveThreat(card);
    expect(isTimeWarpActive([threat])).toBe(true);
  });
});

describe('stationForFace', () => {
  it('maps each crew face to correct station', () => {
    expect(stationForFace('commander')).toBe('commander');
    expect(stationForFace('tactical')).toBe('tactical');
    expect(stationForFace('medical')).toBe('medical');
    expect(stationForFace('science')).toBe('science');
    expect(stationForFace('engineering')).toBe('engineering');
    expect(stationForFace('threat')).toBe('scanners');
  });
});

describe('canAssignToStation', () => {
  it('allows matching face to station', () => {
    const die = makeDie(0, 'pool', 'engineering');
    expect(canAssignToStation(die, 'engineering', false)).toBe(true);
  });

  it('rejects non-pool dice', () => {
    const die = makeDie(0, 'infirmary', 'tactical');
    expect(canAssignToStation(die, 'tactical', false)).toBe(false);
  });

  it('rejects wrong face', () => {
    const die = makeDie(0, 'pool', 'tactical');
    expect(canAssignToStation(die, 'medical', false)).toBe(false);
  });

  it('rejects commander station when comms offline', () => {
    const die = makeDie(0, 'pool', 'commander');
    expect(canAssignToStation(die, 'commander', true)).toBe(false);
  });

  it('rejects infirmary as a station (not a valid assignment target)', () => {
    const die = makeDie(0, 'pool', 'tactical');
    expect(canAssignToStation(die, 'infirmary', false)).toBe(false);
  });

  it('rejects scanners as a station (not a valid assignment target)', () => {
    const die = makeDie(0, 'pool', 'tactical');
    expect(canAssignToStation(die, 'scanners', false)).toBe(false);
  });
});

describe('canAssignToThreat', () => {
  it('allows matching face die in pool during assigning', () => {
    const die = makeDie(0, 'pool', 'engineering');
    const card = makeCard({ kind: 'internal', resolution: { face: 'engineering', count: 1 } });
    const threat = createActiveThreat(card);
    expect(canAssignToThreat(die, threat, { phase: 'assigning' })).toBe(true);
  });

  it('rejects outside assigning phase', () => {
    const die = makeDie(0, 'pool', 'engineering');
    const card = makeCard({ kind: 'internal', resolution: { face: 'engineering', count: 1 } });
    const threat = createActiveThreat(card);
    expect(canAssignToThreat(die, threat, { phase: 'rolling' })).toBe(false);
  });

  it('rejects non-pool die', () => {
    const die = makeDie(0, 'infirmary', 'engineering');
    const card = makeCard({ kind: 'internal', resolution: { face: 'engineering', count: 1 } });
    const threat = createActiveThreat(card);
    expect(canAssignToThreat(die, threat, { phase: 'assigning' })).toBe(false);
  });

  it('rejects external threat', () => {
    const die = makeDie(0, 'pool', 'engineering');
    const card = makeCard({ kind: 'external', resolution: null });
    const threat = createActiveThreat(card);
    expect(canAssignToThreat(die, threat, { phase: 'assigning' })).toBe(false);
  });

  it('rejects threat with no resolution', () => {
    const die = makeDie(0, 'pool', 'engineering');
    const card = makeCard({ kind: 'internal', resolution: null });
    const threat = createActiveThreat(card);
    expect(canAssignToThreat(die, threat, { phase: 'assigning' })).toBe(false);
  });

  it('rejects die with wrong face', () => {
    const die = makeDie(0, 'pool', 'tactical');
    const card = makeCard({ kind: 'internal', resolution: { face: 'engineering', count: 1 } });
    const threat = createActiveThreat(card);
    expect(canAssignToThreat(die, threat, { phase: 'assigning' })).toBe(false);
  });
});
