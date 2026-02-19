import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gameReducer, makeInitialState } from './reducer';
import { createActiveThreat, resetInstanceCounter } from '../logic/threats';
import type { CrewFace, GameState, ThreatCard } from '../types/game';

beforeEach(() => {
  resetInstanceCounter();
});

function playingState(): GameState {
  // NEW_GAME starts in 'drawing' for the 2-card setup sequence; step through both acknowledgements
  let s = gameReducer(makeInitialState(), { type: 'NEW_GAME', difficulty: 'normal' });
  s = gameReducer(s, { type: 'ACKNOWLEDGE_DRAW' }); // draw 2nd setup card
  s = gameReducer(s, { type: 'ACKNOWLEDGE_DRAW' }); // finish setup → rolling
  return s;
}

describe('makeInitialState', () => {
  it('starts in idle status', () => {
    expect(makeInitialState().status).toBe('idle');
  });

  it('has 6 crew dice', () => {
    expect(makeInitialState().crew).toHaveLength(6);
  });

  it('starts with full hull and shields', () => {
    const s = makeInitialState();
    expect(s.hull).toBe(s.maxHull);
    expect(s.shields).toBe(s.maxShields);
  });
});

describe('NEW_GAME', () => {
  it('transitions to playing status', () => {
    const s = gameReducer(makeInitialState(), { type: 'NEW_GAME', difficulty: 'normal' });
    expect(s.status).toBe('playing');
  });

  it('starts in drawing phase for setup card sequence', () => {
    const s = gameReducer(makeInitialState(), { type: 'NEW_GAME', difficulty: 'hard' });
    expect(s.phase).toBe('drawing');
    expect(s.setupDrawsRemaining).toBe(2);
  });

  it('populates the deck with the correct size', () => {
    // After NEW_GAME, the 1st setup card has already been drawn into activeThreats or discard.
    // Total cards in circulation (deck + active + discard) equals the full built deck size.
    // Core (14 internal + 9 external + 1 barrier + 1 Ouroboros) = 25; plus fillers: 6/3/0.
    const easy = gameReducer(makeInitialState(), { type: 'NEW_GAME', difficulty: 'easy' });
    const normal = gameReducer(makeInitialState(), { type: 'NEW_GAME', difficulty: 'normal' });
    const hard = gameReducer(makeInitialState(), { type: 'NEW_GAME', difficulty: 'hard' });
    const total = (s: GameState) => s.deck.length + s.activeThreats.length + s.discard.length;
    expect(total(easy)).toBe(31);
    expect(total(normal)).toBe(28);
    expect(total(hard)).toBe(25);
  });

  it('starts playing with full crew', () => {
    // Hull/shields may already be affected by the 2 initial threat card reveals,
    // so we only verify the game is running with all 6 crew dice present.
    const s = gameReducer(makeInitialState(), { type: 'NEW_GAME', difficulty: 'normal' });
    expect(s.status).toBe('playing');
    expect(s.crew).toHaveLength(6);
    expect(s.hull).toBeLessThanOrEqual(s.maxHull);
    expect(s.shields).toBeLessThanOrEqual(s.maxShields);
  });
});

describe('TICK', () => {
  it('increments elapsedSeconds when playing', () => {
    const s = playingState();
    const next = gameReducer(s, { type: 'TICK' });
    expect(next.elapsedSeconds).toBe(1);
  });

  it('does nothing when not playing', () => {
    const s = makeInitialState();
    const next = gameReducer(s, { type: 'TICK' });
    expect(next).toBe(s);
  });
});

describe('ROLL_COMPLETE', () => {
  it('applies rolled faces to pool dice', () => {
    const s = playingState();
    // All crew in pool after NEW_GAME
    const next = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['commander', 'tactical', 'medical', 'science', 'engineering', 'threat'],
    });
    expect(next.phase).toBe('assigning');
    const faces = next.crew.map((d) => d.face);
    // Threat face → scanners; others in pool
    expect(faces).toContain('commander');
    expect(faces).toContain('tactical');
  });

  it('auto-locks threat dice to scanners and keeps them locked even when 3 trigger a draw', () => {
    const s = playingState();
    const next = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['threat', 'threat', 'threat', 'tactical', 'medical', 'commander'],
    });
    // Exactly 3 threat dice → scanner draw triggered → dice stay locked in scanners
    const inScanners = next.crew.filter((d) => d.location === 'scanners');
    expect(inScanners).toHaveLength(3);
    // All other dice are pool or locked on a threat (e.g. Distracted card drawn)
    const notAccountedFor = next.crew.filter(
      (d) =>
        d.location !== 'pool' &&
        d.location !== 'scanners' &&
        !String(d.location).startsWith('threat-'),
    );
    expect(notAccountedFor).toHaveLength(0);
  });

  it('every 3 threat dice in scanners draws a threat card', () => {
    const s = playingState();
    const deckSize = s.deck.length;
    const next = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['threat', 'threat', 'threat', 'tactical', 'medical', 'commander'],
    });
    // 3 threat dice → 1 scanner draw → deck shrinks by 1
    expect(next.deck.length).toBe(deckSize - 1);
  });

  it('transitions to assigning phase', () => {
    const s = playingState();
    const next = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['commander', 'tactical', 'medical', 'science', 'engineering', 'engineering'],
    });
    expect(next.phase).toBe('assigning');
  });
});

describe('SELECT_DIE', () => {
  it('selects a die', () => {
    const s = playingState();
    const assigning = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['tactical', 'tactical', 'engineering', 'medical', 'science', 'commander'],
    });
    const next = gameReducer(assigning, { type: 'SELECT_DIE', dieId: 0 });
    expect(next.selectedDieId).toBe(0);
  });

  it('deselects when null', () => {
    const s = playingState();
    const assigning = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['tactical', 'tactical', 'engineering', 'medical', 'science', 'commander'],
    });
    const selected = gameReducer(assigning, { type: 'SELECT_DIE', dieId: 0 });
    const deselected = gameReducer(selected, { type: 'SELECT_DIE', dieId: null });
    expect(deselected.selectedDieId).toBeNull();
  });

  it('ignored outside assigning phase', () => {
    const s = playingState();
    const next = gameReducer(s, { type: 'SELECT_DIE', dieId: 0 });
    expect(next.selectedDieId).toBeNull();
  });
});

