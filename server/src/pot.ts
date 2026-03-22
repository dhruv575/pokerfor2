import type { Pot } from 'shared';

/**
 * Calculate pots from player bets, handling side pots for all-ins.
 */
export function calculatePots(
  playerBets: { id: string; bet: number; folded: boolean; allIn: boolean }[]
): Pot[] {
  const activePlayers = playerBets.filter(p => !p.folded);
  if (activePlayers.length === 0) return [];

  // Sort all-in amounts to determine side pot boundaries
  const allInAmounts = [...new Set(
    activePlayers
      .filter(p => p.allIn)
      .map(p => p.bet)
  )].sort((a, b) => a - b);

  const pots: Pot[] = [];
  let previousLevel = 0;

  for (const level of allInAmounts) {
    if (level <= previousLevel) continue;
    const contribution = level - previousLevel;
    let potAmount = 0;
    const eligible: string[] = [];

    for (const p of playerBets) {
      const playerContribution = Math.min(p.bet - previousLevel, contribution);
      if (playerContribution > 0) {
        potAmount += playerContribution;
      }
      if (!p.folded && p.bet >= level) {
        eligible.push(p.id);
      }
    }

    if (potAmount > 0) {
      pots.push({ amount: potAmount, eligible });
    }
    previousLevel = level;
  }

  // Remaining bets above the highest all-in (or all bets if no all-ins)
  const maxAllIn = allInAmounts.length > 0 ? allInAmounts[allInAmounts.length - 1] : 0;
  let remainingPot = 0;
  const remainingEligible: string[] = [];

  for (const p of playerBets) {
    const contributed = Math.max(0, p.bet - maxAllIn);
    remainingPot += contributed;
    if (!p.folded && (allInAmounts.length === 0 || !p.allIn)) {
      remainingEligible.push(p.id);
    }
  }

  if (remainingPot > 0 && remainingEligible.length > 0) {
    pots.push({ amount: remainingPot, eligible: remainingEligible });
  }

  return pots;
}
