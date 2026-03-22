import { describe, it, expect, beforeEach } from 'vitest';
import { Lobby } from '../src/lobby.js';
import { ConnectionManager } from '../src/connection.js';
import { MAX_SEATS } from 'shared';

// Mock WebSocket
function mockWs(): any {
  return {
    readyState: 1,
    send: () => {},
  };
}

describe('Lobby', () => {
  let connections: ConnectionManager;
  let lobby: Lobby;

  beforeEach(() => {
    connections = new ConnectionManager();
    lobby = new Lobby(connections);
  });

  it('creates a game', () => {
    const game = lobby.createGame();
    expect(game).toBeDefined();
    expect(game.state.id).toBeTruthy();
  });

  it('lists games', () => {
    lobby.createGame();
    lobby.createGame();
    const games = lobby.listGames();
    expect(games).toHaveLength(2);
  });

  it('joins a game', () => {
    const ws = mockWs();
    connections.add(ws, 'p1', 'Alice', 'normal');

    const game = lobby.createGame();
    const result = lobby.joinGame(game.state.id, 'p1', 'Alice', 'normal');
    expect(result.success).toBe(true);

    const players = game.getSeatedPlayers();
    expect(players.length).toBeGreaterThanOrEqual(1);
    expect(players.some(p => p.id === 'p1')).toBe(true);
  });

  it('fills empty seats with bots when game is started', () => {
    const ws = mockWs();
    connections.add(ws, 'p1', 'Alice', 'normal');

    const game = lobby.createGame();
    game.creatorId = 'p1';
    lobby.joinGame(game.state.id, 'p1', 'Alice', 'normal');

    // Bots should NOT be filled yet
    expect(game.getSeatedPlayers().length).toBe(1);

    // Start the game
    const result = lobby.startGame('p1');
    expect(result.success).toBe(true);

    // Now bots should be filled
    const players = game.getSeatedPlayers();
    expect(players.length).toBe(MAX_SEATS);
    expect(players.filter(p => p.isBot).length).toBe(MAX_SEATS - 1);
  });

  it('only creator can start the game', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    connections.add(ws1, 'p1', 'Alice', 'normal');
    connections.add(ws2, 'p2', 'Bob', 'normal');

    const game = lobby.createGame();
    game.creatorId = 'p1';
    lobby.joinGame(game.state.id, 'p1', 'Alice', 'normal');
    lobby.joinGame(game.state.id, 'p2', 'Bob', 'normal');

    const result = lobby.startGame('p2');
    expect(result.success).toBe(false);
    expect(result.error).toContain('creator');
  });

  it('rejects joining a non-existent game', () => {
    const ws = mockWs();
    connections.add(ws, 'p1', 'Alice', 'normal');
    const result = lobby.joinGame('fake-id', 'p1', 'Alice', 'normal');
    expect(result.success).toBe(false);
  });

  it('removes a game when all humans leave', () => {
    const ws = mockWs();
    connections.add(ws, 'p1', 'Alice', 'normal');

    const game = lobby.createGame();
    lobby.joinGame(game.state.id, 'p1', 'Alice', 'normal');

    expect(lobby.listGames()).toHaveLength(1);

    lobby.leaveGame('p1');
    expect(lobby.listGames()).toHaveLength(0);
  });

  it('allows multiple humans to join', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    connections.add(ws1, 'p1', 'Alice', 'normal');
    connections.add(ws2, 'p2', 'Bob', 'assisted');

    const game = lobby.createGame();
    lobby.joinGame(game.state.id, 'p1', 'Alice', 'normal');
    lobby.joinGame(game.state.id, 'p2', 'Bob', 'assisted');

    const humans = game.getSeatedPlayers().filter(p => !p.isBot);
    expect(humans).toHaveLength(2);
    expect(humans.find(p => p.mode === 'assisted')).toBeDefined();
  });
});