describe('ASSIGN_TO_STATION', () => {
  it('moves a die to a station', () => {
    const s = playingState();
    // Force a known roll
    const assigning = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['tactical', 'tactical', 'engineering', 'medical', 'science', 'commander'],
    });
    // Die 0 should have face 'tactical' (pool)
    const die = assigning.crew.find((d) => d.face === 'tactical' && d.location === 'pool');
    expect(die).toBeDefined();
    const next = gameReducer(assigning, {
      type: 'ASSIGN_TO_STATION',
      dieId: die!.id,
      stationId: 'tactical',
    });
    expect(next.crew.find((d) => d.id === die!.id)!.location).toBe('tactical');
  });

  it('tracks tactical dice for firing', () => {
    const s = playingState();
    const assigning = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['tactical', 'tactical', 'engineering', 'medical', 'science', 'commander'],
    });
    const tactDie = assigning.crew.find((d) => d.face === 'tactical' && d.location === 'pool');
    const next = gameReducer(assigning, {
      type: 'ASSIGN_TO_STATION',
      dieId: tactDie!.id,
      stationId: 'tactical',
    });
    expect(next.tacticalDice).toContain(tactDie!.id);
  });

  it('rejected outside assigning phase', () => {
    const s = playingState(); // rolling phase
    const next = gameReducer(s, { type: 'ASSIGN_TO_STATION', dieId: 0, stationId: 'tactical' });
    expect(next).toBe(s);
  });

  it('rejected when die is not in pool (e.g. in scanners)', () => {
    const s = assigningState([
      'threat',
      'tactical',
      'engineering',
      'medical',
      'science',
      'commander',
    ]);
    // The threat die was auto-locked to scanners
    const scannerDie = s.crew.find((d) => d.location === 'scanners')!;
    const next = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: scannerDie.id,
      stationId: 'tactical',
    });
    expect(next.crew.find((d) => d.id === scannerDie.id)!.location).toBe('scanners');
  });

  it('rejected when die id does not exist in crew', () => {
    const s = assigningState();
    const next = gameReducer(s, { type: 'ASSIGN_TO_STATION', dieId: 999, stationId: 'tactical' });
    expect(next).toBe(s);
  });
});

describe('USE_ENGINEERING', () => {
  it('does nothing with no engineering dice at station', () => {
    const s = assigningState();
    const next = gameReducer(s, { type: 'USE_ENGINEERING' });
    expect(next).toBe(s);
  });

  it('repairs hull by number of engineering dice', () => {
    const s = playingState();
    const assigning = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['engineering', 'engineering', 'tactical', 'medical', 'science', 'commander'],
    });
    const damagedState = { ...assigning, hull: 5 };
    const engDice = damagedState.crew.filter(
      (d) => d.face === 'engineering' && d.location === 'pool',
    );
    let state = damagedState;
    for (const die of engDice) {
      state = gameReducer(state, {
        type: 'ASSIGN_TO_STATION',
        dieId: die.id,
        stationId: 'engineering',
      });
    }
    const result = gameReducer(state, { type: 'USE_ENGINEERING' });
    expect(result.hull).toBe(7);
  });
});

describe('USE_MEDICAL', () => {
  it('does nothing with no medical dice at station', () => {
    const s = assigningState();
    const next = gameReducer(s, { type: 'USE_MEDICAL' });
    expect(next).toBe(s);
  });

  it('blocked on second call (one-use per turn)', () => {
    const base = playingState();
    const s = { ...base, crew: base.crew.map((d) => ({ ...d, location: 'pool' as const })) };
    const assigning = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['medical', 'tactical', 'engineering', 'commander', 'science', 'engineering'],
    });
    const withInjured = {
      ...assigning,
      crew: assigning.crew.map((d, i) => (i === 1 ? { ...d, location: 'infirmary' as const } : d)),
    };
    const medDie = withInjured.crew.find((d) => d.face === 'medical' && d.location === 'pool')!;
    const assigned = gameReducer(withInjured, {
      type: 'ASSIGN_TO_STATION',
      dieId: medDie.id,
      stationId: 'medical',
    });
    const firstUse = gameReducer(assigned, { type: 'USE_MEDICAL' });
    expect(firstUse.usedStationActions).toContain('USE_MEDICAL');
    // Second call is a no-op
    const secondUse = gameReducer(firstUse, { type: 'USE_MEDICAL' });
    expect(secondUse).toBe(firstUse);
  });

  it('recovers all crew from infirmary', () => {
    const base = playingState();
    // Reset all crew to pool so ROLL_COMPLETE can assign all 6 faces deterministically,
    // regardless of what the random setup draws may have done to crew locations.
    const s = { ...base, crew: base.crew.map((d) => ({ ...d, location: 'pool' as const })) };
    const assigning = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['medical', 'tactical', 'engineering', 'commander', 'science', 'engineering'],
    });
    const withInjured = {
      ...assigning,
      crew: assigning.crew.map((d, i) => (i === 1 ? { ...d, location: 'infirmary' as const } : d)),
    };
    const medDie = withInjured.crew.find((d) => d.face === 'medical' && d.location === 'pool');
    const assigned = gameReducer(withInjured, {
      type: 'ASSIGN_TO_STATION',
      dieId: medDie!.id,
      stationId: 'medical',
    });
    const result = gameReducer(assigned, { type: 'USE_MEDICAL' });
    expect(result.crew.filter((d) => d.location === 'infirmary')).toHaveLength(0);
  });
});

describe('END_ASSIGN_PHASE', () => {
  it('ignored outside assigning phase', () => {
    const s = playingState(); // rolling phase
    const next = gameReducer(s, { type: 'END_ASSIGN_PHASE' });
    expect(next).toBe(s);
  });

  it('transitions to drawing phase and draws a card', () => {
    const s = playingState();
    const assigning = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['tactical', 'engineering', 'medical', 'science', 'commander', 'commander'],
    });
    const deckSizeBefore = assigning.deck.length;
    const next = gameReducer(assigning, { type: 'END_ASSIGN_PHASE' });
    expect(next.phase).toBe('drawing');
    // Exactly one card drawn from deck (may go to activeThreats or discard)
    expect(next.deck.length).toBe(deckSizeBefore - 1);
  });
});

describe('ACKNOWLEDGE_DRAW', () => {
  it('ignored outside drawing phase', () => {
    const s = playingState(); // rolling phase
    const next = gameReducer(s, { type: 'ACKNOWLEDGE_DRAW' });
    expect(next).toBe(s);
  });

  it('transitions from drawing to activating', () => {
    const s = playingState();
    const assigning = gameReducer(s, {
      type: 'ROLL_COMPLETE',
      faces: ['tactical', 'engineering', 'medical', 'science', 'commander', 'commander'],
    });
    const drawing = gameReducer(assigning, { type: 'END_ASSIGN_PHASE' });
    expect(drawing.phase).toBe('drawing');
    const activating = gameReducer(drawing, { type: 'ACKNOWLEDGE_DRAW' });
    expect(activating.phase).toBe('activating');
  });
});

