import { describe, it, expect } from 'vitest';
import { buildDeck, drawCard } from './deck';

describe('buildDeck', () => {
  it('always ends with Ouroboros', () => {
    const deck = buildDeck('normal');
    expect(deck[deck.length - 1]!.id).toBe('ouroboros');
  });

  it("easy difficulty has 6 Don't Panic cards", () => {
    const deck = buildDeck('easy');
    expect(deck.filter((c) => c.id === 'dont-panic')).toHaveLength(6);
  });

  it("normal difficulty has 3 Don't Panic cards", () => {
    const deck = buildDeck('normal');
    expect(deck.filter((c) => c.id === 'dont-panic')).toHaveLength(3);
  });

  it("hard difficulty has 0 Don't Panic cards", () => {
    const deck = buildDeck('hard');
    expect(deck.filter((c) => c.id === 'dont-panic')).toHaveLength(0);
  });

  it('contains exactly one Ouroboros', () => {
    const deck = buildDeck('normal');
    expect(deck.filter((c) => c.id === 'ouroboros')).toHaveLength(1);
  });

  it('contains the Ouroboros Barrier', () => {
    const deck = buildDeck('normal');
    expect(deck.filter((c) => c.id === 'ouroboros-barrier')).toHaveLength(1);
  });

  it('deck size is consistent with difficulty', () => {
    // Core: 14 internal + 9 external + 1 barrier = 24, plus Ouroboros always last = 25 non-filler
    // easy: 25 + 6 = 31
    // normal: 25 + 3 = 28
    // hard: 25 + 0 = 25
    expect(buildDeck('easy')).toHaveLength(31);
    expect(buildDeck('normal')).toHaveLength(28);
    expect(buildDeck('hard')).toHaveLength(25);
  });

  it('produces different orderings on repeated calls', () => {
    const deck1 = buildDeck('normal');
    const deck2 = buildDeck('normal');
    // Very unlikely to be identical (astronomical odds)
    const sameOrder = deck1.slice(0, -1).every((c, i) => c.id === deck2[i]!.id);
    expect(sameOrder).toBe(false);
  });
});

describe('drawCard', () => {
  it('returns null for empty deck', () => {
    expect(drawCard([])).toBeNull();
  });

  it('returns the first card and remaining deck', () => {
    const deck = buildDeck('hard');
    const result = drawCard(deck);
    expect(result).not.toBeNull();
    const [card, rest] = result!;
    expect(card).toBeDefined();
    expect(rest).toHaveLength(deck.length - 1);
  });

  it('does not mutate the input deck', () => {
    const deck = buildDeck('hard');
    const firstId = deck[0]!.id;
    drawCard(deck);
    expect(deck[0]!.id).toBe(firstId);
  });
});
