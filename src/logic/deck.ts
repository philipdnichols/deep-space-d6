import type { Difficulty, ThreatCard } from '../types/game';

// ── Don't Panic counts per difficulty ─────────────────────────────────────────
const DONT_PANIC_COUNTS: Record<Difficulty, number> = {
  easy: 6,
  normal: 3,
  hard: 0,
};

// ── Full base threat deck definition ─────────────────────────────────────────

const DON_T_PANIC: ThreatCard = {
  id: 'dont-panic',
  name: "Don't Panic",
  kind: 'filler',
  activation: 'skull', // never activates dangerously
  maxHealth: 0,
  description: 'Nothing happens. Breathe.',
  resolution: null,
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

// Internal threats

const PANEL_EXPLOSION: ThreatCard = {
  id: 'panel-explosion',
  name: 'Panel Explosion',
  kind: 'internal',
  activation: 'warning',
  maxHealth: 0,
  description: 'ACTIVATE: Send 1 crew to the Infirmary.',
  resolution: { face: 'engineering', count: 1 },
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const DISTRACTED: ThreatCard = {
  id: 'distracted',
  name: 'Distracted',
  kind: 'internal',
  activation: 'nova',
  maxHealth: 0,
  description:
    'REVEAL: Immediately lock 1 crew die here. ACTIVATE: Free the die; discard this card.',
  resolution: null, // resolves only on activation
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: true, // lock a die immediately
};

const DISTRACTED_2: ThreatCard = {
  ...DISTRACTED,
  id: 'distracted-2',
};

const DISTRACTED_3: ThreatCard = {
  ...DISTRACTED,
  id: 'distracted-3',
};

const FRIENDLY_FIRE: ThreatCard = {
  id: 'friendly-fire',
  name: 'Friendly Fire',
  kind: 'internal',
  activation: 'lightning',
  maxHealth: 0,
  description: 'ACTIVATE: Deal 1 hull damage.',
  resolution: { face: 'tactical', count: 1 },
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const BOOST_MORALE: ThreatCard = {
  id: 'boost-morale',
  name: 'Boost Morale',
  kind: 'internal',
  activation: 'nova',
  maxHealth: 0,
  description: 'ACTIVATE: Return 1 crew from the Infirmary.',
  resolution: { face: 'commander', count: 1 },
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const NEBULA: ThreatCard = {
  id: 'nebula',
  name: 'Nebula',
  kind: 'internal',
  activation: 'hazard',
  maxHealth: 0,
  description: 'While in play: shields cannot be recharged. ACTIVATE: Deal 1 shield damage.',
  resolution: { face: 'science', count: 2 },
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const TIME_WARP: ThreatCard = {
  id: 'time-warp',
  name: 'Time Warp',
  kind: 'internal',
  activation: 'nova',
  maxHealth: 0,
  description:
    'While in play: external threats cannot be damaged below 1 HP. ACTIVATE: Shuffle the top 3 discard cards back into the deck.',
  resolution: { face: 'science', count: 2 },
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const PANDEMIC: ThreatCard = {
  id: 'pandemic',
  name: 'Pandemic',
  kind: 'internal',
  activation: 'hazard',
  maxHealth: 0,
  description: 'ACTIVATE: Send ALL crew currently in the pool to the Infirmary.',
  resolution: { face: 'medical', count: 2 },
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const SPORE_INFESTATION: ThreatCard = {
  id: 'spore-infestation',
  name: 'Spore: Infestation',
  kind: 'internal',
  activation: 'alien',
  maxHealth: 0,
  description: 'ACTIVATE: Send 2 crew to the Infirmary.',
  resolution: { face: 'medical', count: 1 },
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const ROBOT_UPRISING: ThreatCard = {
  id: 'robot-uprising',
  name: 'Robot Uprising',
  kind: 'internal',
  activation: 'warning',
  maxHealth: 0,
  description: 'ACTIVATE: Send 2 crew to the Infirmary.',
  resolution: { face: 'tactical', count: 2 },
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const COMMS_OFFLINE: ThreatCard = {
  id: 'comms-offline',
  name: 'Comms Offline',
  kind: 'internal',
  activation: 'lightning',
  maxHealth: 0,
  description: 'While in play: Commander station is disabled. ACTIVATE: Draw 1 extra threat card.',
  resolution: { face: 'engineering', count: 2 },
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

// External threats

const STRIKE_BOMBERS: ThreatCard = {
  id: 'strike-bombers',
  name: 'Strike Bombers',
  kind: 'external',
  activation: 'lightning',
  maxHealth: 3,
  description: 'ACTIVATE: Deal 1 hull damage.',
  resolution: null,
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const STRIKE_BOMBERS_2: ThreatCard = {
  ...STRIKE_BOMBERS,
  id: 'strike-bombers-2',
};

const SCOUT: ThreatCard = {
  id: 'scout',
  name: 'Scout',
  kind: 'external',
  activation: 'hazard',
  maxHealth: 2,
  description: 'ACTIVATE: Deal 1 shield damage (or 1 hull if shields are down).',
  resolution: null,
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const SCOUT_2: ThreatCard = {
  ...SCOUT,
  id: 'scout-2',
};

const PIRATES: ThreatCard = {
  id: 'pirates',
  name: 'Pirates',
  kind: 'external',
  activation: 'skull',
  maxHealth: 4,
  description: 'ACTIVATE: Deal 2 hull damage.',
  resolution: null,
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const SPACE_PIRATES: ThreatCard = {
  id: 'space-pirates',
  name: 'Space Pirates',
  kind: 'external',
  activation: 'skull',
  maxHealth: 5,
  description: 'ACTIVATE: Deal 2 hull damage and 1 shield damage.',
  resolution: null,
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const ORBITAL_CANNON: ThreatCard = {
  id: 'orbital-cannon',
  name: 'Orbital Cannon',
  kind: 'external',
  activation: 'warning',
  maxHealth: 6,
  description:
    'Can only be targeted when it is the ONLY active external threat. ACTIVATE: Deal 3 hull damage.',
  resolution: null,
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

const SOLAR_WINDS_FLAGSHIP: ThreatCard = {
  id: 'solar-winds-flagship',
  name: 'Solar Winds Flagship',
  kind: 'external',
  activation: 'skull',
  maxHealth: 1, // effectively immediate — deals 5 damage then discards
  description: 'REVEAL: Immediately deal 5 hull damage, then discard.',
  resolution: null,
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: true,
};

const HIJACKERS: ThreatCard = {
  id: 'hijackers',
  name: 'Hijackers',
  kind: 'external',
  activation: 'alien',
  maxHealth: 3,
  description: 'ACTIVATE: Send 1 crew to the Infirmary.',
  resolution: null,
  isOuroboros: false,
  isBarrier: false,
  immediateOnReveal: false,
};

// Boss

const OUROBOROS_BARRIER: ThreatCard = {
  id: 'ouroboros-barrier',
  name: 'Ouroboros Barrier',
  kind: 'boss-barrier',
  activation: 'alien',
  maxHealth: 4,
  description:
    'Protects Ouroboros from all damage. When destroyed, Ouroboros can be attacked. ACTIVATE: Deal 2 hull damage and regenerate to full HP.',
  resolution: null,
  isOuroboros: false,
  isBarrier: true,
  immediateOnReveal: false,
};

const OUROBOROS: ThreatCard = {
  id: 'ouroboros',
  name: 'Ouroboros',
  kind: 'external',
  activation: 'alien',
  maxHealth: 8,
  description:
    'Final boss. Cannot be damaged while the Ouroboros Barrier is active. ACTIVATE: Deal 3 hull damage.',
  resolution: null,
  isOuroboros: true,
  isBarrier: false,
  immediateOnReveal: false,
};

// ── Deck builder ──────────────────────────────────────────────────────────────

/** All non-Ouroboros, non-filler cards (always in deck). */
const CORE_CARDS: ReadonlyArray<ThreatCard> = [
  // Internal threats
  PANEL_EXPLOSION,
  PANEL_EXPLOSION,
  DISTRACTED,
  DISTRACTED_2,
  DISTRACTED_3,
  FRIENDLY_FIRE,
  FRIENDLY_FIRE,
  BOOST_MORALE,
  NEBULA,
  TIME_WARP,
  PANDEMIC,
  SPORE_INFESTATION,
  ROBOT_UPRISING,
  COMMS_OFFLINE,
  // External threats
  STRIKE_BOMBERS,
  STRIKE_BOMBERS_2,
  SCOUT,
  SCOUT_2,
  PIRATES,
  SPACE_PIRATES,
  ORBITAL_CANNON,
  SOLAR_WINDS_FLAGSHIP,
  HIJACKERS,
  // Barrier comes before Ouroboros (shuffled into the main deck)
  OUROBOROS_BARRIER,
];

function shuffle<T>(items: ReadonlyArray<T>): ReadonlyArray<T> {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build and shuffle the threat deck for the given difficulty.
 * Ouroboros is always the last card in the deck.
 */
export function buildDeck(difficulty: Difficulty): ReadonlyArray<ThreatCard> {
  const dontPanicCount = DONT_PANIC_COUNTS[difficulty];
  const dontPanics = Array.from<ThreatCard>({ length: dontPanicCount }).fill(DON_T_PANIC);
  const mainDeck = shuffle([...CORE_CARDS, ...dontPanics]);
  // Ouroboros always last
  return [...mainDeck, OUROBOROS];
}

/** Draw the top card from the deck; returns [card, remainingDeck] */
export function drawCard(
  deck: ReadonlyArray<ThreatCard>,
): [ThreatCard, ReadonlyArray<ThreatCard>] | null {
  if (deck.length === 0) return null;
  const [card, ...rest] = deck;
  return [card!, rest];
}
