'use client'

import { HIGHLIGHT_COLORS, type BookHighlight, type HighlightColor } from '@/shared/types/TutorFiles/tutorFiles.types'
import { CheckIcon, CopyIcon, MessageSquareIcon, MessageSquarePlusIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { excerpt, type Anchor, type Placement } from './highlightGeometry'
import styles from './BookReader.module.scss'

export const COLOR_KEY = {
  yellow: 'booksHlColorYellow',
  green: 'booksHlColorGreen',
  pink: 'booksHlColorPink',
  blue: 'booksHlColorBlue',
} as const satisfies Record<HighlightColor, string>

const NOTE_MAX = 2000

/** `fixed` box style from a placement; width is the one the placement was computed for. */
export function floatStyle(p: Placement, width: number): CSSProperties {
  return { left: p.left, top: p.top, bottom: p.bottom, width, maxHeight: p.maxHeight }
}

/** Saved highlights of one page: colour fills under the text layer (never in the way of selecting) + a bubble on those with a comment. */
export function HighlightLayer({ highlights, flashId, onOpen }: { highlights: BookHighlight[]; flashId: string | null; onOpen: (h: BookHighlight, anchor: Anchor) => void }) {
  const t = useTranslations('files')
  if (highlights.length === 0) return null
  return (
    <>
      <div className={styles.hlFills} aria-hidden="true">
        {highlights.map(h => (
          <div key={h.id} className={`${styles.hl} ${flashId === h.id ? styles.hlFlash : ''}`} data-color={h.color} data-hl-id={h.id}>
            {h.rects.map((r, i) => (
              <span key={i} style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }} />
            ))}
          </div>
        ))}
      </div>
      {highlights.filter(h => h.note && h.rects.length > 0).map(h => {
        const r = h.rects[0]
        return (
          <button
            key={h.id}
            type="button"
            data-hl-ui
            data-hl-marker={h.id}
            className={styles.hlMarker}
            data-color={h.color}
            style={{ left: `min(calc(${(r.x + r.w) * 100}% + 2px), calc(100% - 20px))`, top: `${(r.y + r.h / 2) * 100}%` }}
            aria-label={t('booksHlMarkerAria', { note: excerpt(h.note ?? '', 60) })}
            title={h.note ?? undefined}
            onClick={e => {
              e.stopPropagation()
              const b = e.currentTarget.getBoundingClientRect()
              onOpen(h, { left: b.left, top: b.top, bottom: b.bottom, width: b.width })
            }}
          >
            <MessageSquareIcon size={11} />
          </button>
        )
      })}
    </>
  )
}

function Dots({ value, disabled, onPick }: { value?: HighlightColor; disabled?: boolean; onPick: (c: HighlightColor) => void }) {
  const t = useTranslations('files')
  return (
    <>
      {HIGHLIGHT_COLORS.map(c => (
        <button
          key={c}
          type="button"
          className={styles.hlDot}
          data-color={c}
          disabled={disabled}
          aria-pressed={value === undefined ? undefined : value === c}
          aria-label={t(COLOR_KEY[c])}
          title={t(COLOR_KEY[c])}
          onClick={() => onPick(c)}
        />
      ))}
    </>
  )
}

/** Mini-bar over a fresh selection: colour = save, comment = save + open the field, copy. */
export function SelectionBar({ place, width, busy, onColor, onComment, onCopy }: {
  place: Placement
  width: number
  busy: boolean
  onColor: (c: HighlightColor) => void
  onComment: () => void
  onCopy: () => void
}) {
  const t = useTranslations('files')
  return (
    // mousedown is swallowed so pressing a button does not collapse the very selection it acts on.
    <div data-hl-ui className={styles.hlBar} style={floatStyle(place, width)} role="toolbar" aria-label={t('booksHlBarAria')} onMouseDown={e => e.preventDefault()}>
      <Dots disabled={busy} onPick={onColor} />
      <button type="button" className={`${styles.hlBarBtn} ${styles.hlBarFirst}`} disabled={busy} onClick={onComment} aria-label={t('booksHlComment')} title={t('booksHlComment')}>
        <MessageSquarePlusIcon size={15} /><span>{t('booksHlComment')}</span>
      </button>
      <button type="button" className={styles.hlBarBtn} onClick={onCopy} aria-label={t('booksHlCopy')} title={t('booksHlCopy')}>
        <CopyIcon size={15} /><span>{t('booksHlCopy')}</span>
      </button>
    </div>
  )
}

