export interface Tile { x: number; y: number; w: number; h: number }

/**
 * Cuts a w×h picture into tiles of at most max×max. If that takes more than
 * maxTiles, the picture is first scaled down uniformly — by the largest factor
 * that fits some cols×rows grid within maxTiles. Tiles are in scaled pixels.
 */
export function tileGrid(w: number, h: number, max = 2000, maxTiles = 6): { scale: number; tiles: Tile[] } {
  let scale = 0, cols = 1, rows = 1
  for (let c = 1; c <= maxTiles; c++) {
    const r = Math.floor(maxTiles / c)
    const s = Math.min(1, (c * max) / w, (r * max) / h)
    if (s > scale) { scale = s; cols = c; rows = r }
  }
  const sw = Math.min(cols * max, Math.round(w * scale))
  const sh = Math.min(rows * max, Math.round(h * scale))
  const tiles: Tile[] = []
  for (let y = 0; y < sh; y += max) {
    for (let x = 0; x < sw; x += max) tiles.push({ x, y, w: Math.min(max, sw - x), h: Math.min(max, sh - y) })
  }
  return { scale, tiles }
}

/**
 * Each tile of tileGrid(w, h) mapped back onto the original w×h picture, for
 * drawImage's source rect. Edges are scaled from the grid's own extent, so the
 * rects adjoin exactly and the last row/column ends at the picture's edge.
 */
export function sourceRects(w: number, h: number, grid: { tiles: Tile[] }): { sx: number; sy: number; sw: number; sh: number }[] {
  const gw = Math.max(...grid.tiles.map(t => t.x + t.w))
  const gh = Math.max(...grid.tiles.map(t => t.y + t.h))
  return grid.tiles.map(t => {
    const sx = (t.x * w) / gw, sy = (t.y * h) / gh
    return { sx, sy, sw: ((t.x + t.w) * w) / gw - sx, sh: ((t.y + t.h) * h) / gh - sy }
  })
}
