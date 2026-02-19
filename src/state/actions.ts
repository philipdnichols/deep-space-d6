import type { CrewFace, Difficulty, GameState, StationId, ThreatSymbol } from '../types/game';

export type GameAction =
  | { type: 'NEW_GAME'; difficulty: Difficulty }
  | { type: 'TICK' }
  // Roll phase
  | { type: 'START_ROLL' }
  | { type: 'ROLL_COMPLETE'; faces: ReadonlyArray<CrewFace> }
  // Assign phase — die selection & placement
  | { type: 'SELECT_DIE'; dieId: number | null }
  | { type: 'ASSIGN_TO_STATION'; dieId: number; stationId: StationId }
  | { type: 'ASSIGN_TO_THREAT'; dieId: number; threatId: string }
  // Assign phase — station actions
  | { type: 'USE_ENGINEERING' } // resolve all engineering dice
  | { type: 'USE_MEDICAL' } // recover all from infirmary
  | { type: 'USE_MEDICAL_SCANNERS' } // release 1 die from scanners
  | { type: 'USE_TACTICAL'; targetThreatId: string } // fire all tactical dice at target
  | { type: 'USE_SCIENCE_SHIELDS' } // recharge shields
  | { type: 'USE_SCIENCE_STASIS'; targetThreatId: string } // suppress threat
  | { type: 'USE_COMMANDER_REROLL' } // re-roll all pool dice
  | { type: 'USE_COMMANDER_CHANGE'; targetDieId: number; newFace: CrewFace } // change 1 die
  | { type: 'END_ASSIGN_PHASE' }
  // Drawing phase
  | { type: 'ACKNOWLEDGE_DRAW' } // user clicks Continue during drawing phase
  // Activating phase
  | { type: 'START_THREAT_ROLL' }
  | { type: 'THREAT_ROLL_COMPLETE'; face: ThreatSymbol }
  | { type: 'ACKNOWLEDGE_ACTIVATE' } // user clicks Continue after threats activate
  // Gathering phase
  | { type: 'ACKNOWLEDGE_GATHER' } // user clicks Continue to end turn
  // Test
  | { type: '__TEST_LOAD_STATE'; state: GameState };
