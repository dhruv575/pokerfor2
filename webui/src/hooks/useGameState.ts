import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ServerMessage,
  S_GameState,
  S_YourTurn,
  S_AssistedInfo,
  S_HandResult,
  S_LobbyState,
  S_Welcome,
  S_ActionTaken,
  GameSummary,
  RedactedPlayer,
  Card,
  Pot,
  Street,
  ActionType,
  AssistedInfo,
  HandResult,
} from 'shared';

export interface SeatAction {
  action: string;
  amount?: number;
  timestamp: number;
}

export interface GameView {
  gameId: string | null;
  players: (RedactedPlayer | null)[];
  communityCards: Card[];
  pots: Pot[];
  street: Street;
  dealerIndex: number;
  sbIndex: number;
  bbIndex: number;
  activePlayerIndex: number;
}

export interface TurnInfo {
  isMyTurn: boolean;
  validActions: ActionType[];
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  timeoutMs: number;
}

export interface UseGameStateReturn {
  screen: 'lobby' | 'game';
  playerId: string;
  lobbyGames: GameSummary[];
  gameView: GameView | null;
  turnInfo: TurnInfo;
  assistedInfo: AssistedInfo | null;
  handResult: HandResult | null;
  seatActions: Record<number, SeatAction | null>;
  error: string | null;
  clearError: () => void;
  clearHandResult: () => void;
  clearTurn: () => void;
}

export function useGameState(lastMessage: ServerMessage | null): UseGameStateReturn {
  const [screen, setScreen] = useState<'lobby' | 'game'>('lobby');
  const [playerId, setPlayerId] = useState('');
  const [lobbyGames, setLobbyGames] = useState<GameSummary[]>([]);
  const [gameView, setGameView] = useState<GameView | null>(null);
  const [turnInfo, setTurnInfo] = useState<TurnInfo>({
    isMyTurn: false,
    validActions: [],
    callAmount: 0,
    minRaise: 0,
    maxRaise: 0,
    timeoutMs: 0,
  });
  const [assistedInfo, setAssistedInfo] = useState<AssistedInfo | null>(null);
  const [handResult, setHandResult] = useState<HandResult | null>(null);
  const [seatActions, setSeatActions] = useState<Record<number, SeatAction | null>>({});
  const [error, setError] = useState<string | null>(null);
  const actionTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const clearError = useCallback(() => setError(null), []);
  const clearHandResult = useCallback(() => setHandResult(null), []);
  const clearTurn = useCallback(() => setTurnInfo(prev => ({ ...prev, isMyTurn: false })), []);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'S_WELCOME': {
        const msg = lastMessage as S_Welcome;
        setPlayerId(msg.playerId);
        break;
      }

      case 'S_LOBBY_STATE': {
        const msg = lastMessage as S_LobbyState;
        setLobbyGames(msg.games);
        break;
      }

      case 'S_GAME_STATE': {
        const msg = lastMessage as S_GameState;
        setScreen('game');
        setGameView({
          gameId: msg.gameId,
          players: msg.players,
          communityCards: msg.communityCards,
          pots: msg.pots,
          street: msg.street,
          dealerIndex: msg.dealerIndex,
          sbIndex: msg.sbIndex,
          bbIndex: msg.bbIndex,
          activePlayerIndex: msg.activePlayerIndex,
        });
        break;
      }

      case 'S_YOUR_TURN': {
        const msg = lastMessage as S_YourTurn;
        setTurnInfo({
          isMyTurn: true,
          validActions: msg.validActions,
          callAmount: msg.callAmount,
          minRaise: msg.minRaise,
          maxRaise: msg.maxRaise,
          timeoutMs: msg.timeoutMs,
        });
        break;
      }

      case 'S_ASSISTED_INFO': {
        const msg = lastMessage as S_AssistedInfo;
        setAssistedInfo(msg.info);
        break;
      }

      case 'S_HAND_RESULT': {
        const msg = lastMessage as S_HandResult;
        setHandResult(msg.result);
        setTurnInfo(prev => ({ ...prev, isMyTurn: false }));
        break;
      }

      case 'S_ACTION_TAKEN': {
        const msg = lastMessage as S_ActionTaken;
        const seat = msg.seatIndex;
        setSeatActions(prev => ({
          ...prev,
          [seat]: { action: msg.action, amount: msg.amount, timestamp: Date.now() },
        }));
        // Clear after 2.5 seconds
        if (actionTimers.current[seat]) clearTimeout(actionTimers.current[seat]);
        actionTimers.current[seat] = setTimeout(() => {
          setSeatActions(prev => ({ ...prev, [seat]: null }));
        }, 2500);
        break;
      }

      case 'S_ERROR': {
        setError(lastMessage.message);
        break;
      }

      case 'S_PLAYER_LEFT': {
        // If we left, go back to lobby
        break;
      }
    }
  }, [lastMessage]);

  return {
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
  };
}
