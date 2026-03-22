import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandResult } from 'shared';
import { Game, createPlayer, type GameCallbacks } from '../src/game-engine.js';
import type { ValidActions } from '../src/betting-round.js';
import type { Player } from 'shared';

function createMockCallbacks(): GameCallbacks & {
  stateChanges: number;
  turns: { playerId: string; valid: ValidActions }[];
  botTurns: { playerId: string; valid: ValidActions }[];
  handResults: HandResult[];
} {
  const mock = {
    stateChanges: 0,
    turns: [] as { playerId: string; valid: ValidActions }[],
    botTurns: [] as { playerId: string; valid: ValidActions }[],
    handResults: [] as HandResult[],
    onStateChanged: vi.fn(() => { mock.stateChanges++; }),
    onPlayerTurn: vi.fn((game: Game, player: Player, valid: ValidActions) => {
      mock.turns.push({ playerId: player.id, valid });
    }),
    onHandComplete: vi.fn((game: Game, result: HandResult) => {
      mock.handResults.push(result);
    }),
    onActionTaken: vi.fn(),
    onBotTurn: vi.fn((game: Game, player: Player, valid: ValidActions) => {
      mock.botTurns.push({ playerId: player.id, valid });
    }),
  };
  return mock;
}

describe('Game', () => {
  let game: Game;
  let callbacks: ReturnType<typeof createMockCallbacks>;

  beforeEach(() => {
    callbacks = createMockCallbacks();
    game = new Game('test-game', callbacks);
  });

  describe('player management', () => {
    it('adds players to empty seats', () => {
      const p = createPlayer('p1', 'Alice', false);
      const seat = game.addPlayer(p);
      expect(seat).toBe(0);
      expect(game.state.players[0]).toBe(p);
    });

    it('returns -1 when table is full', () => {
      for (let i = 0; i < 6; i++) {
        game.addPlayer(createPlayer(`p${i}`, `Player ${i}`, false));
      }
      const seat = game.addPlayer(createPlayer('p7', 'Extra', false));
      expect(seat).toBe(-1);
    });

    it('removes players', () => {
      const p = createPlayer('p1', 'Alice', false);
      game.addPlayer(p);
      game.removePlayer('p1');
      expect(game.state.players[0]).toBeNull();
    });
  });

  describe('canStartHand', () => {
    it('requires at least 2 players', () => {
      game.addPlayer(createPlayer('p1', 'Alice', false));
      expect(game.canStartHand()).toBe(false);
      game.addPlayer(createPlayer('p2', 'Bob', false));
      expect(game.canStartHand()).toBe(true);
    });
  });

  describe('startHand', () => {
    it('deals hole cards and posts blinds', () => {
      const p1 = createPlayer('p1', 'Alice', false);
      const p2 = createPlayer('p2', 'Bob', false);
      game.addPlayer(p1);
      game.addPlayer(p2);
      game.startHand();

      expect(game.state.street).toBe('preflop');
      expect(p1.holeCards).not.toBeNull();
      expect(p2.holeCards).not.toBeNull();
      expect(p1.holeCards!.length).toBe(2);

      // One player has SB posted, one has BB
      const bets = [p1.bet, p2.bet].sort((a, b) => a - b);
      expect(bets).toEqual([1, 2]);
    });

    it('triggers player turn callback', () => {
      game.addPlayer(createPlayer('p1', 'Alice', false));
      game.addPlayer(createPlayer('p2', 'Bob', false));
      game.startHand();

      expect(callbacks.turns.length).toBe(1);
    });
  });

  describe('hand flow', () => {
    it('completes a hand when one player folds preflop', () => {
      const p1 = createPlayer('p1', 'Alice', false);
      const p2 = createPlayer('p2', 'Bob', false);
      game.addPlayer(p1);
      game.addPlayer(p2);
      game.startHand();

      // In heads-up, dealer posts SB and acts first preflop
      const activeId = game.state.players[game.state.activePlayerIndex]!.id;
      game.handleAction(activeId, { action: 'fold' });

      expect(callbacks.handResults.length).toBe(1);
      expect(callbacks.handResults[0].winners.length).toBe(1);
      // Winner gets the pot (SB + BB = 3)
      expect(callbacks.handResults[0].winners[0].amount).toBe(3);
    });

    it('proceeds to flop after preflop betting', () => {
      const p1 = createPlayer('p1', 'Alice', false);
      const p2 = createPlayer('p2', 'Bob', false);
      game.addPlayer(p1);
      game.addPlayer(p2);
      game.startHand();

      // Heads-up preflop: dealer/SB acts first
      const firstActor = game.state.players[game.state.activePlayerIndex]!;
      // SB needs to call to match BB
      expect(firstActor.bet).toBe(1); // SB posted 1
      game.handleAction(firstActor.id, { action: 'call' });

      // BB gets option
      const secondActor = game.state.players[game.state.activePlayerIndex]!;
      expect(secondActor.bet).toBe(2); // BB posted 2
      game.handleAction(secondActor.id, { action: 'check' });

      expect(game.state.street).toBe('flop');
      expect(game.state.communityCards.length).toBe(3);
    });

    it('plays through all streets to showdown', () => {
      const p1 = createPlayer('p1', 'Alice', false);
      const p2 = createPlayer('p2', 'Bob', false);
      game.addPlayer(p1);
      game.addPlayer(p2);
      game.startHand();

      // Helper: each round, both players check/call through
      function playBettingRound() {
        while (game.state.activePlayerIndex !== -1 && callbacks.handResults.length === 0) {
          const actor = game.state.players[game.state.activePlayerIndex]!;
          const toCall = game.bettingState!.currentBet - actor.bet;
          if (toCall > 0) {
            game.handleAction(actor.id, { action: 'call' });
          } else {
            game.handleAction(actor.id, { action: 'check' });
          }
        }
      }

      // Preflop
      playBettingRound();
      if (callbacks.handResults.length > 0) return; // hand ended early

      expect(game.state.street).toBe('flop');
      expect(game.state.communityCards.length).toBe(3);

      // Flop
      playBettingRound();
      if (callbacks.handResults.length > 0) return;

      expect(game.state.street).toBe('turn');
      expect(game.state.communityCards.length).toBe(4);

      // Turn
      playBettingRound();
      if (callbacks.handResults.length > 0) return;

      expect(game.state.street).toBe('river');
      expect(game.state.communityCards.length).toBe(5);

      // River
      playBettingRound();

      expect(callbacks.handResults.length).toBe(1);
      expect(game.state.street).toBe('showdown');

      // Winner should have received chips
      const totalChips = game.getSeatedPlayers().reduce((sum, p) => sum + p.chips, 0);
      expect(totalChips).toBe(400); // 200 + 200, zero-sum
    });

    it('handles raise and re-raise', () => {
      const p1 = createPlayer('p1', 'Alice', false);
      const p2 = createPlayer('p2', 'Bob', false);
      game.addPlayer(p1);
      game.addPlayer(p2);
      game.startHand();

      const actor1 = game.state.players[game.state.activePlayerIndex]!;
      const result1 = game.handleAction(actor1.id, { action: 'raise', amount: 6 });
      expect(result1.valid).toBe(true);

      const actor2 = game.state.players[game.state.activePlayerIndex]!;
      expect(actor2.id).not.toBe(actor1.id);

      const result2 = game.handleAction(actor2.id, { action: 'raise', amount: 14 });
      expect(result2.valid).toBe(true);

      // First player should get to act again
      const actor3 = game.state.players[game.state.activePlayerIndex]!;
      expect(actor3.id).toBe(actor1.id);
    });

    it('rejects action from wrong player', () => {
      const p1 = createPlayer('p1', 'Alice', false);
      const p2 = createPlayer('p2', 'Bob', false);
      game.addPlayer(p1);
      game.addPlayer(p2);
      game.startHand();

      const activeId = game.state.players[game.state.activePlayerIndex]!.id;
      const wrongId = activeId === 'p1' ? 'p2' : 'p1';
      const result = game.handleAction(wrongId, { action: 'fold' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Not your turn');
    });
  });

  describe('chip conservation', () => {
    it('total chips are conserved after a hand', () => {
      const p1 = createPlayer('p1', 'Alice', false);
      const p2 = createPlayer('p2', 'Bob', false);
      const p3 = createPlayer('p3', 'Charlie', false);
      game.addPlayer(p1);
      game.addPlayer(p2);
      game.addPlayer(p3);
      game.startHand();

      // Everyone folds to BB
      const actor1 = game.state.players[game.state.activePlayerIndex]!;
      game.handleAction(actor1.id, { action: 'fold' });

      if (callbacks.handResults.length === 0) {
        const actor2 = game.state.players[game.state.activePlayerIndex]!;
        game.handleAction(actor2.id, { action: 'fold' });
      }

      const totalChips = game.getSeatedPlayers().reduce((sum, p) => sum + p.chips, 0);
      expect(totalChips).toBe(600); // 200 * 3
    });
  });

  describe('resetForNextHand', () => {
    it('resets state to waiting', () => {
      const p1 = createPlayer('p1', 'Alice', false);
      const p2 = createPlayer('p2', 'Bob', false);
      game.addPlayer(p1);
      game.addPlayer(p2);
      game.startHand();

      // Fold to end hand
      const activeId = game.state.players[game.state.activePlayerIndex]!.id;
      game.handleAction(activeId, { action: 'fold' });

      game.resetForNextHand();
      expect(game.state.street).toBe('waiting');
      expect(game.state.communityCards).toEqual([]);
      expect(game.state.pots).toEqual([]);
    });

    it('removes busted bots', () => {
      const p1 = createPlayer('p1', 'Alice', false);
      const bot = createPlayer('bot1', 'Bot', true);
      bot.chips = 0;
      game.addPlayer(p1);
      game.addPlayer(bot);

      game.resetForNextHand();
      const seated = game.getSeatedPlayers();
      expect(seated.length).toBe(1);
      expect(seated[0].id).toBe('p1');
    });
  });
});
