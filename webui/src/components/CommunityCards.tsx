import type { Card as CardType } from 'shared';
import { Card } from './Card';

interface CommunityCardsProps {
  cards: CardType[];
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  // Always show 5 slots
  const slots = Array.from({ length: 5 }, (_, i) => cards[i] ?? null);

  return (
    <div className="community-cards">
      {slots.map((card, i) => (
        <Card key={i} card={card} faceDown={!card} />
      ))}
    </div>
  );
}
