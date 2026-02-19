import { describe, it, expect } from 'vitest';
import {
  rollCrewFace,
  rollAllCrewDice,
  rollThreatDie,
  calculateTacticalDamage,
  ALL_CREW_FACES,
  THREAT_FACES,
} from './dice';

describe('rollCrewFace', () => {
  it('returns a valid crew face', () => {
    for (let i = 0; i < 50; i++) {
      expect(ALL_CREW_FACES).toContain(rollCrewFace());
    }
  });
});

describe('rollAllCrewDice', () => {
  it('returns the correct number of faces', () => {
    expect(rollAllCrewDice(6)).toHaveLength(6);
    expect(rollAllCrewDice(3)).toHaveLength(3);
    expect(rollAllCrewDice(0)).toHaveLength(0);
  });

  it('all faces are valid', () => {
    const faces = rollAllCrewDice(6);
    faces.forEach((f) => expect(ALL_CREW_FACES).toContain(f));
  });
});

describe('rollThreatDie', () => {
  it('returns a valid threat symbol', () => {
    for (let i = 0; i < 50; i++) {
      expect(THREAT_FACES).toContain(rollThreatDie());
    }
  });
});

describe('calculateTacticalDamage', () => {
  it('returns 0 for 0 dice', () => {
    expect(calculateTacticalDamage(0)).toBe(0);
  });

  it('returns 1 for 1 die', () => {
    expect(calculateTacticalDamage(1)).toBe(1);
  });

  it('returns 3 for 2 dice', () => {
    expect(calculateTacticalDamage(2)).toBe(3);
  });

  it('returns 5 for 3 dice', () => {
    expect(calculateTacticalDamage(3)).toBe(5);
  });

  it('returns 7 for 4 dice', () => {
    expect(calculateTacticalDamage(4)).toBe(7);
  });

  it('scales linearly with additional dice', () => {
    for (let n = 1; n <= 6; n++) {
      expect(calculateTacticalDamage(n)).toBe(1 + (n - 1) * 2);
    }
  });
});
