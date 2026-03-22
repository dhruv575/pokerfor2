import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, deal, cardToString, stringToCard } from 'shared';

describe('createDeck', () => {
  it('creates 52 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('has no duplicate cards', () => {
    const deck = createDeck();
    const strings = deck.map(cardToString);
    const unique = new Set(strings);
    expect(unique.size).toBe(52);
  });

  it('has 4 suits of 13 cards each', () => {
    const deck = createDeck();
    const bySuit = { h: 0, d: 0, c: 0, s: 0 };
    for (const card of deck) {
      bySuit[card.suit]++;
    }
    expect(bySuit.h).toBe(13);
    expect(bySuit.d).toBe(13);
    expect(bySuit.c).toBe(13);
    expect(bySuit.s).toBe(13);
  });
});

describe('shuffle', () => {
  it('returns 52 cards', () => {
    const deck = shuffle(createDeck());
    expect(deck).toHaveLength(52);
  });

  it('still has no duplicates after shuffle', () => {
    const deck = shuffle(createDeck());
    const strings = deck.map(cardToString);
    const unique = new Set(strings);
    expect(unique.size).toBe(52);
  });

  it('changes the order (probabilistic)', () => {
    const original = createDeck().map(cardToString);
    const shuffled = shuffle(createDeck()).map(cardToString);
    // Extremely unlikely to be identical after shuffle
    const samePositions = original.filter((c, i) => c === shuffled[i]).length;
    expect(samePositions).toBeLessThan(52);
  });
});

describe('deal', () => {
  it('deals the requested number of cards', () => {
    const deck = createDeck();
    const dealt = deal(deck, 2);
    expect(dealt).toHaveLength(2);
    expect(deck).toHaveLength(50);
  });

  it('deals from the top of the deck', () => {
    const deck = createDeck();
    const top2 = [cardToString(deck[0]), cardToString(deck[1])];
    const dealt = deal(deck, 2);
    expect(dealt.map(cardToString)).toEqual(top2);
  });

  it('throws when dealing more cards than available', () => {
    const deck = createDeck();
    deal(deck, 50);
    expect(() => deal(deck, 3)).toThrow();
  });
});

describe('cardToString / stringToCard', () => {
  it('round-trips correctly', () => {
    const card = { rank: 'A' as const, suit: 'h' as const };
    expect(stringToCard(cardToString(card))).toEqual(card);
  });

  it('converts all cards', () => {
    const deck = createDeck();
    for (const card of deck) {
      expect(stringToCard(cardToString(card))).toEqual(card);
    }
  });
});
