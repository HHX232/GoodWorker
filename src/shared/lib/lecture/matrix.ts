// Exact matrix arithmetic for the lecture's matrix tool: entries are
// fractions (bigint), so det/inverse/Gauss come out as ½, −⅔ — the way a
// lecture writes them, never 0.30000000000000004. Cells the student types:
// "3", "-1/2", "0,25", "2.5". Anything else (a, x, √2) makes the matrix
// symbolic: it can still be inserted, just not computed.

export class Frac {
  readonly n: bigint
  readonly d: bigint
  constructor(n: bigint, d: bigint = BigInt(1)) {
    if (d === BigInt(0)) throw new Error('division by zero')
    if (d < BigInt(0)) { n = -n; d = -d }
    const g = gcd(n < BigInt(0) ? -n : n, d)
    this.n = g ? n / g : n
    this.d = g ? d / g : d
  }
  static of(v: number | bigint): Frac { return new Frac(BigInt(v)) }
  add(o: Frac) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d) }
  sub(o: Frac) { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d) }
  mul(o: Frac) { return new Frac(this.n * o.n, this.d * o.d) }
  div(o: Frac) { return new Frac(this.n * o.d, this.d * o.n) }
  neg() { return new Frac(-this.n, this.d) }
  isZero() { return this.n === BigInt(0) }
  /** LaTeX: 3, -\frac{1}{2}. `display` = \dfrac, full-size fractions inside matrices (\frac there is cramped and rows collide). */
  latex(display = false): string {
    if (this.d === BigInt(1)) return this.n.toString()
    const neg = this.n < BigInt(0)
    return `${neg ? '-' : ''}\\${display ? 'dfrac' : 'frac'}{${(neg ? -this.n : this.n).toString()}}{${this.d.toString()}}`
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b]
  return a
}

/** "3", "-1/2", "0,25", "2.5", "−4" → Frac; null when it isn't a plain number. */
export function parseFrac(raw: string): Frac | null {
  const s = raw.trim().replace(/[−–]/g, '-').replace(',', '.').replace(/\s+/g, '')
  if (!s) return null
  const frac = /^(-?\d+)\/(-?\d+)$/.exec(s)
  if (frac) return BigInt(frac[2]) === BigInt(0) ? null : new Frac(BigInt(frac[1]), BigInt(frac[2]))
  const dec = /^(-?)(\d*)\.?(\d*)$/.exec(s)
  if (!dec || (!dec[2] && !dec[3])) return null
  const digits = dec[3] ?? ''
  const n = BigInt(`${dec[1]}${dec[2] || '0'}${digits}`)
  return new Frac(n, BigInt(10) ** BigInt(digits.length))
}

export type Matrix = Frac[][]
export type Bracket = 'pmatrix' | 'bmatrix' | 'vmatrix' | 'Bmatrix' | 'matrix'

/** A cell as the student typed it → LaTeX (numbers as fractions, the rest kept as written). */
export function cellLatex(raw: string): string {
  const f = parseFrac(raw)
  if (f) return f.latex(true)
  const s = raw.trim()
  return s || '0'
}

/** Rows with fractions need air between them — mathlive (and the eye) would otherwise stack them into each other. */
function rowBreak(rows: string[][]): string {
  return rows.some(r => r.some(c => c.includes('frac'))) ? ' \\\\[6pt] ' : ' \\\\ '
}

export function matrixLatex(cells: string[][], bracket: Bracket): string {
  const rows = cells.map(r => r.map(cellLatex))
  return `\\begin{${bracket}}${rows.map(r => r.join(' & ')).join(rowBreak(rows))}\\end{${bracket}}`
}

export function fracMatrixLatex(m: Matrix, bracket: Bracket = 'pmatrix'): string {
  const rows = m.map(r => r.map(c => c.latex(true)))
  return `\\begin{${bracket}}${rows.map(r => r.join(' & ')).join(rowBreak(rows))}\\end{${bracket}}`
}

