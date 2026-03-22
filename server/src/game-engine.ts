import type { Card, GameState, Player, PlayerAction, Street, HandResult, Pot } from 'shared';
import { HandRank, STARTING_STACK, SMALL_BLIND, BIG_BLIND, MAX_SEATS, MIN_PLAYERS_TO_START } from 'shared';
import { createDeck, shuffle, deal, evaluateHand, compareHands } from 'shared';
import { calculatePots } from './pot.js';
import {
  createBettingState,
  applyAction,
  findNextToAct,
  getValidActions,
  getValidActionTypes,
  type BettingState,
  type ValidActions,
} from './betting-round.js';

export interface GameCallbacks {
  onStateChanged: (game: Game) => void;
  onPlayerTurn: (game: Game, player: Player, validActions: ValidActions) => void;
  onHandComplete: (game: Game, result: HandResult) => void;
  onBotTurn: (game: Game, player: Player, validActions: ValidActions) => void;
  onActionTaken: (game: Game, player: Player, action: PlayerAction) => void;
}

export class Game {
  state: GameState;
  bettingState: BettingState | null = null;
  callbacks: GameCallbacks;
  turnTimer: ReturnType<typeof setTimeout> | null = null;
  creatorId: string | null = null;
  started: boolean = false;
  sbIndex: number = -1;
  bbIndex: number = -1;

  constructor(id: string, callbacks: GameCallbacks) {
    this.state = {
      id,
      players: new Array(MAX_SEATS).fill(null),
      communityCards: [],
      deck: [],
      pots: [],
      street: 'waiting',
      dealerIndex: 0,
      activePlayerIndex: -1,
      minRaise: BIG_BLIND,
      lastRaise: 0,
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
    };
    this.callbacks = callbacks;
  }

  // ── Player Management ──

  addPlayer(player: Player): number {
    const seatIndex = this.state.players.findIndex(p => p === null);
    if (seatIndex === -1) return -1;
    player.seatIndex = seatIndex;
    this.state.players[seatIndex] = player;
    return seatIndex;
  }

  removePlayer(playerId: string): void {
    const idx = this.state.players.findIndex(p => p?.id === playerId);
    if (idx === -1) return;
    const player = this.state.players[idx]!;

    if (this.state.street !== 'waiting') {
      // Mid-hand: mark as folded/disconnected
      player.folded = true;
      player.connected = false;
      if (this.state.activePlayerIndex === idx) {
        this.advanceAction();
      }
    } else {
      this.state.players[idx] = null;
    }
  }

  getActivePlayers(): Player[] {
    return this.state.players.filter(
      (p): p is Player => p !== null && !p.folded
    );
  }

  getSeatedPlayers(): Player[] {
    return this.state.players.filter((p): p is Player => p !== null);
  }

  canStartHand(): boolean {
    const seated = this.getSeatedPlayers();
    return seated.length >= MIN_PLAYERS_TO_START && seated.every(p => p.chips > 0 || !p.isBot);
  }

  // ── Hand Flow ──

  startHand(): void {
    if (!this.canStartHand()) return;
    if (this.state.street !== 'waiting') return;

    // Remove busted bots
    for (let i = 0; i < this.state.players.length; i++) {
      const p = this.state.players[i];
      if (p && p.isBot && p.chips <= 0) {
        this.state.players[i] = null;
      }
    }

    // Reset player states
    for (const p of this.getSeatedPlayers()) {
      p.folded = false;
      p.allIn = false;
      p.bet = 0;
      p.holeCards = null;
    }

    // Move dealer
    this.state.dealerIndex = this.findNextSeat(this.state.dealerIndex);

    // Create & shuffle deck
    this.state.deck = shuffle(createDeck());
    this.state.communityCards = [];
    this.state.pots = [];

    // Deal hole cards
    for (const p of this.getSeatedPlayers()) {
      p.holeCards = deal(this.state.deck, 2) as [Card, Card];
    }

    // Post blinds
    this.postBlinds();

    // Start preflop betting
    this.state.street = 'preflop';
    this.startBettingRound(true);
  }

  private postBlinds(): void {
    const seats = this.getSeatedPlayers();
    if (seats.length === 2) {
      // Heads-up: dealer posts SB, other posts BB
      this.sbIndex = this.state.dealerIndex;
      this.bbIndex = this.findNextSeat(this.state.dealerIndex);
      this.postBlind(this.state.players[this.sbIndex]!, SMALL_BLIND);
      this.postBlind(this.state.players[this.bbIndex]!, BIG_BLIND);
    } else {
      this.sbIndex = this.findNextSeat(this.state.dealerIndex);
      this.bbIndex = this.findNextSeat(this.sbIndex);
      this.postBlind(this.state.players[this.sbIndex]!, SMALL_BLIND);
      this.postBlind(this.state.players[this.bbIndex]!, BIG_BLIND);
    }
  }

