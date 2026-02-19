import type { GameAction } from './actions';
import type { ActiveThreat, CrewDie, Difficulty, GameState } from '../types/game';
import { buildDeck, drawCard } from '../logic/deck';
import { rollAllCrewDice, calculateTacticalDamage } from '../logic/dice';
import {
  createActiveThreat,
  applyTacticalDamage,
  canTargetThreat,
  activateThreats,
  checkWin,
  checkCrewLoss,
} from '../logic/threats';
import {
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
} from '../logic/stations';

// ── Initial state ──────────────────────────────────────────────────────────────

export function makeInitialState(): GameState {
  return {
    status: 'idle',
    phase: 'rolling',
    difficulty: 'normal',
    hull: 8,
    maxHull: 8,
    shields: 4,
    maxShields: 4,
    crew: Array.from({ length: 6 }, (_, i) => ({
      id: i,
      face: 'tactical' as const,
      location: 'pool' as const,
    })),
    activeThreats: [],
    deck: [],
    discard: [],
    threatDieFace: null,
    selectedDieId: null,
    tacticalDice: [],
    log: [],
    lossReason: null,
    turnNumber: 0,
    elapsedSeconds: 0,
    drawnCard: null,
    nebulaActive: false,
    commsOfflineActive: false,
    setupDrawsRemaining: 0,
    usedStationActions: [],
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function startNewGame(difficulty: Difficulty): GameState {
  const deck = buildDeck(difficulty);
  const crew: ReadonlyArray<CrewDie> = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    face: 'tactical' as const,
    location: 'pool' as const,
  }));
  let state: GameState = {
    ...makeInitialState(),
    status: 'playing',
    phase: 'rolling',
    difficulty,
    deck,
    crew,
    log: ['Game started. Drawing 2 initial threat cards...'],
    turnNumber: 1,
  };

  // Draw 1st setup card; player will acknowledge it, then draw the 2nd, then proceed to rolling
  state = drawAndProcessCard({ ...state, setupDrawsRemaining: 2 });
  state = withPassiveFlags({ ...state, phase: 'drawing' });
  return withWinLossCheck(state);
}

/** Apply threat card effects on reveal. Returns updated state fields. */
function applyRevealEffect(
  state: GameState,
  card: typeof state.drawnCard & NonNullable<unknown>,
): Partial<GameState> {
  if (!card.immediateOnReveal) return {};

  const log = [...state.log];

  if (card.id === 'solar-winds-flagship') {
    // Deal 5 hull damage then discard
    let hull = state.hull;
    let shields = state.shields;
    const totalDmg = 5;
    const absorbed = Math.min(shields, totalDmg);
    shields -= absorbed;
    hull -= totalDmg - absorbed;
    hull = Math.max(0, hull);
    log.push(`Solar Winds Flagship fires! ${totalDmg} hull damage dealt. Card discarded.`);
    return {
      hull,
      shields,
      log,
      discard: [...state.discard, card],
    };
  }

  if (card.id.startsWith('distracted')) {
    // Lock one pool die on the card
    const newThreat = createActiveThreat(card);
    const poolDie = state.crew.find((d) => d.location === 'pool');
    let crew = state.crew;
    const threats = [...state.activeThreats, newThreat];
    if (poolDie) {
      crew = crew.map((d) =>
        d.id === poolDie.id ? { ...d, location: `threat-${newThreat.id}` as const } : d,
      );
      log.push(`${card.name}: ${poolDie.face} crew member is distracted!`);
    } else {
      log.push(`${card.name}: no crew available to distract.`);
    }
    return { crew, activeThreats: threats, log };
  }

  return {};
}

