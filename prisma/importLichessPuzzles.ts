/**
 * Импорт подмножества базы задач Lichess (CC0) в ChessPuzzle.
 * Запуск: set -a; source .env; set +a && npx tsx prisma/importLichessPuzzles.ts
 * Идемпотентен: если в ChessPuzzle уже ≥ TARGET задач — ничего не качает и выходит; иначе отбор
 * детерминирован (порядок файла), запись — createMany skipDuplicates.
 * Загрузка потоковая: файл распаковывается на лету, и как только квоты набраны (~20 МБ из ~300),
 * загрузка обрывается и недокачанный .part удаляется — кеш в os.tmpdir() остаётся, только если файл докачан целиком.
 * Нужен системный `zstd` в PATH.
 */
import { spawn } from 'child_process'
import { createWriteStream, existsSync, renameSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createInterface } from 'readline'
import { Readable } from 'stream'
import type { ReadableStream as WebReadableStream } from 'stream/web'
import { PrismaClient, type ChessPuzzle } from '@prisma/client'

const SRC_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'
const FILE = join(tmpdir(), 'lichess_db_puzzle.csv.zst')

const TARGET = 50_000
const MIN_POPULARITY = 80
const MIN_PLAYS = 300
const BUCKET_FROM = 400
const BUCKET_STEP = 200
const BUCKETS = 12 // 400–2800; крайние корзины забирают всё ниже/выше
const PER_BUCKET = Math.ceil(TARGET / BUCKETS)
const PER_THEME = 500
// Темы тактик из spec «Дополнения после G2» (doubleAttack = fork + discoveredAttack — своей темы в Lichess нет).
const TACTIC_THEMES = [
  'fork', 'pin', 'skewer', 'deflection', 'attraction', 'discoveredAttack', 'mateIn1', 'mateIn2', 'mateIn3',
  'backRankMate', 'sacrifice', 'hangingPiece', 'intermezzo', 'promotion',
]

const prisma = new PrismaClient()

/**
 * Источник строк CSV: кэш в os.tmpdir(), если файл уже скачан целиком; иначе качаем и одновременно
 * распаковываем (тело ответа → zstd stdin и → .part). Отбору хватает первых ~20 МБ (файл отсортирован
 * по случайному PuzzleId), поэтому при остановке раньше конца кэш не сохраняется.
 */
function openSource() {
  const cached = existsSync(FILE)
  console.log(cached ? `[import] читаю кэш ${FILE}` : `[import] качаю потоком ${SRC_URL}`)
  const zstd = spawn('zstd', ['-dc', ...(cached ? [FILE] : [])], { stdio: [cached ? 'ignore' : 'pipe', 'pipe', 'ignore'] })
  const controller = new AbortController()
  let downloaded: Promise<void> = Promise.resolve()
  if (!cached) {
    const part = `${FILE}.part`
    downloaded = (async () => {
      const res = await fetch(SRC_URL, { signal: controller.signal })
      if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`)
      const out = createWriteStream(part)
      for await (const chunk of Readable.fromWeb(res.body as WebReadableStream)) {
        out.write(chunk)
        if (!zstd.stdin!.write(chunk)) await new Promise(r => zstd.stdin!.once('drain', r))
      }
      zstd.stdin!.end()
      await new Promise(r => out.end(r))
      renameSync(part, FILE)
    })().catch(e => {
      zstd.stdin?.destroy()
      rmSync(part, { force: true })
      if (!controller.signal.aborted) throw e
    })
    zstd.stdin!.on('error', () => {}) // EPIPE после ранней остановки
  }
  const stop = () => { controller.abort(); zstd.kill() }
  return { lines: createInterface({ input: zstd.stdout!, crlfDelay: Infinity }), stop, downloaded }
}

async function main() {
  const existing = await prisma.chessPuzzle.count()
  if (existing >= TARGET) return console.log(`[import] в БД уже ${existing} задач (≥ ${TARGET}) — ничего не качаю и не добавляю`)

  const bucketCount = new Array<number>(BUCKETS).fill(0)
  const themeCount: Record<string, number> = Object.fromEntries(TACTIC_THEMES.map(t => [t, 0]))
  let batch: ChessPuzzle[] = []
  let picked = 0
  let inserted = 0
  const flush = async () => {
    if (!batch.length) return
    inserted += (await prisma.chessPuzzle.createMany({ data: batch, skipDuplicates: true })).count
    batch = []
  }

  const src = openSource()
  const full = () => bucketCount.every(n => n >= PER_BUCKET) && TACTIC_THEMES.every(t => themeCount[t] >= PER_THEME)
  let header = true
  for await (const line of src.lines) {
    if (header) { header = false; continue }
    // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags — без кавычек и запятых внутри
    const [id, fen, moves, ratingS, , popS, playsS, themesS, , openingS] = line.split(',')
    const rating = Number(ratingS)
    const popularity = Number(popS)
    if (popularity < MIN_POPULARITY || Number(playsS) < MIN_PLAYS || !id || !fen || !moves) continue
    const themes = themesS ? themesS.split(' ') : []
    const bucket = Math.min(BUCKETS - 1, Math.max(0, Math.floor((rating - BUCKET_FROM) / BUCKET_STEP)))
    const needed = bucketCount[bucket] < PER_BUCKET || themes.some(t => themeCount[t] !== undefined && themeCount[t] < PER_THEME)
    if (!needed) continue
    bucketCount[bucket]++
    for (const t of themes) if (themeCount[t] !== undefined) themeCount[t]++
    picked++
    batch.push({ id, fen, moves, rating, popularity, themes, openingTags: openingS ? openingS.trim().split(' ') : [] })
    if (batch.length >= 1000) await flush()
    if (full()) { src.stop(); break }
  }
  await flush()
  await src.downloaded

  console.log(`[import] отобрано ${picked}, новых записей ${inserted}`)
  console.log('[import] по корзинам рейтинга:', bucketCount.map((n, i) => `${BUCKET_FROM + i * BUCKET_STEP}:${n}`).join(' '))
  const rows = await prisma.$queryRaw<{ theme: string; n: bigint }[]>`
    SELECT t AS theme, count(*) AS n FROM "ChessPuzzle", unnest(themes) t
    WHERE t = ANY(${TACTIC_THEMES}) GROUP BY t ORDER BY n DESC`
  console.log(`[import] в БД всего: ${await prisma.chessPuzzle.count()}; по темам тактик:`)
  for (const r of rows) console.log(`  ${r.theme}: ${r.n}`)
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
