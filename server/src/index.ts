import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import type { ClientMessage } from 'shared';
import { STARTING_STACK } from 'shared';
import { ConnectionManager } from './connection.js';
import { Lobby } from './lobby.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = parseInt(process.env.PORT || '3001', 10);

const connections = new ConnectionManager();
const lobby = new Lobby(connections);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// WebSocket connections
wss.on('connection', (ws) => {
  let playerId: string | null = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;

      switch (message.type) {
        case 'C_JOIN_LOBBY': {
          playerId = crypto.randomUUID();
          connections.add(ws, playerId, message.playerName, message.mode);

          connections.send(playerId, {
            type: 'S_WELCOME',
            playerId,
          });

          connections.send(playerId, {
            type: 'S_LOBBY_STATE',
            games: lobby.listGames(),
          });
          break;
        }

        case 'C_CREATE_GAME': {
          if (!playerId) {
            ws.send(JSON.stringify({ type: 'S_ERROR', message: 'Join lobby first' }));
            break;
          }
          const conn = connections.getByPlayerId(playerId);
          if (!conn) break;

          const game = lobby.createGame();
          game.creatorId = playerId;
          const result = lobby.joinGame(game.state.id, playerId, conn.playerName, conn.mode);
          if (!result.success) {
            connections.send(playerId, { type: 'S_ERROR', message: result.error! });
          }

          broadcastLobbyToAll();
          break;
        }

        case 'C_JOIN_GAME': {
          if (!playerId) {
            ws.send(JSON.stringify({ type: 'S_ERROR', message: 'Join lobby first' }));
            break;
          }
          const conn = connections.getByPlayerId(playerId);
          if (!conn) break;

          const result = lobby.joinGame(message.gameId, playerId, conn.playerName, conn.mode);
          if (!result.success) {
            connections.send(playerId, { type: 'S_ERROR', message: result.error! });
          }

          broadcastLobbyToAll();
          break;
        }

        case 'C_START_GAME': {
          if (!playerId) break;
          const startResult = lobby.startGame(playerId);
          if (!startResult.success) {
            connections.send(playerId, { type: 'S_ERROR', message: startResult.error! });
          }
          broadcastLobbyToAll();
          break;
        }

        case 'C_PLAYER_ACTION': {
          if (!playerId) break;
          const conn = connections.getByPlayerId(playerId);
          if (!conn?.gameId) break;

          const game = lobby.getGame(conn.gameId);
          if (!game) break;

          const result = game.handleAction(playerId, {
            action: message.action,
            amount: message.amount,
          });

          if (!result.valid) {
            connections.send(playerId, { type: 'S_ERROR', message: result.error! });
          }
          break;
        }

        case 'C_REBUY': {
          if (!playerId) break;
          const conn = connections.getByPlayerId(playerId);
          if (!conn?.gameId) break;

          const game = lobby.getGame(conn.gameId);
          if (!game) break;

          const player = game.state.players.find(p => p?.id === playerId);
          if (player && player.chips <= 0 && !player.isBot) {
            player.chips = STARTING_STACK;
            connections.broadcastGameState(conn.gameId, game.state);
          }
          break;
        }

        case 'C_LEAVE_GAME': {
          if (!playerId) break;
          lobby.leaveGame(playerId);
          broadcastLobbyToAll();
          break;
        }
      }
    } catch {
      ws.send(JSON.stringify({ type: 'S_ERROR', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    if (playerId) {
      lobby.leaveGame(playerId);
      connections.remove(ws);
      broadcastLobbyToAll();
    }
  });
});

function broadcastLobbyToAll(): void {
  const games = lobby.listGames();
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      const conn = connections.getByWs(client);
      if (conn && !conn.gameId) {
        client.send(JSON.stringify({ type: 'S_LOBBY_STATE', games }));
      }
    }
  }
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, server, wss, lobby, connections };