describe('THREAT_ROLL_COMPLETE', () => {
  it('ignored outside activating phase', () => {
    const s = playingState(); // rolling phase
    const next = gameReducer(s, { type: 'THREAT_ROLL_COMPLETE', face: 'skull' });
    expect(next).toBe(s);
  });

  it('deals damage when external threat activates', () => {
    const s = playingState();
    // Preset a playing state with a strike-bombers threat activating on 'lightning'
    const preset: GameState = {
      ...s,
      phase: 'activating',
      shields: 0,
      hull: 8,
      activeThreats: [
        {
          id: 'strike-bombers-1',
          card: {
            id: 'strike-bombers',
            name: 'Strike Bombers',
            kind: 'external',
            activation: 'lightning',
            maxHealth: 3,
            description: '',
            resolution: null,
            isOuroboros: false,
            isBarrier: false,
            immediateOnReveal: false,
          },
          health: 3,
          stasisTokens: 0,
          awayMission: [],
          isDestroyed: false,
        },
      ],
    };
    const next = gameReducer(preset, { type: 'THREAT_ROLL_COMPLETE', face: 'lightning' });
    expect(next.hull).toBe(7);
  });

  it('does not activate threats with non-matching symbol', () => {
    const s = playingState();
    const preset: GameState = {
      ...s,
      phase: 'activating',
      shields: 0,
      hull: 8,
      activeThreats: [
        {
          id: 'pirates-1',
          card: {
            id: 'pirates',
            name: 'Pirates',
            kind: 'external',
            activation: 'skull',
            maxHealth: 4,
            description: '',
            resolution: null,
            isOuroboros: false,
            isBarrier: false,
            immediateOnReveal: false,
          },
          health: 4,
          stasisTokens: 0,
          awayMission: [],
          isDestroyed: false,
        },
      ],
    };
    const next = gameReducer(preset, { type: 'THREAT_ROLL_COMPLETE', face: 'lightning' });
    expect(next.hull).toBe(8); // no damage
  });
});

describe('ACKNOWLEDGE_GATHER', () => {
  it('resets usedStationActions for the next turn', () => {
    const gathering: GameState = {
      ...playingState(),
      phase: 'gathering',
      activeThreats: [],
      usedStationActions: ['USE_MEDICAL', 'USE_SCIENCE', 'USE_COMMANDER'],
    };
    const next = gameReducer(gathering, { type: 'ACKNOWLEDGE_GATHER' });
    expect(next.usedStationActions).toHaveLength(0);
  });

  it('ignored outside gathering phase', () => {
    const s = playingState(); // rolling phase
    const next = gameReducer(s, { type: 'ACKNOWLEDGE_GATHER' });
    expect(next).toBe(s);
  });

  it('returns crew to pool and increments turn', () => {
    const s = playingState();
    // Clear activeThreats so no crew are locked on threat cards (setup draws may have produced some)
    const gathering: GameState = { ...s, phase: 'gathering', turnNumber: 3, activeThreats: [] };
    const next = gameReducer(gathering, { type: 'ACKNOWLEDGE_GATHER' });
    expect(next.phase).toBe('rolling');
    expect(next.turnNumber).toBe(4);
    expect(
      next.crew.every(
        (d) => d.location === 'pool' || d.location === 'infirmary' || d.location === 'scanners',
      ),
    ).toBe(true);
  });
});

describe('Win/Loss conditions', () => {
  it('hull reaching 0 sets lost with hull reason', () => {
    const s = playingState();
    const preset: GameState = {
      ...s,
      phase: 'activating',
      hull: 1,
      shields: 0,
      activeThreats: [
        {
          id: 'pirates-1',
          card: {
            id: 'pirates',
            name: 'Pirates',
            kind: 'external',
            activation: 'skull',
            maxHealth: 4,
            description: '',
            resolution: null,
            isOuroboros: false,
            isBarrier: false,
            immediateOnReveal: false,
          },
          health: 4,
          stasisTokens: 0,
          awayMission: [],
          isDestroyed: false,
        },
      ],
    };
    const next = gameReducer(preset, { type: 'THREAT_ROLL_COMPLETE', face: 'skull' });
    expect(next.status).toBe('lost');
    expect(next.lossReason).toBe('hull');
  });

  it('empty deck + all externals destroyed = won', () => {
    const s = playingState();
    const preset: GameState = { ...s, phase: 'gathering', deck: [], activeThreats: [] };
    const next = gameReducer(preset, { type: 'ACKNOWLEDGE_GATHER' });
    expect(next.status).toBe('won');
  });
});

