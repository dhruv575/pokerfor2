import type { GameSummary, PlayerMode, HandResult } from 'shared';
import { MAX_SEATS, MIN_PLAYERS_TO_START, STARTING_STACK, BOT_DELAY_MIN_MS, BOT_DELAY_MAX_MS, HAND_START_DELAY_MS, TURN_TIMEOUT_MS } from 'shared';
import { Game, createPlayer, type GameCallbacks } from './game-engine.js';
import { botDecision, getNextBotName } from './bot.js';
import { getValidActions, getValidActionTypes } from './betting-round.js';
import { ConnectionManager } from './connection.js';
import { buildAssistedInfo } from './equity.js';
import type { ValidActions } from './betting-round.js';
import type { Player } from 'shared';

let gameIdCounter = 0;

export class Lobby {
  games = new Map<string, Game>();
  connections: ConnectionManager;

  constructor(connections: ConnectionManager) {
    this.connections = connections;
  }

  createGame(): Game {
    const id = `game-${++gameIdCounter}`;
    const callbacks = this.createCallbacks(id);
    const game = new Game(id, callbacks);
    this.games.set(id, game);
    return game;
  }

  getGame(id: string): Game | undefined {
    return this.games.get(id);
  }

  removeGame(id: string): void {
    this.games.delete(id);
  }

  listGames(): GameSummary[] {
    return [...this.games.values()].map(g => ({
      id: g.state.id,
      playerCount: g.getSeatedPlayers().filter(p => !p.isBot).length,
      status: g.state.street === 'waiting' ? 'waiting' as const : 'playing' as const,
    }));
  }

  joinGame(gameId: string, playerId: string, playerName: string, mode: PlayerMode): { success: boolean; error?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false, error: 'Game not found' };

    const humanCount = game.getSeatedPlayers().filter(p => !p.isBot).length;
    if (humanCount >= MAX_SEATS) return { success: false, error: 'Game is full' };

    // If table is full, remove a bot to make room (only during waiting)
    const emptySeats = game.state.players.filter(p => p === null).length;
    if (emptySeats === 0 && game.state.street === 'waiting') {
      const botIdx = game.state.players.findIndex(p => p?.isBot);
      if (botIdx !== -1) {
        game.state.players[botIdx] = null;
      }
    }

    const player = createPlayer(playerId, playerName, false, mode);
    const seat = game.addPlayer(player);
    if (seat === -1) return { success: false, error: 'No seats available' };

    // Update connection
    const conn = this.connections.getByPlayerId(playerId);
    if (conn) conn.gameId = gameId;

    // Notify others
    this.connections.broadcast(gameId, {
      type: 'S_PLAYER_JOINED',
      playerName,
      seatIndex: seat,
    });

    // Send current game state
    this.connections.broadcastGameState(gameId, game.state);

