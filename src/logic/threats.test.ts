import { describe, it, expect, beforeEach } from 'vitest';
import {
  createActiveThreat,
  applyDamage,
  applyTacticalDamage,
  canTargetThreat,
  activateThreats,
  checkWin,
  checkCrewLoss,
  resetInstanceCounter,
} from './threats';
import type { ActiveThreat, CrewDie, ThreatCard } from '../types/game';

beforeEach(() => {
  resetInstanceCounter();
});

function makeCard(overrides: Partial<ThreatCard> = {}): ThreatCard {
  return {
    id: 'test-card',
    name: 'Test',
    kind: 'external',
    activation: 'skull',
    maxHealth: 4,
    description: '',
    resolution: null,
    isOuroboros: false,
    isBarrier: false,
    immediateOnReveal: false,
    ...overrides,
  };
}

function makeDie(id: number, location: CrewDie['location'] = 'pool'): CrewDie {
  return { id, face: 'tactical', location };
}

describe('createActiveThreat', () => {
  it('creates a threat with full health', () => {
    const card = makeCard({ maxHealth: 5 });
    const t = createActiveThreat(card);
    expect(t.health).toBe(5);
    expect(t.isDestroyed).toBe(false);
    expect(t.stasisTokens).toBe(0);
    expect(t.awayMission).toHaveLength(0);
  });

  it('produces unique ids for duplicate cards', () => {
    const card = makeCard();
    const t1 = createActiveThreat(card);
    const t2 = createActiveThreat(card);
    expect(t1.id).not.toBe(t2.id);
  });
});

describe('applyDamage', () => {
  it('shields absorb hull damage first', () => {
    const result = applyDamage(8, 4, 2, 0);
    expect(result.shields).toBe(2);
    expect(result.hull).toBe(8);
  });

  it('hull takes damage when shields are depleted', () => {
    const result = applyDamage(8, 2, 4, 0);
    expect(result.shields).toBe(0);
    expect(result.hull).toBe(6);
  });

  it('shield damage reduces shields directly', () => {
    const result = applyDamage(8, 4, 0, 2);
    expect(result.shields).toBe(2);
    expect(result.hull).toBe(8);
  });

  it('shield damage overflows to hull', () => {
    const result = applyDamage(8, 1, 0, 3);
    expect(result.shields).toBe(0);
    expect(result.hull).toBe(6);
  });

  it('hull cannot go below 0', () => {
    const result = applyDamage(2, 0, 10, 0);
    expect(result.hull).toBe(0);
  });

  it('shields cannot go below 0', () => {
    const result = applyDamage(8, 1, 0, 5);
    expect(result.shields).toBe(0);
  });

  it('both damages applied together', () => {
    const result = applyDamage(8, 4, 2, 1);
    // shield dmg 1: shields 4→3
    // hull dmg 2: shields absorb 2, shields 3→1
    expect(result.shields).toBe(1);
    expect(result.hull).toBe(8);
  });
});

