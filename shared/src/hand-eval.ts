import type { Card, HandEvalResult } from './types.js';
import { HandRank } from './types.js';

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const RANK_NAMES: Record<string, string> = {
  '2': 'twos', '3': 'threes', '4': 'fours', '5': 'fives', '6': 'sixes',
  '7': 'sevens', '8': 'eights', '9': 'nines', 'T': 'tens',
  'J': 'jacks', 'Q': 'queens', 'K': 'kings', 'A': 'aces',
};

const RANK_NAME_SINGULAR: Record<string, string> = {
  '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six',
  '7': 'seven', '8': 'eight', '9': 'nine', 'T': 'ten',
  'J': 'jack', 'Q': 'queen', 'K': 'king', 'A': 'ace',
};

function rankVal(card: Card): number {
  return RANK_VALUES[card.rank];
}

/** Generate all C(n, k) combinations */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: T[][] = [];
  const [first, ...rest] = arr;
  // combos that include first
  for (const combo of combinations(rest, k - 1)) {
    result.push([first, ...combo]);
  }
  // combos that exclude first
  for (const combo of combinations(rest, k)) {
    result.push(combo);
  }
  return result;
}

/** Evaluate exactly 5 cards and return a score */
function evaluate5(cards: Card[]): { rank: HandRank; score: number; name: string } {
  const sorted = [...cards].sort((a, b) => rankVal(b) - rankVal(a));
  const values = sorted.map(rankVal);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight (including A-2-3-4-5 wheel)
  let isStraight = false;
  let straightHigh = values[0];

  if (
    values[0] - values[1] === 1 &&
    values[1] - values[2] === 1 &&
    values[2] - values[3] === 1 &&
    values[3] - values[4] === 1
  ) {
    isStraight = true;
    straightHigh = values[0];
  }
  // Wheel: A-5-4-3-2
  if (
    values[0] === 14 &&
    values[1] === 5 &&
    values[2] === 4 &&
    values[3] === 3 &&
    values[4] === 2
  ) {
    isStraight = true;
    straightHigh = 5; // 5-high straight
  }

  // Count ranks
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const groups = [...counts.entries()].sort((a, b) => {
    // Sort by count desc, then by rank desc
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const pattern = groups.map(g => g[1]).join('');

  // Encode tiebreaker: up to 5 nibbles (4 bits each, but we use more for safety)
  function encodeTiebreakers(...vals: number[]): number {
    let result = 0;
    for (let i = 0; i < vals.length; i++) {
      result = result * 15 + vals[i];
    }
    return result;
  }

  // Straight flush
  if (isFlush && isStraight) {
    const name = straightHigh === 14 ? 'royal flush' : `straight flush, ${RANK_NAME_SINGULAR[sorted[isStraightWheel(values) ? 4 : 0].rank]}-high`;
    return {
      rank: HandRank.StraightFlush,
      score: (HandRank.StraightFlush << 20) | encodeTiebreakers(straightHigh),
      name: straightHigh === 14 && !isStraightWheel(values) ? 'royal flush' : `straight flush, ${rankNameForHigh(straightHigh)}-high`,
    };
  }

  // Four of a kind
  if (pattern === '41') {
    return {
      rank: HandRank.FourOfAKind,
      score: (HandRank.FourOfAKind << 20) | encodeTiebreakers(groups[0][0], groups[1][0]),
      name: `four of a kind, ${RANK_NAMES[rankToChar(groups[0][0])]}`,
    };
  }

  // Full house
  if (pattern === '32') {
    return {
      rank: HandRank.FullHouse,
      score: (HandRank.FullHouse << 20) | encodeTiebreakers(groups[0][0], groups[1][0]),
      name: `full house, ${RANK_NAMES[rankToChar(groups[0][0])]} full of ${RANK_NAMES[rankToChar(groups[1][0])]}`,
    };
  }

  // Flush
  if (isFlush) {
    return {
      rank: HandRank.Flush,
      score: (HandRank.Flush << 20) | encodeTiebreakers(...values),
      name: `flush, ${rankNameForHigh(values[0])}-high`,
    };
  }

  // Straight
  if (isStraight) {
    return {
      rank: HandRank.Straight,
      score: (HandRank.Straight << 20) | encodeTiebreakers(straightHigh),
      name: `straight, ${rankNameForHigh(straightHigh)}-high`,
    };
  }

  // Three of a kind
  if (pattern === '311') {
    return {
      rank: HandRank.ThreeOfAKind,
      score: (HandRank.ThreeOfAKind << 20) | encodeTiebreakers(groups[0][0], groups[1][0], groups[2][0]),
      name: `three of a kind, ${RANK_NAMES[rankToChar(groups[0][0])]}`,
    };
  }

  // Two pair
  if (pattern === '221') {
    return {
      rank: HandRank.TwoPair,
      score: (HandRank.TwoPair << 20) | encodeTiebreakers(groups[0][0], groups[1][0], groups[2][0]),
      name: `two pair, ${RANK_NAMES[rankToChar(groups[0][0])]} and ${RANK_NAMES[rankToChar(groups[1][0])]}`,
    };
  }

  // One pair
  if (pattern === '2111') {
    return {
      rank: HandRank.OnePair,
      score: (HandRank.OnePair << 20) | encodeTiebreakers(groups[0][0], groups[1][0], groups[2][0], groups[3][0]),
      name: `pair of ${RANK_NAMES[rankToChar(groups[0][0])]}`,
    };
  }

  // High card
  return {
    rank: HandRank.HighCard,
    score: (HandRank.HighCard << 20) | encodeTiebreakers(...values),
    name: `high card, ${rankNameForHigh(values[0])}`,
  };
}

function isStraightWheel(values: number[]): boolean {
  return values[0] === 14 && values[1] === 5;
}

function rankToChar(val: number): string {
  for (const [k, v] of Object.entries(RANK_VALUES)) {
    if (v === val) return k;
  }
  return '?';
}

function rankNameForHigh(val: number): string {
  return RANK_NAME_SINGULAR[rankToChar(val)] || '?';
}

/**
 * Evaluate the best 5-card hand from 5, 6, or 7 cards.
 */
export function evaluateHand(cards: Card[]): HandEvalResult {
  if (cards.length < 5) {
    throw new Error(`Need at least 5 cards, got ${cards.length}`);
  }
  if (cards.length === 5) {
    const result = evaluate5(cards);
    return { ...result, cards };
  }

  let best: { rank: HandRank; score: number; name: string; cards: Card[] } | null = null;

  for (const combo of combinations(cards, 5)) {
    const result = evaluate5(combo);
    if (!best || result.score > best.score) {
      best = { ...result, cards: combo };
    }
  }

  return best!;
}

/**
 * Compare two hand results. Returns positive if a wins, negative if b wins, 0 for tie.
 */
export function compareHands(a: HandEvalResult, b: HandEvalResult): number {
  return a.score - b.score;
}
