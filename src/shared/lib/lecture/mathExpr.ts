// A tiny, safe math-expression compiler for the lecture graph block: the way
// students and the AI write functions ("2sin(x)", "x^2 - 3x + 1", "√x",
// "e^(-x)", "|x|", "ln x") → (x) => number. No eval, no globals — a
// recursive-descent parser over a fixed whitelist. Prisma-free: client + server.

type Ast =
  | { k: 'num'; v: number }
  | { k: 'x' }
  | { k: 'neg'; a: Ast }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Ast; b: Ast }
  | { k: 'fn'; name: string; a: Ast }

const FNS: Record<string, (v: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, tg: Math.tan,
  cot: v => 1 / Math.tan(v), ctg: v => 1 / Math.tan(v),
  asin: Math.asin, acos: Math.acos, atan: Math.atan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, arctg: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, sh: Math.sinh, ch: Math.cosh, th: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp,
  ln: Math.log, log: Math.log10, lg: Math.log10, log2: Math.log2,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, sgn: Math.sign,
}
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E }

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string }

function tokenize(src: string): Tok[] {
  const s = src
    .replace(/\*\*/g, '^').replace(/[·×∙⋅]/g, '*').replace(/[÷:]/g, '/').replace(/[−–—]/g, '-')
    .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/,(?=\d)/g, '.').toLowerCase()
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) { i++; continue }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i))
    if (num && /[\d.]/.test(c)) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue }
    const id = /^[a-z][a-z0-9]*/.exec(s.slice(i))
    if (id) {
      // "sinx", "2xsin" → split known names greedily so "xsin(x)" and "sinx" both work.
      let word = id[0]
      while (word) {
        const hit = Object.keys(FNS).concat(Object.keys(CONSTS), ['x'])
          .filter(n => word.startsWith(n)).sort((a, b) => b.length - a.length)[0]
        if (!hit) throw new Error(`unknown: ${word}`)
        out.push({ t: 'id', v: hit })
        word = word.slice(hit.length)
      }
      i += id[0].length
      continue
    }
    if ('+-*/^()|'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue }
    throw new Error(`bad char: ${c}`)
  }
  return out
}

function parse(tokens: Tok[]): Ast {
  let p = 0
  const peek = () => tokens[p]
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v
  const eat = (v: string) => { if (!isOp(v)) throw new Error(`expected ${v}`); p++ }
  // An implicit product starts where a value can start: 2x, 2(x+1), x sin x, (x)(x).
  const startsValue = () => { const t = peek(); return !!t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && (t.v === '(' || t.v === '|'))) }

  let absDepth = 0
  let bareArg = 0 // inside "sin x …": another function starts a new factor, not the argument
  const startsFn = () => { const t = peek(); return t?.t === 'id' && t.v in FNS }
  function expr(): Ast {
    let a = term()
    while (isOp('+') || isOp('-')) { const op = peek()!.v as '+' | '-'; p++; a = { k: 'bin', op, a, b: term() } }
    return a
  }
  function term(): Ast {
    let a = unary()
    for (;;) {
      if (isOp('*') || isOp('/')) { const op = peek()!.v as '*' | '/'; p++; a = { k: 'bin', op, a, b: unary() }; continue }
      // "|" closes an |abs| when we're inside one — not an implicit product.
      if (startsValue() && !(isOp('|') && absDepth > 0) && !(bareArg > 0 && startsFn())) { a = { k: 'bin', op: '*', a, b: power() }; continue }
      return a
    }
  }
  function unary(): Ast {
    if (isOp('-')) { p++; return { k: 'neg', a: unary() } }
    if (isOp('+')) { p++; return unary() }
    return power()
  }
  function power(): Ast {
    const base = atom()
    if (isOp('^')) { p++; return { k: 'bin', op: '^', a: base, b: unary() } } // right-assoc, allows 2^-x
    return base
  }
  function atom(): Ast {
    const t = peek()
    if (!t) throw new Error('unexpected end')
    if (t.t === 'num') { p++; return { k: 'num', v: t.v } }
    if (t.t === 'op' && t.v === '(') { p++; const a = expr(); eat(')'); return a }
    if (t.t === 'op' && t.v === '|') { p++; absDepth++; const a = expr(); absDepth--; eat('|'); return { k: 'fn', name: 'abs', a } }
    if (t.t === 'id') {
      p++
      if (t.v === 'x') return { k: 'x' }
      if (t.v in CONSTS) return { k: 'num', v: CONSTS[t.v] }
      // sin x, sin^2 x, sin(x): the argument binds tighter than * (sin 2x = sin(2x)).
      let pow: Ast | null = null
      if (isOp('^')) { p++; pow = atom() }
      let arg: Ast
      if (isOp('(')) arg = atom()
      else { bareArg++; try { arg = term() } finally { bareArg-- } }
      const call: Ast = { k: 'fn', name: t.v, a: arg }
      return pow ? { k: 'bin', op: '^', a: call, b: pow } : call
    }
    throw new Error(`unexpected ${t.v}`)
  }
  const ast = expr()
  if (p < tokens.length) throw new Error('trailing input')
  return ast
}

function evaluate(n: Ast, x: number): number {
  switch (n.k) {
    case 'num': return n.v
    case 'x': return x
    case 'neg': return -evaluate(n.a, x)
    case 'fn': return FNS[n.name](evaluate(n.a, x))
    case 'bin': {
      const a = evaluate(n.a, x)
      const b = evaluate(n.b, x)
      switch (n.op) {
        case '+': return a + b
        case '-': return a - b
        case '*': return a * b
        case '/': return a / b
        case '^': {
          // Odd roots of negatives: x^(1/3) should be real.
          if (a < 0 && !Number.isInteger(b)) {
            const inv = 1 / b
            if (Number.isInteger(inv) && Math.abs(inv) % 2 === 1) return -Math.pow(-a, b)
          }
          return Math.pow(a, b)
        }
      }
    }
  }
}

/** "y = x^2", "f(x)=…" → the right-hand side. */
export function stripLhs(expr: string): string {
  return expr.replace(/^\s*(?:y|[a-z]\s*\(\s*x\s*\))\s*=/i, '').trim()
}

/** Compiles an expression in x; throws a short message on anything it can't read. */
export function compileExpr(expr: string): (x: number) => number {
  const ast = parse(tokenize(stripLhs(expr)))
  return x => evaluate(ast, x)
}

export function isValidExpr(expr: string): boolean {
  try { compileExpr(expr); return true } catch { return false }
}

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' }

/** For legends: "x^2 - 4*x" → "x² − 4·x", "sqrt(x)" → "√(x)", "pi" → "π". */
export function prettyExpr(expr: string): string {
  return expr
    .replace(/\^\(?(-?\d)\)?(?![\d.])/g, (_, d: string) => [...d].map(ch => SUP[ch] ?? ch).join(''))
    .replace(/\*/g, '·')
    .replace(/sqrt/g, '√')
    .replace(/\bpi\b/g, 'π')
    .replace(/-/g, '−')
}