describe('__TEST_LOAD_STATE', () => {
  it('replaces state entirely', () => {
    const preset = { ...makeInitialState(), status: 'won' as const };
    const next = gameReducer(makeInitialState(), { type: '__TEST_LOAD_STATE', state: preset });
    expect(next.status).toBe('won');
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function assigningState(
  faces: [
    'tactical' | 'engineering' | 'medical' | 'science' | 'commander' | 'threat',
    ...('tactical' | 'engineering' | 'medical' | 'science' | 'commander' | 'threat')[],
  ] = ['tactical', 'tactical', 'engineering', 'medical', 'science', 'commander'],
): GameState {
  return gameReducer(playingState(), { type: 'ROLL_COMPLETE', faces });
}

function makeExternalThreat(
  id = 'pirates',
  activation: ThreatCard['activation'] = 'skull',
): ReturnType<typeof createActiveThreat> {
  const card: ThreatCard = {
    id,
    name: id,
    kind: 'external',
    activation,
    maxHealth: 4,
    description: '',
    resolution: null,
    isOuroboros: false,
    isBarrier: false,
    immediateOnReveal: false,
  };
  return createActiveThreat(card);
}

function makeInternalThreat(
  id = 'panel-explosion',
  resolutionFace: CrewFace = 'engineering',
  count = 1,
): ReturnType<typeof createActiveThreat> {
  const card: ThreatCard = {
    id,
    name: id,
    kind: 'internal',
    activation: 'skull',
    maxHealth: 0,
    description: '',
    resolution: { face: resolutionFace, count },
    isOuroboros: false,
    isBarrier: false,
    immediateOnReveal: false,
  };
  return createActiveThreat(card);
}

// ── START_ROLL ─────────────────────────────────────────────────────────────────

describe('START_ROLL', () => {
  it('updates log when in rolling phase', () => {
    const s = playingState();
    const next = gameReducer(s, { type: 'START_ROLL' });
    expect(next.log.some((l) => l.includes('Rolling'))).toBe(true);
  });

  it('ignored outside rolling phase', () => {
    const s = assigningState();
    const next = gameReducer(s, { type: 'START_ROLL' });
    expect(next).toBe(s);
  });
});

// ── ASSIGN_TO_THREAT ───────────────────────────────────────────────────────────

describe('ASSIGN_TO_THREAT', () => {
  it('moves a die to a threat location (count 2, not yet resolved)', () => {
    const s = assigningState([
      'engineering',
      'tactical',
      'medical',
      'science',
      'commander',
      'commander',
    ]);
    // count: 2 means 1 die won't resolve it yet
    const threat = makeInternalThreat('panel-explosion', 'engineering', 2);
    const state: GameState = { ...s, activeThreats: [threat] };
    const die = state.crew.find((d) => d.face === 'engineering' && d.location === 'pool')!;
    const next = gameReducer(state, {
      type: 'ASSIGN_TO_THREAT',
      dieId: die.id,
      threatId: threat.id,
    });
    expect(next.crew.find((d) => d.id === die.id)!.location).toBe(`threat-${threat.id}`);
    expect(next.activeThreats).toHaveLength(1);
  });

  it('auto-resolves threat when fully manned (count 1)', () => {
    const s = assigningState([
      'engineering',
      'tactical',
      'medical',
      'science',
      'commander',
      'commander',
    ]);
    const threat = makeInternalThreat('panel-explosion', 'engineering');
    const state: GameState = { ...s, activeThreats: [threat] };
    const die = state.crew.find((d) => d.face === 'engineering' && d.location === 'pool')!;
    const next = gameReducer(state, {
      type: 'ASSIGN_TO_THREAT',
      dieId: die.id,
      threatId: threat.id,
    });
    expect(next.activeThreats).toHaveLength(0);
    expect(next.crew.find((d) => d.id === die.id)!.location).toBe('pool');
  });

  it('rejects die with wrong face', () => {
    const s = assigningState([
      'tactical',
      'tactical',
      'medical',
      'science',
      'commander',
      'commander',
    ]);
    const threat = makeInternalThreat('panel-explosion', 'engineering');
    const state: GameState = { ...s, activeThreats: [threat] };
    const die = state.crew.find((d) => d.face === 'tactical' && d.location === 'pool')!;
    const next = gameReducer(state, {
      type: 'ASSIGN_TO_THREAT',
      dieId: die.id,
      threatId: threat.id,
    });
    expect(next.crew.find((d) => d.id === die.id)!.location).toBe('pool');
  });

  it('rejected when threat is external (no resolution)', () => {
    const s = assigningState([
      'engineering',
      'tactical',
      'medical',
      'science',
      'commander',
      'commander',
    ]);
    const threat = makeExternalThreat('pirates');
    const state: GameState = { ...s, activeThreats: [threat] };
    const engDie = state.crew.find((d) => d.face === 'engineering' && d.location === 'pool')!;
    const next = gameReducer(state, {
      type: 'ASSIGN_TO_THREAT',
      dieId: engDie.id,
      threatId: threat.id,
    });
    expect(next).toBe(state);
  });

  it('processResolvedThreats skips external threat (kind !== internal branch)', () => {
    // Have both an internal threat (not yet resolved, count=2) and external in activeThreats
    const s = assigningState([
      'engineering',
      'tactical',
      'medical',
      'science',
      'commander',
      'commander',
    ]);
    const internalThreat = makeInternalThreat('robot-uprising', 'engineering', 2);
    const externalThreat = makeExternalThreat('pirates');
    const state: GameState = { ...s, activeThreats: [internalThreat, externalThreat] };
    const engDie = state.crew.find((d) => d.face === 'engineering' && d.location === 'pool')!;
    // Assign 1 die (not enough to resolve — need 2); processResolvedThreats runs but skips external
    const result = gameReducer(state, {
      type: 'ASSIGN_TO_THREAT',
      dieId: engDie.id,
      threatId: internalThreat.id,
    });
    // External stays, internal stays (not resolved yet)
    expect(result.activeThreats).toHaveLength(2);
  });

  it('ignored outside assigning phase', () => {
    const s = playingState();
    const next = gameReducer(s, { type: 'ASSIGN_TO_THREAT', dieId: 0, threatId: 'any' });
    expect(next).toBe(s);
  });
});

// ── USE_MEDICAL_SCANNERS ───────────────────────────────────────────────────────

describe('USE_MEDICAL_SCANNERS', () => {
  it('releases one die from scanners when medical die is assigned', () => {
    // Roll with one threat face (goes to scanners) and one medical face
    const s = assigningState([
      'medical',
      'threat',
      'engineering',
      'science',
      'commander',
      'tactical',
    ]);
    const medDie = s.crew.find((d) => d.face === 'medical' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: medDie.id,
      stationId: 'medical',
    });
    const scannersBefore = assigned.crew.filter((d) => d.location === 'scanners').length;
    const result = gameReducer(assigned, { type: 'USE_MEDICAL_SCANNERS' });
    expect(result.crew.filter((d) => d.location === 'scanners').length).toBe(scannersBefore - 1);
  });

  it('does nothing with no medical dice at station', () => {
    const s = assigningState();
    const next = gameReducer(s, { type: 'USE_MEDICAL_SCANNERS' });
    expect(next).toBe(s);
  });
});

// ── USE_TACTICAL ───────────────────────────────────────────────────────────────

describe('USE_TACTICAL', () => {
  it('deals damage to target external threat', () => {
    const s = assigningState([
      'tactical',
      'engineering',
      'medical',
      'science',
      'commander',
      'commander',
    ]);
    const tactDie = s.crew.find((d) => d.face === 'tactical' && d.location === 'pool')!;
    const afterAssign = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: tactDie.id,
      stationId: 'tactical',
    });
    const threat = makeExternalThreat('pirates', 'skull');
    const state: GameState = { ...afterAssign, activeThreats: [threat] };
    const result = gameReducer(state, { type: 'USE_TACTICAL', targetThreatId: threat.id });
    // 1 tactical die = 1 damage; pirates had 4 HP
    const remaining = result.activeThreats.find((t) => t.id === threat.id);
    expect(remaining?.health).toBe(3);
  });

  it('destroys and removes threat when health reaches 0', () => {
    const s = assigningState([
      'tactical',
      'tactical',
      'engineering',
      'medical',
      'science',
      'commander',
    ]);
    let state = s;
    for (const die of s.crew.filter((d) => d.face === 'tactical' && d.location === 'pool')) {
      state = gameReducer(state, {
        type: 'ASSIGN_TO_STATION',
        dieId: die.id,
        stationId: 'tactical',
      });
    }
    // 2 tactical dice = 3 damage (1+2); make a threat with 3 HP
    const card: ThreatCard = {
      id: 'scout',
      name: 'Scout',
      kind: 'external',
      activation: 'skull',
      maxHealth: 3,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: false,
    };
    const threat = createActiveThreat(card);
    const withThreat: GameState = { ...state, activeThreats: [threat] };
    const result = gameReducer(withThreat, { type: 'USE_TACTICAL', targetThreatId: threat.id });
    expect(result.activeThreats.find((t) => t.id === threat.id)).toBeUndefined();
    expect(result.discard.some((c) => c.id === 'scout')).toBe(true);
  });

  it('does nothing with no tactical dice assigned', () => {
    const s = assigningState();
    const threat = makeExternalThreat();
    const state: GameState = { ...s, activeThreats: [threat] };
    const next = gameReducer(state, { type: 'USE_TACTICAL', targetThreatId: threat.id });
    expect(next).toBe(state);
  });

  it('does nothing with unknown target', () => {
    const s = assigningState([
      'tactical',
      'engineering',
      'medical',
      'science',
      'commander',
      'commander',
    ]);
    const tactDie = s.crew.find((d) => d.face === 'tactical' && d.location === 'pool')!;
    const state = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: tactDie.id,
      stationId: 'tactical',
    });
    const next = gameReducer(state, { type: 'USE_TACTICAL', targetThreatId: 'nonexistent-id' });
    expect(next).toBe(state);
  });

  it('does nothing when canTargetThreat returns false (Ouroboros with active barrier)', () => {
    const s = assigningState([
      'tactical',
      'engineering',
      'medical',
      'science',
      'commander',
      'commander',
    ]);
    const tactDie = s.crew.find((d) => d.face === 'tactical' && d.location === 'pool')!;
    const afterAssign = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: tactDie.id,
      stationId: 'tactical',
    });
    const bossCard: ThreatCard = {
      id: 'ouroboros',
      name: 'Ouroboros',
      kind: 'external',
      activation: 'skull',
      maxHealth: 8,
      description: '',
      resolution: null,
      isOuroboros: true,
      isBarrier: false,
      immediateOnReveal: false,
    };
    const barrierCard: ThreatCard = {
      id: 'ouroboros-barrier',
      name: 'Barrier',
      kind: 'boss-barrier',
      activation: 'skull',
      maxHealth: 5,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: true,
      immediateOnReveal: false,
    };
    const boss = createActiveThreat(bossCard);
    const barrier = createActiveThreat(barrierCard);
    const state: GameState = { ...afterAssign, activeThreats: [boss, barrier] };
    const next = gameReducer(state, { type: 'USE_TACTICAL', targetThreatId: boss.id });
    expect(next).toBe(state);
  });

  it('limits damage when time warp is active', () => {
    const s = assigningState([
      'tactical',
      'tactical',
      'tactical',
      'medical',
      'science',
      'commander',
    ]);
    let state = s;
    for (const die of s.crew.filter((d) => d.face === 'tactical' && d.location === 'pool')) {
      state = gameReducer(state, {
        type: 'ASSIGN_TO_STATION',
        dieId: die.id,
        stationId: 'tactical',
      });
    }
    const timeWarpCard: ThreatCard = {
      id: 'time-warp',
      name: 'Time Warp',
      kind: 'internal',
      activation: 'skull',
      maxHealth: 0,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: false,
    };
    const targetCard: ThreatCard = {
      id: 'pirates',
      name: 'Pirates',
      kind: 'external',
      activation: 'skull',
      maxHealth: 4,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: false,
    };
    const timeWarp = createActiveThreat(timeWarpCard);
    const target = createActiveThreat(targetCard);
    const withWarp: GameState = { ...state, activeThreats: [timeWarp, target] };
    // 3 tactical dice = 5 damage, but time warp limits to max 1 HP remaining
    const result = gameReducer(withWarp, { type: 'USE_TACTICAL', targetThreatId: target.id });
    expect(result.activeThreats.find((t) => t.id === target.id)?.health).toBe(1);
  });

  it('triggers win when last external threat destroyed', () => {
    const s = assigningState([
      'tactical',
      'engineering',
      'medical',
      'science',
      'commander',
      'commander',
    ]);
    const tactDie = s.crew.find((d) => d.face === 'tactical' && d.location === 'pool')!;
    const afterAssign = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: tactDie.id,
      stationId: 'tactical',
    });
    const card: ThreatCard = {
      id: 'scout',
      name: 'Scout',
      kind: 'external',
      activation: 'skull',
      maxHealth: 1,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: false,
    };
    const threat = createActiveThreat(card);
    const state: GameState = { ...afterAssign, activeThreats: [threat], deck: [] };
    const result = gameReducer(state, { type: 'USE_TACTICAL', targetThreatId: threat.id });
    expect(result.status).toBe('won');
  });
});

