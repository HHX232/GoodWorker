'use client'

import {
  determinant, echelon, fracMatrixLatex, inverse, matrixLatex, rank, toNumeric, transpose, type Bracket,
} from '@/shared/lib/lecture/matrix'
import { Grid3x3Icon, XIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { MathMarkup } from '../editor/MathView'
import styles from '../ui/ToolDialog.module.scss'

const MAX = 8
const BRACKETS: { id: Bracket; label: string }[] = [
  { id: 'pmatrix', label: '( )' },
  { id: 'bmatrix', label: '[ ]' },
  { id: 'vmatrix', label: '| |' },
  { id: 'Bmatrix', label: '{ }' },
  { id: 'matrix', label: '—' },
]
type Op = 'T' | 'det' | 'inv' | 'rank' | 'gauss' | 'rref'

export interface MatrixInitial { name: string; bracket: Bracket; cells: string[][] }

interface Props {
  initial?: MatrixInitial | null
  /** Insert (or, when editing, replace) the matrix itself. */
  onApply: (latex: string) => void
  /** Insert a computed result as a new formula block after it. */
  onInsertResult: (latex: string) => void
  onClose: () => void
}

const empty = (r: number, c: number) => Array.from({ length: r }, () => Array.from({ length: c }, () => ''))

/**
 * Matrix tool: size, brackets, a grid of cells (numbers, fractions 1/2, or
 * symbols a, x²), a live preview — and exact operations for numeric
 * matrices: transpose, determinant, inverse, rank, Gauss / Gauss–Jordan.
 */
export function MatrixDialog({ initial, onApply, onInsertResult, onClose }: Props) {
  const t = useTranslations('lecture')
  const [name, setName] = useState(initial?.name ?? 'A')
  const [bracket, setBracket] = useState<Bracket>(initial?.bracket ?? 'pmatrix')
  const [cells, setCells] = useState<string[][]>(initial?.cells ?? empty(3, 3))
  const [result, setResult] = useState<{ latex: string; note?: string } | null>(null)
  const rows = cells.length
  const cols = cells[0].length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const resize = (r: number, c: number) => {
    setCells(prev => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => prev[i]?.[j] ?? '')))
    setResult(null)
  }
  const setCell = (i: number, j: number, v: string) => { setCells(prev => prev.map((row, a) => (a === i ? row.map((x, b) => (b === j ? v : x)) : row))); setResult(null) }

  const nm = name.trim() || 'A'
  const body = matrixLatex(cells, bracket)
  const full = name.trim() ? `${name.trim()} = ${body}` : body
  const numeric = useMemo(() => toNumeric(cells), [cells])
  const square = rows === cols

  const run = (op: Op) => {
    if (!numeric) return
    const shown = matrixLatex(cells, 'pmatrix')
    switch (op) {
      case 'T': setResult({ latex: `${nm}^{T} = ${fracMatrixLatex(transpose(numeric))}` }); break
      case 'det': setResult({ latex: `\\det ${nm} = ${matrixLatex(cells, 'vmatrix')} = ${determinant(numeric).latex()}` }); break
      case 'inv': {
        const inv = inverse(numeric)
        setResult(inv ? { latex: `${nm}^{-1} = ${fracMatrixLatex(inv)}` } : { latex: `\\det ${nm} = 0`, note: t('matrixSingular') })
        break
      }
      case 'rank': setResult({ latex: `\\operatorname{rank} ${nm} = ${rank(numeric)}` }); break
      case 'gauss': setResult({ latex: `${shown} \\sim ${fracMatrixLatex(echelon(numeric, false).m)}`, note: t('matrixGaussNote') }); break
      case 'rref': setResult({ latex: `${shown} \\sim ${fracMatrixLatex(echelon(numeric, true).m)}`, note: t('matrixRrefNote') }); break
    }
  }

  const ops: { id: Op; label: string; needSquare?: boolean }[] = [
    { id: 'T', label: t('matrixOpT') },
    { id: 'det', label: t('matrixOpDet'), needSquare: true },
    { id: 'inv', label: t('matrixOpInv'), needSquare: true },
    { id: 'rank', label: t('matrixOpRank') },
    { id: 'gauss', label: t('matrixOpGauss') },
    { id: 'rref', label: t('matrixOpRref') },
  ]

  return createPortal(
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`${styles.dialog} ${styles.narrow}`} role="dialog" aria-label={t('matrixTitle')}>
        <div className={styles.head}>
          <span className={styles.headTitle}><Grid3x3Icon size={17} /> {t('matrixTitle')}</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t('cancel')}><XIcon size={18} /></button>
        </div>

        <div className={styles.form} style={{ borderRight: 0 }}>
          <div className={styles.matrixTop}>
            <label className={styles.field} style={{ width: 90 }}><span>{t('matrixName')}</span><input value={name} onChange={e => { setName(e.target.value.slice(0, 6)); setResult(null) }} placeholder="A" /></label>
            <div className={styles.field}><span>{t('matrixRows')}</span>
              <div className={styles.stepper}><button type="button" disabled={rows <= 1} onClick={() => resize(rows - 1, cols)}>−</button><span>{rows}</span><button type="button" disabled={rows >= MAX} onClick={() => resize(rows + 1, cols)}>+</button></div>
            </div>
            <div className={styles.field}><span>{t('matrixCols')}</span>
              <div className={styles.stepper}><button type="button" disabled={cols <= 1} onClick={() => resize(rows, cols - 1)}>−</button><span>{cols}</span><button type="button" disabled={cols >= MAX} onClick={() => resize(rows, cols + 1)}>+</button></div>
            </div>
            <div className={styles.field}><span>{t('matrixBrackets')}</span>
              <div className={styles.brackets}>
                {BRACKETS.map(b => <button key={b.id} type="button" className={`${styles.bracketBtn} ${bracket === b.id ? styles.bracketOn : ''}`} onClick={() => setBracket(b.id)} aria-pressed={bracket === b.id}>{b.label}</button>)}
              </div>
            </div>
          </div>

          <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${cols}, minmax(54px, 1fr))` }}>
            {cells.map((row, i) => row.map((v, j) => (
              <input
                key={`${i}-${j}`}
                value={v}
                placeholder="0"
                aria-label={`${i + 1}, ${j + 1}`}
                onChange={e => setCell(i, j, e.target.value)}
                onKeyDown={e => {
                  // Enter / arrows walk the grid like a spreadsheet.
                  const go = (a: number, b: number) => { e.preventDefault(); (e.currentTarget.parentElement?.children[a * cols + b] as HTMLInputElement | undefined)?.focus() }
                  if (e.key === 'Enter' || (e.key === 'ArrowDown' && i < rows - 1)) { if (i < rows - 1) go(i + 1, j); else if (j < cols - 1) go(0, j + 1) }
                  else if (e.key === 'ArrowUp' && i > 0) go(i - 1, j)
                  else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === v.length && j < cols - 1) go(i, j + 1)
                  else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0 && j > 0) go(i, j - 1)
                }}
              />
            )))}
          </div>

          <div className={styles.matrixPreview}><MathMarkup latex={full} inline={false} /></div>

          <div className={styles.sectionHead}>{t('matrixOps')}</div>
          <div className={styles.ops}>
            {ops.map(o => (
              <button key={o.id} type="button" className={styles.opBtn} disabled={!numeric || (o.needSquare && !square)} onClick={() => run(o.id)}>{o.label}</button>
            ))}
          </div>
          {!numeric && <div className={styles.opsHint}>{t('matrixSymbolic')}</div>}

          {result && (
            <div className={styles.result}>
              <div className={styles.resultMath}><MathMarkup latex={result.latex} inline={false} /></div>
              {result.note && <div className={styles.resultNote}>{result.note}</div>}
              <div className={styles.resultActions}>
                <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => { onInsertResult(result.latex); setResult(null) }}>{t('matrixInsertResult')}</button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.foot}>
          <span className={styles.spacer} />
          <button type="button" className={styles.btn} onClick={onClose}>{t('cancel')}</button>
          <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => { onApply(full); onClose() }}>{initial ? t('apply') : t('matrixInsert')}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
