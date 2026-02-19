import { describe, it, expect } from 'vitest';
import { buildDeck, drawCard } from './deck';

describe('buildDeck', () => {
  it('always ends with Ouroboros', () => {
    const deck = buildDeck('normal');
    expect(deck[deck.length - 1]!.id).toBe('ouroboros');
  });

  it("easy difficulty has 10 Don't Panic cards", () => {
    const deck = buildDeck('easy');
    expect(deck.filter((c) => c.id === 'dont-panic')).toHaveLength(10);
  });

  it("normal difficulty has 5 Don't Panic cards", () => {
    const deck = buildDeck('normal');
    expect(deck.filter((c) => c.id === 'dont-panic')).toHaveLength(5);
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
    // 24 core + barrier + dont-panics + ouroboros at end
    // core cards: 23 non-boss, 1 barrier = 24
    // easy: 24 + 10 + 1 = 35
    // normal: 24 + 5 + 1 = 30
    // hard: 24 + 0 + 1 = 25
    expect(buildDeck('easy')).toHaveLength(35);
    expect(buildDeck('normal')).toHaveLength(30);
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
