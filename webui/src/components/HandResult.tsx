import type { HandResult as HandResultType } from 'shared';

interface HandResultProps {
  result: HandResultType | null;
  onDismiss: () => void;
}

export function HandResultOverlay({ result, onDismiss }: HandResultProps) {
  if (!result) return null;

  return (
    <div className="hand-result-overlay" onClick={onDismiss}>
      <div className="hand-result" onClick={e => e.stopPropagation()}>
        <h3>Hand Complete</h3>
        <div className="winners">
          {result.winners.map((w, i) => (
            <div key={i} className="winner-row">
              <span className="winner-name">{w.id}</span>
              <span className="winner-hand">{w.hand}</span>
              <span className="winner-amount">+{w.amount}</span>
            </div>
          ))}
        </div>
        {result.showdown.length > 0 && (
          <div className="showdown">
            <h4>Showdown</h4>
            {result.showdown.map((s, i) => (
              <div key={i} className="showdown-row">
                <span>{s.id}</span>
                <span>{s.cards.map(c => `${c.rank}${c.suit}`).join(' ')}</span>
                <span>{s.handName}</span>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-dismiss" onClick={onDismiss}>OK</button>
      </div>
    </div>
  );
}
