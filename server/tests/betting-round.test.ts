import { describe, it, expect } from 'vitest';
import type { Player } from 'shared';
import { BIG_BLIND, STARTING_STACK } from 'shared';
import {
  createBettingState,
  getValidActions,
  getValidActionTypes,
  applyAction,
  findNextToAct,
} from '../src/betting-round.js';

function makePlayer(overrides: Partial<Player> & { seatIndex: number }): Player {
  return {
    id: `player-${overrides.seatIndex}`,
    name: `Player ${overrides.seatIndex}`,
    chips: STARTING_STACK,
    holeCards: null,
    bet: 0,
    folded: false,
    allIn: false,
    isBot: false,
    mode: 'normal',
    connected: true,
    ...overrides,
  };
}

describe('createBettingState', () => {
  it('creates state for preflop', () => {
    const players: (Player | null)[] = [
      makePlayer({ seatIndex: 0 }),
      makePlayer({ seatIndex: 1 }),
      null, null, null, null,
    ];
    const state = createBettingState(players, 0, true);
    expect(state.currentBet).toBe(BIG_BLIND);
    expect(state.needsToAct.size).toBe(2);
    expect(state.isComplete).toBe(false);
  });

  it('creates state for postflop', () => {
    const players: (Player | null)[] = [
      makePlayer({ seatIndex: 0 }),
      makePlayer({ seatIndex: 1 }),
      null, null, null, null,
    ];
    const state = createBettingState(players, 0, false);
    expect(state.currentBet).toBe(0);
  });

  it('excludes folded and all-in players from needsToAct', () => {
    const players: (Player | null)[] = [
      makePlayer({ seatIndex: 0 }),
      makePlayer({ seatIndex: 1, folded: true }),
      makePlayer({ seatIndex: 2, allIn: true }),
      makePlayer({ seatIndex: 3 }),
      null, null,
    ];
    const state = createBettingState(players, 0, false);
    expect(state.needsToAct.size).toBe(2);
    expect(state.needsToAct.has(0)).toBe(true);
    expect(state.needsToAct.has(3)).toBe(true);
  });
});

describe('getValidActions', () => {
  it('allows check when no bet is owed', () => {
    const player = makePlayer({ seatIndex: 0, bet: 0 });
    const state = createBettingState([player, makePlayer({ seatIndex: 1 })], 0, false);
    const valid = getValidActions(player, state);
    expect(valid.canCheck).toBe(true);
    expect(valid.canCall).toBe(false);
  });

  it('allows call when there is a bet to match', () => {
    const player = makePlayer({ seatIndex: 0, bet: 0 });
    const state = createBettingState([player, makePlayer({ seatIndex: 1 })], 0, true);
    // Preflop, currentBet = 2
    const valid = getValidActions(player, state);
    expect(valid.canCall).toBe(true);
    expect(valid.callAmount).toBe(BIG_BLIND);
  });

  it('limits call to remaining chips', () => {
    const player = makePlayer({ seatIndex: 0, chips: 1, bet: 0 });
    const state = createBettingState([player, makePlayer({ seatIndex: 1 })], 0, true);
    const valid = getValidActions(player, state);
    expect(valid.callAmount).toBe(1);
  });

  it('calculates min raise correctly', () => {
    const player = makePlayer({ seatIndex: 0, bet: 0 });
    const state = createBettingState([player, makePlayer({ seatIndex: 1 })], 0, true);
    const valid = getValidActions(player, state);
    // Min raise = currentBet (2) + minRaiseSize (2) = 4
    expect(valid.minRaise).toBe(4);
    expect(valid.maxRaise).toBe(STARTING_STACK); // all chips
  });

  it('cannot raise when chips exactly cover the call', () => {
    const player = makePlayer({ seatIndex: 0, chips: 2, bet: 0 });
    const state = createBettingState([player, makePlayer({ seatIndex: 1 })], 0, true);
    const valid = getValidActions(player, state);
    expect(valid.canRaise).toBe(false);
  });
});

