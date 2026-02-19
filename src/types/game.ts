// ── Primitives ────────────────────────────────────────────────────────────────

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';
export type LossReason = 'hull' | 'crew';

export type TurnPhase =
  | 'rolling' // Step 1: dice are animating
  | 'assigning' // Step 3: user assigns dice to stations
  | 'drawing' // Step 4: threat card drawn, user clicks Continue
  | 'activating' // Step 5: threat die rolled, threats activated, user clicks Continue
  | 'gathering'; // Step 6: crew gathered, user clicks Continue

export type Difficulty = 'easy' | 'normal' | 'hard';

// Crew die faces
export type CrewFace = 'commander' | 'tactical' | 'medical' | 'science' | 'engineering' | 'threat';

// Threat die activation symbols (6 faces matching symbols on threat cards)
export type ThreatSymbol = 'skull' | 'lightning' | 'alien' | 'warning' | 'hazard' | 'nova';

// Station IDs
export type StationId =
  | 'commander'
  | 'tactical'
  | 'engineering'
  | 'medical'
  | 'science'
  | 'scanners'
  | 'infirmary';

// Where a crew die can be
export type DieLocation =
  | 'pool' // available to assign
  | 'infirmary' // incapacitated
  | 'scanners' // locked on threat detected
  | StationId // assigned to station
  | `threat-${string}`; // assigned to threat card (away mission)

export type ThreatKind = 'internal' | 'external' | 'boss-barrier' | 'filler';

// ── Threat card definitions ────────────────────────────────────────────────────

export interface ResolutionRequirement {
  readonly face: CrewFace;
  readonly count: number;
}

export interface ThreatCard {
  readonly id: string;
  readonly name: string;
  readonly kind: ThreatKind;
  readonly activation: ThreatSymbol;
  readonly maxHealth: number; // 0 for internal/filler, >0 for external
  readonly description: string; // Shown on card
  // For internal threats: how to resolve (assign dice to card)
  readonly resolution: ResolutionRequirement | null;
  // Special flags
  readonly isOuroboros: boolean; // the boss
  readonly isBarrier: boolean; // the Ouroboros Barrier
  readonly immediateOnReveal: boolean; // triggers effect when drawn (e.g. Solar Winds Flagship)
}

// ── Active game objects ────────────────────────────────────────────────────────

export interface ActiveThreat {
  readonly id: string; // unique instance id (card.id + '-' + index for duplicates)
  readonly card: ThreatCard;
  readonly health: number; // current HP (external), 0 for internal
  readonly stasisTokens: number; // science dice suppressing next activation
  readonly awayMission: ReadonlyArray<number>; // die IDs placed on this card for resolution
  readonly isDestroyed: boolean; // barrier can be "destroyed" but not removed
}

export interface CrewDie {
  readonly id: number; // 0–5
  readonly face: CrewFace;
  readonly location: DieLocation;
}

// ── Commander pending action ──────────────────────────────────────────────────

export type CommanderAction =
  | { readonly type: 'reroll' }
  | { readonly type: 'change'; readonly targetDieId: number; readonly newFace: CrewFace };

// ── Game state ────────────────────────────────────────────────────────────────

export interface GameState {
  readonly status: GameStatus;
  readonly phase: TurnPhase;
  readonly difficulty: Difficulty;

  // Ship stats (RPTR)
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;

  // Crew
  readonly crew: ReadonlyArray<CrewDie>;

  // Threats
  readonly activeThreats: ReadonlyArray<ActiveThreat>;
  readonly deck: ReadonlyArray<ThreatCard>;
  readonly discard: ReadonlyArray<ThreatCard>;

  // Threat die
  readonly threatDieFace: ThreatSymbol | null;

  // UI selection state
  readonly selectedDieId: number | null;

  // Pending tactical dice ids waiting to fire (before target is chosen)
  readonly tacticalDice: ReadonlyArray<number>;

  // Log of events this turn (cleared each new turn)
  readonly log: ReadonlyArray<string>;

  // Loss tracking
  readonly lossReason: LossReason | null;

  // Turn counter + timer
  readonly turnNumber: number;
  readonly elapsedSeconds: number;

  // Drawn card this turn (shown during 'drawing' phase)
  readonly drawnCard: ThreatCard | null;

  // Nebula in play: shields can't be recharged
  readonly nebulaActive: boolean;
  // Comms offline: commander station disabled
  readonly commsOfflineActive: boolean;
}
