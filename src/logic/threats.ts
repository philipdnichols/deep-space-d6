import type { ActiveThreat, CrewDie, GameState, ThreatCard, ThreatSymbol } from '../types/game';

// ── Threat instance creation ──────────────────────────────────────────────────

let instanceCounter = 0;

export function resetInstanceCounter(): void {
  instanceCounter = 0;
}

export function createActiveThreat(card: ThreatCard): ActiveThreat {
  return {
    id: `${card.id}-${++instanceCounter}`,
    card,
    health: card.maxHealth,
    stasisTokens: 0,
    awayMission: [],
    isDestroyed: false,
  };
}

// ── Damage helpers ────────────────────────────────────────────────────────────

export interface ShipDamageResult {
  readonly hull: number;
  readonly shields: number;
  readonly log: ReadonlyArray<string>;
}

/** Apply damage to shields first, then hull. Returns updated hull/shields. */
export function applyDamage(
  hull: number,
  shields: number,
  hullDmg: number,
  shieldDmg: number,
): ShipDamageResult {
  const log: string[] = [];

  let newShields = shields;
  let newHull = hull;

  // Shield damage (direct)
  if (shieldDmg > 0) {
    const actual = Math.min(newShields, shieldDmg);
    newShields -= actual;
    const overflow = shieldDmg - actual;
    if (overflow > 0) {
      newHull -= overflow;
      log.push(`${shieldDmg} shield damage — shields depleted, ${overflow} hull damage overflow.`);
    } else {
      log.push(`${shieldDmg} shield damage.`);
    }
  }

  // Hull damage (absorbed by shields first)
  if (hullDmg > 0) {
    const absorbed = Math.min(newShields, hullDmg);
    newShields -= absorbed;
    const remaining = hullDmg - absorbed;
    if (absorbed > 0) {
      log.push(`${hullDmg} hull damage — shields absorbed ${absorbed}, ${remaining} hull damage.`);
    } else {
      log.push(`${hullDmg} hull damage.`);
    }
    newHull -= remaining;
  }

  return {
    hull: Math.max(0, newHull),
    shields: Math.max(0, newShields),
    log,
  };
}

// ── Threat targetting rules ───────────────────────────────────────────────────

/** Can the given external threat be targeted by tactical fire? */
export function canTargetThreat(
  threat: ActiveThreat,
  allThreats: ReadonlyArray<ActiveThreat>,
): boolean {
  if (threat.card.kind !== 'external' && threat.card.kind !== 'boss-barrier') return false;
  if (threat.isDestroyed) return false;
  if (threat.card.id === 'orbital-cannon') {
    // Can only be targeted when it's the only active external/boss threat
    const otherExternal = allThreats.filter(
      (t) =>
        t.id !== threat.id &&
        (t.card.kind === 'external' || t.card.kind === 'boss-barrier') &&
        !t.isDestroyed,
    );
    return otherExternal.length === 0;
  }
  // Can't target Ouroboros while Barrier is active
  if (threat.card.isOuroboros) {
    const barrier = allThreats.find((t) => t.card.isBarrier && !t.isDestroyed);
    return barrier === undefined;
  }
  return true;
}

/** Apply tactical damage to a specific threat. Returns updated threat list. */
export function applyTacticalDamage(
  threats: ReadonlyArray<ActiveThreat>,
  targetId: string,
  damage: number,
  timeWarpActive: boolean,
): ReadonlyArray<ActiveThreat> {
  return threats.map((t) => {
    if (t.id !== targetId) return t;
    let newHealth = t.health - damage;
    if (timeWarpActive && !t.card.isOuroboros) {
      newHealth = Math.max(1, newHealth);
    }
    newHealth = Math.max(0, newHealth);
    return { ...t, health: newHealth, isDestroyed: newHealth === 0 };
  });
}

// ── Threat activation ─────────────────────────────────────────────────────────

export interface ActivationResult {
  readonly hull: number;
  readonly shields: number;
  readonly threats: ReadonlyArray<ActiveThreat>;
  readonly crew: ReadonlyArray<CrewDie>;
  readonly log: ReadonlyArray<string>;
  readonly extraDraw: boolean; // comms offline activation
}

