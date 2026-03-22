import { useState, useCallback } from 'react';
import type { PlayerMode } from 'shared';
import { useWebSocket } from './hooks/useWebSocket';
import { useGameState } from './hooks/useGameState';
import { Lobby } from './components/Lobby';
import { Table } from './components/Table';
import './App.css';

const WS_URL = import.meta.env.VITE_WS_URL
  || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

function App() {
  const { send, lastMessage, connected } = useWebSocket(WS_URL);
  const {
    screen,
    playerId,
    lobbyGames,
    gameView,
    turnInfo,
    assistedInfo,
    handResult,
    seatActions,
    error,
    clearError,
    clearHandResult,
    clearTurn,
  } = useGameState(lastMessage);

  const [joined, setJoined] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  const handleJoinLobby = useCallback((name: string, mode: PlayerMode) => {
    send({ type: 'C_JOIN_LOBBY', playerName: name, mode });
    setJoined(true);
  }, [send]);

  const handleCreateGame = useCallback(() => {
    send({ type: 'C_CREATE_GAME' });
    setIsCreator(true);
  }, [send]);

  const handleJoinGame = useCallback((gameId: string) => {
    send({ type: 'C_JOIN_GAME', gameId });
    setIsCreator(false);
  }, [send]);

  return (
    <div className="app">
      {error && (
        <div className="error-toast" onClick={clearError}>
          {error}
        </div>
      )}
      {screen === 'lobby' || !gameView ? (
        <Lobby
          games={lobbyGames}
          connected={connected}
          joined={joined}
          onJoinLobby={handleJoinLobby}
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
        />
      ) : (
        <Table
          gameView={gameView}
          turnInfo={turnInfo}
          assistedInfo={assistedInfo}
          handResult={handResult}
          seatActions={seatActions}
          send={send}
          myPlayerId={playerId}
          isCreator={isCreator}
          clearHandResult={clearHandResult}
          clearTurn={clearTurn}
        />
      )}
    </div>
  );
}

export default App;
