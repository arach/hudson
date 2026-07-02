'use client';

import { useExplorer } from './IntentProvider';
import { IntentFloatingCard } from './IntentFloatingCard';

export function IntentFloatingLayer() {
  const {
    catalog,
    floatingCards,
    cardPositions,
    handleCardDragStart,
    removeFloatingCard,
    bringCardToFront,
  } = useExplorer();

  if (floatingCards.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {floatingCards.map(card => {
        const entry = catalog.index[card.intentId];
        if (!entry) return null;

        const pos = cardPositions[card.id] ?? { x: 80, y: 60 };

        return (
          <div key={card.id} className="pointer-events-auto">
            <IntentFloatingCard
              intent={entry.intent}
              appId={entry.appId}
              zIndex={card.zIndex}
              position={pos}
              onDragStart={(e) => handleCardDragStart(card.id, e)}
              onClose={() => removeFloatingCard(card.id)}
              onFocus={() => bringCardToFront(card.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
