function hexToHsl(hex: string): {h: number; s: number; l: number} {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  return {h: h * 360, s: s * 100, l: l * 100}
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360
  s /= 100
  l /= 100
  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (x: number) =>
    Math.round(Math.max(0, Math.min(255, x * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Each divider output index gets a slightly different hue + lightness shift
export function varyEdgeColor(hex: string, index: number): string {
  if (!hex || index === 0) return hex
  const {h, s, l} = hexToHsl(hex)
  const newH = (h + index * 22) % 360
  const newL = Math.min(78, l + index * 8)
  const newS = Math.max(30, s - index * 4)
  return hslToHex(newH, newS, newL)
}

// Returns the correct edge color for a given edge based on source node headerColor
// For divider outputs the color is slightly varied per handle index
export function edgeColorFromNode(
  headerColor: string | undefined | null,
  sourceHandle: string | null | undefined,
  sourceNodeId: string,
  fallback = '#868897',
): string {
  if (!headerColor) return fallback

  const dividerPrefix = `${sourceNodeId}-output-`
  if (sourceHandle?.startsWith(dividerPrefix)) {
    const index = parseInt(sourceHandle.slice(dividerPrefix.length), 10)
    return isNaN(index) ? headerColor : varyEdgeColor(headerColor, index)
  }

  return headerColor
}