/** Activate all threats whose activation symbol matches the rolled face. */
export function activateThreats(
  state: Pick<GameState, 'hull' | 'shields' | 'maxShields' | 'activeThreats' | 'crew'>,
  rolledFace: ThreatSymbol,
): ActivationResult {
  let hull = state.hull;
  let shields = state.shields;
  let threats: ReadonlyArray<ActiveThreat> = [...state.activeThreats];
  let crew: ReadonlyArray<CrewDie> = [...state.crew];
  const log: string[] = [];
  let extraDraw = false;

  // Sort: internal first, then external/boss
  const ordered = [...threats].sort((a, b) => {
    const aInternal = a.card.kind === 'internal' ? 0 : 1;
    const bInternal = b.card.kind === 'internal' ? 0 : 1;
    return aInternal - bInternal;
  });

  for (const threat of ordered) {
    if (threat.card.kind === 'filler') continue;
    if (threat.card.activation !== rolledFace) continue;
    if (threat.isDestroyed && !threat.card.isBarrier) continue;

    // Check stasis
    const current = threats.find((t) => t.id === threat.id);
    if (!current) continue;
    if (current.stasisTokens > 0) {
      threats = threats.map((t) =>
        t.id === threat.id ? { ...t, stasisTokens: t.stasisTokens - 1 } : t,
      );
      log.push(`${threat.card.name} activation suppressed by stasis token.`);
      continue;
    }

    log.push(`${threat.card.name} activates!`);

    // Barrier: regenerate + deal damage
    if (threat.card.isBarrier) {
      threats = threats.map((t) =>
        t.id === threat.id ? { ...t, health: t.card.maxHealth, isDestroyed: false } : t,
      );
      const dmg = applyDamage(hull, shields, 2, 0);
      hull = dmg.hull;
      shields = dmg.shields;
      log.push(...dmg.log);
      log.push(`Ouroboros Barrier regenerated to full health!`);
      continue;
    }

    switch (threat.card.id) {
      case 'panel-explosion': {
        crew = sendToInfirmary(crew, 1, log);
        break;
      }
      case 'distracted':
      case 'distracted-2':
      case 'distracted-3': {
        // Free any die locked on this card, discard the threat
        crew = crew.map((d) =>
          d.location === `threat-${threat.id}` ? { ...d, location: 'pool' as const } : d,
        );
        threats = threats.filter((t) => t.id !== threat.id);
        log.push(`Distracted crew member returns to duty.`);
        break;
      }
      case 'friendly-fire': {
        const dmg = applyDamage(hull, shields, 1, 0);
        hull = dmg.hull;
        shields = dmg.shields;
        log.push(...dmg.log);
        break;
      }
      case 'boost-morale': {
        const inInfirmary = crew.filter((d) => d.location === 'infirmary');
        if (inInfirmary.length > 0) {
          crew = crew.map((d) =>
            d.id === inInfirmary[0]!.id ? { ...d, location: 'pool' as const } : d,
          );
          log.push(`Morale boost! 1 crew recovered from Infirmary.`);
        } else {
          log.push(`Boost Morale: no crew in Infirmary.`);
        }
        break;
      }
      case 'nebula': {
        const dmg = applyDamage(hull, shields, 0, 1);
        hull = dmg.hull;
        shields = dmg.shields;
        log.push(...dmg.log);
        break;
      }
      case 'time-warp': {
        // Shuffle top 3 discard back — handled by reducer (we just log)
        log.push(`Time Warp: top discard cards shuffled back into deck.`);
        break;
      }
      case 'pandemic': {
        const poolCrew = crew.filter((d) => d.location === 'pool');
        crew = crew.map((d) =>
          d.location === 'pool' ? { ...d, location: 'infirmary' as const } : d,
        );
        log.push(`Pandemic! ${poolCrew.length} crew sent to Infirmary.`);
        break;
      }
      case 'spore-infestation': {
        crew = sendToInfirmary(crew, 2, log);
        break;
      }
      case 'robot-uprising': {
        crew = sendToInfirmary(crew, 2, log);
        break;
      }
      case 'comms-offline': {
        extraDraw = true;
        log.push(`Comms Offline: draw 1 extra threat card this turn.`);
        break;
      }
      case 'strike-bombers':
      case 'strike-bombers-2': {
        const dmg = applyDamage(hull, shields, 1, 0);
        hull = dmg.hull;
        shields = dmg.shields;
        log.push(...dmg.log);
        break;
      }
      case 'scout':
      case 'scout-2': {
        const dmg = applyDamage(hull, shields, 0, 1);
        hull = dmg.hull;
        shields = dmg.shields;
        log.push(...dmg.log);
        break;
      }
      case 'pirates': {
        const dmg = applyDamage(hull, shields, 2, 0);
        hull = dmg.hull;
        shields = dmg.shields;
        log.push(...dmg.log);
        break;
      }
      case 'space-pirates': {
        const dmg = applyDamage(hull, shields, 2, 1);
        hull = dmg.hull;
        shields = dmg.shields;
        log.push(...dmg.log);
        break;
      }
      case 'orbital-cannon': {
        const dmg = applyDamage(hull, shields, 3, 0);
        hull = dmg.hull;
        shields = dmg.shields;
        log.push(...dmg.log);
        break;
      }
      case 'hijackers': {
        crew = sendToInfirmary(crew, 1, log);
        break;
      }
      case 'ouroboros': {
        const dmg = applyDamage(hull, shields, 3, 0);
        hull = dmg.hull;
        shields = dmg.shields;
        log.push(...dmg.log);
        break;
      }
    }
  }

  return { hull, shields, threats, crew, log, extraDraw };
}

// ── Crew helpers ──────────────────────────────────────────────────────────────

/** Send up to `count` crew from pool to infirmary. Mutates log. */
function sendToInfirmary(
  crew: ReadonlyArray<CrewDie>,
  count: number,
  log: string[],
): ReadonlyArray<CrewDie> {
  const result = [...crew];
  let sent = 0;
  for (let i = 0; i < result.length && sent < count; i++) {
    if (result[i]!.location === 'pool') {
      result[i] = { ...result[i]!, location: 'infirmary' };
      sent++;
    }
  }
  if (sent > 0) {
    log.push(`${sent} crew sent to Infirmary.`);
  }
  return result;
}

// ── Win/loss detection ────────────────────────────────────────────────────────

/** Check if all external threats are destroyed and deck is empty. */
export function checkWin(
  deck: ReadonlyArray<unknown>,
  activeThreats: ReadonlyArray<ActiveThreat>,
): boolean {
  if (deck.length > 0) return false;
  const remaining = activeThreats.filter(
    (t) => (t.card.kind === 'external' || t.card.isOuroboros || t.card.isBarrier) && !t.isDestroyed,
  );
  return remaining.length === 0;
}

/** Check if player has lost due to no available crew.
 * Dice assigned to stations will return to pool at gather, so they are not incapacitated.
 * Only infirmary, scanners, and active away missions (threat-*) count as truly unavailable. */
export function checkCrewLoss(crew: ReadonlyArray<CrewDie>): boolean {
  return crew.every(
    (d) =>
      d.location === 'infirmary' || d.location === 'scanners' || d.location.startsWith('threat-'),
  );
}
