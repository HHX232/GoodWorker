// White-POV centipawns → "+1.3" / "−0.4" / "M3" / "#" (mate scores are ±(100000 − plies), see coachModel).
export function formatEval(cp: number): string {
  if (Math.abs(cp) >= 100000) return '#' // mate already on the board
  if (Math.abs(cp) >= 90000) {
    const moves = Math.ceil((100000 - Math.abs(cp) + 1) / 2)
    return `${cp > 0 ? '' : '−'}M${moves}`
  }
  const v = Math.abs(cp / 100).toFixed(1)
  return cp > 0 ? `+${v}` : cp < 0 ? `−${v}` : '0.0'
}

/** Share of the bar that is White's, 0..1 (logistic, like the usual "win chance" curve). */
export const whiteShare = (cp: number) => 1 / (1 + Math.exp(-0.004 * Math.max(-2000, Math.min(2000, cp))))
