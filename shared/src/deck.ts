import type { Card, Rank, Suit } from './types.js';

const SUITS: Suit[] = ['h', 'd', 'c', 's'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle (in place) */
export function shuffle(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Deal n cards from the top of the deck (mutates the deck) */
export function deal(deck: Card[], n: number): Card[] {
  if (deck.length < n) {
    throw new Error(`Cannot deal ${n} cards from a deck of ${deck.length}`);
  }
  return deck.splice(0, n);
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function stringToCard(s: string): Card {
  return { rank: s[0] as Rank, suit: s[1] as Suit };
}

export { SUITS, RANKS };
