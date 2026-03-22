import type { Card, PlayerAction } from 'shared';
import { evaluateHand, HandRank } from 'shared';
import type { ValidActions } from './betting-round.js';

const BOT_NAMES = [
  'RoboRaise', 'FoldBot', 'ChipMunk', 'PokerFace3000', 'BettyBot',
  'SilverStack', 'BluffByte', 'CardBot', 'NitPicker', 'LuckyLoop',
];

let botNameIndex = 0;

export function getNextBotName(): string {
  const name = BOT_NAMES[botNameIndex % BOT_NAMES.length];
  botNameIndex++;
  return name;
}

export function resetBotNames(): void {
  botNameIndex = 0;
}

/**
 * Compute a hand strength value between 0 and 1.
 * Preflop: based on starting hand categories.
 * Postflop: based on actual hand evaluation.
 */
function getHandStrength(holeCards: [Card, Card], communityCards: Card[]): number {
  if (communityCards.length === 0) {
    return getPreflopStrength(holeCards);
  }
  return getPostflopStrength(holeCards, communityCards);
}

function getPreflopStrength(holeCards: [Card, Card]): number {
  const [c1, c2] = holeCards;
  const r1 = rankValue(c1.rank);
  const r2 = rankValue(c2.rank);
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const suited = c1.suit === c2.suit;
  const pair = r1 === r2;

  if (pair) {
    if (high >= 12) return 0.95; // AA, KK
    if (high >= 10) return 0.85; // QQ, JJ
    if (high >= 8) return 0.70;  // TT, 99
    return 0.55; // lower pairs
  }

  if (high === 14) { // Ace-x
    if (low >= 12) return suited ? 0.85 : 0.80; // AK
    if (low >= 10) return suited ? 0.75 : 0.65; // AQ, AJ
    if (suited) return 0.50;
    return 0.35;
  }

  if (high >= 12 && low >= 10) { // KQ, KJ, QJ
    return suited ? 0.60 : 0.50;
  }

  // Connected suited
  if (suited && high - low <= 2) return 0.45;
  if (suited) return 0.35;

  // Connected
  if (high - low <= 2 && high >= 7) return 0.35;

  return 0.20;
}

function getPostflopStrength(holeCards: [Card, Card], communityCards: Card[]): number {
  const allCards = [...holeCards, ...communityCards];
  const result = evaluateHand(allCards);

  // Normalize hand rank to 0-1
  switch (result.rank) {
    case HandRank.StraightFlush: return 0.98;
    case HandRank.FourOfAKind: return 0.95;
    case HandRank.FullHouse: return 0.90;
    case HandRank.Flush: return 0.85;
    case HandRank.Straight: return 0.78;
    case HandRank.ThreeOfAKind: return 0.70;
    case HandRank.TwoPair: return 0.60;
    case HandRank.OnePair: {
      // Top pair is stronger than bottom pair
      const pairRank = result.cards[0].rank === result.cards[1].rank
        ? rankValue(result.cards[0].rank)
        : rankValue(result.cards[2].rank);
      if (pairRank >= 12) return 0.55;
      if (pairRank >= 8) return 0.45;
      return 0.35;
    }
    case HandRank.HighCard: {
      if (rankValue(result.cards[0].rank) >= 13) return 0.25;
      return 0.15;
    }
  }
}

function rankValue(rank: string): number {
  const vals: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  return vals[rank] ?? 0;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Decide what action a bot should take.
 */
export function botDecision(
  holeCards: [Card, Card],
  communityCards: Card[],
  validActions: ValidActions,
): PlayerAction {
  const strength = getHandStrength(holeCards, communityCards);
  const noise = (Math.random() - 0.5) * 0.15;
  const adjusted = clamp(strength + noise, 0, 1);

  const { callAmount, minRaise, maxRaise, canCheck, canCall, canRaise } = validActions;

  // Weak hand
  if (adjusted < 0.3) {
    if (canCheck) return { action: 'check' };
    // Occasionally bluff (10% of the time)
    if (canRaise && Math.random() < 0.10) {
      return { action: 'raise', amount: minRaise };
    }
    return { action: 'fold' };
  }

  // Medium hand
  if (adjusted < 0.6) {
    if (canCheck) {
      // Sometimes bet with medium hands
      if (canRaise && Math.random() < 0.25) {
        return { action: 'raise', amount: minRaise };
      }
      return { action: 'check' };
    }
    // Call if the price is right
    if (canCall && callAmount <= maxRaise * 0.15) {
      return { action: 'call' };
    }
    if (canCall && Math.random() < 0.4) {
      return { action: 'call' };
    }
    return { action: 'fold' };
  }

  // Strong hand
  if (canCheck && Math.random() < 0.2) {
    return { action: 'check' }; // Slow-play
  }

  if (canRaise) {
    // Size the raise based on strength
    const potFraction = adjusted > 0.8 ? 0.8 : 0.5;
    const raiseAmount = Math.min(
      Math.max(Math.round(minRaise * (1 + potFraction)), minRaise),
      maxRaise,
    );
    if (Math.random() < 0.6) {
      return { action: 'raise', amount: raiseAmount };
    }
  }

  if (canCall) return { action: 'call' };
  if (canCheck) return { action: 'check' };
  return { action: 'fold' };
}