  private postBlind(player: Player, amount: number): void {
    const actual = Math.min(amount, player.chips);
    player.chips -= actual;
    player.bet = actual;
    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  private startBettingRound(isPreflop: boolean): void {
    this.bettingState = createBettingState(
      this.state.players,
      this.state.dealerIndex,
      isPreflop,
    );

    // Find first player to act
    let startFrom: number;
    if (isPreflop) {
      const seats = this.getSeatedPlayers();
      if (seats.length === 2) {
        // Heads-up: dealer/SB acts first preflop
        // findNextToAct searches from startFrom+1, so go one before dealer
        startFrom = (this.state.dealerIndex - 1 + MAX_SEATS) % MAX_SEATS;
      } else {
        // UTG = left of BB = 2 seats left of dealer
        const sbIndex = this.findNextSeat(this.state.dealerIndex);
        const bbIndex = this.findNextSeat(sbIndex);
        startFrom = bbIndex;
      }
    } else {
      // Postflop: start left of dealer
      startFrom = this.state.dealerIndex;
    }

    const nextSeat = findNextToAct(this.state.players, this.bettingState, startFrom);
    if (nextSeat === -1 || this.bettingState.isComplete) {
      this.endBettingRound();
      return;
    }

    this.state.activePlayerIndex = nextSeat;
    this.promptAction();
  }

  handleAction(playerId: string, action: PlayerAction): { valid: boolean; error?: string } {
    const player = this.state.players.find(p => p?.id === playerId);
    if (!player) return { valid: false, error: 'Player not found' };
    if (player.seatIndex !== this.state.activePlayerIndex) {
      return { valid: false, error: 'Not your turn' };
    }
    if (!this.bettingState) return { valid: false, error: 'No active betting round' };

    this.clearTurnTimer();

    const result = applyAction(player, action, this.bettingState, this.state.players);
    if (!result.valid) {
      return { valid: false, error: result.error };
    }

    // Broadcast the action first (before state changes)
    this.callbacks.onActionTaken(this, player, action);

    if (result.bettingComplete) {
      this.endBettingRound();
    } else {
      // Advance active player BEFORE broadcasting state
      this.advanceToNextPlayer();
      this.callbacks.onStateChanged(this);
      this.promptAction();
    }

    return { valid: true };
  }

  /** Move activePlayerIndex to the next player. Returns false if round is done. */
  private advanceToNextPlayer(): boolean {
    if (!this.bettingState) return false;

    const nextSeat = findNextToAct(
      this.state.players,
      this.bettingState,
      this.state.activePlayerIndex,
    );

    if (nextSeat === -1 || this.bettingState.isComplete) {
      return false;
    }

    this.state.activePlayerIndex = nextSeat;
    return true;
  }

  private advanceAction(): void {
    if (!this.advanceToNextPlayer()) {
      this.endBettingRound();
      return;
    }
    this.promptAction();
  }

  private promptAction(): void {
    const player = this.state.players[this.state.activePlayerIndex];
    if (!player) return;

    const valid = getValidActions(player, this.bettingState!);

    if (player.isBot) {
      this.callbacks.onBotTurn(this, player, valid);
    } else {
      this.callbacks.onPlayerTurn(this, player, valid);
    }
  }

  private endBettingRound(): void {
    this.clearTurnTimer();

    // Collect bets into pots
    this.collectBets();

    // Check if hand is over (only one player remaining)
    const active = this.getActivePlayers();
    if (active.length <= 1) {
      this.finishHand();
      return;
    }

    // Check if all remaining players are all-in (run out the board)
    const canAct = active.filter(p => !p.allIn);
    const runOut = canAct.length <= 1;

    // Advance to next street
    switch (this.state.street) {
      case 'preflop':
        this.state.street = 'flop';
        this.state.communityCards.push(...deal(this.state.deck, 3));
        break;
      case 'flop':
        this.state.street = 'turn';
        this.state.communityCards.push(...deal(this.state.deck, 1));
        break;
      case 'turn':
        this.state.street = 'river';
        this.state.communityCards.push(...deal(this.state.deck, 1));
        break;
      case 'river':
        this.finishHand();
        return;
      default:
        return;
    }

    this.callbacks.onStateChanged(this);

    if (runOut) {
      // All players are all-in, just deal remaining streets
      this.endBettingRound();
    } else {
      // Reset bets for new round
      for (const p of this.getSeatedPlayers()) {
        p.bet = 0;
      }
      this.startBettingRound(false);
    }
  }

  private collectBets(): void {
    const playerBets = this.state.players
      .filter((p): p is Player => p !== null)
      .map(p => ({
        id: p.id,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
      }));

    const newPots = calculatePots(playerBets);

    // Merge into existing pots
    if (this.state.pots.length === 0) {
      this.state.pots = newPots;
    } else {
      // Add new pot amounts to existing structure
      for (const newPot of newPots) {
        const existing = this.state.pots.find(
          p => JSON.stringify(p.eligible.sort()) === JSON.stringify(newPot.eligible.sort())
        );
        if (existing) {
          existing.amount += newPot.amount;
        } else {
          this.state.pots.push(newPot);
        }
      }
    }

    // Reset bets
    for (const p of this.getSeatedPlayers()) {
      p.bet = 0;
    }
  }

  private finishHand(): void {
    this.state.street = 'showdown';
    this.collectBets();

    const active = this.getActivePlayers();
    const result: HandResult = { winners: [], showdown: [] };

    if (active.length === 1) {
      // Everyone else folded
      const winner = active[0];
      const totalPot = this.state.pots.reduce((sum, p) => sum + p.amount, 0);
      winner.chips += totalPot;
      result.winners.push({ id: winner.id, hand: 'last player standing', amount: totalPot });
    } else {
      // Evaluate hands and award pots
      const handResults = new Map<string, ReturnType<typeof evaluateHand>>();
      for (const p of active) {
        if (p.holeCards) {
          const allCards = [...p.holeCards, ...this.state.communityCards];
          handResults.set(p.id, evaluateHand(allCards));
        }
      }

      // Build showdown info
      for (const p of active) {
        const eval_ = handResults.get(p.id);
        if (eval_ && p.holeCards) {
          result.showdown.push({
            id: p.id,
            cards: p.holeCards,
            handName: eval_.name,
          });
        }
      }

      // Award each pot
      for (const pot of this.state.pots) {
        const eligibleWithHands = pot.eligible
          .map(id => ({ id, eval: handResults.get(id)! }))
          .filter(x => x.eval);

        if (eligibleWithHands.length === 0) continue;

        // Find best hand
        eligibleWithHands.sort((a, b) => compareHands(b.eval, a.eval));
        const bestScore = eligibleWithHands[0].eval.score;
        const potWinners = eligibleWithHands.filter(x => x.eval.score === bestScore);

        const share = Math.floor(pot.amount / potWinners.length);
        const remainder = pot.amount - share * potWinners.length;

        for (let i = 0; i < potWinners.length; i++) {
          const w = potWinners[i];
          const amount = share + (i === 0 ? remainder : 0);
          const player = this.state.players.find(p => p?.id === w.id);
          if (player) {
            player.chips += amount;
          }
          const existing = result.winners.find(x => x.id === w.id);
          if (existing) {
            existing.amount += amount;
          } else {
            result.winners.push({ id: w.id, hand: w.eval.name, amount });
          }
        }
      }
    }

    this.state.pots = [];
    this.state.street = 'showdown';
    this.state.activePlayerIndex = -1;
    this.bettingState = null;

    this.callbacks.onHandComplete(this, result);
    this.callbacks.onStateChanged(this);
  }

  resetForNextHand(): void {
    this.state.street = 'waiting';
    this.state.communityCards = [];
    this.state.deck = [];
    this.state.pots = [];
    this.state.activePlayerIndex = -1;
    this.bettingState = null;

    // Remove busted bots, remove disconnected players
    for (let i = 0; i < this.state.players.length; i++) {
      const p = this.state.players[i];
      if (!p) continue;
      if (p.isBot && p.chips <= 0) {
        this.state.players[i] = null;
      } else if (!p.connected && !p.isBot) {
        this.state.players[i] = null;
      }
    }
  }

  // ── Helpers ──

  private findNextSeat(fromIndex: number): number {
    for (let i = 1; i <= MAX_SEATS; i++) {
      const idx = (fromIndex + i) % MAX_SEATS;
      const p = this.state.players[idx];
      if (p && !p.folded && p.chips > 0) {
        return idx;
      }
    }
    return fromIndex;
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  /** Force-fold the current active player (for timeouts) */
  forceAction(playerId: string, action: PlayerAction): void {
    this.handleAction(playerId, action);
  }
}

export function createPlayer(
  id: string,
  name: string,
  isBot: boolean,
  mode: 'normal' | 'assisted' = 'normal',
): Player {
  return {
    id,
    name,
    chips: STARTING_STACK,
    holeCards: null,
    bet: 0,
    folded: false,
    allIn: false,
    isBot,
    mode,
    seatIndex: -1,
    connected: !isBot,
  };
}
