import type { Card, AssistedInfo, OutInfo } from 'shared';
import { HandRank } from 'shared';
import { createDeck, shuffle, evaluateHand } from 'shared';

/**
 * Monte Carlo equity calculation.
 * Returns what % of the time this hand wins against random opponents.
 */
export function calculateEquity(
  holeCards: [Card, Card],
  communityCards: Card[],
  numOpponents: number,
  iterations: number = 5000,
): number {
  const known = new Set([
    cardKey(holeCards[0]),
    cardKey(holeCards[1]),
    ...communityCards.map(cardKey),
  ]);

  let wins = 0;

  for (let i = 0; i < iterations; i++) {
    // Build a deck of remaining cards
    const remaining = createDeck().filter(c => !known.has(cardKey(c)));
    shuffleArray(remaining);

    let idx = 0;

    // Deal remaining community cards
    const board = [...communityCards];
    while (board.length < 5) {
      board.push(remaining[idx++]);
    }

    // Evaluate my hand
    const myHand = evaluateHand([...holeCards, ...board]);

    // Deal and evaluate opponent hands
    let iWin = true;
    let tied = false;
    for (let o = 0; o < numOpponents; o++) {
      const oppHole: [Card, Card] = [remaining[idx++], remaining[idx++]];
      const oppHand = evaluateHand([...oppHole, ...board]);
      if (oppHand.score > myHand.score) {
        iWin = false;
        break;
      } else if (oppHand.score === myHand.score) {
        tied = true;
      }
    }

    if (iWin && !tied) {
      wins += 1;
    } else if (iWin && tied) {
      wins += 0.5;
    }
  }

  return Math.round((wins / iterations) * 1000) / 10; // one decimal place
}

/**
 * Calculate outs — cards that improve the player's hand.
 * Only meaningful on flop and turn.
 */
export function calculateOuts(
  holeCards: [Card, Card],
  communityCards: Card[],
): OutInfo[] {
  if (communityCards.length < 3 || communityCards.length >= 5) return [];

  const known = new Set([
    cardKey(holeCards[0]),
    cardKey(holeCards[1]),
    ...communityCards.map(cardKey),
  ]);

  const currentHand = evaluateHand([...holeCards, ...communityCards]);
  const remaining = createDeck().filter(c => !known.has(cardKey(c)));

  // Count improvements by category
  const improvements = new Map<string, number>();

  for (const card of remaining) {
    const newBoard = [...communityCards, card];
    const newHand = evaluateHand([...holeCards, ...newBoard]);
    if (newHand.rank > currentHand.rank) {
      const desc = handRankName(newHand.rank);
      improvements.set(desc, (improvements.get(desc) || 0) + 1);
    }
  }

  return [...improvements.entries()].map(([description, count]) => ({
    count,
    description: `${description} (${count} outs)`,
  }));
}

/**
 * Calculate the nuts — the best possible hand given the board.
 */
export function calculateNuts(communityCards: Card[]): string {
  if (communityCards.length < 3) return 'N/A';

  const deck = createDeck();
  const boardKeys = new Set(communityCards.map(cardKey));
  const available = deck.filter(c => !boardKeys.has(cardKey(c)));

  let bestScore = 0;
  let bestName = '';

  // Check all possible 2-card combos
  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const hand = evaluateHand([available[i], available[j], ...communityCards]);
      if (hand.score > bestScore) {
        bestScore = hand.score;
        bestName = hand.name;
      }
    }
  }

  return bestName;
}

/**
 * Get human-readable name for current hand.
 */
export function getCurrentHandName(
  holeCards: [Card, Card],
  communityCards: Card[],
): string {
  if (communityCards.length === 0) {
    // Preflop — just describe the hole cards
    const r1 = holeCards[0].rank;
    const r2 = holeCards[1].rank;
    const suited = holeCards[0].suit === holeCards[1].suit;
    if (r1 === r2) return `pocket ${rankPlural(r1)}`;
    return `${rankName(r1)}-${rankName(r2)}${suited ? ' suited' : ''}`;
  }

  const result = evaluateHand([...holeCards, ...communityCards]);
  return result.name;
}

/**
 * Build full assisted info for a player.
 */
export function buildAssistedInfo(
  holeCards: [Card, Card],
  communityCards: Card[],
  numOpponents: number,
): AssistedInfo {
  return {
    equity: calculateEquity(holeCards, communityCards, numOpponents),
    outs: calculateOuts(holeCards, communityCards),
    nuts: calculateNuts(communityCards),
    currentHandName: getCurrentHandName(holeCards, communityCards),
  };
}

// ── Helpers ──

function cardKey(c: Card): string {
  return `${c.rank}${c.suit}`;
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function handRankName(rank: HandRank): string {
  const names: Record<HandRank, string> = {
    [HandRank.HighCard]: 'high card',
    [HandRank.OnePair]: 'pair',
    [HandRank.TwoPair]: 'two pair',
    [HandRank.ThreeOfAKind]: 'three of a kind',
    [HandRank.Straight]: 'straight',
    [HandRank.Flush]: 'flush',
    [HandRank.FullHouse]: 'full house',
    [HandRank.FourOfAKind]: 'four of a kind',
    [HandRank.StraightFlush]: 'straight flush',
  };
  return names[rank] || 'unknown';
}

const RANK_NAMES: Record<string, string> = {
  '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six',
  '7': 'seven', '8': 'eight', '9': 'nine', 'T': 'ten',
  'J': 'jack', 'Q': 'queen', 'K': 'king', 'A': 'ace',
};

const RANK_PLURALS: Record<string, string> = {
  '2': 'twos', '3': 'threes', '4': 'fours', '5': 'fives', '6': 'sixes',
  '7': 'sevens', '8': 'eights', '9': 'nines', 'T': 'tens',
  'J': 'jacks', 'Q': 'queens', 'K': 'kings', 'A': 'aces',
};

function rankName(r: string): string { return RANK_NAMES[r] || r; }
function rankPlural(r: string): string { return RANK_PLURALS[r] || r; }