    return { success: true };
  }

  startGame(playerId: string): { success: boolean; error?: string } {
    const conn = this.connections.getByPlayerId(playerId);
    if (!conn?.gameId) return { success: false, error: 'Not in a game' };

    const game = this.games.get(conn.gameId);
    if (!game) return { success: false, error: 'Game not found' };
    if (game.creatorId !== playerId) return { success: false, error: 'Only the game creator can start' };
    if (game.started) return { success: false, error: 'Game already started' };

    game.started = true;

    // Fill with bots and start
    this.fillWithBots(game);
    if (game.canStartHand()) {
      setTimeout(() => {
        if (game.state.street === 'waiting' && game.canStartHand()) {
          game.startHand();
        }
      }, 500);
    }

    return { success: true };
  }

  leaveGame(playerId: string): void {
    const conn = this.connections.getByPlayerId(playerId);
    if (!conn?.gameId) return;

    const game = this.games.get(conn.gameId);
    if (!game) return;

    const player = game.state.players.find(p => p?.id === playerId);
    const seatIndex = player?.seatIndex ?? -1;
    const playerName = player?.name ?? '';

    game.removePlayer(playerId);
    conn.gameId = null;

    this.connections.broadcast(game.state.id, {
      type: 'S_PLAYER_LEFT',
      playerName,
      seatIndex,
    });

    this.connections.broadcastGameState(game.state.id, game.state);

    // Clean up empty games
    const humans = game.getSeatedPlayers().filter(p => !p.isBot);
    if (humans.length === 0) {
      this.removeGame(game.state.id);
    }

    this.broadcastLobbyState();
  }

  /** Auto-start the next hand (only after the game has been manually started) */
  tryStartGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;
    if (!game.started) return;
    if (game.state.street !== 'waiting') return;

    const humans = game.getSeatedPlayers().filter(p => !p.isBot);
    if (humans.length === 0) return;

    // Refill bots if any were eliminated
    this.fillWithBots(game);

    if (game.canStartHand()) {
      setTimeout(() => {
        if (game.state.street === 'waiting' && game.canStartHand()) {
          game.startHand();
        }
      }, HAND_START_DELAY_MS);
    }
  }

  private fillWithBots(game: Game): void {
    const seated = game.getSeatedPlayers().length;
    const botsNeeded = MAX_SEATS - seated;

    for (let i = 0; i < botsNeeded; i++) {
      const bot = createPlayer(
        `bot-${game.state.id}-${i}`,
        getNextBotName(),
        true,
      );
      game.addPlayer(bot);
    }
  }

  broadcastLobbyState(): void {
    const games = this.listGames();
    // Broadcast to all connections not in a game
    // This is handled by the server index
  }

  private sendAssistedInfo(game: Game): void {
    if (game.state.street === 'waiting' || game.state.street === 'showdown') return;

    const numOpponents = game.getActivePlayers().length - 1;
    if (numOpponents < 1) return;

    for (const player of game.getSeatedPlayers()) {
      if (player.mode !== 'assisted' || player.isBot || !player.holeCards) continue;

      const info = buildAssistedInfo(
        player.holeCards,
        game.state.communityCards,
        numOpponents,
      );

      this.connections.send(player.id, {
        type: 'S_ASSISTED_INFO',
        info,
      });
    }
  }

  private createCallbacks(gameId: string): GameCallbacks {
    return {
      onStateChanged: (game: Game) => {
        this.connections.broadcastGameState(gameId, game.state, {
          sbIndex: game.sbIndex,
          bbIndex: game.bbIndex,
        });
        this.sendAssistedInfo(game);
      },

      onPlayerTurn: (game: Game, player: Player, validActions: ValidActions) => {
        const actionTypes = getValidActionTypes(validActions);
        this.connections.send(player.id, {
          type: 'S_YOUR_TURN',
          validActions: actionTypes,
          callAmount: validActions.callAmount,
          minRaise: validActions.minRaise,
          maxRaise: validActions.maxRaise,
          timeoutMs: TURN_TIMEOUT_MS,
        });

        // Set turn timeout
        game.turnTimer = setTimeout(() => {
          game.forceAction(player.id, { action: 'fold' });
        }, TURN_TIMEOUT_MS);
      },

      onBotTurn: (game: Game, player: Player, validActions: ValidActions) => {
        const delay = BOT_DELAY_MIN_MS + Math.random() * (BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS);
        setTimeout(() => {
          if (player.folded || game.state.street === 'waiting' || game.state.street === 'showdown') return;
          if (game.state.activePlayerIndex !== player.seatIndex) return;

          const action = botDecision(
            player.holeCards!,
            game.state.communityCards,
            validActions,
          );
          game.handleAction(player.id, action);
        }, delay);
      },

      onActionTaken: (game: Game, player: Player, action: { action: string; amount?: number }) => {
        this.connections.broadcast(gameId, {
          type: 'S_ACTION_TAKEN',
          playerName: player.name,
          seatIndex: player.seatIndex,
          action: action.action as any,
          amount: action.amount,
        });
      },

      onHandComplete: (game: Game, result: HandResult) => {
        this.connections.broadcast(gameId, {
          type: 'S_HAND_RESULT',
          result,
        });

        // Schedule next hand
        setTimeout(() => {
          game.resetForNextHand();

          // Check if game should continue
          const humans = game.getSeatedPlayers().filter(p => !p.isBot && p.connected);
          if (humans.length === 0) {
            this.removeGame(gameId);
            return;
          }

          // Refill bots
          this.fillWithBots(game);

          if (game.canStartHand()) {
            game.startHand();
          }

          this.connections.broadcastGameState(gameId, game.state);
        }, HAND_START_DELAY_MS);
      },
    };
  }
}