/** Draw and process a single threat card. Returns updated state. */
function drawAndProcessCard(state: GameState): GameState {
  const result = drawCard(state.deck);
  if (!result) return state; // deck empty, no draw

  const [card, remainingDeck] = result;
  const log = [...state.log, `Threat card drawn: ${card.name}.`];

  // Handle filler
  if (card.kind === 'filler') {
    return {
      ...state,
      deck: remainingDeck,
      discard: [...state.discard, card],
      log: [...log, `${card.name} — nothing happens.`],
      drawnCard: card,
    };
  }

  // Handle internal/external threats with immediate effects
  const revealEffects = applyRevealEffect({ ...state, deck: remainingDeck, log }, card);

  // For non-immediate reveal cards, add to active threats
  let activeThreats = state.activeThreats;
  let discard = [...state.discard];

  if (!card.immediateOnReveal) {
    const newThreat = createActiveThreat(card);
    activeThreats = [...activeThreats, newThreat];
  } else if (card.id === 'solar-winds-flagship') {
    // Solar Winds discards immediately
    discard = (revealEffects.discard ?? discard) as typeof discard;
  } else if (card.id.startsWith('distracted')) {
    // Distracted handled in revealEffects (adds to active threats there)
    activeThreats = revealEffects.activeThreats ?? activeThreats;
  }

  return {
    ...state,
    ...revealEffects,
    deck: remainingDeck,
    activeThreats,
    discard: card.immediateOnReveal ? discard : state.discard,
    log: revealEffects.log ?? log,
    drawnCard: card,
  };
}

/** After assign phase, process any resolved internal threats. */
function processResolvedThreats(state: GameState): GameState {
  let currentState = state;
  for (const threat of state.activeThreats) {
    if (threat.card.kind !== 'internal') continue;
    if (isThreatResolved(threat, currentState.crew)) {
      const { threats, crew } = resolveThreat(
        currentState.activeThreats,
        currentState.crew,
        threat.id,
      );
      currentState = {
        ...currentState,
        activeThreats: threats,
        crew,
        discard: [...currentState.discard, threat.card],
        log: [...currentState.log, `${threat.card.name} resolved!`],
      };
    }
  }
  return currentState;
}

/** Recompute passive flags after threat list changes. */
function withPassiveFlags(state: GameState): GameState {
  return {
    ...state,
    nebulaActive: isNebulaActive(state.activeThreats),
    commsOfflineActive: isCommsOfflineActive(state.activeThreats),
  };
}

/** Check win/loss after a state-changing action. */
function withWinLossCheck(state: GameState): GameState {
  if (state.hull <= 0) {
    return { ...state, status: 'lost', lossReason: 'hull' };
  }
  if (state.status === 'playing' && checkCrewLoss(state.crew)) {
    return { ...state, status: 'lost', lossReason: 'crew' };
  }
  if (state.status === 'playing' && checkWin(state.deck, state.activeThreats)) {
    return { ...state, status: 'won' };
  }
  return state;
}