// ── USE_SCIENCE_SHIELDS ────────────────────────────────────────────────────────

describe('USE_SCIENCE_SHIELDS', () => {
  it('blocked on second call (one-use per turn)', () => {
    const s = assigningState([
      'science',
      'tactical',
      'engineering',
      'medical',
      'commander',
      'commander',
    ]);
    const sciDie = s.crew.find((d) => d.face === 'science' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: sciDie.id,
      stationId: 'science',
    });
    const depleted: GameState = { ...assigned, shields: 0 };
    const firstUse = gameReducer(depleted, { type: 'USE_SCIENCE_SHIELDS' });
    expect(firstUse.usedStationActions).toContain('USE_SCIENCE');
    const secondUse = gameReducer(firstUse, { type: 'USE_SCIENCE_SHIELDS' });
    expect(secondUse).toBe(firstUse);
  });

  it('USE_SCIENCE_STASIS also blocked after shields used (shared science budget)', () => {
    const s = assigningState([
      'science',
      'tactical',
      'engineering',
      'medical',
      'commander',
      'commander',
    ]);
    const sciDie = s.crew.find((d) => d.face === 'science' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: sciDie.id,
      stationId: 'science',
    });
    const withThreat: GameState = {
      ...assigned,
      shields: 0,
      activeThreats: [makeExternalThreat()],
    };
    const afterShields = gameReducer(withThreat, { type: 'USE_SCIENCE_SHIELDS' });
    // Now try stasis — should be blocked
    const afterStasis = gameReducer(afterShields, {
      type: 'USE_SCIENCE_STASIS',
      targetThreatId: afterShields.activeThreats[0]!.id,
    });
    expect(afterStasis).toBe(afterShields);
  });

  it('recharges shields to max', () => {
    const s = assigningState([
      'science',
      'tactical',
      'engineering',
      'medical',
      'commander',
      'commander',
    ]);
    const sciDie = s.crew.find((d) => d.face === 'science' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: sciDie.id,
      stationId: 'science',
    });
    const depleted: GameState = { ...assigned, shields: 0 };
    const result = gameReducer(depleted, { type: 'USE_SCIENCE_SHIELDS' });
    expect(result.shields).toBe(result.maxShields);
  });

  it('blocked when nebula is active', () => {
    const s = assigningState([
      'science',
      'tactical',
      'engineering',
      'medical',
      'commander',
      'commander',
    ]);
    const sciDie = s.crew.find((d) => d.face === 'science' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: sciDie.id,
      stationId: 'science',
    });
    const withNebula: GameState = { ...assigned, shields: 0, nebulaActive: true };
    const result = gameReducer(withNebula, { type: 'USE_SCIENCE_SHIELDS' });
    expect(result.shields).toBe(0);
  });

  it('does nothing with no science dice at station', () => {
    const s = assigningState();
    const next = gameReducer(s, { type: 'USE_SCIENCE_SHIELDS' });
    expect(next).toBe(s);
  });
});