describe('canTargetThreat', () => {
  it('allows targeting an external threat', () => {
    const card = makeCard({ kind: 'external' });
    const threat = createActiveThreat(card);
    expect(canTargetThreat(threat, [threat])).toBe(true);
  });

  it('disallows targeting internal threats', () => {
    const card = makeCard({ kind: 'internal', maxHealth: 0 });
    const threat = createActiveThreat(card);
    expect(canTargetThreat(threat, [threat])).toBe(false);
  });

  it('disallows targeting destroyed threats', () => {
    const card = makeCard();
    const threat = { ...createActiveThreat(card), isDestroyed: true };
    expect(canTargetThreat(threat, [threat])).toBe(false);
  });

  it('Orbital Cannon can only be targeted when alone', () => {
    const cannonCard = makeCard({ id: 'orbital-cannon' });
    const otherCard = makeCard({ id: 'other' });
    const cannon = createActiveThreat(cannonCard);
    const other = createActiveThreat(otherCard);
    expect(canTargetThreat(cannon, [cannon, other])).toBe(false);
    expect(canTargetThreat(cannon, [cannon])).toBe(true);
  });

  it('Orbital Cannon blocked by active boss-barrier (covers kind=boss-barrier branch)', () => {
    const cannonCard = makeCard({ id: 'orbital-cannon' });
    const barrierCard = makeCard({
      id: 'ouroboros-barrier',
      kind: 'boss-barrier',
      isBarrier: true,
    });
    const cannon = createActiveThreat(cannonCard);
    const barrier = createActiveThreat(barrierCard);
    expect(canTargetThreat(cannon, [cannon, barrier])).toBe(false);
  });

  it('Orbital Cannon can be targeted when only other external is destroyed (covers !isDestroyed false)', () => {
    const cannonCard = makeCard({ id: 'orbital-cannon' });
    const otherCard = makeCard({ id: 'pirates' });
    const cannon = createActiveThreat(cannonCard);
    const destroyed = { ...createActiveThreat(otherCard), isDestroyed: true };
    expect(canTargetThreat(cannon, [cannon, destroyed])).toBe(true);
  });

  it('Ouroboros cannot be targeted when barrier is active', () => {
    const bossCard = makeCard({ id: 'ouroboros', isOuroboros: true });
    const barrierCard = makeCard({ id: 'ouroboros-barrier', isBarrier: true });
    const boss = createActiveThreat(bossCard);
    const barrier = createActiveThreat(barrierCard);
    expect(canTargetThreat(boss, [boss, barrier])).toBe(false);
    const destroyedBarrier = { ...barrier, isDestroyed: true };
    expect(canTargetThreat(boss, [boss, destroyedBarrier])).toBe(true);
  });
});

describe('applyTacticalDamage', () => {
  it('reduces threat health by damage', () => {
    const card = makeCard({ maxHealth: 6 });
    const threat = createActiveThreat(card);
    const result = applyTacticalDamage([threat], threat.id, 3, false);
    expect(result[0]!.health).toBe(3);
  });

  it('marks threat as destroyed at 0 HP', () => {
    const card = makeCard({ maxHealth: 2 });
    const threat = createActiveThreat(card);
    const result = applyTacticalDamage([threat], threat.id, 5, false);
    expect(result[0]!.health).toBe(0);
    expect(result[0]!.isDestroyed).toBe(true);
  });

  it('does not affect non-target threats (covers return-t branch)', () => {
    const card1 = makeCard({ id: 'pirates', maxHealth: 4 });
    const card2 = makeCard({ id: 'scout', maxHealth: 3 });
    const t1 = createActiveThreat(card1);
    const t2 = createActiveThreat(card2);
    const result = applyTacticalDamage([t1, t2], t1.id, 2, false);
    expect(result[0]!.health).toBe(2); // t1 damaged
    expect(result[1]!.health).toBe(3); // t2 unchanged
  });

  it('time warp prevents damage below 1', () => {
    const card = makeCard({ maxHealth: 5 });
    const threat = createActiveThreat(card);
    const result = applyTacticalDamage([threat], threat.id, 10, true);
    expect(result[0]!.health).toBe(1);
    expect(result[0]!.isDestroyed).toBe(false);
  });

  it('time warp does not apply to Ouroboros', () => {
    const card = makeCard({ id: 'ouroboros', isOuroboros: true, maxHealth: 8 });
    const boss = createActiveThreat(card);
    const result = applyTacticalDamage([boss], boss.id, 100, true);
    expect(result[0]!.health).toBe(0);
    expect(result[0]!.isDestroyed).toBe(true);
  });
});

