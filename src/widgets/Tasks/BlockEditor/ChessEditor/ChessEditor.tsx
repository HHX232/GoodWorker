'use client'
import {checkSquare, fenError, normalizeFen, playUci, START_FEN} from '@/shared/lib/chess/puzzle'
import {useActions} from '@/features/hooks/store/useActions'
import {ChessPuzzlePayload, ChessStudyPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {ChessBoard, getSkin, useBoardTheme, usePieceSet, type BoardMove, type PieceCode} from '@/widgets/Chess/Board'
import {Eraser, Trash2, Undo2} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useMemo, useState, type CSSProperties, type DragEvent} from 'react'
import styles from './ChessEditor.module.scss'

const FILES = 'abcdefgh'
const PALETTE: PieceCode[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
type Placement = Record<string, PieceCode>

function readPlacement(fen: string): Placement {
  const out: Placement = {}
  ;(fen.split(' ')[0] ?? '').split('/').forEach((row, r) => {
    let f = 0
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch)
      else if (f < 8) out[FILES[f++] + (8 - r)] = `${ch === ch.toUpperCase() ? 'w' : 'b'}${ch.toUpperCase()}` as PieceCode
    }
  })
  return out
}

/** Builds a FEN from a placement; castling rights follow from kings and rooks on their home squares. */
function writeFen(pl: Placement, turn: 'w' | 'b'): string {
  const rows: string[] = []
  for (let r = 8; r >= 1; r--) {
    let row = ''
    let gap = 0
    for (const f of FILES) {
      const p = pl[f + r]
      if (!p) gap++
      else {
        row += (gap || '') + (p[0] === 'w' ? p[1] : p[1].toLowerCase())
        gap = 0
      }
    }
    rows.push(row + (gap || ''))
  }
  const castle =
    (pl.e1 === 'wK' && pl.h1 === 'wR' ? 'K' : '') +
    (pl.e1 === 'wK' && pl.a1 === 'wR' ? 'Q' : '') +
    (pl.e8 === 'bK' && pl.h8 === 'bR' ? 'k' : '') +
    (pl.e8 === 'bK' && pl.a8 === 'bR' ? 'q' : '')
  return `${rows.join('/')} ${turn} ${castle || '-'} - 0 1`
}

const turnOf = (fen: string): 'w' | 'b' => (fen.split(' ')[1] === 'b' ? 'b' : 'w')

// ── Position setup: palette + eraser, side to move, FEN ─────────────────────────