// ── USE_SCIENCE_STASIS ─────────────────────────────────────────────────────────

describe('USE_SCIENCE_STASIS', () => {
  it('places stasis token on target threat', () => {
    const s = assigningState([
      'science',
      'tactical',
      'engineering',
      'medical',
      'commander',
      'commander',
    ]);
    const sciDie = s.crew.find((d) => d.face === 'science' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: sciDie.id,
      stationId: 'science',
    });
    const threat = makeExternalThreat();
    const state: GameState = { ...assigned, activeThreats: [threat] };
    const result = gameReducer(state, { type: 'USE_SCIENCE_STASIS', targetThreatId: threat.id });
    expect(result.activeThreats[0]?.stasisTokens).toBe(1);
  });

  it('does nothing with no science dice at station', () => {
    const s = assigningState();
    const threat = makeExternalThreat();
    const state: GameState = { ...s, activeThreats: [threat] };
    const next = gameReducer(state, { type: 'USE_SCIENCE_STASIS', targetThreatId: threat.id });
    expect(next).toBe(state);
  });

  it('does nothing when target threat not found', () => {
    const s = assigningState([
      'science',
      'tactical',
      'engineering',
      'medical',
      'commander',
      'commander',
    ]);
    const sciDie = s.crew.find((d) => d.face === 'science' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: sciDie.id,
      stationId: 'science',
    });
    const next = gameReducer(assigned, {
      type: 'USE_SCIENCE_STASIS',
      targetThreatId: 'nonexistent',
    });
    expect(next).toBe(assigned);
  });
});

// ── USE_COMMANDER_REROLL ───────────────────────────────────────────────────────

describe('USE_COMMANDER_REROLL', () => {
  it('blocked on second call (one-use per turn)', () => {
    const s = assigningState([
      'commander',
      'tactical',
      'engineering',
      'medical',
      'science',
      'engineering',
    ]);
    const cmdDie = s.crew.find((d) => d.face === 'commander' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: cmdDie.id,
      stationId: 'commander',
    });
    const safeAssigned: GameState = { ...assigned, commsOfflineActive: false };
    const firstUse = gameReducer(safeAssigned, { type: 'USE_COMMANDER_REROLL' });
    expect(firstUse.usedStationActions).toContain('USE_COMMANDER');
    const secondUse = gameReducer(firstUse, { type: 'USE_COMMANDER_REROLL' });
    expect(secondUse).toBe(firstUse);
  });

  it('USE_COMMANDER_CHANGE also blocked after reroll used (shared commander budget)', () => {
    const s = assigningState([
      'commander',
      'tactical',
      'engineering',
      'medical',
      'science',
      'engineering',
    ]);
    const cmdDie = s.crew.find((d) => d.face === 'commander' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: cmdDie.id,
      stationId: 'commander',
    });
    const safeAssigned: GameState = { ...assigned, commsOfflineActive: false };
    const afterReroll = gameReducer(safeAssigned, { type: 'USE_COMMANDER_REROLL' });
    // Pool dice were rerolled; find one to try to change
    const poolDie = afterReroll.crew.find((d) => d.location === 'pool');
    if (poolDie) {
      const afterChange = gameReducer(afterReroll, {
        type: 'USE_COMMANDER_CHANGE',
        targetDieId: poolDie.id,
        newFace: 'medical',
      });
      expect(afterChange).toBe(afterReroll);
    }
  });

  it('rerolls pool dice and logs the action', () => {
    const s = assigningState([
      'commander',
      'tactical',
      'engineering',
      'medical',
      'science',
      'engineering',
    ]);
    const cmdDie = s.crew.find((d) => d.face === 'commander' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: cmdDie.id,
      stationId: 'commander',
    });
    const safeAssigned: GameState = { ...assigned, commsOfflineActive: false };
    const result = gameReducer(safeAssigned, { type: 'USE_COMMANDER_REROLL' });
    expect(result.log.some((l) => l.includes('re-rolled'))).toBe(true);
  });

  it('blocked when comms offline is active', () => {
    const s = assigningState([
      'commander',
      'tactical',
      'engineering',
      'medical',
      'science',
      'engineering',
    ]);
    const cmdDie = s.crew.find((d) => d.face === 'commander' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: cmdDie.id,
      stationId: 'commander',
    });
    const withComms: GameState = { ...assigned, commsOfflineActive: true };
    const next = gameReducer(withComms, { type: 'USE_COMMANDER_REROLL' });
    expect(next).toBe(withComms);
  });

  it('does nothing with no commander die at station', () => {
    const s = assigningState();
    const next = gameReducer(s, { type: 'USE_COMMANDER_REROLL' });
    expect(next).toBe(s);
  });
});

// ── USE_COMMANDER_CHANGE ───────────────────────────────────────────────────────

describe('USE_COMMANDER_CHANGE', () => {
  it('changes the target die face', () => {
    const s = assigningState([
      'commander',
      'tactical',
      'engineering',
      'medical',
      'science',
      'engineering',
    ]);
    const cmdDie = s.crew.find((d) => d.face === 'commander' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: cmdDie.id,
      stationId: 'commander',
    });
    const safeAssigned: GameState = { ...assigned, commsOfflineActive: false };
    const tactDie = safeAssigned.crew.find((d) => d.face === 'tactical' && d.location === 'pool')!;
    const result = gameReducer(safeAssigned, {
      type: 'USE_COMMANDER_CHANGE',
      targetDieId: tactDie.id,
      newFace: 'science',
    });
    expect(result.crew.find((d) => d.id === tactDie.id)!.face).toBe('science');
  });

  it('auto-locks die to scanners when changed to threat face', () => {
    const s = assigningState([
      'commander',
      'tactical',
      'engineering',
      'medical',
      'science',
      'engineering',
    ]);
    const cmdDie = s.crew.find((d) => d.face === 'commander' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: cmdDie.id,
      stationId: 'commander',
    });
    const safeAssigned: GameState = { ...assigned, commsOfflineActive: false };
    const tactDie = safeAssigned.crew.find((d) => d.face === 'tactical' && d.location === 'pool')!;
    const result = gameReducer(safeAssigned, {
      type: 'USE_COMMANDER_CHANGE',
      targetDieId: tactDie.id,
      newFace: 'threat',
    });
    expect(result.crew.find((d) => d.id === tactDie.id)!.location).toBe('scanners');
  });

  it('blocked when comms offline is active', () => {
    const s = assigningState([
      'commander',
      'tactical',
      'engineering',
      'medical',
      'science',
      'engineering',
    ]);
    const cmdDie = s.crew.find((d) => d.face === 'commander' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: cmdDie.id,
      stationId: 'commander',
    });
    const withComms: GameState = { ...assigned, commsOfflineActive: true };
    const tactDie = withComms.crew.find((d) => d.face === 'tactical' && d.location === 'pool')!;
    const next = gameReducer(withComms, {
      type: 'USE_COMMANDER_CHANGE',
      targetDieId: tactDie.id,
      newFace: 'science',
    });
    expect(next).toBe(withComms);
  });

  it('does nothing with no commander die at station', () => {
    const s = assigningState();
    const tactDie = s.crew.find((d) => d.face === 'tactical' && d.location === 'pool')!;
    const next = gameReducer(s, {
      type: 'USE_COMMANDER_CHANGE',
      targetDieId: tactDie.id,
      newFace: 'science',
    });
    expect(next).toBe(s);
  });
});

