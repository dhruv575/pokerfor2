import type { ClientMessage } from 'shared';
import type { GameView, TurnInfo, SeatAction } from '../hooks/useGameState';
import type { AssistedInfo, HandResult as HandResultType } from 'shared';
import { Seat } from './Seat';
import { CommunityCards } from './CommunityCards';
import { PotDisplay } from './PotDisplay';
import { ActionPanel } from './ActionPanel';
import { HandInfo } from './HandInfo';
import { HandResultOverlay } from './HandResult';

interface TableProps {
  gameView: GameView;
  turnInfo: TurnInfo;
  assistedInfo: AssistedInfo | null;
  handResult: HandResultType | null;
  seatActions: Record<number, SeatAction | null>;
  send: (msg: ClientMessage) => void;
  myPlayerId: string;
  isCreator: boolean;
  clearHandResult: () => void;
  clearTurn: () => void;
}

export function Table({
  gameView,
  turnInfo,
  assistedInfo,
  handResult,
  seatActions,
  send,
  myPlayerId,
  isCreator,
  clearHandResult,
  clearTurn,
}: TableProps) {
  const { players, communityCards, pots, dealerIndex, sbIndex, bbIndex, activePlayerIndex, street } = gameView;

  const myIndex = players.findIndex(p => p?.id === myPlayerId);
  const myPlayer = myIndex >= 0 ? players[myIndex] : null;
  const isAssisted = myPlayer?.mode === 'assisted';
  const isFolded = myPlayer?.folded ?? false;

  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0)
    + players.reduce((sum, p) => sum + (p?.bet ?? 0), 0);

  const isBusted = myPlayer && myPlayer.chips <= 0 && street === 'waiting';

  return (
    <div className="table-container">
      <div className="table-header">
        <button
          className="btn btn-leave"
          onClick={() => send({ type: 'C_LEAVE_GAME' })}
        >
          Leave
        </button>
        <span className="table-street">{street.toUpperCase()}</span>
      </div>

      <div className="table-body">
        {/* Action panel — always visible, left side */}
        <ActionPanel
          turnInfo={turnInfo}
          send={send}
          totalPot={totalPot}
          folded={isFolded}
          onAction={clearTurn}
        />

        {/* Table area */}
        <div className="poker-table">
          <div className="table-felt">
            {players.map((player, i) => (
              <Seat
                key={i}
                player={player}
                isDealer={i === dealerIndex}
                isActive={i === activePlayerIndex}
                isMe={player?.id === myPlayerId}
                blind={i === sbIndex ? 'sb' : i === bbIndex ? 'bb' : null}
                seatIndex={i}
                lastAction={seatActions[i] ?? null}
              />
            ))}

            <div className="table-center">
              <PotDisplay pots={pots} />
              <CommunityCards cards={communityCards} />
            </div>
          </div>

          {/* Assisted mode — floating top-right */}
          {isAssisted && assistedInfo && (
            <HandInfo info={assistedInfo} />
          )}
        </div>
      </div>

      {/* Start game button for creator */}
      {isCreator && street === 'waiting' && (
        <div className="start-game-prompt">
          <p>Waiting for players — {players.filter(p => p && !p.isBot).length} seated</p>
          <button
            className="btn"
            onClick={() => send({ type: 'C_START_GAME' })}
          >
            Start Game
          </button>
        </div>
      )}

      {/* Rebuy prompt */}
      {isBusted && (
        <div className="rebuy-prompt">
          <p>Out of chips</p>
          <button
            className="btn btn-primary"
            onClick={() => send({ type: 'C_REBUY' })}
          >
            Rebuy — 200 chips
          </button>
        </div>
      )}

      <HandResultOverlay result={handResult} onDismiss={clearHandResult} />
    </div>
  );
}