function PositionSetup({fen, onChange, warn}: {fen: string; onChange: (fen: string) => void; warn: boolean}) {
  const t = useTranslations('chess.course')
  const tc = useTranslations('chess.core')
  const [boardId] = useBoardTheme()
  const [piecesId] = usePieceSet()
  const board = getSkin(boardId)
  const pieces = getSkin(piecesId).pieces
  const [tool, setTool] = useState<PieceCode | 'erase'>('wP')
  const [draft, setDraft] = useState(fen)
  const [seenFen, setSeenFen] = useState(fen)
  if (seenFen !== fen) {
    setSeenFen(fen)
    setDraft(fen)
  }

  const placement = useMemo(() => readPlacement(fen), [fen])
  const turn = turnOf(fen)
  const error = fenError(normalizeFen(draft))

  const commit = (pl: Placement, side = turn) => onChange(writeFen(pl, side))

  const applyTool = (sq: string) => {
    const pl = {...placement}
    if (tool === 'erase' || pl[sq] === tool) delete pl[sq]
    else pl[sq] = tool
    commit(pl)
  }

  const onDrop = (e: DragEvent, sq: string) => {
    e.preventDefault()
    const [code, from] = e.dataTransfer.getData('text/plain').split('|')
    if (!PALETTE.includes(code as PieceCode)) return
    const pl = {...placement}
    if (from) delete pl[from]
    pl[sq] = code as PieceCode
    commit(pl)
  }

  const onFenInput = (text: string) => {
    setDraft(text)
    const next = normalizeFen(text)
    if (!fenError(next)) onChange(next)
  }

  const squares = []
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      const sq = FILES[col] + (8 - row)
      const p = placement[sq]
      const Piece = p ? pieces[p] : null
      squares.push(
        <button
          key={sq}
          type='button'
          className={`${styles.setup_sq} ${(row + col) % 2 ? styles.sq_dark : styles.sq_light}`}
          aria-label={p ? tc('square_piece', {square: sq, piece: tc(`pc_${p}`)}) : tc('square_empty', {square: sq})}
          onClick={() => applyTool(sq)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDrop(e, sq)}
        >
          {Piece && (
            <span
              className={styles.setup_piece}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', `${p}|${sq}`)}
            >
              <Piece />
            </span>
          )}
          {col === 0 && <span className={`${styles.coord} ${styles.coord_rank}`}>{8 - row}</span>}
          {row === 7 && <span className={`${styles.coord} ${styles.coord_file}`}>{FILES[col]}</span>}
        </button>
      )
    }

  return (
    <div className={styles.split}>
      <div
        className={styles.setup_board}
        style={{'--sq-light': board.light, '--sq-dark': board.dark, '--coord-light': board.coordLight, '--coord-dark': board.coordDark} as CSSProperties}
      >
        {squares}
      </div>

      <div className={styles.side}>
        <div className={styles.field}>
          <span className={styles.label}>{t('palette')}</span>
          <div className={styles.palette} role='radiogroup' aria-label={t('palette')}>
            {PALETTE.map((code) => {
              const Piece = pieces[code]
              return (
                <button
                  key={code}
                  type='button'
                  role='radio'
                  aria-checked={tool === code}
                  aria-label={tc(`pc_${code}`)}
                  title={tc(`pc_${code}`)}
                  className={`${styles.tool} ${tool === code ? styles.tool_active : ''}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', code)}
                  onClick={() => setTool(code)}
                >
                  <Piece />
                </button>
              )
            })}
            <button
              type='button'
              role='radio'
              aria-checked={tool === 'erase'}
              aria-label={t('eraser')}
              title={t('eraser')}
              className={`${styles.tool} ${styles.tool_erase} ${tool === 'erase' ? styles.tool_active : ''}`}
              onClick={() => setTool('erase')}
            >
              <Eraser size={18} strokeWidth={1.75} />
            </button>
          </div>
          <p className={styles.hint}>{t('setupHint')}</p>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t('sideToMove')}</span>
          <div className={styles.segment}>
            {(['w', 'b'] as const).map((side) => (
              <button
                key={side}
                type='button'
                aria-pressed={turn === side}
                className={`${styles.segment_btn} ${turn === side ? styles.segment_active : ''}`}
                onClick={() => commit(placement, side)}
              >
                {t(side === 'w' ? 'white' : 'black')}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <button type='button' className={styles.btn} onClick={() => onChange(START_FEN)}>
            {t('startPos')}
          </button>
          <button type='button' className={styles.btn} onClick={() => commit({})}>
            {t('emptyPos')}
          </button>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>{t('fenLabel')}</span>
          <input
            className={`${styles.input} ${styles.mono} ${error ? styles.input_error : ''}`}
            value={draft}
            spellCheck={false}
            aria-invalid={!!error}
            onChange={(e) => onFenInput(e.target.value)}
          />
          {error && <span className={styles.error}>{t(`err_${error}`)}</span>}
        </label>

        {warn && <p className={styles.warn}>{t('positionResetWarn')}</p>}
      </div>
    </div>
  )
}

// ── Move recorder: the teacher plays the line on a real board ───────────────────

function useLine(fen: string, ucis: string[]) {
  return useMemo(() => {
    let cur = fen
    const steps: {san: string; from: string; to: string}[] = []
    for (const uci of ucis) {
      const r = playUci(cur, uci)
      if (!r) break
      steps.push(r)
      cur = r.fen
    }
    return {fen: cur, steps}
  }, [fen, ucis])
}

function MoveRecorder({
  fen,
  moves,
  onChange,
  hint,
  children
}: {
  fen: string
  moves: string[]
  onChange: (moves: string[]) => void
  hint: string
  children: React.ReactNode
}) {
  const t = useTranslations('chess.course')
  const line = useLine(fen, moves)
  const last = line.steps.at(-1)

  if (fenError(fen)) return <p className={styles.warn}>{t('fixPositionFirst')}</p>

  const onMove = (m: BoardMove) => onChange([...moves, m.from + m.to + (m.promotion ?? '')])

  return (
    <div className={styles.split}>
      <ChessBoard
        className={styles.board}
        fen={line.fen}
        orientation={turnOf(fen)}
        onMove={onMove}
        lastMove={last ? {from: last.from, to: last.to} : null}
        check={checkSquare(line.fen)}
      />
      <div className={styles.side}>
        <p className={styles.hint}>{hint}</p>
        {moves.length === 0 ? <p className={styles.empty}>{t('solutionEmpty')}</p> : children}
        <div className={styles.row}>
          <button type='button' className={styles.btn} disabled={!moves.length} onClick={() => onChange(moves.slice(0, -1))}>
            <Undo2 size={15} /> {t('undoMove')}
          </button>
          <button type='button' className={styles.btn} disabled={!moves.length} onClick={() => onChange([])}>
            <Trash2 size={15} /> {t('clearMoves')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** "1." / "1…" prefix for the n-th move of a line starting with `turn` to move. */
export function moveNumber(i: number, turn: 'w' | 'b'): string {
  const ply = i + (turn === 'b' ? 1 : 0)
  const n = Math.floor(ply / 2) + 1
  return ply % 2 === 0 ? `${n}.` : i === 0 ? `${n}…` : ''
}

function Tabs<T extends string>({value, onChange, items}: {value: T; onChange: (v: T) => void; items: [T, string][]}) {
  return (
    <div className={styles.segment} role='tablist'>
      {items.map(([id, label]) => (
        <button
          key={id}
          type='button'
          role='tab'
          aria-selected={value === id}
          className={`${styles.segment_btn} ${value === id ? styles.segment_active : ''}`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── CHESS_PUZZLE editor ───────────────────────────────────────────────────────

/** `onChange` replaces the test-store write (road-map node keeps the payload in its own data). */
export function ChessPuzzleEditor({blockId, payload, onChange}: {blockId: string; payload: ChessPuzzlePayload; onChange?: (p: ChessPuzzlePayload) => void}) {
  const t = useTranslations('chess.course')
  const {updateBlockPayload} = useActions()
  const update = (patch: Partial<ChessPuzzlePayload>) =>
    onChange ? onChange({...payload, ...patch}) : updateBlockPayload({id: blockId, payload: {...payload, ...patch}})
  const [tab, setTab] = useState<'position' | 'moves'>(payload.solution.length ? 'moves' : 'position')
  const line = useLine(payload.fen, payload.solution)
  const turn = turnOf(payload.fen)

  return (
    <div className={styles.box}>
      <Tabs value={tab} onChange={setTab} items={[['position', t('tabPosition')], ['moves', t('tabSolution')]]} />

      {tab === 'position' ? (
        <PositionSetup fen={payload.fen} warn={payload.solution.length > 0} onChange={(fen) => update({fen, solution: []})} />
      ) : (
        <MoveRecorder fen={payload.fen} moves={payload.solution} onChange={(solution) => update({solution})} hint={t('solutionHint')}>
          <ol className={styles.chips}>
            {line.steps.map((s, i) => (
              <li key={i} className={`${styles.chip} ${i % 2 ? styles.chip_reply : styles.chip_student}`}>
                <span className={styles.chip_num}>{moveNumber(i, turn)}</span>
                <span className={styles.mono}>{s.san}</span>
                <span className={styles.chip_role}>{t(i % 2 ? 'opponentMove' : 'studentMove')}</span>
              </li>
            ))}
          </ol>
          {line.steps.length % 2 === 0 && <p className={styles.warn}>{t('solutionEndsWithReply')}</p>}
        </MoveRecorder>
      )}

      <label className={styles.field}>
        <span className={styles.label}>{t('promptLabel')}</span>
        <input
          className={styles.input}
          value={payload.prompt ?? ''}
          placeholder={t('promptPlaceholder')}
          onChange={(e) => update({prompt: e.target.value})}
        />
      </label>
    </div>
  )
}

// ── CHESS_STUDY editor ────────────────────────────────────────────────────────

/** `onChange` replaces the test-store write (road-map node keeps the payload in its own data). */
export function ChessStudyEditor({blockId, payload, onChange}: {blockId: string; payload: ChessStudyPayload; onChange?: (p: ChessStudyPayload) => void}) {
  const t = useTranslations('chess.course')
  const {updateBlockPayload} = useActions()
  const update = (patch: Partial<ChessStudyPayload>) =>
    onChange ? onChange({...payload, ...patch}) : updateBlockPayload({id: blockId, payload: {...payload, ...patch}})
  const [tab, setTab] = useState<'position' | 'moves'>(payload.moves.length ? 'moves' : 'position')
  const ucis = useMemo(() => payload.moves.map((m) => m.uci), [payload.moves])
  const line = useLine(payload.fen, ucis)
  const turn = turnOf(payload.fen)

  const setUcis = (next: string[]) =>
    update({moves: next.map((uci, i) => ({uci, comment: payload.moves[i]?.uci === uci ? payload.moves[i].comment : ''}))})
  const setComment = (i: number, comment: string) =>
    update({moves: payload.moves.map((m, j) => (j === i ? {...m, comment} : m))})

  return (
    <div className={styles.box}>
      <Tabs value={tab} onChange={setTab} items={[['position', t('tabPosition')], ['moves', t('tabMoves')]]} />

      {tab === 'position' ? (
        <PositionSetup fen={payload.fen} warn={payload.moves.length > 0} onChange={(fen) => update({fen, moves: []})} />
      ) : (
        <MoveRecorder fen={payload.fen} moves={ucis} onChange={setUcis} hint={t('studyHint')}>
          <ol className={styles.comment_list}>
            {line.steps.map((s, i) => (
              <li key={i} className={styles.comment_row}>
                <span className={`${styles.comment_san} ${styles.mono}`}>
                  {moveNumber(i, turn) || ' '} {s.san}
                </span>
                <input
                  className={styles.input}
                  value={payload.moves[i]?.comment ?? ''}
                  placeholder={t('commentPlaceholder')}
                  onChange={(e) => setComment(i, e.target.value)}
                />
              </li>
            ))}
          </ol>
        </MoveRecorder>
      )}
    </div>
  )
}

