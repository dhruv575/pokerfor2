import type { Card as CardType } from 'shared';

const SUIT_SYMBOLS: Record<string, string> = {
  h: '\u2665',
  d: '\u2666',
  c: '\u2663',
  s: '\u2660',
};

const SUIT_COLORS: Record<string, string> = {
  h: '#d4333f',
  d: '#d4333f',
  c: '#1a1a1a',
  s: '#1a1a1a',
};

const RANK_DISPLAY: Record<string, string> = {
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

interface CardProps {
  card: CardType | null;
  faceDown?: boolean;
  small?: boolean;
}

export function Card({ card, faceDown, small }: CardProps) {
  if (!card || faceDown) {
    return (
      <div className={`card card-back ${small ? 'card-small' : ''}`}>
        <div className="card-back-pattern" />
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit];
  const rank = RANK_DISPLAY[card.rank] ?? card.rank;
  const suit = SUIT_SYMBOLS[card.suit];

  return (
    <div className={`card ${small ? 'card-small' : ''}`} style={{ color }}>
      <span className="card-rank">{rank}</span>
      <span className="card-suit">{suit}</span>
    </div>
  );
}
