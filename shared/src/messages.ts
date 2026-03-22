import type { ActionType, AssistedInfo, Card, GameSummary, HandResult, Player, PlayerMode, Pot, Street } from './types.js';

// ── Client → Server ──

export interface C_JoinLobby {
  type: 'C_JOIN_LOBBY';
  playerName: string;
  mode: PlayerMode;
}

export interface C_CreateGame {
  type: 'C_CREATE_GAME';
}

export interface C_JoinGame {
  type: 'C_JOIN_GAME';
  gameId: string;
}

export interface C_PlayerAction {
  type: 'C_PLAYER_ACTION';
  action: ActionType;
  amount?: number;
}

export interface C_Rebuy {
  type: 'C_REBUY';
}

export interface C_StartGame {
  type: 'C_START_GAME';
}

export interface C_LeaveGame {
  type: 'C_LEAVE_GAME';
}

export type ClientMessage =
  | C_JoinLobby
  | C_CreateGame
  | C_JoinGame
  | C_StartGame
  | C_PlayerAction
  | C_Rebuy
  | C_LeaveGame;

// ── Server → Client ──

export interface S_LobbyState {
  type: 'S_LOBBY_STATE';
  games: GameSummary[];
}

export interface RedactedPlayer {
  id: string;
  name: string;
  chips: number;
  holeCards: [Card, Card] | null; // null for other players, visible for self & at showdown
  bet: number;
  folded: boolean;
  allIn: boolean;
  isBot: boolean;
  mode: PlayerMode;
  seatIndex: number;
  connected: boolean;
}

export interface S_GameState {
  type: 'S_GAME_STATE';
  gameId: string;
  players: (RedactedPlayer | null)[];
  communityCards: Card[];
  pots: Pot[];
  street: Street;
  dealerIndex: number;
  sbIndex: number;
  bbIndex: number;
  activePlayerIndex: number;
}

export interface S_YourTurn {
  type: 'S_YOUR_TURN';
  validActions: ActionType[];
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  timeoutMs: number;
}

export interface S_AssistedInfo {
  type: 'S_ASSISTED_INFO';
  info: AssistedInfo;
}

export interface S_HandResult {
  type: 'S_HAND_RESULT';
  result: HandResult;
}

export interface S_Error {
  type: 'S_ERROR';
  message: string;
}

export interface S_Welcome {
  type: 'S_WELCOME';
  playerId: string;
}

export interface S_ActionTaken {
  type: 'S_ACTION_TAKEN';
  playerName: string;
  seatIndex: number;
  action: ActionType;
  amount?: number;
}

export interface S_PlayerJoined {
  type: 'S_PLAYER_JOINED';
  playerName: string;
  seatIndex: number;
}

export interface S_PlayerLeft {
  type: 'S_PLAYER_LEFT';
  playerName: string;
  seatIndex: number;
}

export type ServerMessage =
  | S_LobbyState
  | S_GameState
  | S_YourTurn
  | S_AssistedInfo
  | S_HandResult
  | S_Error
  | S_Welcome
  | S_ActionTaken
  | S_PlayerJoined
  | S_PlayerLeft;