describe('applyAction', () => {
  it('fold removes player from needsToAct', () => {
    const p0 = makePlayer({ seatIndex: 0 });
    const p1 = makePlayer({ seatIndex: 1 });
    const players: (Player | null)[] = [p0, p1, null, null, null, null];
    const state = createBettingState(players, 0, false);

    const result = applyAction(p0, { action: 'fold' }, state, players);
    expect(result.valid).toBe(true);
    expect(p0.folded).toBe(true);
    expect(state.needsToAct.has(0)).toBe(false);
  });

  it('check succeeds when no bet owed', () => {
    const p0 = makePlayer({ seatIndex: 0 });
    const p1 = makePlayer({ seatIndex: 1 });
    const players: (Player | null)[] = [p0, p1, null, null, null, null];
    const state = createBettingState(players, 0, false);

    const result = applyAction(p0, { action: 'check' }, state, players);
    expect(result.valid).toBe(true);
  });

  it('check fails when there is a bet', () => {
    const p0 = makePlayer({ seatIndex: 0, bet: 0 });
    const p1 = makePlayer({ seatIndex: 1 });
    const players: (Player | null)[] = [p0, p1, null, null, null, null];
    const state = createBettingState(players, 0, true);

    const result = applyAction(p0, { action: 'check' }, state, players);
    expect(result.valid).toBe(false);
  });

  it('call deducts correct chips', () => {
    const p0 = makePlayer({ seatIndex: 0, bet: 0, chips: 200 });
    const p1 = makePlayer({ seatIndex: 1, bet: 2 });
    const players: (Player | null)[] = [p0, p1, null, null, null, null];
    const state = createBettingState(players, 0, true);

    const result = applyAction(p0, { action: 'call' }, state, players);
    expect(result.valid).toBe(true);
    expect(p0.chips).toBe(198);
    expect(p0.bet).toBe(2);
  });

  it('call with insufficient chips goes all-in', () => {
    const p0 = makePlayer({ seatIndex: 0, bet: 0, chips: 1 });
    const p1 = makePlayer({ seatIndex: 1, bet: 2 });
    const players: (Player | null)[] = [p0, p1, null, null, null, null];
    const state = createBettingState(players, 0, true);

    const result = applyAction(p0, { action: 'call' }, state, players);
    expect(result.valid).toBe(true);
    expect(p0.chips).toBe(0);
    expect(p0.allIn).toBe(true);
  });

  it('raise updates currentBet and resets needsToAct', () => {
    const p0 = makePlayer({ seatIndex: 0, bet: 0, chips: 200 });
    const p1 = makePlayer({ seatIndex: 1, bet: 0, chips: 200 });
    const p2 = makePlayer({ seatIndex: 2, bet: 0, chips: 200 });
    const players: (Player | null)[] = [p0, p1, p2, null, null, null];
    const state = createBettingState(players, 0, false);

    // p0 checks
    applyAction(p0, { action: 'check' }, state, players);

    // p1 raises to 10
    const result = applyAction(p1, { action: 'raise', amount: 10 }, state, players);
    expect(result.valid).toBe(true);
    expect(state.currentBet).toBe(10);
    expect(state.needsToAct.has(0)).toBe(true); // p0 needs to act again
    expect(state.needsToAct.has(2)).toBe(true); // p2 needs to act
    expect(state.needsToAct.has(1)).toBe(false); // p1 just raised
  });

  it('raise below minimum is rejected', () => {
    const p0 = makePlayer({ seatIndex: 0, bet: 0, chips: 200 });
    const p1 = makePlayer({ seatIndex: 1, bet: 0, chips: 200 });
    const players: (Player | null)[] = [p0, p1, null, null, null, null];
    const state = createBettingState(players, 0, true);
    // currentBet = 2, minRaise = 4
    const result = applyAction(p0, { action: 'raise', amount: 3 }, state, players);
    expect(result.valid).toBe(false);
  });

  it('all-in raise for less than min raise is allowed', () => {
    const p0 = makePlayer({ seatIndex: 0, bet: 0, chips: 3 });
    const p1 = makePlayer({ seatIndex: 1, bet: 0, chips: 200 });
    const players: (Player | null)[] = [p0, p1, null, null, null, null];
    const state = createBettingState(players, 0, true);
    // currentBet = 2, minRaise = 4, but player only has 3 total
    const result = applyAction(p0, { action: 'raise', amount: 3 }, state, players);
    expect(result.valid).toBe(true);
    expect(p0.allIn).toBe(true);
  });

  it('betting completes when all players have acted', () => {
    const p0 = makePlayer({ seatIndex: 0 });
    const p1 = makePlayer({ seatIndex: 1 });
    const players: (Player | null)[] = [p0, p1, null, null, null, null];
    const state = createBettingState(players, 0, false);

    applyAction(p0, { action: 'check' }, state, players);
    expect(state.isComplete).toBe(false);
    applyAction(p1, { action: 'check' }, state, players);
    expect(state.isComplete).toBe(true);
  });

  it('betting completes when all but one player folds', () => {
    const p0 = makePlayer({ seatIndex: 0 });
    const p1 = makePlayer({ seatIndex: 1 });
    const p2 = makePlayer({ seatIndex: 2 });
    const players: (Player | null)[] = [p0, p1, p2, null, null, null];
    const state = createBettingState(players, 0, false);

    applyAction(p0, { action: 'fold' }, state, players);
    expect(state.isComplete).toBe(false);
    applyAction(p1, { action: 'fold' }, state, players);
    expect(state.isComplete).toBe(true);
  });
});

describe('findNextToAct', () => {
  it('finds next player who needs to act', () => {
    const p0 = makePlayer({ seatIndex: 0 });
    const p1 = makePlayer({ seatIndex: 1 });
    const p4 = makePlayer({ seatIndex: 4 });
    const players: (Player | null)[] = [p0, p1, null, null, p4, null];
    const state = createBettingState(players, 0, false);

    expect(findNextToAct(players, state, 0)).toBe(1);
    expect(findNextToAct(players, state, 1)).toBe(4);
    expect(findNextToAct(players, state, 4)).toBe(0);
  });

  it('returns -1 when no one needs to act', () => {
    const p0 = makePlayer({ seatIndex: 0 });
    const p1 = makePlayer({ seatIndex: 1 });
    const players: (Player | null)[] = [p0, p1, null, null, null, null];
    const state = createBettingState(players, 0, false);
    state.needsToAct.clear();

    expect(findNextToAct(players, state, 0)).toBe(-1);
  });
});