describe('activateThreats', () => {
  const baseState = {
    hull: 8,
    shields: 4,
    maxShields: 4,
    activeThreats: [] as ActiveThreat[],
    crew: [makeDie(0), makeDie(1), makeDie(2)],
  };

  it('does nothing when no threats match', () => {
    const strikeBombers = createActiveThreat(
      makeCard({ id: 'strike-bombers', activation: 'lightning' }),
    );
    const state = { ...baseState, activeThreats: [strikeBombers] };
    const result = activateThreats(state, 'skull');
    expect(result.hull).toBe(8);
    expect(result.shields).toBe(4);
  });

  it('Strike Bombers deal 1 hull damage', () => {
    const card = makeCard({ id: 'strike-bombers', activation: 'lightning', kind: 'external' });
    const threat = createActiveThreat(card);
    const state = { ...baseState, shields: 0, activeThreats: [threat] };
    const result = activateThreats(state, 'lightning');
    expect(result.hull).toBe(7);
  });

  it('stasis token suppresses activation', () => {
    const card = makeCard({ id: 'strike-bombers', activation: 'lightning', kind: 'external' });
    const threat = { ...createActiveThreat(card), stasisTokens: 1 };
    const state = { ...baseState, shields: 0, activeThreats: [threat] };
    const result = activateThreats(state, 'lightning');
    expect(result.hull).toBe(8); // no damage
    expect(result.threats[0]!.stasisTokens).toBe(0); // token consumed
  });

  it('stasis suppression with multiple threats covers non-matching ternary branch', () => {
    const stasisCard = makeCard({
      id: 'strike-bombers',
      activation: 'lightning',
      kind: 'external',
    });
    const otherCard = makeCard({ id: 'pirates', activation: 'skull', kind: 'external' });
    const stasisThreat = { ...createActiveThreat(stasisCard), stasisTokens: 1 };
    const otherThreat = createActiveThreat(otherCard);
    const state = { ...baseState, shields: 0, activeThreats: [stasisThreat, otherThreat] };
    const result = activateThreats(state, 'lightning');
    // Only stasis threat processed (lightning), pirates don't activate
    expect(result.hull).toBe(8);
    const stasisAfter = result.threats.find((t) => t.id === stasisThreat.id);
    expect(stasisAfter?.stasisTokens).toBe(0);
  });

  it('skips a destroyed non-barrier threat even if activation matches', () => {
    const card = makeCard({ id: 'strike-bombers', activation: 'lightning', kind: 'external' });
    const destroyed = { ...createActiveThreat(card), isDestroyed: true };
    const state = { ...baseState, shields: 0, activeThreats: [destroyed] };
    const result = activateThreats(state, 'lightning');
    expect(result.hull).toBe(8); // no damage — threat was destroyed
  });

  it('barrier regeneration with multiple threats covers non-matching ternary branch', () => {
    const barrierCard = makeCard({
      id: 'ouroboros-barrier',
      isBarrier: true,
      activation: 'skull',
      kind: 'boss-barrier',
      maxHealth: 5,
    });
    const otherCard = makeCard({ id: 'pirates', activation: 'lightning', kind: 'external' });
    const barrier = { ...createActiveThreat(barrierCard), health: 0, isDestroyed: true };
    const other = createActiveThreat(otherCard);
    const state = { ...baseState, shields: 0, activeThreats: [other, barrier] };
    const result = activateThreats(state, 'skull');
    const barrierAfter = result.threats.find((t) => t.id === barrier.id);
    expect(barrierAfter?.health).toBe(5); // regenerated
    expect(barrierAfter?.isDestroyed).toBe(false);
    expect(result.hull).toBe(6); // 2 hull damage from barrier
  });

  it('Pandemic sends all pool crew to infirmary', () => {
    const card = makeCard({ id: 'pandemic', kind: 'internal', activation: 'hazard', maxHealth: 0 });
    const threat = createActiveThreat(card);
    const crew = [makeDie(0, 'pool'), makeDie(1, 'pool'), makeDie(2, 'infirmary')];
    const state = { ...baseState, crew, activeThreats: [threat] };
    const result = activateThreats(state, 'hazard');
    const inInfirmary = result.crew.filter((d) => d.location === 'infirmary');
    expect(inInfirmary).toHaveLength(3);
  });

  it('Distracted frees locked die on activation', () => {
    const card = makeCard({ id: 'distracted', kind: 'internal', activation: 'nova', maxHealth: 0 });
    const threat = createActiveThreat(card);
    const crew = [makeDie(0, `threat-${threat.id}` as const), makeDie(1, 'pool')];
    const state = { ...baseState, crew, activeThreats: [threat] };
    const result = activateThreats(state, 'nova');
    const freed = result.crew.find((d) => d.id === 0);
    expect(freed!.location).toBe('pool');
    // Threat is removed from active threats
    expect(result.threats.find((t) => t.id === threat.id)).toBeUndefined();
  });
});

