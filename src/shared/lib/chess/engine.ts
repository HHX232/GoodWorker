// Stockfish 19 lite single-thread (GPL-3, public/stockfish/) in a Web Worker.
// One worker per tab; every call is queued so UCI commands never interleave.
import { validateFen } from 'chess.js'

export type EngineLine = { uci: string; pv: string[]; scoreCp: number | null; mate: number | null }

export type EngineLevel = { level: number; elo?: number; skill?: number; movetimeMs: number }

/** Levels 1–8 (spec "Дополнения после G2"). 1–3 use UCI_Elo, 4–8 use Skill Level. */
export const ENGINE_LEVELS: EngineLevel[] = [
  { level: 1, elo: 1320, movetimeMs: 100 },
  { level: 2, elo: 1500, movetimeMs: 200 },
  { level: 3, elo: 1700, movetimeMs: 300 },
  { level: 4, skill: 8, movetimeMs: 400 },
  { level: 5, skill: 12, movetimeMs: 600 },
  { level: 6, skill: 15, movetimeMs: 900 },
  { level: 7, skill: 18, movetimeMs: 1300 },
  { level: 8, skill: 20, movetimeMs: 2000 },
]

export type AnalyseOpts = { multiPV: number; depth?: number; movetimeMs?: number }

/**
 * Rejections: ENGINE_UNAVAILABLE (worker failed to load — permanent), ENGINE_CANCELLED (stop/cancelAll),
 * BAD_FEN (invalid FEN, checked before the worker), NO_MOVE (bestMove in a finished position).
 */
export interface ChessEngine {
  bestMove(fen: string, level: number): Promise<string>
  analyse(fen: string, opts: AnalyseOpts): Promise<EngineLine[]>
  /** Rejects the running job with ENGINE_CANCELLED and halts its search; queued jobs still run. */
  stop(): void
  /** Rejects the running and every queued job with ENGINE_CANCELLED. The engine stays usable. */
  cancelAll(): void
}

const WORKER_URL = '/stockfish/stockfish-19-lite-single.js'
const INIT_TIMEOUT_MS = 20000
const unavailable = () => new Error('ENGINE_UNAVAILABLE')
const cancelled = () => new Error('ENGINE_CANCELLED')

type Ticket = { cancelled: boolean; reject: (e: Error) => void }

type Waiter = { until: (line: string) => boolean; resolve: (line: string) => void; reject: (e: Error) => void; onLine?: (line: string) => void }

class StockfishEngine implements ChessEngine {
  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private dead = false
  private waiter: Waiter | null = null
  private tail: Promise<unknown> = Promise.resolve()
  private current: Ticket | null = null
  private pending = new Set<Ticket>()