/** Popup over a saved highlight: quote, colour, comment (edit), delete. Mount with `key={highlight.id}` — the draft starts from its note. */
export function HighlightPopup({ highlight, place, width, focusNote, onColor, onSaveNote, onRemove, onClose }: {
  highlight: BookHighlight
  place: Placement
  width: number
  focusNote: boolean
  onColor: (c: HighlightColor) => void
  onSaveNote: (note: string | null) => void
  onRemove: () => void
  onClose: () => void
}) {
  const t = useTranslations('files')
  const [draft, setDraft] = useState(highlight.note ?? '')
  const dirty = draft.trim() !== (highlight.note ?? '')
  const save = () => {
    if (dirty) onSaveNote(draft.trim() || null)
    onClose()
  }
  // Opening by click: focus goes into the popup (the comment field when it was opened by «Комментарий»).
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focusNote) dialogRef.current?.focus({ preventScroll: true })
  }, [focusNote])
  return (
    <div ref={dialogRef} data-hl-ui className={styles.hlPop} style={floatStyle(place, width)} role="dialog" tabIndex={-1} aria-label={t('booksHlPopupAria')}>
      <blockquote className={styles.hlQuote} data-color={highlight.color}>{highlight.text}</blockquote>
      <div className={styles.hlColors} role="group" aria-label={t('booksHlColors')}>
        <Dots value={highlight.color} onPick={onColor} />
      </div>
      <textarea
        className={styles.hlNote}
        autoFocus={focusNote}
        rows={3}
        maxLength={NOTE_MAX}
        value={draft}
        aria-label={t('booksHlNoteLabel')}
        placeholder={t('booksHlNotePlaceholder')}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.stopPropagation(); onClose() }
          else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save() }
        }}
      />
      <div className={styles.hlPopActions}>
        <button type="button" className={`${styles.hlTextBtn} ${styles.hlDanger}`} onClick={() => { onRemove(); onClose() }}>
          <Trash2Icon size={14} />{t('booksHlDelete')}
        </button>
        <button type="button" className={`${styles.hlTextBtn} ${styles.hlPrimary}`} onClick={save}>
          <CheckIcon size={14} />{t('booksHlNoteSave')}
        </button>
      </div>
    </div>
  )
}

/** The «Выделения» tab: highlights in book order, jump / edit comment / delete. */
export function HighlightList({ items, isHere, hint, onJump, onSaveNote, onRemove }: {
  items: BookHighlight[]
  isHere: (page: number) => boolean
  /** Extra line under the empty state (the visible pages have no text layer). */
  hint: boolean
  onJump: (h: BookHighlight) => void
  onSaveNote: (id: string, note: string | null) => void
  onRemove: (id: string) => void
}) {
  const t = useTranslations('files')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  if (items.length === 0) {
    return (
      <div className={styles.panelEmpty}>
        <p>{t('booksHlEmpty')}</p>
        {hint && <p>{t('booksHlNoTextLayer')}</p>}
      </div>
    )
  }
  return (
    <ul className={styles.list}>
      {items.map(h => (
        <li key={h.id} className={`${styles.item} ${styles.hlItem} ${isHere(h.page) ? styles.itemHere : ''}`}>
          <span className={styles.hlStripe} data-color={h.color} aria-hidden="true" />
          {editing?.id === h.id ? (
            <form
              className={styles.hlEditRow}
              onSubmit={e => {
                e.preventDefault()
                const next = editing.text.trim() || null
                if (next !== h.note) onSaveNote(h.id, next)
                setEditing(null)
              }}
            >
              <textarea
                        autoFocus
                className={styles.hlNote}
                rows={3}
                maxLength={NOTE_MAX}
                value={editing.text}
                aria-label={t('booksHlNoteLabel')}
                placeholder={t('booksHlNotePlaceholder')}
                onChange={e => setEditing({ id: h.id, text: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) }
                  else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit() }
                }}
              />
              <button type="submit" className={styles.iconBtn} aria-label={t('booksHlNoteSave')} title={t('booksHlNoteSave')}><CheckIcon size={15} /></button>
            </form>
          ) : (
            <>
              <button type="button" className={styles.itemMain} onClick={() => onJump(h)} aria-label={t('booksHlGoto', { page: h.page })}>
                <span className={styles.itemPage}>{t('booksReaderBookmarkPage', { page: h.page })}</span>
                <span className={styles.hlItemQuote}>{excerpt(h.text)}</span>
                {h.note && <span className={styles.hlItemNote}><MessageSquareIcon size={12} />{h.note}</span>}
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => setEditing({ id: h.id, text: h.note ?? '' })} aria-label={t('booksHlEditNote')} title={t('booksHlEditNote')}><PencilIcon size={14} /></button>
              <button type="button" className={styles.iconBtn} onClick={() => onRemove(h.id)} aria-label={t('booksHlDelete')} title={t('booksHlDelete')}><Trash2Icon size={14} /></button>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