describe('checkWin', () => {
  it('returns false when deck is not empty', () => {
    expect(checkWin([{}], [])).toBe(false);
  });

  it('returns false when external threats remain', () => {
    const card = makeCard({ kind: 'external' });
    const threat = createActiveThreat(card);
    expect(checkWin([], [threat])).toBe(false);
  });

  it('returns true when deck empty and all externals destroyed', () => {
    const card = makeCard({ kind: 'external' });
    const threat = { ...createActiveThreat(card), isDestroyed: true };
    expect(checkWin([], [threat])).toBe(true);
  });

  it('returns true with no active threats and empty deck', () => {
    expect(checkWin([], [])).toBe(true);
  });
});

describe('checkCrewLoss', () => {
  it('returns false when at least one crew is in pool', () => {
    const crew = [makeDie(0, 'pool'), makeDie(1, 'infirmary')];
    expect(checkCrewLoss(crew)).toBe(false);
  });

  it('returns false when all crew are assigned to stations (they return at gather)', () => {
    const crew = [
      makeDie(0, 'tactical'),
      makeDie(1, 'tactical'),
      makeDie(2, 'commander'),
      makeDie(3, 'medical'),
      makeDie(4, 'engineering'),
      makeDie(5, 'science'),
    ];
    expect(checkCrewLoss(crew)).toBe(false);
  });

  it('returns true when all crew are in infirmary or scanners', () => {
    const crew = [makeDie(0, 'infirmary'), makeDie(1, 'scanners')];
    expect(checkCrewLoss(crew)).toBe(true);
  });

  it('returns true when all crew are on away missions', () => {
    const crew = [makeDie(0, 'threat-abc'), makeDie(1, 'threat-xyz')];
    expect(checkCrewLoss(crew)).toBe(true);
  });

  it('returns true for empty crew', () => {
    expect(checkCrewLoss([])).toBe(true);
  });
});