  private fail() {
    this.dead = true
    this.worker?.terminate()
    this.worker = null
    this.waiter?.reject(unavailable())
    this.waiter = null
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd)
  }

  private waitFor(until: (line: string) => boolean, onLine?: (line: string) => void): Promise<string> {
    if (this.dead) return Promise.reject(unavailable())
    return new Promise((resolve, reject) => {
      this.waiter = { until, resolve, reject, onLine }
    })
  }

  private boot(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = (async () => {
      if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') throw unavailable()
      try {
        this.worker = new Worker(WORKER_URL)
      } catch {
        throw unavailable()
      }
      this.worker.onmessage = (e: MessageEvent) => {
        const line = String(e.data)
        const w = this.waiter
        if (!w) return
        w.onLine?.(line)
        if (w.until(line)) {
          this.waiter = null
          w.resolve(line)
        }
      }
      this.worker.onerror = () => this.fail()
      const timer = setTimeout(() => this.fail(), INIT_TIMEOUT_MS)
      try {
        const ok = this.waitFor((l) => l === 'uciok')
        this.send('uci')
        await ok
        const ready = this.waitFor((l) => l === 'readyok')
        this.send('isready')
        await ready
      } finally {
        clearTimeout(timer)
      }
    })()
    return this.ready
  }

  /**
   * Serialises jobs: each runs alone from `position` to `bestmove`. A cancelled job's caller is
   * rejected at once, but the job itself still drains its `bestmove` so the next one starts clean.
   */
  private enqueue<T>(fen: string, job: () => Promise<T>): Promise<T> {
    if (!validateFen(fen).ok) return Promise.reject(new Error('BAD_FEN'))
    return new Promise<T>((resolve, reject) => {
      const ticket: Ticket = { cancelled: false, reject }
      this.pending.add(ticket)
      this.tail = this.tail.then(async () => {
        if (ticket.cancelled) return
        this.current = ticket
        try {
          await this.boot()
          if (this.dead) throw unavailable()
          const result = await job()
          if (!ticket.cancelled) resolve(result)
        } catch (e) {
          if (!ticket.cancelled) reject(e as Error)
        } finally {
          this.current = null
          this.pending.delete(ticket)
        }
      })
    })
  }

  private cancel(ticket: Ticket) {
    ticket.cancelled = true
    this.pending.delete(ticket)
    ticket.reject(cancelled())
  }

  private configure(opts: Record<string, string | number | boolean>) {
    for (const [k, v] of Object.entries(opts)) this.send(`setoption name ${k} value ${v}`)
  }

  bestMove(fen: string, level: number): Promise<string> {
    const lv = ENGINE_LEVELS[Math.min(8, Math.max(1, Math.round(level))) - 1]
    return this.enqueue(fen, async () => {
      this.configure({
        MultiPV: 1,
        UCI_LimitStrength: lv.elo != null,
        ...(lv.elo != null ? { UCI_Elo: lv.elo, 'Skill Level': 20 } : { 'Skill Level': lv.skill ?? 20 }),
      })
      this.send(`position fen ${fen}`)
      const done = this.waitFor((l) => l.startsWith('bestmove'))
      this.send(`go movetime ${lv.movetimeMs}`)
      const move = (await done).split(/\s+/)[1]
      if (!move || move === '(none)') throw new Error('NO_MOVE')
      return move
    })
  }

  analyse(fen: string, { multiPV, depth, movetimeMs }: AnalyseOpts): Promise<EngineLine[]> {
    return this.enqueue(fen, async () => {
      this.configure({ MultiPV: multiPV, UCI_LimitStrength: false, 'Skill Level': 20 })
      this.send(`position fen ${fen}`)
      const lines = new Map<number, EngineLine>()
      const done = this.waitFor(
        (l) => l.startsWith('bestmove'),
        (l) => {
          const parsed = parseInfo(l)
          if (parsed) lines.set(parsed.k, parsed.line)
        },
      )
      const go = ['go']
      if (depth) go.push('depth', String(depth))
      if (movetimeMs) go.push('movetime', String(movetimeMs))
      if (go.length === 1) go.push('depth', '14')
      this.send(go.join(' '))
      await done
      return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, line]) => line)
    })
  }

  stop() {
    if (!this.current || this.current.cancelled) return
    this.cancel(this.current)
    this.send('stop')
  }

  cancelAll() {
    const running = !!this.current && !this.current.cancelled
    for (const t of [...this.pending]) this.cancel(t)
    if (running) this.send('stop')
  }
}

/** `info depth 14 ... multipv 2 score cp -31 ... pv e7e5 g1f3` → line #2. Bound scores are skipped. */
function parseInfo(l: string): { k: number; line: EngineLine } | null {
  if (!l.startsWith('info ') || !l.includes(' pv ') || / (upper|lower)bound/.test(l)) return null
  const t = l.split(/\s+/)
  const at = (key: string) => t.indexOf(key)
  const s = at('score')
  if (s < 0) return null
  const kind = t[s + 1]
  const val = Number(t[s + 2])
  const pv = t.slice(at('pv') + 1)
  const mpv = at('multipv')
  return {
    k: mpv >= 0 ? Number(t[mpv + 1]) : 1,
    line: { uci: pv[0], pv, scoreCp: kind === 'cp' ? val : null, mate: kind === 'mate' ? val : null },
  }
}

let instance: StockfishEngine | null = null

export function getEngine(): ChessEngine {
  if (!instance) instance = new StockfishEngine()
  return instance
}