// ── END_ASSIGN_PHASE auto-engineering ──────────────────────────────────────────

// Filler card used to control deck draws (harmless, no hull damage)
const FILLER_CARD: ThreatCard = {
  id: 'dont-panic',
  name: "Don't Panic",
  kind: 'filler',
  activation: 'skull',
  maxHealth: 0,
  description: '',
  resolution: null,
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

describe('END_ASSIGN_PHASE auto-engineering', () => {
  it('auto-applies engineering die when ending assign phase', () => {
    const s = assigningState([
      'engineering',
      'engineering',
      'tactical',
      'medical',
      'science',
      'commander',
    ]);
    const engDie = s.crew.find((d) => d.face === 'engineering' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: engDie.id,
      stationId: 'engineering',
    });
    // Use controlled deck so the draw doesn't deal random damage
    const damaged: GameState = { ...assigned, hull: 5, deck: [FILLER_CARD] };
    const result = gameReducer(damaged, { type: 'END_ASSIGN_PHASE' });
    expect(result.hull).toBe(6);
  });

  it('engineering at full hull produces no repair message (covers repaired=0 branch)', () => {
    const s = assigningState([
      'engineering',
      'engineering',
      'tactical',
      'medical',
      'science',
      'commander',
    ]);
    const engDie = s.crew.find((d) => d.face === 'engineering' && d.location === 'pool')!;
    const assigned = gameReducer(s, {
      type: 'ASSIGN_TO_STATION',
      dieId: engDie.id,
      stationId: 'engineering',
    });
    // Hull is already at max; use controlled deck so the draw doesn't deal random damage.
    // Also reset hull to max since setup draws may have damaged it.
    const controlled: GameState = { ...assigned, deck: [FILLER_CARD], hull: assigned.maxHull };
    const result = gameReducer(controlled, { type: 'END_ASSIGN_PHASE' });
    expect(result.hull).toBe(8);
    expect(result.log.some((l) => l.includes('auto-resolved'))).toBe(false);
  });
});

// ── START_THREAT_ROLL ──────────────────────────────────────────────────────────

describe('START_THREAT_ROLL', () => {
  it('clears threatDieFace when in activating phase', () => {
    const s: GameState = { ...playingState(), phase: 'activating', threatDieFace: 'skull' };
    const next = gameReducer(s, { type: 'START_THREAT_ROLL' });
    expect(next.threatDieFace).toBeNull();
  });

  it('ignored outside activating phase', () => {
    const s = playingState();
    const next = gameReducer(s, { type: 'START_THREAT_ROLL' });
    expect(next).toBe(s);
  });
});

// ── ACKNOWLEDGE_ACTIVATE ───────────────────────────────────────────────────────

describe('ACKNOWLEDGE_ACTIVATE', () => {
  it('transitions from activating to gathering', () => {
    const s: GameState = { ...playingState(), phase: 'activating' };
    const next = gameReducer(s, { type: 'ACKNOWLEDGE_ACTIVATE' });
    expect(next.phase).toBe('gathering');
  });

  it('ignored outside activating phase', () => {
    const s = playingState();
    const next = gameReducer(s, { type: 'ACKNOWLEDGE_ACTIVATE' });
    expect(next).toBe(s);
  });
});

// ── Crew loss condition ────────────────────────────────────────────────────────

describe('crew loss condition', () => {
  it('all crew in infirmary triggers crew loss on ROLL_COMPLETE', () => {
    const s: GameState = {
      ...playingState(),
      phase: 'rolling',
      crew: playingState().crew.map((d) => ({ ...d, location: 'infirmary' as const })),
    };
    const next = gameReducer(s, { type: 'ROLL_COMPLETE', faces: [] });
    expect(next.status).toBe('lost');
    expect(next.lossReason).toBe('crew');
  });
});

// ── Immediate reveal effects ───────────────────────────────────────────────────

describe('solar-winds-flagship immediate draw', () => {
  it('deals 5 hull damage on draw and discards without adding to activeThreats', () => {
    const solarWindsCard: ThreatCard = {
      id: 'solar-winds-flagship',
      name: 'Solar Winds Flagship',
      kind: 'external',
      activation: 'skull',
      maxHealth: 0,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: true,
    };
    const s = assigningState();
    const state: GameState = {
      ...s,
      hull: 8,
      shields: 4,
      deck: [solarWindsCard, ...s.deck.slice(1)],
    };
    const result = gameReducer(state, { type: 'END_ASSIGN_PHASE' });
    // 5 hull damage: 4 absorbed by shields → 1 to hull
    expect(result.shields).toBe(0);
    expect(result.hull).toBe(7);
    expect(result.activeThreats.some((t) => t.card.id === 'solar-winds-flagship')).toBe(false);
    expect(result.discard.some((c) => c.id === 'solar-winds-flagship')).toBe(true);
  });
});

describe('distracted immediate draw', () => {
  it('locks a pool die on the threat when drawn', () => {
    const distractedCard: ThreatCard = {
      id: 'distracted',
      name: 'Distracted',
      kind: 'internal',
      activation: 'skull',
      maxHealth: 0,
      description: '',
      resolution: { face: 'commander', count: 1 },
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: true,
    };
    const s = assigningState();
    // Clear activeThreats so setup-drawn threats don't contaminate the count
    const state: GameState = {
      ...s,
      activeThreats: [],
      deck: [distractedCard, ...s.deck.slice(1)],
    };
    const result = gameReducer(state, { type: 'END_ASSIGN_PHASE' });
    const distractedThreats = result.activeThreats.filter((t) => t.card.id === 'distracted');
    expect(distractedThreats).toHaveLength(1);
    const lockedDice = result.crew.filter(
      (d) => d.location === `threat-${distractedThreats[0]!.id}`,
    );
    expect(lockedDice).toHaveLength(1);
  });

  it('no pool crew available — threat added but no die locked (covers line 124)', () => {
    const distractedCard: ThreatCard = {
      id: 'distracted',
      name: 'Distracted',
      kind: 'internal',
      activation: 'skull',
      maxHealth: 0,
      description: '',
      resolution: { face: 'commander', count: 1 },
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: true,
    };
    const s = assigningState();
    // Move all crew to infirmary so no pool die is available
    // Clear activeThreats so setup-drawn threats don't contaminate the count
    const state: GameState = {
      ...s,
      activeThreats: [],
      deck: [distractedCard, ...s.deck.slice(1)],
      crew: s.crew.map((d) => ({ ...d, location: 'infirmary' as const })),
    };
    const result = gameReducer(state, { type: 'END_ASSIGN_PHASE' });
    const distractedThreats = result.activeThreats.filter((t) => t.card.id === 'distracted');
    expect(distractedThreats).toHaveLength(1);
    const lockedDice = result.crew.filter((d) => d.location.startsWith('threat-'));
    expect(lockedDice).toHaveLength(0);
  });
});

