export function getNodeHeaderIconColor(hex: string): string | undefined {
  const clean = hex.replace('#', '')
  if (clean.length < 6) return undefined
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (luminance < 0.35) return '#ffffff'
  if (luminance < 0.85) return '#141416'
  return undefined
}
