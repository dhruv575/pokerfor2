import type { AssistedInfo } from 'shared';

interface HandInfoProps {
  info: AssistedInfo | null;
}

function equityColor(equity: number): string {
  if (equity >= 65) return '#4ade80';
  if (equity >= 40) return '#facc15';
  return '#f87171';
}

export function HandInfo({ info }: HandInfoProps) {
  if (!info) return null;

  return (
    <div className="hand-info">
      {/* Equity — the hero number */}
      <div className="hand-info-equity">
        <span className="equity-number" style={{ color: equityColor(info.equity) }}>
          {Math.round(info.equity)}
        </span>
        <span className="equity-percent" style={{ color: equityColor(info.equity) }}>%</span>
        <span className="equity-label">equity</span>
      </div>

      {/* Divider */}
      <div className="hand-info-divider" />

      {/* Current hand */}
      <div className="hand-info-section">
        <span className="hand-info-section-label">Hand</span>
        <span className="hand-info-section-value">{info.currentHandName}</span>
      </div>

      {/* Outs */}
      {info.outs.length > 0 && (
        <div className="hand-info-section">
          <span className="hand-info-section-label">Outs</span>
          {info.outs.map((out, i) => (
            <div key={i} className="hand-info-out">
              <span className="out-count">{out.count}</span>
              <span className="out-desc">{out.description.replace(/ \(\d+ outs\)/, '')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Nuts */}
      <div className="hand-info-section">
        <span className="hand-info-section-label">Nuts</span>
        <span className="hand-info-section-value hand-info-nuts">{info.nuts}</span>
      </div>
    </div>
  );
}
