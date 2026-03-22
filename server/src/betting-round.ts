import type { Player, ActionType, PlayerAction } from 'shared';
import { BIG_BLIND } from 'shared';

export interface BettingState {
  /** Current highest bet this round */
  currentBet: number;
  /** Minimum raise size (last raise increment) */
  minRaiseSize: number;
  /** Index of the last player who raised (or -1) */
  lastRaiserIndex: number;
  /** Set of seat indices that still need to act */
  needsToAct: Set<number>;
  /** Whether the round is complete */
  isComplete: boolean;
}

export function createBettingState(
  players: (Player | null)[],
  dealerIndex: number,
  isPreflop: boolean,
): BettingState {
  const activePlayers = players.filter(
    (p): p is Player => p !== null && !p.folded && !p.allIn
  );

  const needsToAct = new Set<number>();
  for (const p of activePlayers) {
    needsToAct.add(p.seatIndex);
  }

  const currentBet = isPreflop ? BIG_BLIND : 0;

  return {
    currentBet,
    minRaiseSize: BIG_BLIND,
    lastRaiserIndex: -1,
    needsToAct,
    isComplete: false,
  };
}

export interface ValidActions {
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
  canFold: boolean;
  callAmount: number;
  minRaise: number;
  maxRaise: number;
}

export function getValidActions(
  player: Player,
  bettingState: BettingState,
): ValidActions {
  const toCall = bettingState.currentBet - player.bet;
  const canCheck = toCall === 0;
  const canCall = toCall > 0 && player.chips > 0;
  const callAmount = Math.min(toCall, player.chips);

  // Minimum raise = current bet + minRaiseSize
  const minRaiseTotal = bettingState.currentBet + bettingState.minRaiseSize;
  const canRaise = player.chips > toCall;
  const minRaise = Math.min(minRaiseTotal, player.chips + player.bet);
  const maxRaise = player.chips + player.bet; // all-in

  return {
    canCheck,
    canCall,
    canRaise,
    canFold: true,
    callAmount,
    minRaise,
    maxRaise,
  };
}

export function getValidActionTypes(valid: ValidActions): ActionType[] {
  const actions: ActionType[] = ['fold'];
  if (valid.canCheck) actions.push('check');
  if (valid.canCall) actions.push('call');
  if (valid.canRaise) actions.push('raise');
  return actions;
}

export interface ActionResult {
  valid: boolean;
  error?: string;
  playerFolded?: boolean;
  playerAllIn?: boolean;
  bettingComplete?: boolean;
}

/**
 * Apply a player action to the betting state and player.
 * Mutates both the player and bettingState.
 */
export function applyAction(
  player: Player,
  action: PlayerAction,
  bettingState: BettingState,
  allPlayers: (Player | null)[],
): ActionResult {
  const valid = getValidActions(player, bettingState);

  switch (action.action) {
    case 'fold': {
      player.folded = true;
      bettingState.needsToAct.delete(player.seatIndex);
      checkBettingComplete(bettingState, allPlayers);
      return { valid: true, playerFolded: true, bettingComplete: bettingState.isComplete };
    }

    case 'check': {
      if (!valid.canCheck) {
        return { valid: false, error: 'Cannot check, there is a bet to call' };
      }
      bettingState.needsToAct.delete(player.seatIndex);
      checkBettingComplete(bettingState, allPlayers);
      return { valid: true, bettingComplete: bettingState.isComplete };
    }

    case 'call': {
      if (!valid.canCall) {
        return { valid: false, error: 'Nothing to call' };
      }
      const callAmount = valid.callAmount;
      player.chips -= callAmount;
      player.bet += callAmount;
      if (player.chips === 0) {
        player.allIn = true;
      }
      bettingState.needsToAct.delete(player.seatIndex);
      checkBettingComplete(bettingState, allPlayers);
      return { valid: true, playerAllIn: player.allIn, bettingComplete: bettingState.isComplete };
    }

    case 'raise': {
      if (!valid.canRaise) {
        return { valid: false, error: 'Cannot raise' };
      }
      const raiseTotal = action.amount ?? valid.minRaise;

      // Validate raise amount
      if (raiseTotal < valid.minRaise && raiseTotal !== valid.maxRaise) {
        // Allow all-in for less than min raise
        if (raiseTotal !== player.chips + player.bet) {
          return { valid: false, error: `Raise must be at least ${valid.minRaise}` };
        }
      }
      if (raiseTotal > valid.maxRaise) {
        return { valid: false, error: `Raise cannot exceed ${valid.maxRaise}` };
      }

      const raiseIncrement = raiseTotal - bettingState.currentBet;
      const chipsNeeded = raiseTotal - player.bet;

      player.chips -= chipsNeeded;
      player.bet = raiseTotal;
      if (player.chips === 0) {
        player.allIn = true;
      }

      bettingState.currentBet = raiseTotal;
      if (raiseIncrement >= bettingState.minRaiseSize) {
        bettingState.minRaiseSize = raiseIncrement;
      }
      bettingState.lastRaiserIndex = player.seatIndex;

      // Everyone else who hasn't folded/all-in needs to act again
      bettingState.needsToAct.clear();
      for (const p of allPlayers) {
        if (p && !p.folded && !p.allIn && p.seatIndex !== player.seatIndex) {
          bettingState.needsToAct.add(p.seatIndex);
        }
      }

      checkBettingComplete(bettingState, allPlayers);
      return { valid: true, playerAllIn: player.allIn, bettingComplete: bettingState.isComplete };
    }

    default:
      return { valid: false, error: 'Unknown action' };
  }
}

function checkBettingComplete(
  bettingState: BettingState,
  allPlayers: (Player | null)[],
): void {
  // Round is complete when no one needs to act
  if (bettingState.needsToAct.size === 0) {
    bettingState.isComplete = true;
    return;
  }

  // Also complete if only one non-folded player remains
  const activePlayers = allPlayers.filter(
    (p): p is Player => p !== null && !p.folded
  );
  if (activePlayers.length <= 1) {
    bettingState.isComplete = true;
    return;
  }

  // Also complete if all remaining players are all-in
  const canAct = activePlayers.filter(p => !p.allIn);
  if (canAct.length <= 1) {
    bettingState.isComplete = true;
  }
}

/**
 * Find the next player who needs to act, starting from a given seat index.
 * Returns the seat index, or -1 if no one needs to act.
 */
export function findNextToAct(
  players: (Player | null)[],
  bettingState: BettingState,
  fromSeatIndex: number,
): number {
  const numSeats = players.length;
  for (let i = 1; i <= numSeats; i++) {
    const idx = (fromSeatIndex + i) % numSeats;
    if (bettingState.needsToAct.has(idx)) {
      return idx;
    }
  }
  return -1;
}
