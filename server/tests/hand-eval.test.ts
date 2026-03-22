import { describe, it, expect } from 'vitest';
import { evaluateHand, compareHands } from 'shared';
import { HandRank } from 'shared';
import type { Card } from 'shared';

function cards(strs: string[]): Card[] {
  return strs.map(s => ({ rank: s[0] as Card['rank'], suit: s[1] as Card['suit'] }));
}

describe('evaluateHand - 5-card hands', () => {
  it('detects royal flush', () => {
    const result = evaluateHand(cards(['Ah', 'Kh', 'Qh', 'Jh', 'Th']));
    expect(result.rank).toBe(HandRank.StraightFlush);
    expect(result.name).toBe('royal flush');
  });

  it('detects straight flush', () => {
    const result = evaluateHand(cards(['9d', '8d', '7d', '6d', '5d']));
    expect(result.rank).toBe(HandRank.StraightFlush);
    expect(result.name).toContain('straight flush');
  });

  it('detects wheel straight flush (A-2-3-4-5)', () => {
    const result = evaluateHand(cards(['Ac', '2c', '3c', '4c', '5c']));
    expect(result.rank).toBe(HandRank.StraightFlush);
    expect(result.name).toContain('five-high');
  });

  it('detects four of a kind', () => {
    const result = evaluateHand(cards(['Ks', 'Kh', 'Kd', 'Kc', '3h']));
    expect(result.rank).toBe(HandRank.FourOfAKind);
    expect(result.name).toContain('four of a kind');
  });

  it('detects full house', () => {
    const result = evaluateHand(cards(['Jh', 'Jd', 'Jc', '4s', '4h']));
    expect(result.rank).toBe(HandRank.FullHouse);
    expect(result.name).toContain('full house');
  });

  it('detects flush', () => {
    const result = evaluateHand(cards(['Ah', 'Th', '7h', '4h', '2h']));
    expect(result.rank).toBe(HandRank.Flush);
    expect(result.name).toContain('flush');
  });

  it('detects straight', () => {
    const result = evaluateHand(cards(['9h', '8d', '7c', '6s', '5h']));
    expect(result.rank).toBe(HandRank.Straight);
    expect(result.name).toContain('straight');
  });

  it('detects wheel straight (A-2-3-4-5)', () => {
    const result = evaluateHand(cards(['Ah', '2d', '3c', '4s', '5h']));
    expect(result.rank).toBe(HandRank.Straight);
    expect(result.name).toContain('five-high');
  });

  it('detects three of a kind', () => {
    const result = evaluateHand(cards(['8h', '8d', '8c', 'Ks', '3h']));
    expect(result.rank).toBe(HandRank.ThreeOfAKind);
    expect(result.name).toContain('three of a kind');
  });

  it('detects two pair', () => {
    const result = evaluateHand(cards(['Ah', 'Ad', '9c', '9s', '3h']));
    expect(result.rank).toBe(HandRank.TwoPair);
    expect(result.name).toContain('two pair');
  });

  it('detects one pair', () => {
    const result = evaluateHand(cards(['Qh', 'Qd', '9c', '6s', '3h']));
    expect(result.rank).toBe(HandRank.OnePair);
    expect(result.name).toContain('pair of');
  });

  it('detects high card', () => {
    const result = evaluateHand(cards(['Ah', 'Td', '8c', '5s', '3h']));
    expect(result.rank).toBe(HandRank.HighCard);
    expect(result.name).toContain('high card');
  });
});

describe('evaluateHand - 7-card best-of-5 selection', () => {
  it('finds flush hidden in 7 cards', () => {
    const result = evaluateHand(cards(['Ah', 'Kh', '3h', '7h', '2h', 'Qd', '9c']));
    expect(result.rank).toBe(HandRank.Flush);
  });

  it('finds straight in 7 cards', () => {
    const result = evaluateHand(cards(['9h', '8d', '7c', '6s', '5h', 'Kd', '2c']));
    expect(result.rank).toBe(HandRank.Straight);
  });

  it('finds full house over flush in 7 cards', () => {
    // 7 cards where both flush and full house are possible
    const result = evaluateHand(cards(['Ah', 'Ad', 'Ac', 'Kh', 'Kd', '3h', '2h']));
    expect(result.rank).toBe(HandRank.FullHouse);
  });

  it('picks best pair with kickers in 7 cards', () => {
    const hand1 = evaluateHand(cards(['Ah', 'Ad', 'Kc', 'Qs', 'Jh', '3d', '2c']));
    const hand2 = evaluateHand(cards(['Ah', 'Ad', 'Kc', 'Qs', 'Th', '3d', '2c']));
    expect(hand1.rank).toBe(HandRank.OnePair);
    expect(hand2.rank).toBe(HandRank.OnePair);
    expect(compareHands(hand1, hand2)).toBeGreaterThan(0); // J kicker beats T kicker
  });
});

describe('compareHands - tiebreakers', () => {
  it('higher flush beats lower flush', () => {
    const a = evaluateHand(cards(['Ah', 'Kh', 'Qh', 'Jh', '9h']));
    const b = evaluateHand(cards(['Kd', 'Qd', 'Jd', 'Td', '8d']));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('higher pair beats lower pair', () => {
    const a = evaluateHand(cards(['Ah', 'Ad', 'Kc', 'Qs', '3h']));
    const b = evaluateHand(cards(['Kh', 'Kd', 'Ac', 'Qs', '3h']));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('same hand ranks as tie', () => {
    const a = evaluateHand(cards(['Ah', 'Kd', 'Qc', 'Js', '9h']));
    const b = evaluateHand(cards(['As', 'Kc', 'Qd', 'Jh', '9d']));
    expect(compareHands(a, b)).toBe(0);
  });

  it('higher two pair beats lower two pair', () => {
    const a = evaluateHand(cards(['Ah', 'Ad', 'Kc', 'Ks', '3h']));
    const b = evaluateHand(cards(['Ah', 'Ad', 'Qc', 'Qs', '3h']));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('full house: higher trips wins', () => {
    const a = evaluateHand(cards(['Ah', 'Ad', 'Ac', '3s', '3h']));
    const b = evaluateHand(cards(['Kh', 'Kd', 'Kc', 'As', 'Ah']));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('straight flush beats four of a kind', () => {
    const a = evaluateHand(cards(['9h', '8h', '7h', '6h', '5h']));
    const b = evaluateHand(cards(['As', 'Ah', 'Ad', 'Ac', 'Kh']));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('four of a kind beats full house', () => {
    const a = evaluateHand(cards(['2s', '2h', '2d', '2c', '3h']));
    const b = evaluateHand(cards(['As', 'Ah', 'Ad', 'Kc', 'Kh']));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });
});
