import type { RedactedPlayer } from 'shared';
import type { SeatAction } from '../hooks/useGameState';
import { Card } from './Card';

interface SeatProps {
  player: RedactedPlayer | null;
  isDealer: boolean;
  isActive: boolean;
  isMe: boolean;
  blind: 'sb' | 'bb' | null;
  seatIndex: number;
  lastAction: SeatAction | null;
}

function formatAction(action: SeatAction): string {
  switch (action.action) {
    case 'fold': return 'FOLD';
    case 'check': return 'CHECK';
    case 'call': return action.amount ? `CALL ${action.amount}` : 'CALL';
    case 'raise': return action.amount ? `RAISE ${action.amount}` : 'RAISE';
    default: return action.action.toUpperCase();
  }
}

function actionClass(action: string): string {
  switch (action) {
    case 'fold': return 'action-badge-fold';
    case 'check': return 'action-badge-check';
    case 'call': return 'action-badge-call';
    case 'raise': return 'action-badge-raise';
    default: return '';
  }
}

export function Seat({ player, isDealer, isActive, isMe, blind, seatIndex, lastAction }: SeatProps) {
  if (!player) {
    return (
      <div className={`seat seat-${seatIndex} seat-empty`}>
        <div className="seat-label">Empty</div>
      </div>
    );
  }

  const classes = [
    'seat',
    `seat-${seatIndex}`,
    isActive ? 'seat-active' : '',
    isMe ? 'seat-me' : '',
    player.folded ? 'seat-folded' : '',
    player.allIn ? 'seat-allin' : '',
    !player.connected && !player.isBot ? 'seat-disconnected' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {/* Position badges: D / SB / BB */}
      <div className="seat-badges">
        {isDealer && <span className="badge badge-dealer">D</span>}
        {blind === 'sb' && <span className="badge badge-sb">SB</span>}
        {blind === 'bb' && <span className="badge badge-bb">BB</span>}
      </div>

      {/* Action badge */}
      {lastAction && (
        <div className={`action-badge ${actionClass(lastAction.action)}`}>
          {formatAction(lastAction)}
        </div>
      )}

      <div className="seat-cards">
        {player.holeCards ? (
          <>
            <Card card={player.holeCards[0]} small />
            <Card card={player.holeCards[1]} small />
          </>
        ) : player.folded ? null : (
          <>
            <Card card={null} faceDown small />
            <Card card={null} faceDown small />
          </>
        )}
      </div>
      <div className="seat-info">
        <div className="seat-name">
          {player.isBot && <span className="seat-bot-tag">BOT</span>}
          {player.name}
        </div>
        <div className="seat-chips">{player.chips}</div>
      </div>
      {player.bet > 0 && (
        <div className="seat-bet">{player.bet}</div>
      )}
      {player.allIn && <div className="seat-status">ALL IN</div>}
    </div>
  );
}
