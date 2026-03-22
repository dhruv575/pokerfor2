export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type PlayerMode = 'normal' | 'assisted';

export interface Player {
  id: string;
  name: string;
  chips: number;
  holeCards: [Card, Card] | null;
  bet: number;
  folded: boolean;
  allIn: boolean;
  isBot: boolean;
  mode: PlayerMode;
  seatIndex: number;
  connected: boolean;
}

export interface Pot {
  amount: number;
  eligible: string[]; // player IDs
}

export interface GameState {
  id: string;
  players: (Player | null)[]; // 6 slots
  communityCards: Card[];
  deck: Card[]; // server-only, never sent to clients
  pots: Pot[];
  street: Street;
  dealerIndex: number;
  activePlayerIndex: number;
  minRaise: number;
  lastRaise: number;
  smallBlind: number;
  bigBlind: number;
}

export interface AssistedInfo {
  equity: number; // 0-100
  outs: OutInfo[];
  nuts: string;
  currentHandName: string;
}

export interface OutInfo {
  count: number;
  description: string;
}

export type ActionType = 'fold' | 'check' | 'call' | 'raise';

export interface PlayerAction {
  action: ActionType;
  amount?: number;
}

export interface GameSummary {
  id: string;
  playerCount: number;
  status: 'waiting' | 'playing';
}

export interface HandResult {
  winners: { id: string; hand: string; amount: number }[];
  showdown: { id: string; cards: [Card, Card]; handName: string }[];
}

export enum HandRank {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export interface HandEvalResult {
  rank: HandRank;
  score: number; // single comparable number: (rank << 20) | tiebreakers
  name: string;  // human-readable, e.g. "pair of aces"
  cards: Card[]; // the best 5 cards
}
