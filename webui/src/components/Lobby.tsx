import { useState } from 'react';
import type { PlayerMode, GameSummary } from 'shared';

interface LobbyProps {
  games: GameSummary[];
  connected: boolean;
  joined: boolean;
  onJoinLobby: (name: string, mode: PlayerMode) => void;
  onCreateGame: () => void;
  onJoinGame: (gameId: string) => void;
}

export function Lobby({ games, connected, joined, onJoinLobby, onCreateGame, onJoinGame }: LobbyProps) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<PlayerMode>('normal');

  if (!connected) {
    return (
      <div className="lobby">
        <div className="lobby-entrance">
          <div className="lobby-brand">
            <div className="brand-icon">
              <span className="brand-suits">
                <span className="suit-red">{'\u2665'}</span>
                <span className="suit-blk">{'\u2660'}</span>
              </span>
            </div>
            <h1>Poker for 2</h1>
          </div>
          <p className="connecting">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="lobby">
        <div className="lobby-entrance">
          <div className="lobby-brand">
            <div className="brand-icon">
              <span className="brand-suits">
                <span className="suit-red">{'\u2665'}</span>
                <span className="suit-blk">{'\u2660'}</span>
              </span>
            </div>
            <h1>Poker for 2</h1>
            <p className="subtitle">Texas Hold'em — Learn & Play</p>
          </div>

          <div className="entrance-form">
            <div className="form-group">
              <label htmlFor="name">Display Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) onJoinLobby(name.trim(), mode);
                }}
                placeholder="What should we call you?"
                maxLength={20}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Play Mode</label>
              <div className="mode-select">
                <button
                  className={`mode-btn ${mode === 'normal' ? 'mode-active' : ''}`}
                  onClick={() => setMode('normal')}
                >
                  <div className="mode-btn-header">
                    <strong>Normal</strong>
                    <span className="mode-check">{mode === 'normal' ? '\u2713' : ''}</span>
                  </div>
                  <span>Standard poker — no hints</span>
                </button>
                <button
                  className={`mode-btn ${mode === 'assisted' ? 'mode-active' : ''}`}
                  onClick={() => setMode('assisted')}
                >
                  <div className="mode-btn-header">
                    <strong>Assisted</strong>
                    <span className="mode-check">{mode === 'assisted' ? '\u2713' : ''}</span>
                  </div>
                  <span>See equity, outs & best hand</span>
                </button>
              </div>
            </div>

            <button
              className="btn btn-enter"
              disabled={!name.trim()}
              onClick={() => onJoinLobby(name.trim(), mode)}
            >
              Enter Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby">
      <div className="lobby-browser">
        <div className="browser-header">
          <h2>Games</h2>
          <button className="btn btn-create" onClick={onCreateGame}>
            + New Game
          </button>
        </div>

        {games.length > 0 ? (
          <div className="game-list">
            {games.map((game) => (
              <div key={game.id} className="game-item">
                <div className="game-info">
                  <span className="game-id">{game.id}</span>
                  <div className="game-meta">
                    <span className="game-players">{game.playerCount}/6 players</span>
                    <span className={`game-status game-status-${game.status}`}>
                      {game.status}
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-join"
                  onClick={() => onJoinGame(game.id)}
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-games">
            <p>No open games yet</p>
            <span>Create one to get started</span>
          </div>
        )}
      </div>
    </div>
  );
}
