import { describe, it, expect } from 'vitest';
import { calculatePots } from '../src/pot.js';

describe('calculatePots', () => {
  it('single pot - no all-ins', () => {
    const pots = calculatePots([
      { id: 'a', bet: 10, folded: false, allIn: false },
      { id: 'b', bet: 10, folded: false, allIn: false },
      { id: 'c', bet: 10, folded: false, allIn: false },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(30);
    expect(pots[0].eligible).toEqual(['a', 'b', 'c']);
  });

  it('single pot with a fold', () => {
    const pots = calculatePots([
      { id: 'a', bet: 10, folded: false, allIn: false },
      { id: 'b', bet: 10, folded: false, allIn: false },
      { id: 'c', bet: 5, folded: true, allIn: false },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(25);
    expect(pots[0].eligible).toEqual(['a', 'b']);
  });

  it('side pot when one player is all-in for less', () => {
    const pots = calculatePots([
      { id: 'a', bet: 50, folded: false, allIn: true },
      { id: 'b', bet: 100, folded: false, allIn: false },
      { id: 'c', bet: 100, folded: false, allIn: false },
    ]);
    expect(pots).toHaveLength(2);
    // Main pot: 50 * 3 = 150
    expect(pots[0].amount).toBe(150);
    expect(pots[0].eligible).toContain('a');
    expect(pots[0].eligible).toContain('b');
    expect(pots[0].eligible).toContain('c');
    // Side pot: 50 * 2 = 100
    expect(pots[1].amount).toBe(100);
    expect(pots[1].eligible).not.toContain('a');
    expect(pots[1].eligible).toContain('b');
    expect(pots[1].eligible).toContain('c');
  });

  it('multiple side pots with multiple all-ins', () => {
    const pots = calculatePots([
      { id: 'a', bet: 20, folded: false, allIn: true },
      { id: 'b', bet: 50, folded: false, allIn: true },
      { id: 'c', bet: 100, folded: false, allIn: false },
    ]);
    expect(pots).toHaveLength(3);
    // Main pot: 20 * 3 = 60 (a, b, c eligible)
    expect(pots[0].amount).toBe(60);
    expect(pots[0].eligible.sort()).toEqual(['a', 'b', 'c']);
    // Side pot 1: 30 * 2 = 60 (b, c eligible)
    expect(pots[1].amount).toBe(60);
    expect(pots[1].eligible.sort()).toEqual(['b', 'c']);
    // Side pot 2: 50 * 1 = 50 (c eligible)
    expect(pots[2].amount).toBe(50);
    expect(pots[2].eligible).toEqual(['c']);
  });

  it('folded player contributes to pot but is not eligible', () => {
    const pots = calculatePots([
      { id: 'a', bet: 50, folded: false, allIn: true },
      { id: 'b', bet: 30, folded: true, allIn: false },
      { id: 'c', bet: 100, folded: false, allIn: false },
    ]);
    // Main pot includes a's 50, c's first 50, b's 30
    expect(pots[0].amount).toBe(130);
    expect(pots[0].eligible).toContain('a');
    expect(pots[0].eligible).toContain('c');
    expect(pots[0].eligible).not.toContain('b');
  });
});