// ── Reducer ────────────────────────────────────────────────────────────────────

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // ── Meta ────────────────────────────────────────────────────────────────

    case '__TEST_LOAD_STATE':
      return action.state;

    case 'NEW_GAME':
      return startNewGame(action.difficulty);

    case 'TICK':
      if (state.status !== 'playing') return state;
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };

    // ── Rolling phase ───────────────────────────────────────────────────────

    case 'START_ROLL': {
      if (state.status !== 'playing' || state.phase !== 'rolling') return state;
      // transition stays rolling; animation plays, then ROLL_COMPLETE is dispatched
      return { ...state, log: [`Turn ${state.turnNumber}: Rolling crew dice...`] };
    }

    case 'ROLL_COMPLETE': {
      if (state.status !== 'playing' || state.phase !== 'rolling') return state;

      // Apply rolled faces to pool dice
      const poolDice = state.crew.filter((d) => d.location === 'pool');
      let crew = state.crew.map((d) => {
        const poolIndex = poolDice.findIndex((p) => p.id === d.id);
        if (poolIndex === -1) return d;
        return { ...d, face: action.faces[poolIndex] ?? d.face };
      });

      // Auto-lock ThreatDetected dice to scanners
      const newThreatDice: number[] = [];
      crew = crew.map((d) => {
        if (d.location === 'pool' && d.face === 'threat') {
          newThreatDice.push(d.id);
          return { ...d, location: 'scanners' as const };
        }
        return d;
      });

      const log = [...state.log];
      if (newThreatDice.length > 0) {
        log.push(`${newThreatDice.length} die/dice locked in Scanners (Threat Detected).`);
      }

      // Process scanners: every 3 = draw a threat card
      const { crew: crewAfterScanners, extraDraws } = processScanners(crew);
      let currentState: GameState = { ...state, crew: crewAfterScanners, log };

      for (let i = 0; i < extraDraws; i++) {
        currentState = drawAndProcessCard(currentState);
        currentState = {
          ...currentState,
          log: [...currentState.log, `(Scanner draw ${i + 1}/${extraDraws})`],
        };
      }

      currentState = withPassiveFlags({ ...currentState, phase: 'assigning', drawnCard: null });
      return withWinLossCheck(currentState);
    }

    // ── Assign phase ─────────────────────────────────────────────────────────

    case 'SELECT_DIE': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      return { ...state, selectedDieId: action.dieId };
    }

    case 'ASSIGN_TO_STATION': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      const die = state.crew.find((d) => d.id === action.dieId);
      if (!die || die.location !== 'pool') return state;

      const crew = state.crew.map((d) =>
        d.id === action.dieId ? { ...d, location: action.stationId } : d,
      );

      // Track tactical dice for later firing
      let tacticalDice = state.tacticalDice;
      if (action.stationId === 'tactical') {
        tacticalDice = [...tacticalDice, action.dieId];
      }

      return withPassiveFlags({
        ...state,
        crew,
        tacticalDice,
        selectedDieId: null,
        log: [...state.log, `Assigned ${die.face} die to ${action.stationId}.`],
      });
    }

    case 'ASSIGN_TO_THREAT': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      const die = state.crew.find((d) => d.id === action.dieId);
      const threat = state.activeThreats.find((t) => t.id === action.threatId);
      if (!die || !threat || die.location !== 'pool') return state;
      if (threat.card.kind !== 'internal' || !threat.card.resolution) return state;
      if (die.face !== threat.card.resolution.face) return state;

      const crew = state.crew.map((d) =>
        d.id === action.dieId ? { ...d, location: `threat-${action.threatId}` as const } : d,
      );

      // Update away mission on threat
      const activeThreats = state.activeThreats.map((t) =>
        t.id === action.threatId ? { ...t, awayMission: [...t.awayMission, action.dieId] } : t,
      );

      const log = [...state.log, `${die.face} die sent to ${threat.card.name} (away mission).`];

      // Check if threat is now resolved
      let newState = withPassiveFlags({
        ...state,
        crew,
        activeThreats,
        selectedDieId: null,
        log,
      });
      newState = processResolvedThreats(newState);
      return withPassiveFlags(newState);
    }

    case 'USE_ENGINEERING': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      const engCount = state.crew.filter((d) => d.location === 'engineering').length;
      if (engCount === 0) return state;
      const newHull = resolveEngineering(state.hull, state.maxHull, engCount);
      const repaired = newHull - state.hull;
      return {
        ...state,
        hull: newHull,
        log: [...state.log, `Engineering repaired ${repaired} hull. (${newHull}/${state.maxHull})`],
      };
    }

    case 'USE_MEDICAL': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      if (state.usedStationActions.includes('USE_MEDICAL')) return state;
      const medCount = state.crew.filter((d) => d.location === 'medical').length;
      if (medCount === 0) return state;
      const infirmaryCount = state.crew.filter((d) => d.location === 'infirmary').length;
      const crew = resolveMedical(state.crew);
      return {
        ...state,
        crew,
        usedStationActions: [...state.usedStationActions, 'USE_MEDICAL'],
        log: [...state.log, `Medical: ${infirmaryCount} crew recovered from Infirmary.`],
      };
    }

    case 'USE_MEDICAL_SCANNERS': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      const medCount = state.crew.filter((d) => d.location === 'medical').length;
      if (medCount === 0) return state;
      const crew = releaseFromScanners(state.crew);
      return {
        ...state,
        crew,
        log: [...state.log, `Medical: 1 crew released from Scanners.`],
      };
    }

    case 'USE_TACTICAL': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      const tactCount = state.tacticalDice.length;
      if (tactCount === 0) return state;

      const target = state.activeThreats.find((t) => t.id === action.targetThreatId);
      if (!target) return state;
      if (!canTargetThreat(target, state.activeThreats)) return state;

      const damage = calculateTacticalDamage(tactCount);
      const timeWarp = isTimeWarpActive(state.activeThreats);
      const activeThreats = applyTacticalDamage(
        state.activeThreats,
        action.targetThreatId,
        damage,
        timeWarp,
      );

      const destroyed = activeThreats.find((t) => t.id === action.targetThreatId)?.isDestroyed;
      const log = [
        ...state.log,
        `Tactical: ${tactCount} ${tactCount === 1 ? 'die' : 'dice'} fire at ${target.card.name} for ${damage} damage.${destroyed ? ' Target destroyed!' : ''}`,
      ];

      // Discard destroyed external/boss threats (barriers stay on board)
      let finalThreats = activeThreats;
      let discard = state.discard;
      finalThreats = activeThreats.map((t) => {
        if (t.id === action.targetThreatId && t.isDestroyed && !t.card.isBarrier) {
          discard = [...discard, t.card];
        }
        return t;
      });
      // Remove non-barrier destroyed threats from board
      finalThreats = finalThreats.filter((t) => !t.isDestroyed || t.card.isBarrier);

      return withWinLossCheck(
        withPassiveFlags({
          ...state,
          activeThreats: finalThreats,
          discard,
          tacticalDice: [], // reset after firing
          log,
        }),
      );
    }

    case 'USE_SCIENCE_SHIELDS': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      if (state.usedStationActions.includes('USE_SCIENCE')) return state;
      const sciCount = state.crew.filter((d) => d.location === 'science').length;
      if (sciCount === 0) return state;
      if (state.nebulaActive) {
        return {
          ...state,
          log: [...state.log, `Science: shields cannot be recharged — Nebula is active!`],
        };
      }
      const shields = resolveScience(state.maxShields);
      return {
        ...state,
        shields,
        usedStationActions: [...state.usedStationActions, 'USE_SCIENCE'],
        log: [...state.log, `Science: shields recharged to ${shields}/${state.maxShields}.`],
      };
    }

    case 'USE_SCIENCE_STASIS': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      if (state.usedStationActions.includes('USE_SCIENCE')) return state;
      const sciCount = state.crew.filter((d) => d.location === 'science').length;
      if (sciCount === 0) return state;
      const target = state.activeThreats.find((t) => t.id === action.targetThreatId);
      if (!target) return state;
      const activeThreats = placeStasisToken(state.activeThreats, action.targetThreatId);
      return {
        ...state,
        activeThreats,
        usedStationActions: [...state.usedStationActions, 'USE_SCIENCE'],
        log: [...state.log, `Science: stasis token placed on ${target.card.name}.`],
      };
    }

    case 'USE_COMMANDER_REROLL': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      if (state.commsOfflineActive) return state;
      if (state.usedStationActions.includes('USE_COMMANDER')) return state;
      const cmdCount = state.crew.filter((d) => d.location === 'commander').length;
      if (cmdCount === 0) return state;
      const rerollCount = commanderRerollCount(state.crew);
      const newFaces = rollAllCrewDice(rerollCount);
      const poolDice = state.crew.filter((d) => d.location === 'pool');
      let crew = state.crew;
      const newThreatDice: number[] = [];

      crew = crew.map((d) => {
        if (d.location !== 'pool') return d;
        const idx = poolDice.findIndex((p) => p.id === d.id);
        const newFace = newFaces[idx] ?? d.face;
        if (newFace === 'threat') {
          newThreatDice.push(d.id);
          return { ...d, face: newFace, location: 'scanners' as const };
        }
        return { ...d, face: newFace };
      });

      const log = [
        ...state.log,
        `Commander: re-rolled ${rerollCount} dice.`,
        ...(newThreatDice.length > 0
          ? [`${newThreatDice.length} new Threat Detected die/dice locked in Scanners.`]
          : []),
      ];

      // Process scanners again after reroll
      const { crew: crewAfterScanners, extraDraws } = processScanners(crew);
      let currentState: GameState = {
        ...state,
        crew: crewAfterScanners,
        log,
        usedStationActions: [...state.usedStationActions, 'USE_COMMANDER'],
      };

      for (let i = 0; i < extraDraws; i++) {
        currentState = drawAndProcessCard(currentState);
      }

      return withPassiveFlags(withWinLossCheck(currentState));
    }

    case 'USE_COMMANDER_CHANGE': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      if (state.commsOfflineActive) return state;
      if (state.usedStationActions.includes('USE_COMMANDER')) return state;
      const cmdCount = state.crew.filter((d) => d.location === 'commander').length;
      if (cmdCount === 0) return state;

      let crew = commanderChangeDie(state.crew, action.targetDieId, action.newFace);

      // If changed to threat, auto-lock
      if (action.newFace === 'threat') {
        crew = crew.map((d) =>
          d.id === action.targetDieId && d.location === 'pool'
            ? { ...d, location: 'scanners' as const }
            : d,
        );
      }

      return withPassiveFlags({
        ...state,
        crew,
        usedStationActions: [...state.usedStationActions, 'USE_COMMANDER'],
        log: [...state.log, `Commander: changed die to ${action.newFace}.`],
      });
    }

    case 'END_ASSIGN_PHASE': {
      if (state.status !== 'playing' || state.phase !== 'assigning') return state;
      // Resolve engineering automatically when ending phase
      const engCount = state.crew.filter((d) => d.location === 'engineering').length;
      let stateAfterEng = state;
      if (engCount > 0) {
        const newHull = resolveEngineering(state.hull, state.maxHull, engCount);
        const repaired = newHull - state.hull;
        stateAfterEng = {
          ...state,
          hull: newHull,
          log:
            repaired > 0
              ? [...state.log, `Engineering auto-resolved: +${repaired} hull.`]
              : state.log,
        };
      }

      // Draw one threat card
      const stateAfterDraw = drawAndProcessCard(stateAfterEng);

      return withWinLossCheck(
        withPassiveFlags({ ...stateAfterDraw, phase: 'drawing', tacticalDice: [] }),
      );
    }

    // ── Drawing phase ─────────────────────────────────────────────────────────

    case 'ACKNOWLEDGE_DRAW': {
      if (state.status !== 'playing' || state.phase !== 'drawing') return state;

      // Setup sequence: draw the 2nd card, then return to rolling
      if (state.setupDrawsRemaining >= 2) {
        let next = drawAndProcessCard({ ...state, drawnCard: null, setupDrawsRemaining: 1 });
        next = withPassiveFlags({ ...next, phase: 'drawing' });
        return withWinLossCheck(next);
      }
      if (state.setupDrawsRemaining === 1) {
        return withPassiveFlags({
          ...state,
          phase: 'rolling',
          drawnCard: null,
          setupDrawsRemaining: 0,
        });
      }

      // Normal mid-turn draw acknowledgement
      return { ...state, phase: 'activating', drawnCard: null };
    }

    // ── Activating phase ──────────────────────────────────────────────────────

    case 'START_THREAT_ROLL': {
      if (state.status !== 'playing' || state.phase !== 'activating') return state;
      return { ...state, threatDieFace: null };
    }

    case 'THREAT_ROLL_COMPLETE': {
      if (state.status !== 'playing' || state.phase !== 'activating') return state;

      const face = action.face;
      const log = [...state.log, `Threat Die rolled: ${face}.`];

      const result = activateThreats(state, face);

      // Handle time warp discard reshuffle
      let deck = state.deck;
      if (result.log.some((l) => l.includes('Time Warp'))) {
        // Time warp: shuffle top 3 discard back into deck
        const toReshuffle = state.discard.slice(-3);
        if (toReshuffle.length > 0) {
          // Insert at random positions (simple shuffle)
          const newDeck = [...deck, ...toReshuffle];
          for (let i = newDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newDeck[i], newDeck[j]] = [newDeck[j]!, newDeck[i]!];
          }
          deck = newDeck;
        }
      }

      // Handle comms offline extra draw
      let stateAfterActivation: GameState = withPassiveFlags({
        ...state,
        hull: result.hull,
        shields: result.shields,
        activeThreats: result.threats as ReadonlyArray<ActiveThreat>,
        crew: result.crew as ReadonlyArray<import('../types/game').CrewDie>,
        deck,
        log: [...log, ...result.log],
        threatDieFace: face,
      });

      // Extra draw from Comms Offline activation
      if (result.extraDraw) {
        stateAfterActivation = drawAndProcessCard(stateAfterActivation);
      }

      return withWinLossCheck(stateAfterActivation);
    }

    case 'ACKNOWLEDGE_ACTIVATE': {
      if (state.status !== 'playing' || state.phase !== 'activating') return state;
      return { ...state, phase: 'gathering' };
    }

    // ── Gathering phase ───────────────────────────────────────────────────────

    case 'ACKNOWLEDGE_GATHER': {
      if (state.status !== 'playing' || state.phase !== 'gathering') return state;

      const crew = gatherCrew(state.crew, state.activeThreats);
      const gathered = crew.filter((d) => d.location === 'pool').length;
      const log = [...state.log, `Crew gathered. ${gathered} crew ready for next turn.`];

      const nextState: GameState = withPassiveFlags({
        ...state,
        crew,
        log,
        phase: 'rolling',
        turnNumber: state.turnNumber + 1,
        tacticalDice: [],
        drawnCard: null,
        selectedDieId: null,
        usedStationActions: [],
      });

      return withWinLossCheck(nextState);
    }

    default:
      return state;
  }
}