describe('immediateOnReveal card with unknown id (covers dead-code line 129)', () => {
  it('card drawn but not added to activeThreats or discard', () => {
    const syntheticCard: ThreatCard = {
      id: 'synthetic-immediate',
      name: 'Synthetic',
      kind: 'external',
      activation: 'skull',
      maxHealth: 2,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: true, // not solar-winds-flagship or distracted
    };
    const s = assigningState();
    const state: GameState = { ...s, activeThreats: [], discard: [], deck: [syntheticCard] };
    const result = gameReducer(state, { type: 'END_ASSIGN_PHASE' });
    // Card falls through applyRevealEffect returning {} — not added anywhere
    expect(result.activeThreats).toHaveLength(0);
    expect(result.discard).toHaveLength(0);
    expect(result.drawnCard?.id).toBe('synthetic-immediate');
  });
});

describe('filler card draw', () => {
  it('discards filler without adding to activeThreats', () => {
    const fillerCard: ThreatCard = {
      id: 'dont-panic',
      name: "Don't Panic",
      kind: 'filler',
      activation: 'skull',
      maxHealth: 0,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: false,
    };
    const s = assigningState();
    const state: GameState = { ...s, activeThreats: [], deck: [fillerCard] };
    const result = gameReducer(state, { type: 'END_ASSIGN_PHASE' });
    expect(result.activeThreats).toHaveLength(0);
    expect(result.discard.some((c) => c.id === 'dont-panic')).toBe(true);
  });
});

// ── THREAT_ROLL_COMPLETE edge cases ────────────────────────────────────────────

describe('THREAT_ROLL_COMPLETE — time warp reshuffles discard', () => {
  it('does nothing when discard is empty (covers toReshuffle.length=0 branch)', () => {
    const timeWarpCard: ThreatCard = {
      id: 'time-warp',
      name: 'Time Warp',
      kind: 'internal',
      activation: 'skull',
      maxHealth: 0,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: false,
    };
    const s: GameState = {
      ...playingState(),
      phase: 'activating',
      discard: [],
      activeThreats: [
        {
          id: 'time-warp-1',
          card: timeWarpCard,
          health: 0,
          stasisTokens: 0,
          awayMission: [],
          isDestroyed: false,
        },
      ],
    };
    const deckSizeBefore = s.deck.length;
    const next = gameReducer(s, { type: 'THREAT_ROLL_COMPLETE', face: 'skull' });
    expect(next.deck.length).toBe(deckSizeBefore); // no change, empty discard
  });

  it('adds up to 3 discard cards back into the deck', () => {
    const timeWarpCard: ThreatCard = {
      id: 'time-warp',
      name: 'Time Warp',
      kind: 'internal',
      activation: 'skull',
      maxHealth: 0,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: false,
    };
    const dummyCard: ThreatCard = {
      id: 'dummy',
      name: 'Dummy',
      kind: 'external',
      activation: 'skull',
      maxHealth: 1,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: false,
    };
    const s: GameState = {
      ...playingState(),
      phase: 'activating',
      discard: [dummyCard, { ...dummyCard, id: 'dummy2' }, { ...dummyCard, id: 'dummy3' }],
      activeThreats: [
        {
          id: 'time-warp-1',
          card: timeWarpCard,
          health: 0,
          stasisTokens: 0,
          awayMission: [],
          isDestroyed: false,
        },
      ],
    };
    const deckSizeBefore = s.deck.length;
    const next = gameReducer(s, { type: 'THREAT_ROLL_COMPLETE', face: 'skull' });
    expect(next.deck.length).toBe(deckSizeBefore + 3);
  });
});

describe('THREAT_ROLL_COMPLETE — comms offline draws extra card', () => {
  it('deck shrinks by 1 more when comms offline activates', () => {
    const commsCard: ThreatCard = {
      id: 'comms-offline',
      name: 'Comms Offline',
      kind: 'internal',
      activation: 'skull',
      maxHealth: 0,
      description: '',
      resolution: null,
      isOuroboros: false,
      isBarrier: false,
      immediateOnReveal: false,
    };
    const s: GameState = {
      ...playingState(),
      phase: 'activating',
      activeThreats: [
        {
          id: 'comms-offline-1',
          card: commsCard,
          health: 0,
          stasisTokens: 0,
          awayMission: [],
          isDestroyed: false,
        },
      ],
    };
    const deckSizeBefore = s.deck.length;
    const next = gameReducer(s, { type: 'THREAT_ROLL_COMPLETE', face: 'skull' });
    // Comms offline activation draws 1 extra card
    expect(next.deck.length).toBeLessThan(deckSizeBefore);
  });
});

// ── USE_COMMANDER_REROLL with threat faces ─────────────────────────────────────

describe('USE_COMMANDER_REROLL — threat face rolled', () => {
  it('auto-locks rerolled threat dice to scanners', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9); // index 5 = 'threat'
    try {
      const s = assigningState([
        'commander',
        'tactical',
        'engineering',
        'medical',
        'science',
        'engineering',
      ]);
      const cmdDie = s.crew.find((d) => d.face === 'commander' && d.location === 'pool')!;
      const assigned = gameReducer(s, {
        type: 'ASSIGN_TO_STATION',
        dieId: cmdDie.id,
        stationId: 'commander',
      });
      const safeAssigned: GameState = { ...assigned, commsOfflineActive: false };
      const result = gameReducer(safeAssigned, { type: 'USE_COMMANDER_REROLL' });
      // With Math.random() always returning 0.9, all pool dice get 'threat' face → scanners
      const inScanners = result.crew.filter((d) => d.location === 'scanners');
      expect(inScanners.length).toBeGreaterThan(0);
      expect(result.log.some((l) => l.includes('Scanners'))).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });
});

// ── Reducer default case ───────────────────────────────────────────────────────

describe('reducer default case', () => {
  it('returns state unchanged for unknown action type', () => {
    const s = makeInitialState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = gameReducer(s, { type: 'UNKNOWN_ACTION' } as any);
    expect(next).toBe(s);
  });
});
