import type { Pot } from 'shared';

interface PotDisplayProps {
  pots: Pot[];
}

export function PotDisplay({ pots }: PotDisplayProps) {
  const total = pots.reduce((sum, p) => sum + p.amount, 0);
  if (total === 0) return null;

  return (
    <div className="pot-display">
      <div className="pot-total">
        Pot: {total}
      </div>
      {pots.length > 1 && (
        <div className="pot-breakdown">
          {pots.map((pot, i) => (
            <span key={i} className="pot-side">
              {i === 0 ? 'Main' : `Side ${i}`}: {pot.amount}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
