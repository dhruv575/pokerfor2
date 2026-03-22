import { useEffect, useState } from 'react';
import type { ClientMessage } from 'shared';
import type { TurnInfo } from '../hooks/useGameState';

interface ActionPanelProps {
  turnInfo: TurnInfo;
  send: (msg: ClientMessage) => void;
  totalPot: number;
  folded: boolean;
  onAction: () => void;
}

export function ActionPanel({ turnInfo, send, totalPot, folded, onAction }: ActionPanelProps) {
  const { isMyTurn, validActions, callAmount, minRaise, maxRaise } = turnInfo;
  const active = isMyTurn && !folded;

  // Default raise to the minimum legal raise (already 2x the current bet from server)
  const [raiseAmount, setRaiseAmount] = useState(minRaise);

  // Update raise default when turn info changes
  useEffect(() => {
    if (isMyTurn) {
      setRaiseAmount(minRaise);
    }
  }, [isMyTurn, minRaise]);

  const canFold = active && validActions.includes('fold');
  const canCheck = active && validActions.includes('check');
  const canCall = active && validActions.includes('call');
  const canRaise = active && validActions.includes('raise');

  const handleAction = (action: 'fold' | 'check' | 'call') => {
    send({ type: 'C_PLAYER_ACTION', action });
    onAction();
  };

  const handleRaise = () => {
    send({ type: 'C_PLAYER_ACTION', action: 'raise', amount: raiseAmount });
    onAction();
  };

  const presets = active ? [
    { label: 'Min', amount: minRaise },
    { label: '3x', amount: Math.round(minRaise * 1.5) },
    { label: 'Pot', amount: Math.max(minRaise, totalPot) },
    { label: 'All In', amount: maxRaise },
  ].filter(p => p.amount <= maxRaise && p.amount >= minRaise) : [];

  return (
    <div className={`action-panel ${active ? 'action-panel-active' : ''} ${folded ? 'action-panel-folded' : ''}`}>
      {folded && <div className="action-panel-label">Folded</div>}
      {!folded && !active && <div className="action-panel-label">Waiting...</div>}
      {active && <div className="action-panel-label">Your Action</div>}

      <div className="action-buttons">
        <button className="btn btn-fold" disabled={!canFold} onClick={() => handleAction('fold')}>
          Fold
        </button>
        <button
          className={`btn ${canCheck ? 'btn-check' : 'btn-call'}`}
          disabled={!canCheck && !canCall}
          onClick={() => handleAction(canCheck ? 'check' : 'call')}
        >
          {canCheck ? 'Check' : `Call ${callAmount || ''}`}
        </button>
        <button className="btn btn-raise" disabled={!canRaise} onClick={handleRaise}>
          Raise {active ? raiseAmount : ''}
        </button>
      </div>

      <div className={`raise-controls ${!canRaise ? 'raise-disabled' : ''}`}>
        <input
          type="range"
          min={minRaise || 0}
          max={maxRaise || 1}
          value={raiseAmount}
          onChange={(e) => setRaiseAmount(Number(e.target.value))}
          disabled={!canRaise}
          className="raise-slider"
        />
        <div className="raise-presets">
          {presets.map(p => (
            <button
              key={p.label}
              className="btn btn-preset"
              disabled={!canRaise}
              onClick={() => setRaiseAmount(Math.min(p.amount, maxRaise))}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
