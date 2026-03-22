import { describe, it, expect } from 'vitest';
import { botDecision, getNextBotName, resetBotNames } from '../src/bot.js';
import type { Card } from 'shared';
import type { ValidActions } from '../src/betting-round.js';

function cards(strs: string[]): [Card, Card] {
  return strs.map(s => ({ rank: s[0] as Card['rank'], suit: s[1] as Card['suit'] })) as [Card, Card];
}

function makeValidActions(overrides: Partial<ValidActions> = {}): ValidActions {
  return {
    canCheck: false,
    canCall: true,
    canRaise: true,
    canFold: true,
    callAmount: 2,
    minRaise: 4,
    maxRaise: 200,
    ...overrides,
  };
}

describe('botDecision', () => {
  it('returns a valid action', () => {
    const action = botDecision(
      cards(['Ah', 'Kh']),
      [],
      makeValidActions(),
    );
    expect(['fold', 'check', 'call', 'raise']).toContain(action.action);
  });

  it('never returns an invalid action type', () => {
    // Run many times to catch probabilistic issues
    for (let i = 0; i < 100; i++) {
      const action = botDecision(
        cards(['2h', '7d']),
        [],
        makeValidActions({ canCheck: false, canCall: true, canRaise: false }),
      );
      // Should only fold or call (no check available, no raise available)
      expect(['fold', 'call']).toContain(action.action);
    }
  });

  it('checks when available and hand is weak', () => {
    let checks = 0;
    for (let i = 0; i < 100; i++) {
      const action = botDecision(
        cards(['2h', '7d']),
        [],
        makeValidActions({ canCheck: true, canCall: false }),
      );
      if (action.action === 'check') checks++;
    }
    // Weak hand should check most of the time
    expect(checks).toBeGreaterThan(50);
  });

  it('strong hands tend to raise', () => {
    let raises = 0;
    for (let i = 0; i < 100; i++) {
      const action = botDecision(
        cards(['Ah', 'Ad']),
        [],
        makeValidActions(),
      );
      if (action.action === 'raise') raises++;
    }
    // AA should raise frequently
    expect(raises).toBeGreaterThan(20);
  });

  it('raise amounts respect min/max', () => {
    for (let i = 0; i < 100; i++) {
      const action = botDecision(
        cards(['Ah', 'Ad']),
        [],
        makeValidActions({ minRaise: 10, maxRaise: 50 }),
      );
      if (action.action === 'raise' && action.amount !== undefined) {
        expect(action.amount).toBeGreaterThanOrEqual(10);
        expect(action.amount).toBeLessThanOrEqual(50);
      }
    }
  });

  it('works with community cards (postflop)', () => {
    const community: Card[] = [
      { rank: 'A', suit: 'h' },
      { rank: 'K', suit: 'h' },
      { rank: 'Q', suit: 'h' },
    ];
    const action = botDecision(
      cards(['Jh', 'Th']),
      community,
      makeValidActions(),
    );
    // Royal flush draw / straight flush — should be aggressive
    expect(['call', 'raise']).toContain(action.action);
  });
});

describe('getNextBotName', () => {
  it('returns different names', () => {
    resetBotNames();
    const name1 = getNextBotName();
    const name2 = getNextBotName();
    expect(name1).not.toBe(name2);
  });

  it('cycles through names', () => {
    resetBotNames();
    const names = new Set<string>();
    for (let i = 0; i < 20; i++) {
      names.add(getNextBotName());
    }
    expect(names.size).toBe(10); // 10 unique bot names
  });
});