/** Numeric matrix, or null when any cell is symbolic/empty. */
export function toNumeric(cells: string[][]): Matrix | null {
  const out: Matrix = []
  for (const row of cells) {
    const r: Frac[] = []
    for (const c of row) {
      const f = parseFrac(c === '' ? '0' : c)
      if (!f) return null
      r.push(f)
    }
    out.push(r)
  }
  return out
}

const clone = (m: Matrix): Matrix => m.map(r => [...r])

export function transpose(m: Matrix): Matrix {
  return m[0].map((_, j) => m.map(r => r[j]))
}

/** Row echelon form with the steps' pivots; `reduced` = Gauss–Jordan (RREF). */
export function echelon(m: Matrix, reduced: boolean): { m: Matrix; rank: number; swaps: number; det: Frac } {
  const a = clone(m)
  const rows = a.length
  const cols = a[0].length
  let r = 0
  let swaps = 0
  let det = Frac.of(1)
  for (let c = 0; c < cols && r < rows; c++) {
    let p = r
    while (p < rows && a[p][c].isZero()) p++
    if (p === rows) { det = Frac.of(0); continue }
    if (p !== r) { [a[p], a[r]] = [a[r], a[p]]; swaps++ }
    const pivot = a[r][c]
    det = det.mul(pivot)
    if (reduced) a[r] = a[r].map(v => v.div(pivot))
    for (let i = reduced ? 0 : r + 1; i < rows; i++) {
      if (i === r || a[i][c].isZero()) continue
      const k = a[i][c].div(a[r][c])
      a[i] = a[i].map((v, j) => v.sub(k.mul(a[r][j])))
    }
    r++
  }
  if (rows === cols && r < rows) det = Frac.of(0)
  return { m: a, rank: r, swaps, det: swaps % 2 ? det.neg() : det }
}

export function determinant(m: Matrix): Frac {
  if (m.length !== m[0].length) throw new Error('not square')
  return echelon(m, false).det
}

export function rank(m: Matrix): number {
  return echelon(m, false).rank
}

/** Inverse via Gauss–Jordan on [A | E]; null when singular. */
export function inverse(m: Matrix): Matrix | null {
  const size = m.length
  if (size !== m[0].length) return null
  const aug = m.map((r, i) => [...r, ...Array.from({ length: size }, (_, j) => Frac.of(i === j ? 1 : 0))])
  const { m: red, rank: rk } = echelon(aug, true)
  if (rk < size || red.some((r, i) => !r[i].sub(Frac.of(1)).isZero())) return null
  return red.map(r => r.slice(size))
}

export function multiply(a: Matrix, b: Matrix): Matrix | null {
  if (a[0].length !== b.length) return null
  return a.map(r => b[0].map((_, j) => r.reduce((s, v, k) => s.add(v.mul(b[k][j])), Frac.of(0))))
}

/**
 * "A = \begin{pmatrix}1 & 2 \\ 3 & 4\end{pmatrix}" → its parts, so a matrix
 * already in the notes opens back in the matrix tool. null for anything else.
 */
export function parseMatrixLatex(latex: string): { name: string; bracket: Bracket; cells: string[][] } | null {
  const m = /^\s*(?:([A-Za-z](?:_\{?\w+\}?)?)\s*=\s*)?\\begin\{(pmatrix|bmatrix|vmatrix|Bmatrix|matrix)\}([\s\S]*?)\\end\{\2\}\s*$/.exec(latex)
  if (!m) return null
  const rows = m[3].split(/\\\\(?:\[[^\]]*\])?/).map(r => r.trim()).filter(Boolean).map(r => r.split('&').map(c => latexCell(c.trim())))
  const cols = Math.max(...rows.map(r => r.length))
  if (!rows.length || rows.length > 8 || cols > 8) return null
  return { name: m[1] ?? '', bracket: m[2] as Bracket, cells: rows.map(r => [...r, ...Array(cols - r.length).fill('0')]) }
}

/** \frac{1}{2} → 1/2, -\frac{3}{4} → -3/4 (the grid shows plain fractions). */
function latexCell(c: string): string {
  const f = /^(-?)\\d?frac\{(\d+)\}\{(\d+)\}$/.exec(c)
  return f ? `${f[1]}${f[2]}/${f[3]}` : c
}
