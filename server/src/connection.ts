import type { WebSocket } from 'ws';
import type { ServerMessage, ClientMessage, RedactedPlayer } from 'shared';
import type { Player, GameState, PlayerMode } from 'shared';

export interface Connection {
  ws: WebSocket;
  playerId: string;
  playerName: string;
  mode: PlayerMode;
  gameId: string | null;
}

export class ConnectionManager {
  private connections = new Map<string, Connection>();
  private wsToId = new Map<WebSocket, string>();

  add(ws: WebSocket, playerId: string, playerName: string, mode: PlayerMode): Connection {
    const conn: Connection = { ws, playerId, playerName, mode, gameId: null };
    this.connections.set(playerId, conn);
    this.wsToId.set(ws, playerId);
    return conn;
  }

  remove(ws: WebSocket): Connection | undefined {
    const playerId = this.wsToId.get(ws);
    if (!playerId) return undefined;
    const conn = this.connections.get(playerId);
    this.wsToId.delete(ws);
    this.connections.delete(playerId);
    return conn;
  }

  getByPlayerId(playerId: string): Connection | undefined {
    return this.connections.get(playerId);
  }

  getByWs(ws: WebSocket): Connection | undefined {
    const id = this.wsToId.get(ws);
    return id ? this.connections.get(id) : undefined;
  }

  getPlayersInGame(gameId: string): Connection[] {
    return [...this.connections.values()].filter(c => c.gameId === gameId);
  }

  send(playerId: string, message: ServerMessage): void {
    const conn = this.connections.get(playerId);
    if (conn && conn.ws.readyState === 1) { // WebSocket.OPEN
      conn.ws.send(JSON.stringify(message));
    }
  }

  broadcast(gameId: string, message: ServerMessage): void {
    for (const conn of this.getPlayersInGame(gameId)) {
      if (conn.ws.readyState === 1) {
        conn.ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Send game state to each player, redacting other players' hole cards.
   */
  broadcastGameState(gameId: string, state: GameState, extra?: { sbIndex: number; bbIndex: number }): void {
    for (const conn of this.getPlayersInGame(gameId)) {
      const redactedPlayers = state.players.map(p => {
        if (!p) return null;
        return redactPlayer(p, conn.playerId, state.street);
      });

      const msg: ServerMessage = {
        type: 'S_GAME_STATE',
        gameId: state.id,
        players: redactedPlayers,
        communityCards: state.communityCards,
        pots: state.pots,
        street: state.street,
        dealerIndex: state.dealerIndex,
        sbIndex: extra?.sbIndex ?? -1,
        bbIndex: extra?.bbIndex ?? -1,
        activePlayerIndex: state.activePlayerIndex,
      };

      if (conn.ws.readyState === 1) {
        conn.ws.send(JSON.stringify(msg));
      }
    }
  }
}

function redactPlayer(player: Player, viewerId: string, street: string): RedactedPlayer {
  const isViewer = player.id === viewerId;
  const isShowdown = street === 'showdown';

  return {
    id: player.id,
    name: player.name,
    chips: player.chips,
    holeCards: (isViewer || isShowdown) && !player.folded ? player.holeCards : null,
    bet: player.bet,
    folded: player.folded,
    allIn: player.allIn,
    isBot: player.isBot,
    mode: player.mode,
    seatIndex: player.seatIndex,
    connected: player.connected,
  };
}