describe('activateThreats — individual cards', () => {
  const baseState = {
    hull: 8,
    shields: 4,
    maxShields: 4,
    activeThreats: [] as ActiveThreat[],
    crew: Array.from({ length: 3 }, (_, i) => makeDie(i, 'pool')),
  };

  function makeThreat(
    id: string,
    kind: ThreatCard['kind'] = 'internal',
    activation: ThreatCard['activation'] = 'skull',
  ): ActiveThreat {
    const card = makeCard({ id, kind, activation, maxHealth: kind === 'external' ? 4 : 0 });
    return createActiveThreat(card);
  }

  it('Friendly Fire deals 1 hull damage', () => {
    const threat = makeThreat('friendly-fire', 'internal', 'lightning');
    const state = { ...baseState, shields: 0, activeThreats: [threat] };
    const result = activateThreats(state, 'lightning');
    expect(result.hull).toBe(7);
  });

  it('Boost Morale recovers 1 crew from infirmary', () => {
    const threat = makeThreat('boost-morale', 'internal', 'nova');
    const crew = [makeDie(0, 'infirmary'), makeDie(1, 'pool')];
    const state = { ...baseState, crew, activeThreats: [threat] };
    const result = activateThreats(state, 'nova');
    expect(result.crew.filter((d) => d.location === 'infirmary')).toHaveLength(0);
  });

  it('Boost Morale does nothing when infirmary is empty', () => {
    const threat = makeThreat('boost-morale', 'internal', 'nova');
    const state = { ...baseState, activeThreats: [threat] };
    const result = activateThreats(state, 'nova');
    expect(result.log.some((l) => l.includes('no crew'))).toBe(true);
  });

  it('Nebula deals 1 shield damage', () => {
    const threat = makeThreat('nebula', 'internal', 'hazard');
    const state = { ...baseState, activeThreats: [threat] };
    const result = activateThreats(state, 'hazard');
    expect(result.shields).toBe(3);
  });

  it('Time Warp logs message', () => {
    const threat = makeThreat('time-warp', 'internal', 'nova');
    const state = { ...baseState, activeThreats: [threat] };
    const result = activateThreats(state, 'nova');
    expect(result.log.some((l) => l.includes('Time Warp'))).toBe(true);
  });

  it('Spore Infestation sends 2 crew to infirmary', () => {
    const threat = makeThreat('spore-infestation', 'internal', 'alien');
    const crew = Array.from({ length: 3 }, (_, i) => makeDie(i, 'pool'));
    const state = { ...baseState, crew, activeThreats: [threat] };
    const result = activateThreats(state, 'alien');
    expect(result.crew.filter((d) => d.location === 'infirmary')).toHaveLength(2);
  });

  it('Robot Uprising sends 2 crew to infirmary', () => {
    const threat = makeThreat('robot-uprising', 'internal', 'warning');
    const crew = Array.from({ length: 3 }, (_, i) => makeDie(i, 'pool'));
    const state = { ...baseState, crew, activeThreats: [threat] };
    const result = activateThreats(state, 'warning');
    expect(result.crew.filter((d) => d.location === 'infirmary')).toHaveLength(2);
  });

  it('Comms Offline sets extraDraw', () => {
    const threat = makeThreat('comms-offline', 'internal', 'lightning');
    const state = { ...baseState, activeThreats: [threat] };
    const result = activateThreats(state, 'lightning');
    expect(result.extraDraw).toBe(true);
  });

  it('Strike Bombers-2 deal 1 hull damage', () => {
    const threat = makeThreat('strike-bombers-2', 'external', 'lightning');
    const state = { ...baseState, shields: 0, activeThreats: [threat] };
    const result = activateThreats(state, 'lightning');
    expect(result.hull).toBe(7);
  });

  it('Scout deals 1 shield damage', () => {
    const threat = makeThreat('scout', 'external', 'hazard');
    const state = { ...baseState, activeThreats: [threat] };
    const result = activateThreats(state, 'hazard');
    expect(result.shields).toBe(3);
  });

  it('Scout-2 deals 1 shield damage', () => {
    const threat = makeThreat('scout-2', 'external', 'hazard');
    const state = { ...baseState, activeThreats: [threat] };
    const result = activateThreats(state, 'hazard');
    expect(result.shields).toBe(3);
  });

  it('Pirates deal 2 hull damage', () => {
    const threat = makeThreat('pirates', 'external', 'skull');
    const state = { ...baseState, shields: 0, activeThreats: [threat] };
    const result = activateThreats(state, 'skull');
    expect(result.hull).toBe(6);
  });

  it('Space Pirates deal 2 hull + 1 shield damage', () => {
    const threat = makeThreat('space-pirates', 'external', 'skull');
    const state = { ...baseState, activeThreats: [threat] };
    const result = activateThreats(state, 'skull');
    expect(result.shields).toBe(1); // -1 shield direct
    // shields (3 remaining) absorb 2 hull damage
    expect(result.hull).toBe(8);
  });

  it('Orbital Cannon deals 3 hull damage', () => {
    const threat = makeThreat('orbital-cannon', 'external', 'warning');
    const state = { ...baseState, shields: 0, activeThreats: [threat] };
    const result = activateThreats(state, 'warning');
    expect(result.hull).toBe(5);
  });

  it('Hijackers send 1 crew to infirmary', () => {
    const threat = makeThreat('hijackers', 'external', 'alien');
    const crew = [makeDie(0, 'pool'), makeDie(1, 'pool')];
    const state = { ...baseState, crew, activeThreats: [threat] };
    const result = activateThreats(state, 'alien');
    expect(result.crew.filter((d) => d.location === 'infirmary')).toHaveLength(1);
  });

  it('Ouroboros deals 3 hull damage', () => {
    const card = makeCard({
      id: 'ouroboros',
      isOuroboros: true,
      kind: 'external',
      activation: 'alien',
      maxHealth: 8,
    });
    const threat = createActiveThreat(card);
    const state = { ...baseState, shields: 0, activeThreats: [threat] };
    const result = activateThreats(state, 'alien');
    expect(result.hull).toBe(5);
  });

  it('Ouroboros Barrier regenerates and deals 2 hull damage', () => {
    const card = makeCard({
      id: 'ouroboros-barrier',
      isBarrier: true,
      kind: 'boss-barrier',
      activation: 'alien',
      maxHealth: 4,
    });
    const threat = { ...createActiveThreat(card), health: 0, isDestroyed: true };
    const state = { ...baseState, shields: 0, activeThreats: [threat] };
    const result = activateThreats(state, 'alien');
    expect(result.threats[0]!.health).toBe(4); // regenerated
    expect(result.hull).toBe(6); // 2 hull damage
  });

  it('Panel Explosion sends 1 crew to infirmary', () => {
    const threat = makeThreat('panel-explosion', 'internal', 'warning');
    const crew = [makeDie(0, 'pool'), makeDie(1, 'pool')];
    const state = { ...baseState, crew, activeThreats: [threat] };
    const result = activateThreats(state, 'warning');
    expect(result.crew.filter((d) => d.location === 'infirmary')).toHaveLength(1);
  });

  it('sendToInfirmary does nothing when no pool crew available', () => {
    const threat = makeThreat('panel-explosion', 'internal', 'warning');
    const crew = [makeDie(0, 'infirmary'), makeDie(1, 'scanners')];
    const state = { ...baseState, crew, activeThreats: [threat] };
    const result = activateThreats(state, 'warning');
    // No crew in pool to send, so crew state unchanged
    expect(result.crew.filter((d) => d.location === 'infirmary')).toHaveLength(1);
  });

  it('Distracted with no pool crew does not crash', () => {
    const threat = makeThreat('distracted', 'internal', 'nova');
    const crew = [makeDie(0, 'infirmary')];
    const state = { ...baseState, crew, activeThreats: [threat] };
    const result = activateThreats(state, 'nova');
    // Just logs and removes threat
    expect(result.threats.find((t) => t.id === threat.id)).toBeUndefined();
  });

  it('checkWin returns false when Ouroboros boss threat is alive', () => {
    const card = makeCard({ id: 'ouroboros', isOuroboros: true, kind: 'external', maxHealth: 8 });
    const threat = createActiveThreat(card);
    expect(checkWin([], [threat])).toBe(false);
  });

  it('checkWin returns false when active (non-destroyed) Barrier is present', () => {
    const card = makeCard({
      id: 'ouroboros-barrier',
      isBarrier: true,
      kind: 'boss-barrier',
      maxHealth: 5,
    });
    const barrier = createActiveThreat(card);
    expect(checkWin([], [barrier])).toBe(false);
  });

  it('checkWin returns true when only a destroyed Barrier remains', () => {
    const card = makeCard({
      id: 'ouroboros-barrier',
      isBarrier: true,
      kind: 'boss-barrier',
      maxHealth: 5,
    });
    const barrier = { ...createActiveThreat(card), isDestroyed: true };
    expect(checkWin([], [barrier])).toBe(true);
  });

  it('activates both internal and external threats with [external, internal] input order', () => {
    const internal = makeThreat('panel-explosion', 'internal', 'skull');
    const external = makeThreat('strike-bombers', 'external', 'skull');
    const crew = [makeDie(0, 'pool'), makeDie(1, 'pool'), makeDie(2, 'pool')];
    const state = { ...baseState, hull: 8, shields: 0, crew, activeThreats: [external, internal] };
    const result = activateThreats(state, 'skull');
    // Internal activates first (sorted), then external
    expect(result.crew.filter((d) => d.location === 'infirmary')).toHaveLength(1);
    expect(result.hull).toBe(7);
  });

  it('activates both internal and external threats with [internal, external] input order (other sort branch)', () => {
    const internal = makeThreat('panel-explosion', 'internal', 'skull');
    const external = makeThreat('strike-bombers', 'external', 'skull');
    const crew = [makeDie(0, 'pool'), makeDie(1, 'pool'), makeDie(2, 'pool')];
    const state = { ...baseState, hull: 8, shields: 0, crew, activeThreats: [internal, external] };
    const result = activateThreats(state, 'skull');
    expect(result.crew.filter((d) => d.location === 'infirmary')).toHaveLength(1);
    expect(result.hull).toBe(7);
  });

  it('skips filler threats entirely (covers filler-continue branch)', () => {
    const fillerCard = makeCard({
      id: 'dont-panic',
      kind: 'filler',
      activation: 'skull',
      maxHealth: 0,
    });
    const filler = createActiveThreat(fillerCard);
    const state = { ...baseState, shields: 0, activeThreats: [filler] };
    const result = activateThreats(state, 'skull');
    expect(result.hull).toBe(8); // filler does nothing
  });
});
