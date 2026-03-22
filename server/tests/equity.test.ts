import { describe, it, expect } from 'vitest';
import { calculateEquity, calculateOuts, calculateNuts, getCurrentHandName, buildAssistedInfo } from '../src/equity.js';
import type { Card } from 'shared';

function cards(strs: string[]): Card[] {
  return strs.map(s => ({ rank: s[0] as Card['rank'], suit: s[1] as Card['suit'] }));
}

function hole(strs: string[]): [Card, Card] {
  return cards(strs) as [Card, Card];
}

describe('calculateEquity', () => {
  it('AA vs 1 opponent has ~80%+ equity', () => {
    const equity = calculateEquity(hole(['Ah', 'Ad']), [], 1, 2000);
    expect(equity).toBeGreaterThan(75);
    expect(equity).toBeLessThan(95);
  });

  it('72o vs 1 opponent has low equity', () => {
    const equity = calculateEquity(hole(['7h', '2d']), [], 1, 2000);
    expect(equity).toBeLessThan(45);
  });

  it('equity with community cards', () => {
    // AK on AKQ board should be very strong
    const equity = calculateEquity(
      hole(['Ah', 'Kd']),
      cards(['As', 'Kc', 'Qh']),
      1,
      2000,
    );
    expect(equity).toBeGreaterThan(80);
  });

  it('returns a number between 0 and 100', () => {
    const equity = calculateEquity(hole(['Th', '9h']), [], 1, 500);
    expect(equity).toBeGreaterThanOrEqual(0);
    expect(equity).toBeLessThanOrEqual(100);
  });
});

describe('calculateOuts', () => {
  it('flush draw has ~9 outs', () => {
    const outs = calculateOuts(
      hole(['Ah', 'Kh']),
      cards(['Qh', '7h', '2d']),
    );
    // Should have flush outs
    const flushOuts = outs.find(o => o.description.includes('flush'));
    expect(flushOuts).toBeDefined();
    expect(flushOuts!.count).toBe(9);
  });

  it('returns empty for preflop', () => {
    const outs = calculateOuts(hole(['Ah', 'Kh']), []);
    expect(outs).toHaveLength(0);
  });

  it('returns empty for river', () => {
    const outs = calculateOuts(
      hole(['Ah', 'Kh']),
      cards(['2d', '3c', '4s', '5h', '6d']),
    );
    expect(outs).toHaveLength(0);
  });
});

describe('calculateNuts', () => {
  it('identifies the nuts on a board', () => {
    const nuts = calculateNuts(cards(['Ah', 'Kh', 'Qh']));
    expect(nuts).toBeTruthy();
    // On AhKhQh board, nuts should be a straight flush or royal flush
    expect(nuts.toLowerCase()).toContain('flush');
  });

  it('returns N/A preflop', () => {
    expect(calculateNuts([])).toBe('N/A');
  });
});

describe('getCurrentHandName', () => {
  it('describes pocket pair preflop', () => {
    const name = getCurrentHandName(hole(['Ah', 'Ad']), []);
    expect(name).toContain('aces');
  });

  it('describes suited connectors preflop', () => {
    const name = getCurrentHandName(hole(['Th', '9h']), []);
    expect(name).toContain('suited');
  });

  it('describes hand with community cards', () => {
    const name = getCurrentHandName(
      hole(['Ah', 'Kd']),
      cards(['As', '7c', '2h']),
    );
    expect(name).toContain('pair');
  });
});

describe('buildAssistedInfo', () => {
  it('returns complete assisted info', () => {
    const info = buildAssistedInfo(
      hole(['Ah', 'Kh']),
      cards(['Qh', '7h', '2d']),
      1,
    );

    expect(info.equity).toBeGreaterThan(0);
    expect(info.equity).toBeLessThanOrEqual(100);
    expect(info.currentHandName).toBeTruthy();
    expect(info.nuts).toBeTruthy();
    expect(Array.isArray(info.outs)).toBe(true);
  });
});
